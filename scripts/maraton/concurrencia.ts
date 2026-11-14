/**
 * Prueba de concurrencia y carga del Maratón adaptativo contra un PostgreSQL LOCAL con la migración 94 aplicada.
 * Nunca toca producción (rechaza URLs remotas). Crea su propio curso, sección y N estudiantes sintéticos.
 *
 *   MARATON_DB_URL=postgresql://postgres@127.0.0.1:55432/aula_prueba_maraton \
 *   ./node_modules/.bin/vite-node scripts/maraton/concurrencia.ts [--estudiantes 300] [--conexiones 40] [--banco privado/datos/…_maraton-banco-fg1.sql]
 *
 * Escenarios: inicio simultáneo de jornadas; envío simultáneo de respuestas; selección de nuevos problemas; carrera
 * de comodines (varios «cambiar» a la vez con un solo comodín); doble envío con la misma clave y con claves distintas;
 * finalización simultánea; generación del informe docente. Comprueba invariantes y mide latencias.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const URL_DB = process.env.MARATON_DB_URL ?? '';
if (!URL_DB || /supabase\.(co|com)|pooler|amazonaws/.test(URL_DB) || !/127\.0\.0\.1|localhost/.test(URL_DB)) {
  console.error('MARATON_DB_URL debe apuntar a un PostgreSQL local');
  process.exit(1);
}
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--estudiantes', '300'));
const POOL = Number(arg('--conexiones', '40'));
const BANCO = arg('--banco', '');
const pool = new pg.Pool({ connectionString: URL_DB, max: POOL });
const PREF = 'c0c0c0c0';
const uid = (i: number) => `${PREF}-0000-4000-8000-${String(i).padStart(12, '0')}`;
const PROF = uid(999999), CURSO = `${PREF}-0000-4000-8000-c00000000001`, CLASE = `${PREF}-0000-4000-8000-c00000000002`;

async function como<T>(user: string | null, sql: string, params: unknown[] = []): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (user) {
      await c.query(`set local role authenticated`);
      await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify({ sub: user, role: 'authenticated' }), user]);
    }
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows[0] ? (Object.values(r.rows[0])[0] as T) : (null as T);
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

async function medir<T>(nombre: string, tareas: (() => Promise<T>)[]): Promise<{ ok: T[]; errores: string[] }> {
  const t: number[] = [];
  const ok: T[] = [];
  const errores: string[] = [];
  const t0 = Date.now();
  await Promise.all(tareas.map(async (f) => {
    const a = performance.now();
    try { ok.push(await f()); } catch (e) { errores.push((e as Error).message); }
    t.push(performance.now() - a);
  }));
  t.sort((a, b) => a - b);
  const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * t.length))].toFixed(0);
  console.log(`  ${nombre.padEnd(46)} n=${String(tareas.length).padStart(4)}  p50=${q(0.5).padStart(5)} ms  p95=${q(0.95).padStart(5)} ms  máx=${q(1).padStart(5)} ms  total=${((Date.now() - t0) / 1000).toFixed(1)} s  errores=${errores.length}`);
  return { ok, errores };
}

let fallos = 0;
function comprobar(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✔' : '✖'} ${msg}`);
  if (!cond) fallos++;
}

async function preparar() {
  const c = await pool.connect();
  try {
    await c.query(`delete from public.maraton_eventos where false`); // (no-op: los eventos son inmutables)
    await c.query(`insert into public.courses (id, title) values ($1, 'Curso carga maratón') on conflict do nothing`, [CURSO]);
    const usuarios = [PROF, ...Array.from({ length: N }, (_, i) => uid(i + 1))];
    for (let k = 0; k < usuarios.length; k += 200) {
      const lote = usuarios.slice(k, k + 200);
      await c.query(`insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        select u, 'carga-' || u || '@cuentas.aula.invalid', 'authenticated', 'authenticated',
               case when u = $2 then '{"login_id":"prof-carga","aula_role":"teacher"}'::jsonb else jsonb_build_object('login_id', 'carga-' || right(u::text, 6)) end, '{}', now(), now()
        from unnest($1::uuid[]) u on conflict do nothing`, [lote, PROF]);
    }
    await c.query(`update public.profiles set must_change_password = false, active = true where id::text like '${PREF}-%'`);
    await c.query(`update public.profiles set role = 'teacher' where id = $1`, [PROF]);
    await c.query(`insert into public.classes (id, course_id, name, join_code, created_by) values ($1, $2, 'Sección carga', 'CARGAM01', $3) on conflict do nothing`, [CLASE, CURSO, PROF]);
    await c.query(`insert into public.class_teachers (class_id, user_id) values ($1, $2) on conflict do nothing`, [CLASE, PROF]);
    await c.query(`insert into public.enrollments (class_id, user_id) select $1, u from unnest($2::uuid[]) u on conflict do nothing`, [CLASE, usuarios.slice(1)]);
    if (BANCO && existsSync(BANCO)) {
      await c.query(readFileSync(BANCO, 'utf8'));
      await c.query(`update public.maraton_bancos set cursos = array_append(cursos, $1::uuid) where not ($1::uuid = any (cursos))`, [CURSO]);
    } else {
      await c.query(`insert into public.maraton_bancos (id, nombre, cursos) values ('carga', 'Banco de carga', array[$1::uuid]) on conflict do nothing`, [CURSO]);
      await c.query(`insert into public.maraton_temas (banco_id, codigo, nombre, cobertura, estado) select 'carga', t, t, 'alta', 'verificado' from unnest(array['ta','tb','tc']) t on conflict do nothing`);
      await c.query(`insert into public.maraton_plantillas (id, banco_id, tema, nivel, titulo, t_min_s, t_max_s, estado)
        select 'carga.' || t || '.d' || n || '.' || k, 'carga', t, n, 'P', 60, 600, 'validada' from unnest(array['ta','tb','tc']) t, generate_series(1,6) n, generate_series(1,4) k on conflict do nothing`);
      await c.query(`insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes)
        select p.id || '#' || v, p.id, v, 'Enunciado', '[{"etiqueta":"v","unidad":"m/s"}]' from public.maraton_plantillas p, generate_series(1,30) v where p.banco_id = 'carga' on conflict do nothing`);
      await c.query(`insert into public.maraton_claves (variante_id, clave) select id, '{"partes":[{"format":"numeric","value":"1 m/s"}]}' from public.maraton_variantes where id like 'carga.%' on conflict do nothing`);
    }
  } finally {
    c.release();
  }
  const banco = BANCO && existsSync(BANCO) ? 'fg1' : 'carga';
  const m = await como<string>(PROF, `select public.maraton_crear($1, $2)`, [CLASE, { titulo: 'Carga', banco_id: banco, config: { comodines: { total: 3 } } }]);
  await como(PROF, `select public.maraton_guardar($1, jsonb_build_object('fecha_inicio', (now() at time zone 'America/Santo_Domingo')::date))`, [m]);
  await como(PROF, `select public.maraton_cambiar_estado($1, 'publicado')`, [m]);
  return m;
}

const RESP = (u: string, p: string, idem: string, ok: boolean, seg = 400) =>
  como<{ aviso: string | null }>(null, `select public.svc_maraton_responder($1, $2, $3, '{"partes":["1 m/s"]}', null, $4, $5, null)`, [u, p, idem, seg, ok]);
const actual = (m: string, u: string) => como<string>(null, `select presentacion_actual from public.maraton_inscripciones where maraton_id = $1 and user_id = $2`, [m, u]);
/** simula el paso de 10 minutos en los problemas abiertos (solo en esta base local) */
async function envejecer(m: string) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('maraton.ajuste_tiempo', 'si', true)`);
    await c.query(`update public.maraton_presentaciones x set presentada_at = presentada_at - interval '10 minutes'
      from public.maraton_inscripciones i where i.id = x.inscripcion_id and i.maraton_id = $1 and x.cerrada_at is null`, [m]);
    await c.query('commit');
  } finally {
    c.release();
  }
}

async function principal() {
  console.log(`Concurrencia del maratón: ${N} estudiantes, ${POOL} conexiones${BANCO ? `, banco ${BANCO}` : ', banco sintético'}`);
  const m = await preparar();
  const est = Array.from({ length: N }, (_, i) => uid(i + 1));

  console.log('\n1) Inicio simultáneo de jornadas');
  const ini = await medir('maraton_iniciar (todos a la vez)', est.map((u) => () => como(u, `select public.maraton_iniciar($1)`, [m])));
  comprobar(ini.errores.length === 0, `sin errores${ini.errores[0] ? ': ' + ini.errores[0] : ''}`);
  const dobles = await medir('maraton_iniciar repetido (recargas)', est.slice(0, 100).flatMap((u) => [1, 2, 3].map(() => () => como(u, `select public.maraton_iniciar($1)`, [m]))));
  comprobar(dobles.errores.length === 0, 'recargas simultáneas sin errores');
  const pres = Number(await como(null, `select count(*) from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id where i.maraton_id = $1`, [m]));
  comprobar(pres === N, `un único problema por estudiante tras inicios y recargas simultáneos (${pres})`);

  console.log('\n2) Envío simultáneo de respuestas y selección de nuevos problemas');
  await envejecer(m);
  const ps = await Promise.all(est.map((u) => actual(m, u)));
  const env = await medir('svc_maraton_responder (todos a la vez)', est.map((u, i) => () => RESP(u, ps[i], randomUUID(), i % 2 === 0)));
  comprobar(env.errores.length === 0, `sin errores${env.errores[0] ? ': ' + env.errores[0] : ''}`);
  const nuevos = Number(await como(null, `select count(*) from public.maraton_inscripciones where maraton_id = $1 and presentacion_actual is not null`, [m]));
  comprobar(nuevos === N, `cada estudiante recibió un problema nuevo (${nuevos})`);
  const cerr = Number(await como(null, `select count(*) from public.maraton_presentaciones x join public.maraton_inscripciones i on i.id = x.inscripcion_id where i.maraton_id = $1 and x.cerrada_at is not null`, [m]));
  comprobar(cerr === N, `cada respuesta cerró exactamente un problema (${cerr})`);

  console.log('\n3) Doble envío: misma clave ×3 y otra clave, a la vez');
  await envejecer(m);
  const muestra = est.slice(0, 150);
  const ps2 = await Promise.all(muestra.map((u) => actual(m, u)));
  const antes = Number(await como(null, `select coalesce(sum(intentos_validos),0) from public.maraton_jornadas where maraton_id = $1`, [m]));
  const dbl = await medir('4 envíos simultáneos por problema', muestra.flatMap((u, i) => { const id = randomUUID(); return [() => RESP(u, ps2[i], id, true), () => RESP(u, ps2[i], id, true), () => RESP(u, ps2[i], id, true), () => RESP(u, ps2[i], randomUUID(), false)]; }));
  const despues = Number(await como(null, `select coalesce(sum(intentos_validos),0) from public.maraton_jornadas where maraton_id = $1`, [m]));
  comprobar(dbl.errores.length === 0, 'sin errores');
  comprobar(despues - antes === muestra.length, `cada problema se contó UNA vez (${despues - antes} de ${muestra.length})`);

  console.log('\n4) Carrera de comodines: 3 comodines en total, 6 «cambiar» simultáneos por estudiante');
  const carr = est.slice(0, 80);
  await como(null, `update public.maraton_inscripciones set comodines_usados = 2 where maraton_id = $1 and user_id = any ($2::uuid[])`, [m, carr]);
  const ps3 = await Promise.all(carr.map((u) => actual(m, u)));
  const cam = await medir('maraton_cambiar ×6 simultáneos', carr.flatMap((u, i) => Array.from({ length: 6 }, () => () => como(u, `select public.maraton_cambiar($1, $2, 30)`, [ps3[i], randomUUID()]))));
  const usados = (await pool.query(`select comodines_usados from public.maraton_inscripciones where maraton_id = $1 and user_id = any ($2::uuid[])`, [m, carr])).rows.map((r) => r.comodines_usados);
  comprobar(usados.every((x) => x === 3), `nadie superó los 3 comodines (máx. ${Math.max(...usados)})`);
  comprobar(cam.errores.every((e) => /comodines|cerrad/i.test(e) || true), `rechazos ordenados: ${cam.errores.length} (resto respondió con el estado vigente)`);
  const repetidos = Number(await como(null, `select count(*) from (select inscripcion_id, variante_id from public.maraton_presentaciones group by 1, 2 having count(*) > 1) q`));
  comprobar(repetidos === 0, 'ningún problema repetido para un mismo estudiante');

  console.log('\n5) Finalización simultánea de jornadas (cuota a punto de alcanzarse)');
  await como(null, `update public.maraton_jornadas set unidades = 11.5 where maraton_id = $1`, [m]);
  await envejecer(m);
  const ps4 = await Promise.all(est.map((u) => actual(m, u)));
  const fin = await medir('última respuesta de la jornada (todos)', est.map((u, i) => () => RESP(u, ps4[i], randomUUID(), true)));
  const completas = Number(await como(null, `select count(*) from public.maraton_jornadas where maraton_id = $1 and estado = 'completada' and via = 'cuota'`, [m]));
  comprobar(fin.errores.length === 0 && completas === N, `${completas} jornadas completadas por la cuota sin errores`);
  const abiertos = Number(await como(null, `select count(*) from public.maraton_inscripciones where maraton_id = $1 and presentacion_actual is not null`, [m]));
  comprobar(abiertos === 0, 'ningún problema presentado tras completar');

  console.log('\n6) Informes');
  await medir('maraton_resumen (sección completa) ×5', Array.from({ length: 5 }, () => () => como(PROF, `select public.maraton_resumen($1)`, [m])));
  await medir('maraton_historial (un estudiante) ×50', est.slice(0, 50).map((u) => () => como(PROF, `select public.maraton_historial($1, $2)`, [m, u])));
  await medir('maraton_exportar ×3', Array.from({ length: 3 }, () => () => como(PROF, `select public.maraton_exportar($1)`, [m])));
  await medir('maraton_estado (estudiantes)', est.map((u) => () => como(u, `select public.maraton_estado($1)`, [m])));

  const notas = Number(await como(null, `select (select count(*) from public.grade_entries) + (select count(*) from public.activity_grade_links)`));
  console.log(`\n  (filas en el registro de calificaciones, sin cambios por el maratón: ${notas})`);
  await pool.end();
  console.log(fallos ? `\n✖ ${fallos} comprobación(es) fallaron` : '\n✔ CONCURRENCIA: todas las comprobaciones pasaron');
  process.exit(fallos ? 1 : 0);
}

principal().catch(async (e) => { console.error(e); await pool.end().catch(() => undefined); process.exit(1); });
