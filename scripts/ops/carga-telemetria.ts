/**
 * Prueba de CARGA de la Telemetría V2 (caso S) contra la base LOCAL de pruebas (aula_prueba), nunca contra producción.
 *
 *   npm run probar            (deja aula_prueba con todas las migraciones)
 *   npm run carga-telemetria  [-- --estudiantes 60 --lotes 20 --tamano 50 --concurrencia 20]
 *
 * Simula N estudiantes de una sección que envían a la vez lotes de eventos V2 (telemetry_v2_ingest) y guardan
 * respuestas (save_response, que dispara el historial de revisiones). Mide latencia (p50/p95/p99), ritmo, idempotencia
 * (reenviar un lote no duplica) y espacio ocupado. Crea datos sintéticos (prefijo c4000000-…) y los BORRA al terminar.
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { credenciales, fallar } from './comun';

const arg = (k: string, def: number) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Math.max(1, Number(process.argv[i + 1]) || def) : def; };
const N = arg('estudiantes', 60), LOTES = arg('lotes', 20), TAM = Math.min(200, arg('tamano', 50)), CONC = arg('concurrencia', 20);
const P = 'c4000000-0000-4000-8000-';
const id = (n: number) => `${P}${String(n).padStart(12, '0')}`;
const CURSO = id(900001), CLASE = id(900002), ACT = id(900003), PROF = id(900004);
const EJ = [id(900011), id(900012), id(900013)];
const est = (k: number) => id(100000 + k), intento = (k: number) => id(200000 + k);

function percentil(xs: number[], p: number) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; }

async function main() {
  const c = credenciales();
  const url = c.LOCAL_DB_URL;
  if (!url || /supabase\.(co|com)|pooler|amazonaws/.test(url)) fallar('LOCAL_DB_URL no es una base local. La prueba de carga solo se ejecuta en local.');
  if (!/\/aula_prueba[\w]*(\?|$)/.test(url)) fallar('Por seguridad, la base debe llamarse aula_prueba… (ejecute antes npm run probar).');
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  // orden: usuarios (en cascada: intentos, respuestas, eventos, revisiones) → sección (su asignatura es «restrict») → asignatura
  const limpiar = async () => {
    await admin.query(`delete from auth.users where id::text like $1`, [`${P}%`]);
    await admin.query(`delete from public.classes where id = $1`, [CLASE]);
    await admin.query(`delete from public.courses where id = $1`, [CURSO]);
  };
  await limpiar();
  console.log(`Preparando ${N} estudiantes, ${LOTES} lotes de ${TAM} eventos cada uno, ${CONC} conexiones simultáneas…`);
  await admin.query(`insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    select x.id::uuid, x.id || '@carga.aula.invalid', 'authenticated', 'authenticated', jsonb_build_object('login_id', 'carga-' || right(x.id, 12)), '{}', now(), now()
    from unnest($1::text[]) x(id)`, [[PROF, ...Array.from({ length: N }, (_, k) => est(k))]]);
  await admin.query(`update public.profiles set must_change_password = false, active = true where id::text like $1`, [`${P}%`]);
  await admin.query(`update public.profiles set role = 'teacher' where id = $1`, [PROF]);
  await admin.query(`insert into public.courses (id, title) values ($1, 'Carga telemetría')`, [CURSO]);
  for (const [k, e] of EJ.entries()) {
    await admin.query(`insert into public.exercises (id, course_id, slug, category, difficulty, role, format, prompt, points) values ($1, $2, $3, 'numerica', 'basico', 'bank', 'numeric', 'P', 1)`, [e, CURSO, `carga-${k}`]);
  }
  await admin.query(`insert into public.classes (id, course_id, name, join_code, created_by) values ($1, $2, 'Carga', 'CARGA001', $3)`, [CLASE, CURSO, PROF]);
  await admin.query(`insert into public.enrollments (class_id, user_id) select $1, x::uuid from unnest($2::text[]) x`, [CLASE, Array.from({ length: N }, (_, k) => est(k))]);
  await admin.query(`insert into public.activities (id, class_id, title, mode, published, reveal_policy, hints_enabled) values ($1, $2, 'Carga', 'practice', true, 'immediate', false)`, [ACT, CLASE]);
  for (const [k, e] of EJ.entries()) await admin.query(`insert into public.activity_items (activity_id, exercise_id, position) values ($1, $2, $3)`, [ACT, e, k + 1]);
  await admin.query(`insert into public.attempts (id, user_id, course_id, activity_id, mode) select ('${P}' || lpad((200000 + k)::text, 12, '0'))::uuid,
    ('${P}' || lpad((100000 + k)::text, 12, '0'))::uuid, $1, $2, 'practice' from generate_series(0, $3 - 1) k`, [CURSO, ACT, N]);
  await admin.query(`insert into public.telemetry_v2_flags (course_id, activo) values ($1, true)`, [CURSO]);
  const antes = await admin.query(`select pg_total_relation_size('public.telemetry_v2_events') as ev, pg_total_relation_size('public.response_revisions') as rv`);

  // trabajadores: cada conexión atiende a varios estudiantes en turno
  const latIngesta: number[] = [], latGuardar: number[] = [];
  let aceptados = 0, rechazados = 0, errores = 0;
  const trabajador = async (w: number) => {
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    await db.query(`set role authenticated`);
    const mios = Array.from({ length: N }, (_, k) => k).filter((k) => k % CONC === w);
    const sesion = new Map(mios.map((k) => [k, randomUUID()]));
    const seq = new Map(mios.map((k) => [k, 0]));
    for (let l = 0; l < LOTES; l++) {
      for (const k of mios) {
        await db.query(`select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)`, [JSON.stringify({ sub: est(k), role: 'authenticated' }), est(k)]);
        const lote = Array.from({ length: TAM }, (_, i) => {
          const s = seq.get(k)! + 1; seq.set(k, s);
          const tipos = ['heartbeat', 'question_activated', 'answer_draft_changed', 'page_visible', 'question_exposure_started'];
          return { event_id: randomUUID(), attempt_id: intento(k), session_id: sesion.get(k), client_seq: s, event_type: tipos[(s + i) % tipos.length],
            question_id: s % 5 === 1 || s % 5 === 2 || s % 5 === 4 ? EJ[s % 3] : null, t_mono: s * 1000, visibility: 'visible', connectivity: 'online',
            payload: { len: s % 40, h: (s * 2654435761 >>> 0).toString(16).slice(0, 8), pendientes: 0 } };
        });
        const t0 = performance.now();
        try {
          const r = (await db.query(`select public.telemetry_v2_ingest($1::jsonb) as r`, [JSON.stringify(lote)])).rows[0].r;
          aceptados += r.aceptados; rechazados += r.rechazados;
        } catch { errores++; }
        latIngesta.push(performance.now() - t0);
        if (l % 4 === 0) {
          const t1 = performance.now();
          try { await db.query(`select public.save_response($1, $2, $3::jsonb)`, [intento(k), EJ[l % 3], JSON.stringify({ text: `${l} m/s` })]); } catch { errores++; }
          latGuardar.push(performance.now() - t1);
        }
      }
    }
    await db.end();
  };
  const inicio = performance.now();
  await Promise.all(Array.from({ length: Math.min(CONC, N) }, (_, w) => trabajador(w)));
  const total = (performance.now() - inicio) / 1000;

  // idempotencia: reenviar un lote ya aceptado no inserta nada
  const filas = Number((await admin.query(`select count(*) from public.telemetry_v2_events where attempt_id::text like $1`, [`${P}%`])).rows[0].count);
  const rev = Number((await admin.query(`select count(*) from public.response_revisions where attempt_id::text like $1`, [`${P}%`])).rows[0].count);
  const despues = await admin.query(`select pg_total_relation_size('public.telemetry_v2_events') as ev, pg_total_relation_size('public.response_revisions') as rv`);
  const dup = await (async () => {
    const db = new pg.Client({ connectionString: url }); await db.connect();
    await db.query(`set role authenticated`);
    await db.query(`select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)`, [JSON.stringify({ sub: est(0), role: 'authenticated' }), est(0)]);
    const ev = (await admin.query(`select event_id, session_id, client_seq, event_type, t_mono from public.telemetry_v2_events where attempt_id = $1 order by client_seq limit 50`, [intento(0)])).rows
      .map((e) => ({ ...e, attempt_id: intento(0) }));
    const r = (await db.query(`select public.telemetry_v2_ingest($1::jsonb) as r`, [JSON.stringify(ev)])).rows[0].r;
    await db.end();
    return { enviados: ev.length, ...r };
  })();

  const esperados = N * LOTES * TAM;
  const kb = (b: unknown) => Math.round(Number(b) / 1024);
  console.log('\n— Resultados —');
  console.log(`Eventos: enviados ${esperados}, aceptados ${aceptados}, rechazados ${rechazados}, en la tabla ${filas}; errores de conexión o SQL: ${errores}`);
  console.log(`Ritmo: ${Math.round(esperados / total)} eventos/s en ${total.toFixed(1)} s (${N * LOTES} lotes de ${TAM})`);
  console.log(`Latencia de la ingesta por lote: p50 ${percentil(latIngesta, 0.5).toFixed(0)} ms · p95 ${percentil(latIngesta, 0.95).toFixed(0)} ms · p99 ${percentil(latIngesta, 0.99).toFixed(0)} ms · máx ${Math.max(...latIngesta).toFixed(0)} ms`);
  console.log(`Latencia de save_response (con historial de revisiones): p50 ${percentil(latGuardar, 0.5).toFixed(0)} ms · p95 ${percentil(latGuardar, 0.95).toFixed(0)} ms`);
  console.log(`Revisiones registradas: ${rev} (guardados seguidos < 20 s se consolidan)`);
  console.log(`Espacio: telemetry_v2_events +${kb(Number(despues.rows[0].ev) - Number(antes.rows[0].ev))} KB (≈ ${filas ? Math.round((Number(despues.rows[0].ev) - Number(antes.rows[0].ev)) / filas) : 0} B por evento con índices) · response_revisions +${kb(Number(despues.rows[0].rv) - Number(antes.rows[0].rv))} KB`);
  console.log(`Idempotencia: reenviados ${dup.enviados} eventos ya guardados → aceptados ${dup.aceptados}, duplicados ${dup.duplicados}`);
  const ok = errores === 0 && filas === aceptados && aceptados === esperados && dup.aceptados === 0;
  await limpiar();
  await admin.end();
  console.log(ok ? '\n✔ CARGA: sin errores, sin pérdidas y sin duplicados. Datos sintéticos borrados.' : '\n✖ CARGA: revise los números de arriba (datos sintéticos borrados).');
  process.exit(ok ? 0 : 1);
}

void main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
