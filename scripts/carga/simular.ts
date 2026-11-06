/**
 * Pruebas de carga del aula a nivel de BASE DE DATOS, sobre la copia LOCAL del último respaldo (nunca producción).
 *
 * Imita lo que PostgREST hace por cada petición del navegador (una transacción con el rol y el JWT del estudiante y la
 * misma función SQL) siguiendo el CALENDARIO de peticiones del aula, en dos perfiles:
 *   · «antes»:   el aula anterior al modo de bajo consumo (latido 25 s, sondeos de 10–20 s, telemetría V1+V2 cada 10 s…);
 *   · «despues»: el modo de bajo consumo (src/lib/consumo.ts + migraciones 87 y 88; con SIN_88=1, sin la 88).
 * «Comprobar» y «Entregar» ejecutan el código real de la Edge Function calificar (handler.ts) con rol de servicio.
 * Qué NO incluye: red, pasarela de Supabase, PostgREST, GoTrue (inicio de sesión), Realtime, ni el arranque en frío de
 * Deno. Antes de cada prueba se instalan las funciones del perfil (migración 87 o su reversión) y se fuerza un punto de
 * control para que las páginas completas en el WAL (full-page writes) cuenten igual en todas las pruebas.
 *
 * Uso: vite-node scripts/carga/simular.ts -- <perfil> <modo> <estudiantes> <minutos> [etiqueta]
 *   perfil: antes | despues     modo: entrada (todos entran en 10 s) | sostenida (rampa de 60 s)
 * Resultados: privado/carga/<etiqueta>.json y una fila en privado/carga/resultados.csv
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { handle, type Db } from '../../supabase/functions/calificar/handler';
import { arrancar, cpuPostgresMs, escrituraDiscoBytes, parar, rssPostgresMb, URL_DB } from './servidor';

const args = process.argv.slice(2).filter((a) => a !== '--');
const [PERFIL = 'despues', MODO = 'sostenida', nArg = '5', minArg = '3', etiquetaArg] = args;
if (PERFIL !== 'antes' && PERFIL !== 'despues') throw new Error('perfil: antes | despues');
if (MODO !== 'entrada' && MODO !== 'sostenida') throw new Error('modo: entrada | sostenida');
const N = Number(nArg), MINUTOS = Number(minArg);
const ETIQUETA = etiquetaArg ?? `${PERFIL}-${MODO}-${N}`;
const POOL = 10;   // conexiones de PostgREST hacia la base (orden de magnitud de una instancia pequeña)

/** Calendario de peticiones del navegador, en ms. 0 = no se hace. */
const PERFILES = {
  antes: {
    presencia: 25_000, mensajes: 60_000, bloqueo: 20_000, control: 10_000, avisoAsistencia: 30_000, botonAsistencia: 20_000,
    pregunta: 15_000, estudio: 15_000, rutaMin: 0, oculto: { presencia: true, bloqueo: true, mensajes: true, pregunta: true },
    telV1: true, telV2: true, vaciado: 10_000, cuentaPresenciaVolver: 0, saltoPresencia: false,
    prof: { onlinePorLatido: true, espera: 600, online: 10_000, historial: 20_000, alertas: 120_000 },
  },
  despues: {
    presencia: 50_000, mensajes: 120_000, bloqueo: 90_000, control: 20_000, avisoAsistencia: 60_000, botonAsistencia: 30_000,
    pregunta: 90_000, estudio: 45_000, rutaMin: 30_000, oculto: { presencia: true, bloqueo: false, mensajes: false, pregunta: false },
    telV1: false, telV2: true, vaciado: 30_000, cuentaPresenciaVolver: 300_000, saltoPresencia: true,
    prof: { onlinePorLatido: false, espera: 2_000, online: 20_000, historial: 45_000, alertas: 900_000 },
  },
} as const;
const P = PERFILES[PERFIL];
const BD = (process.env.BD ?? PERFIL) as 'antes' | 'despues';
if (BD !== 'antes' && BD !== 'despues') throw new Error('BD: antes | despues');
// Caducidad efectiva de la presencia en Orbe Control: la del servidor (control_online) y la del propio panel (EXPIRA_S)
const CADUCA_S = Math.min(BD === 'despues' ? 150 : 75, PERFIL === 'despues' ? 150 : 75);
const ESTRANGULAR = !!process.env.ESTRANGULAR;
const conectados = new Set<string>();   // estudiantes con la pestaña abierta (tras su primer latido)
const presencia = { muestras: 0, con_falsos: 0, falsos_max: 0, falsos_total: 0, edad_max_s: 0 };

const ACT = 'cafe0000-0000-4000-8000-0000000000a1';
// Orbe Control lo usa el administrador (en producción, el profesor es el administrador): se toma el de la copia
let PROF = 'cafe0000-0000-4000-8000-000000000001';
const uid = (i: number) => `cafe0000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`;

// ---------------------------------------------------------------------------------------------------------------
type Muestra = { op: string; ms: number; ok: boolean; err?: string; t: number; usuario: string };
const muestras: Muestra[] = [];
const cargas: number[] = [];   // tiempo de la carga inicial del aula por estudiante (ms, peticiones en paralelo como el navegador)
const pool = new pg.Pool({ connectionString: URL_DB, max: POOL, idleTimeoutMillis: 0 });
const lit = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : pg.Client.prototype.escapeLiteral.call(null, typeof v === 'string' ? v : JSON.stringify(v)));
const ERROR = Symbol('error');
// una petición rezagada tras cerrar el grupo de conexiones no debe tumbar el proceso (los resultados ya están escritos)
process.on('unhandledRejection', (e) => console.error('rechazo no atendido (ignorado):', String(e).slice(0, 200)));
let ultimoError = '';
const sesiones = new Map<string, string>();

async function rpc(op: string, usuario: string | null, fn: string, a: Record<string, unknown> | unknown[] = {}, rol = 'authenticated'): Promise<unknown> {
  const t0 = performance.now();
  let c: pg.PoolClient | null = null;
  try {
    c = await pool.connect();
    const claims = usuario ? JSON.stringify({ sub: usuario, role: rol, session_id: sesiones.get(usuario) ?? null }) : JSON.stringify({ role: rol });
    const lista = Array.isArray(a) ? a.map(lit).join(', ')
      : Object.entries(a).map(([k, v]) => `${k} := ${lit(v)}${typeof v === 'object' && v !== null ? '::jsonb' : ''}`).join(', ');
    const sql = `begin; select set_config('role', ${lit(rol)}, true), set_config('request.jwt.claims', ${lit(claims)}, true), set_config('request.jwt.claim.sub', ${lit(usuario ?? '')}, true), set_config('request.path', ${lit('/rpc/' + fn)}, true); select public.${fn}(${lista}) as r; commit;`;
    const res = (await c.query(sql)) as unknown as pg.QueryResult[];
    muestras.push({ op, ms: performance.now() - t0, ok: true, t: Date.now(), usuario: usuario ?? '' });
    return res[2]?.rows?.[0]?.r;
  } catch (e) {
    const m = e as { code?: string; message?: string };
    try { await c?.query('rollback'); } catch { /* */ }
    muestras.push({ op, ms: performance.now() - t0, ok: false, err: `${m.code ?? 'X'}:${(m.message ?? '').slice(0, 70)}`, t: Date.now(), usuario: usuario ?? '' });
    ultimoError = m.message ?? 'error';
    return ERROR;
  } finally { c?.release(); }
}
async function leer(op: string, usuario: string, sqlSelect: string) {
  const t0 = performance.now();
  let c: pg.PoolClient;
  try { c = await pool.connect(); } catch (e) {
    muestras.push({ op, ms: performance.now() - t0, ok: false, err: String((e as Error).message).slice(0, 70), t: Date.now(), usuario });
    return;
  }
  try {
    await c.query(`begin; select set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: usuario, role: 'authenticated' }))}, true), set_config('request.jwt.claim.sub', ${lit(usuario)}, true), set_config('request.path', '/rest/v1/x', true); ${sqlSelect}; commit;`);
    muestras.push({ op, ms: performance.now() - t0, ok: true, t: Date.now(), usuario });
  } catch (e) {
    try { await c.query('rollback'); } catch { /* */ }
    muestras.push({ op, ms: performance.now() - t0, ok: false, err: String((e as Error).message).slice(0, 70), t: Date.now(), usuario });
  } finally { c.release(); }
}
const dbServicio: Db = { rpc: async (fn, a) => {
  const d = await rpc(`svc:${fn}`, null, fn, a as Record<string, unknown>, 'service_role');
  return d === ERROR ? { data: null, error: { message: ultimoError } } : { data: d, error: null };
} };

// ---------------------------------------------------------------------------------------------------------------
const fin = { t: 0 };
const vivo = () => Date.now() < fin.t;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, fin.t ? Math.max(0, Math.min(ms, fin.t - Date.now() + 50)) : ms));
const logn = (mediana_s: number, sigma = 0.6) => mediana_s * Math.exp(sigma * Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random())) * 1000;
/** Temporizador del navegador (con la variación habitual de los setInterval). `cuando` decide si en ese tic se consulta. */
function cada(ms: number, f: () => Promise<unknown> | void, cuando: () => boolean = () => true) {
  if (!ms) return Promise.resolve();
  return (async () => { await dormir(Math.random() * ms); while (vivo()) { if (cuando()) await f(); await dormir(ms * (0.97 + 0.06 * Math.random())); } })();
}

// Orbe Control (el profesor con el panel abierto): reacciona a los latidos de presencia como el panel real
const prof = { pendiente: undefined as NodeJS.Timeout | undefined, ultima: 0, conocidos: new Map<string, boolean>() };
function eventoPresencia(usuario: string, visible: boolean, escribio: boolean) {
  if (!vivo()) return;
  if (!escribio) return;   // sin escritura no hay evento de Realtime
  const nuevo = !prof.conocidos.has(usuario) || prof.conocidos.get(usuario) !== visible;
  prof.conocidos.set(usuario, visible);
  if (P.prof.onlinePorLatido) {   // antes: cada latido reinicia una espera de 600 ms y recarga
    clearTimeout(prof.pendiente);
    prof.pendiente = setTimeout(() => void rpc('prof:control_online', PROF, 'control_online'), P.prof.espera);
  } else if (nuevo) {             // después: solo altas y cambios de visibilidad, como mucho una recarga cada 2 s
    const falta = prof.ultima + P.prof.espera - Date.now();
    if (falta <= 0) { prof.ultima = Date.now(); void rpc('prof:control_online', PROF, 'control_online'); }
    else if (!prof.pendiente) prof.pendiente = setTimeout(() => { prof.pendiente = undefined; prof.ultima = Date.now(); void rpc('prof:control_online', PROF, 'control_online'); }, falta);
  }
}
async function profesor() {
  await rpc('prof:control_online', PROF, 'control_online');
  await Promise.all([
    cada(P.prof.online, () => rpc('prof:control_online', PROF, 'control_online')),
    cada(P.prof.historial, async () => { await rpc('prof:live_message_history', PROF, 'live_message_history', [null, 8]); await rpc('prof:active_screen_locks', PROF, 'active_screen_locks'); }),
    cada(P.prof.alertas, async () => { await rpc('prof:sec_detections', PROF, 'sec_detections', { p_hours: 24 }); await rpc('prof:sec_access_after_failures', PROF, 'sec_access_after_failures', { p_days: 1 }); }),
  ]);
}

// Telemetría (frecuencias medidas en producción: V1 p50 4,4 ev/min, p90 11,5; V2 p50 5,3, p90 20,9)
const TASA_V1 = () => (Math.random() < 0.1 ? 11.5 : 4.4), TASA_V2 = () => (Math.random() < 0.1 ? 20.9 : 5.3);
const TIPOS_V1 = ['pregunta_vista', 'pregunta_vista', 'borrador_guardado', 'respuesta_cambio', 'comprobacion', 'foco', 'visibilidad', 'inactividad'];
const TIPOS_V2 = ['question_exposure_started', 'question_exposure_ended', 'heartbeat', 'question_activated', 'answer_save_requested', 'answer_save_confirmed', 'answer_draft_changed'];
let CURSO = '';
const respuestaFinal = new Map<string, string>();
const telemetria = { v1_enviados: 0, v2_enviados: 0 };

async function estudiante(i: number) {
  const u = uid(i);
  const st = { visible: true, ultimaRuta: 0, ultimaCuenta: 0, ultimoLatido: 0, ultimaVis: true as boolean, visita: randomUUID(), seqVisita: 0, enIntento: false };
  const conn = randomUUID(), sesEst = randomUUID();
  await dormir((MODO === 'entrada' ? 10_000 : 60_000) * Math.random());
  if (!vivo()) return;

  // ---- carga inicial del aula (Layout + Inicio, en paralelo como el navegador) ----
  const t0 = performance.now();
  await leer('perfil', u, `select * from public.profiles where id = ${lit(u)}`);
  await Promise.all([
    rpc('cuenta_presencia', u, 'cuenta_presencia'), rpc('acceso_estado_panel', u, 'acceso_estado_panel'), rpc('my_monitor_classes', u, 'my_monitor_classes'),
    rpc('hist_mi_bloqueo', u, 'hist_mi_bloqueo'), rpc('study_config', u, 'study_config'), rpc('my_pending_messages_v3', u, 'my_pending_messages_v3'),
    rpc('my_screen_lock', u, 'my_screen_lock'), rpc('my_open_poll', u, 'my_open_poll'), rpc('my_control_pendiente', u, 'my_control_pendiente'),
    rpc('my_open_attendance', u, 'my_open_attendance'), rpc('my_open_attendance', u, 'my_open_attendance'),
    rpc('presence_ping', u, 'presence_ping', { p_conn: conn, p_visible: true }).then((r) => { eventoPresencia(u, true, r !== ERROR); if (r !== ERROR) conectados.add(u); }),
    rpc('my_classes', u, 'my_classes'), rpc('my_activities', u, 'my_activities'), rpc('my_pending_practice', u, 'my_pending_practice'),
    rpc('my_grades', u, 'my_grades'), rpc('my_announcements', u, 'my_announcements'), rpc('pes_mis_practicas', u, 'pes_mis_practicas'),
    leer('units', u, `select * from public.units where course_id = ${lit(CURSO)} order by position`),
    leer('lessons', u, `select id, unit_id, course_id, slug, position, title, summary, hidden, simulation, updated_at from public.lessons where course_id = ${lit(CURSO)} order by position`),
    rpc('lesson_progress', u, 'lesson_progress', { p_course: CURSO, p_user: null }), rpc('concept_mastery', u, 'concept_mastery', { p_course: CURSO, p_user: null }),
  ]);
  cargas.push(performance.now() - t0);
  st.ultimaRuta = Date.now();

  const latidoPresencia = async (porEvento: boolean) => {
    const ahora = Date.now();
    if (porEvento && P.saltoPresencia && st.visible === st.ultimaVis && ahora - st.ultimoLatido < 5_000) return;
    st.ultimoLatido = ahora; st.ultimaVis = st.visible;
    const r = await rpc('presence_ping', u, 'presence_ping', { p_conn: conn, p_visible: st.visible });
    // un evento de Realtime por cada latido que escribe (el servidor descarta solo duplicados de < 5 s)
    eventoPresencia(u, st.visible, r !== ERROR);
  };
  const latidoEstudio = async () => {
    st.seqVisita++;
    await rpc('study_beat', u, 'study_beat', { p_visit: st.visita, p_session: sesEst, p_kind: 'actividad', p_ref: ACT, p_section: 'actividad', p_seq: st.seqVisita,
      p_effective: Math.round((P.estudio / 1000) * st.seqVisita * 0.8), p_visible: Math.round((P.estudio / 1000) * st.seqVisita), p_idle: 0, p_hidden: 0, p_weak: 0,
      p_interactions: st.seqVisita * 3, p_answers: 0, p_offline: false });
  };
  // cambio de página: el navegador vuelve a consultar avisos (antes siempre; después, solo si pasaron ≥ 30 s)
  const cambioDeRuta = async () => {
    if (st.seqVisita > 0) await latidoEstudio();   // cierre de la visita anterior
    st.visita = randomUUID(); st.seqVisita = 0;
    if (P.rutaMin && Date.now() - st.ultimaRuta < P.rutaMin) return;
    st.ultimaRuta = Date.now();
    await Promise.all([rpc('hist_mi_bloqueo', u, 'hist_mi_bloqueo'), rpc('my_control_pendiente', u, 'my_control_pendiente'), rpc('my_open_attendance', u, 'my_open_attendance')]);
  };
  const v = () => st.visible;
  const globales = [
    // latido de conexión; con ESTRANGULAR=1, en pestaña oculta los temporizadores van como mucho uno por minuto
    // (estrangulamiento intensivo de Chrome tras 5 min oculta): el peor caso para la caducidad de la presencia
    (async () => {
      await dormir(Math.random() * P.presencia);
      while (vivo()) {
        if (st.visible || P.oculto.presencia) await latidoPresencia(false);
        const periodo = !st.visible && ESTRANGULAR ? Math.max(P.presencia, 60_000) : P.presencia;
        await dormir(periodo * (0.97 + 0.06 * Math.random()));
      }
    })(),
    cada(P.mensajes, () => rpc('my_pending_messages_v3', u, 'my_pending_messages_v3'), () => st.visible || P.oculto.mensajes),
    cada(P.bloqueo, () => rpc('my_screen_lock', u, 'my_screen_lock'), () => st.visible || P.oculto.bloqueo),
    cada(P.control, () => rpc('my_control_pendiente', u, 'my_control_pendiente'), v),
    cada(P.avisoAsistencia, () => rpc('my_open_attendance', u, 'my_open_attendance'), v),
    cada(P.pregunta, () => rpc('my_open_poll', u, 'my_open_poll'), () => st.visible || P.oculto.pregunta),
    cada(P.estudio, latidoEstudio, v),
    cada(300_000, () => rpc('mi_alerta_puntos', u, 'mi_alerta_puntos'), v),
    // pestaña: ~30 % de las veces se oculta un rato (otra app, el teléfono se apaga)
    (async () => {
      while (vivo()) {
        await dormir(logn(240));
        if (!vivo() || Math.random() > 0.3) continue;
        st.visible = false;
        await Promise.all([latidoPresencia(true), latidoEstudio()]);
        await dormir(ESTRANGULAR ? logn(420) : logn(40));
        if (!vivo()) break;
        st.visible = true;
        const volver: Promise<unknown>[] = [latidoPresencia(true), rpc('my_screen_lock', u, 'my_screen_lock'), rpc('my_pending_messages_v3', u, 'my_pending_messages_v3'),
          rpc('my_open_poll', u, 'my_open_poll'), rpc('my_control_pendiente', u, 'my_control_pendiente'), rpc('my_open_attendance', u, 'my_open_attendance')];
        if (!P.cuentaPresenciaVolver || Date.now() - st.ultimaCuenta > P.cuentaPresenciaVolver) { st.ultimaCuenta = Date.now(); volver.push(rpc('cuenta_presencia', u, 'cuenta_presencia')); }
        await Promise.all(volver);
      }
    })(),
    // navegación por lecciones cuando no está en un intento
    (async () => { while (vivo()) { await dormir(logn(45)); if (vivo() && !st.enIntento) await cambioDeRuta(); } })(),
  ];

  // ---- práctica: 80 % de los estudiantes ----
  if (Math.random() < 0.8) {
    await dormir(MODO === 'entrada' ? logn(15) : logn(40));
    if (!vivo()) return void (await Promise.all(globales));
    st.enIntento = true;
    await cambioDeRuta();
    const attempt = (await rpc('start_activity_attempt', u, 'start_activity_attempt', { p_activity: ACT })) as string | typeof ERROR;
    if (attempt !== ERROR && attempt) {
      const vista = (await rpc('get_attempt', u, 'get_attempt', { p_attempt: attempt })) as { items?: { exercise: { id: string; format: string } }[] } | typeof ERROR;
      const items = vista !== ERROR && vista ? vista.items ?? [] : [];
      const sesTel = randomUUID();
      let seq = 0, seqV2 = 0, tms = 0, entregado = false;
      const cola: Record<string, unknown>[] = [], colaV2: Record<string, unknown>[] = [];
      const genV1 = setInterval(() => { if (!entregado) for (let k = Math.round(TASA_V1() / 6 * (0.5 + Math.random())); k > 0; k--) cola.push({ session_id: sesTel, seq: ++seq, attempt_id: attempt, exercise_id: items[seq % Math.max(1, items.length)]?.exercise.id ?? null, kind: TIPOS_V1[seq % TIPOS_V1.length], t_ms: (tms += 2000), wall: Date.now(), data: {} }); }, 10_000);
      const genV2 = setInterval(() => { if (!entregado) for (let k = Math.round(TASA_V2() / 6 * (0.5 + Math.random())); k > 0; k--) colaV2.push({ event_id: randomUUID(), schema_version: 2, attempt_id: attempt, session_id: sesTel, client_seq: ++seqV2, event_type: TIPOS_V2[seqV2 % TIPOS_V2.length], t_mono: (tms += 1500), wall: Date.now(), payload: {} }); }, 10_000);
      const tel = [
        P.telV1 ? cada(P.vaciado, async () => { if (!cola.length) return; const l = cola.splice(0, 200); if ((await rpc('telemetry_ingest', u, 'telemetry_ingest', { p_eventos: l })) === ERROR) cola.unshift(...l); else telemetria.v1_enviados += l.length; }) : null,
        P.telV2 ? cada(P.vaciado, async () => { if (!colaV2.length) return; const l = colaV2.splice(0, 200); if ((await rpc('telemetry_v2_ingest', u, 'telemetry_v2_ingest', { p_eventos: l })) === ERROR) colaV2.unshift(...l); else telemetria.v2_enviados += l.length; }) : null,
        cada(300_000, async () => { if (!entregado) await rpc('telemetry_v2_sync', u, 'telemetry_v2_sync', [attempt]); }),
      ];
      await rpc('telemetry_v2_sync', u, 'telemetry_v2_sync', [attempt]);
      for (const it of items) {
        if (!vivo()) break;
        const ej = it.exercise;
        for (let b = 1 + Math.floor(Math.random() * 2); b > 0 && vivo(); b--) {
          await dormir(MODO === 'entrada' ? 3000 + Math.random() * 4000 : logn(80));
          const answer = ej.format === 'choice' ? { selected: [Math.floor(Math.random() * 3)] } : { text: `${(Math.random() * 20).toFixed(2)} m/s` };
          if ((await rpc('save_response', u, 'save_response', { p_attempt: attempt, p_exercise: ej.id, p_answer: answer })) !== ERROR) respuestaFinal.set(`${attempt}|${ej.id}`, JSON.stringify(answer));
        }
        if (!vivo()) break;
        await dormir(MODO === 'entrada' ? 1500 : logn(60));
        const answer = ej.format === 'choice' ? { selected: [0] } : { text: `${(Math.random() * 20).toFixed(2)} m/s` };
        const tc = performance.now();
        try {
          await handle({ action: 'check', attempt_id: attempt, exercise_id: ej.id, answer }, u, dbServicio);
          muestras.push({ op: 'calificar:check', ms: performance.now() - tc, ok: true, t: Date.now(), usuario: u });
          respuestaFinal.set(`${attempt}|${ej.id}`, JSON.stringify(answer));
        } catch (e) { muestras.push({ op: 'calificar:check', ms: performance.now() - tc, ok: false, err: String((e as Error).message).slice(0, 70), t: Date.now(), usuario: u }); }
      }
      if (vivo()) {
        const ts = performance.now();
        try { await handle({ action: 'submit', attempt_id: attempt }, u, dbServicio); muestras.push({ op: 'calificar:submit', ms: performance.now() - ts, ok: true, t: Date.now(), usuario: u }); entregado = true; }
        catch (e) { muestras.push({ op: 'calificar:submit', ms: performance.now() - ts, ok: false, err: String((e as Error).message).slice(0, 70), t: Date.now(), usuario: u }); }
      }
      clearInterval(genV1); clearInterval(genV2);
      void tel;
    }
    st.enIntento = false;
  }
  await Promise.all(globales);
}

// ---------------------------------------------------------------------------------------------------------------
const q = (a: number[], x: number) => (a.length ? +a[Math.min(a.length - 1, Math.floor(x * a.length))].toFixed(1) : 0);
const s = await arrancar();
const raiz = new pg.Client({ connectionString: URL_DB });
await raiz.connect();
try {
  // funciones y políticas de la BASE: «despues» = migraciones 87 y 88 (salvo SIN_88=1); «antes» = sus reversiones.
  // Por defecto la base sigue al perfil del navegador; BD=antes|despues las combina (pruebas de orden de despliegue).
  const archivos = BD === 'despues'
    ? ['supabase/migrations/20261106000087_bajo_consumo_presencia.sql', ...(process.env.SIN_88 ? ['supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql'] : ['supabase/migrations/20261106000088_rls_permisos_una_vez.sql'])]
    : ['supabase/reversion/20261106000087_bajo_consumo_presencia_revertir.sql', 'supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql'];
  for (const a of archivos) await raiz.query(readFileSync(a, 'utf8'));
  CURSO = (await raiz.query(`select course_id from public.classes where id = 'cafe0000-0000-4000-8000-0000000000c1'`)).rows[0]?.course_id;
  if (!CURSO) throw new Error('falta el entorno sintético: vite-node scripts/carga/preparar.ts');
  PROF = (await raiz.query(`select id from public.profiles where role = 'admin' and id::text not like 'cafe0000%' order by created_at limit 1`)).rows[0]?.id ?? PROF;
  // estado limpio y comparable: sin presencia ni intentos de pruebas anteriores
  await raiz.query(`delete from public.presence_connections where user_id::text like 'cafe0000-%'`);
  await raiz.query(`update public.attempts set status = 'submitted', submitted_at = coalesce(submitted_at, now()) where user_id::text like 'cafe0000-0000-4000-8000-0000000010%' and status = 'in_progress'`);
  for (let i = 1; i <= 94; i++) sesiones.set(uid(i), (await raiz.query(`select id from auth.sessions where user_id = $1 limit 1`, [uid(i)])).rows[0]?.id);
  await raiz.query('checkpoint');
  await raiz.query('select pg_stat_statements_reset(), pg_stat_reset(), pg_stat_reset_shared(\'wal\'), pg_stat_reset_shared(\'io\'), pg_stat_reset_shared(\'bgwriter\')');
  const disco0 = escrituraDiscoBytes(s.pid), cpu0 = cpuPostgresMs(s.pid);
  const t0 = Date.now();
  fin.t = t0 + MINUTOS * 60_000;
  const ventanas: Record<string, number>[] = [];
  const monitor = (async () => {
    let i0 = 0, cpuPrev = cpu0, tPrev = t0;
    while (vivo()) {
      await dormir(15_000);
      const ahora = Date.now(), cpu = cpuPostgresMs(s.pid), m = muestras.slice(i0); i0 = muestras.length;
      const ms = m.map((x) => x.ms).sort((a, b) => a - b);
      const act = (await raiz.query(`select count(*) filter (where state = 'active')::int act, count(*)::int total from pg_stat_activity where datname = current_database()`)).rows[0];
      ventanas.push({ t_s: Math.round((ahora - t0) / 1000), peticiones: m.length, p50: q(ms, 0.5), p95: q(ms, 0.95), p99: q(ms, 0.99), errores: m.filter((x) => !x.ok).length,
        cpu_pct: +((100 * (cpu - cpuPrev)) / (ahora - tPrev)).toFixed(1), rss_mb: rssPostgresMb(s.pid), conexiones: act.total, activas: act.act });
      cpuPrev = cpu; tPrev = ahora;
    }
  })();
  // ¿Orbe Control mostraría como desconectado a alguien que sigue con el aula abierta? (cada 5 s, con la caducidad efectiva)
  const vigiaPresencia = (async () => {
    while (vivo()) {
      await dormir(5_000);
      if (!vivo() || !conectados.size) continue;
      const r = (await raiz.query(`select count(distinct user_id)::int vistos, coalesce(max(extract(epoch from now() - ult)), 0)::float edad
          from (select user_id, max(last_seen) ult from public.presence_connections where user_id::text like 'cafe0000-0000-4000-8000-0000000010%' group by user_id) x
          where ult > now() - make_interval(secs => $1)`, [CADUCA_S])).rows[0];
      const edad = (await raiz.query(`select coalesce(max(extract(epoch from now() - ult)), 0)::float e from (select max(last_seen) ult from public.presence_connections
          where user_id::text like 'cafe0000-0000-4000-8000-0000000010%' group by user_id) x`)).rows[0].e;
      const falsos = Math.max(0, conectados.size - r.vistos);
      presencia.muestras++; presencia.falsos_total += falsos; presencia.falsos_max = Math.max(presencia.falsos_max, falsos);
      if (falsos) presencia.con_falsos++;
      presencia.edad_max_s = Math.max(presencia.edad_max_s, +Number(edad).toFixed(1));
    }
  })();
  await Promise.all([...Array.from({ length: N }, (_, k) => estudiante(k + 1)), profesor(), monitor, vigiaPresencia]);
  await dormir(0);
  clearTimeout(prof.pendiente);
  await new Promise((r) => setTimeout(r, 1500));   // peticiones en vuelo
  const duracion = (Date.now() - t0) / 1000;
  const cpu = cpuPostgresMs(s.pid) - cpu0, disco1 = escrituraDiscoBytes(s.pid);

  const wal = (await raiz.query(`select wal_records::bigint r, wal_fpi::bigint fpi, wal_bytes::bigint b, wal_write::bigint w, wal_sync::bigint sy from pg_stat_wal`)).rows[0];
  const io = (await raiz.query(`select coalesce(sum(reads),0)::bigint lecturas, coalesce(sum(writes),0)::bigint escrituras, coalesce(sum(extends),0)::bigint extensiones,
      coalesce(sum(fsyncs),0)::bigint fsyncs, coalesce(sum(hits),0)::bigint aciertos from pg_stat_io`)).rows[0];
  const db = (await raiz.query(`select xact_commit::bigint commits, blks_read::bigint leidos, blks_hit::bigint aciertos, tup_inserted::bigint ins, tup_updated::bigint upd, tup_deleted::bigint del
      from pg_stat_database where datname = current_database()`)).rows[0];
  const tablas = (await raiz.query(`select relname, n_tup_ins::int ins, n_tup_upd::int upd, n_tup_hot_upd::int hot, n_tup_del::int del, seq_scan::int seq, idx_scan::int idx
      from pg_stat_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0 order by n_tup_ins + n_tup_upd + n_tup_del desc limit 15`)).rows;
  const top = (await raiz.query(`select calls::int, round(total_exec_time::numeric, 1)::float total_ms, round(mean_exec_time::numeric, 2)::float media_ms,
      (shared_blks_dirtied + local_blks_dirtied)::int ensuciados, shared_blks_written::int escritos, wal_bytes::bigint wal, left(regexp_replace(query, '\\s+', ' ', 'g'), 110) consulta
      from pg_stat_statements where toplevel and dbid = (select oid from pg_database where datname = current_database()) and query not ilike '%pg_stat%'
      order by wal_bytes desc limit 12`)).rows;

  const porOp: Record<string, { n: number; err: number; p50: number; p95: number; p99: number }> = {};
  for (const op of [...new Set(muestras.map((m) => m.op))].sort()) {
    const m = muestras.filter((x) => x.op === op), ms = m.map((x) => x.ms).sort((a, b) => a - b);
    porOp[op] = { n: m.length, err: m.filter((x) => !x.ok).length, p50: q(ms, 0.5), p95: q(ms, 0.95), p99: q(ms, 0.99) };
  }
  const est = muestras.filter((m) => m.usuario.startsWith('cafe0000-0000-4000-8000-0000000010'));
  const todos = muestras.map((m) => m.ms).sort((a, b) => a - b), cs = cargas.slice().sort((a, b) => a - b);
  const errores: Record<string, number> = {};
  for (const m of muestras.filter((x) => !x.ok)) errores[m.err ?? '?'] = (errores[m.err ?? '?'] ?? 0) + 1;
  // integridad: toda respuesta confirmada está guardada con ese contenido (o con la comprobada después)
  let faltan = 0;
  for (const [k] of respuestaFinal) {
    const [a, e] = k.split('|');
    if (!(await raiz.query(`select 1 from public.responses where attempt_id = $1 and exercise_id = $2`, [a, e])).rowCount) faltan++;
  }
  const minutosEst = (N * duracion) / 60;
  const r = {
    etiqueta: ETIQUETA, perfil: PERFIL, bd: BD, modo: MODO, estudiantes: N, minutos: MINUTOS, duracion_s: Math.round(duracion), pool: POOL,
    presencia: { ...presencia, caducidad_efectiva_s: CADUCA_S, conectados: conectados.size,
      nota: 'falsos = estudiantes con el aula abierta que Orbe Control mostraría como desconectados (muestras cada 5 s)' },
    peticiones: muestras.length, peticiones_estudiante_min: +(est.length / minutosEst).toFixed(2),
    latencia_ms: { p50: q(todos, 0.5), p95: q(todos, 0.95), p99: q(todos, 0.99) },
    carga_inicial_ms: { n: cs.length, p50: q(cs, 0.5), p95: q(cs, 0.95), p99: q(cs, 0.99) },
    errores_total: muestras.filter((m) => !m.ok).length, errores,
    escritura: {
      commits: Number(db.commits), commits_por_s: +(Number(db.commits) / duracion).toFixed(2),
      filas_insertadas: Number(db.ins), filas_actualizadas: Number(db.upd), filas_borradas: Number(db.del),
      wal_registros: Number(wal.r), wal_paginas_completas: Number(wal.fpi), wal_mb: +(Number(wal.b) / 1048576).toFixed(2),
      wal_kb_estudiante_min: +(Number(wal.b) / 1024 / minutosEst).toFixed(1), wal_sync: Number(wal.sy), wal_sync_por_s: +(Number(wal.sy) / duracion).toFixed(2),
      pg_stat_io_escrituras_8k: Number(io.escrituras), pg_stat_io_extensiones: Number(io.extensiones), pg_stat_io_fsyncs: Number(io.fsyncs),
      disco_escrito_mb_proc: +((disco1.escritos - disco0.escritos) / 1048576).toFixed(2),
    },
    lectura: { bloques_leidos_disco: Number(db.leidos), bloques_en_cache: Number(db.aciertos), pg_stat_io_lecturas: Number(io.lecturas),
      acierto_cache_pct: +((100 * Number(db.aciertos)) / Math.max(1, Number(db.aciertos) + Number(db.leidos))).toFixed(2) },
    cpu_pg_pct_medio: +((100 * cpu) / (duracion * 1000)).toFixed(2), cpu_pg_ms_estudiante_min: +(cpu / minutosEst).toFixed(1),
    rss_pg_mb_max: Math.max(0, ...ventanas.map((w) => w.rss_mb)), conexiones_max: Math.max(0, ...ventanas.map((w) => w.conexiones)),
    esperas_bloqueo: s.esperas(), telemetria, integridad: { respuestas_confirmadas: respuestaFinal.size, respuestas_faltantes: faltan },
    por_operacion: porOp, tablas_mas_escritas: tablas, sentencias_mas_wal: top, ventanas,
  };
  mkdirSync('privado/carga', { recursive: true });
  writeFileSync(`privado/carga/${ETIQUETA}.json`, JSON.stringify(r, null, 1));
  const csv = 'privado/carga/resultados.csv';
  if (!existsSync(csv)) writeFileSync(csv, 'etiqueta,perfil,modo,estudiantes,duracion_s,peticiones,pet_est_min,p50_ms,p95_ms,p99_ms,carga_p50_ms,carga_p95_ms,errores,commits_s,filas_upd,filas_ins,wal_mb,wal_kb_est_min,wal_fpi,wal_sync_s,disco_mb,cpu_pct,respuestas,faltantes\n');
  appendFileSync(csv, [ETIQUETA, PERFIL, MODO, N, r.duracion_s, r.peticiones, r.peticiones_estudiante_min, r.latencia_ms.p50, r.latencia_ms.p95, r.latencia_ms.p99,
    r.carga_inicial_ms.p50, r.carga_inicial_ms.p95, r.errores_total, r.escritura.commits_por_s, r.escritura.filas_actualizadas, r.escritura.filas_insertadas, r.escritura.wal_mb,
    r.escritura.wal_kb_estudiante_min, r.escritura.wal_paginas_completas, r.escritura.wal_sync_por_s, r.escritura.disco_escrito_mb_proc, r.cpu_pg_pct_medio,
    respuestaFinal.size, faltan].join(',') + '\n');
  console.log(JSON.stringify({ etiqueta: ETIQUETA, bd: BD, presencia: r.presencia, peticiones_estudiante_min: r.peticiones_estudiante_min, latencia: r.latencia_ms, carga: r.carga_inicial_ms, errores: r.errores_total,
    commits_s: r.escritura.commits_por_s, wal_mb: r.escritura.wal_mb, wal_kb_est_min: r.escritura.wal_kb_estudiante_min, disco_mb: r.escritura.disco_escrito_mb_proc, cpu: r.cpu_pg_pct_medio, integridad: r.integridad }));
} finally {
  await raiz.end().catch(() => undefined);
  await pool.end().catch(() => undefined);
  await parar(s);
}
process.exit(0);
