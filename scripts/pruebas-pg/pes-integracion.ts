/**
 * PES · pruebas de flujo completo contra la base REAL (PostgreSQL con todas las migraciones) y la lógica real de la
 * función «calificar» (handler.ts), desde la perspectiva del estudiante: la misma SesionPes que usa la pantalla.
 * Solo falta el transporte HTTP de Supabase (PostgREST y Deno), que no existe en este equipo.
 *
 * Uso (base desechable ya migrada, p. ej. la de privado/tmp/pruebas-sql-local.mjs):
 *   PES_PG_URL=postgresql://postgres@127.0.0.1:55432/aula_prueba_local ./node_modules/.bin/vite-node scripts/pruebas-pg/pes-integracion.ts
 * Crea sus datos (prefijo de760000) y los borra al terminar.
 */
import pg from 'pg';
import { handle, HttpError, type Db } from '../../supabase/functions/calificar/handler.ts';
import { claveConcreta } from '../../supabase/functions/_shared/calificacion/variante.ts';
import type { NumericKey } from '../../supabase/functions/_shared/calificacion/tipos.ts';
import type { ApiPes, EventoCliente, ResultadoConfirmar, ResultadoOmitir, VistaPes } from '@/api/pesTipos';
import { SesionPes, type Temporizador } from '@/lib/pesSesion';
import { AlmacenMemoria } from '@/lib/examen/guardado';
import { conRed, type Red } from '@/lib/pesRed';
import { factorControl, puntajePes, type ApartadoPuntuado } from '@/lib/pes';
import { ejecutarSondas, type ClienteSondas } from '@/lib/pesSondas';
import { indicadores, type DatosMonitor } from '@/lib/pesMonitor';

const URL = process.env.PES_PG_URL ?? 'postgresql://postgres@127.0.0.1:55432/aula_prueba_local';
const pool = new pg.Pool({ connectionString: URL, max: 30 });
const U = (n: number) => `de760000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P = U(1), E1 = U(11), E2 = U(12), E3 = U(13), E4 = U(14);
const CLASE = U(180), CURSO = U(160);
let fallos = 0, pasadas = 0;
const ok = (c: boolean, m: string) => { if (c) pasadas++; else fallos++; console.log(`${c ? '✔' : '✖'} ${m}`); };
const seccion = (t: string) => console.log(`\n— ${t}`);

// ---------------------------------------------------------------------------------------------------------------
// Acceso a la base como lo haría Supabase: estudiante/profesor = rol authenticated con su id; «calificar» = service_role
// ---------------------------------------------------------------------------------------------------------------
const param = (v: unknown) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);
async function llamar(rol: 'authenticated' | 'service_role', uid: string | null, fn: string, args: Record<string, unknown>) {
  const keys = Object.keys(args);
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${rol}`);
    await c.query(`select set_config('request.path', '/rpc/${fn}', true)`);
    if (uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    const r = await c.query(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => param(args[k])));
    await c.query('commit');
    return r.rows[0].r;
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally { c.release(); }
}
const dbServicio: Db = {
  rpc: async (fn, args) => {
    try { return { data: await llamar('service_role', null, fn, args), error: null }; }
    catch (e) { const x = e as { message: string; code?: string }; return { data: null, error: { message: x.message, code: x.code } }; }
  },
};
const como = (uid: string) => <T>(fn: string, args: Record<string, unknown> = {}) => llamar('authenticated', uid, fn, args) as Promise<T>;
const sql = async <T = Record<string, unknown>>(q: string, v: unknown[] = []) => (await pool.query(q, v)).rows as T[];

/** La API del estudiante, igual que API_PES pero sin HTTP. Registra TODO lo que recibe el navegador. */
function apiEstudiante(uid: string, registro: string[]): ApiPes {
  const rpc = async <T>(fn: string, args: Record<string, unknown>) => {
    try { const r = await llamar('authenticated', uid, fn, args) as T; registro.push(JSON.stringify(r ?? null)); return r; }
    catch (e) { throw new Error((e as Error).message); }
  };
  const calificar = async <T>(body: Record<string, unknown>) => {
    try { const r = await handle(body, uid, dbServicio) as T; registro.push(JSON.stringify(r)); return r; }
    catch (e) { throw new Error(e instanceof HttpError ? e.message : 'Error interno'); }     // como invocar(): solo el mensaje
  };
  return {
    misPracticas: () => rpc('pes_mis_practicas', {}),
    iniciar: (p) => rpc<VistaPes>('pes_iniciar', { p_practica: p }),
    actual: (p) => rpc<VistaPes>('pes_actual', { p_practica: p }),
    borrador: (p, a, texto, rev) => rpc('pes_borrador', { p_practica: p, p_apartado: a, p_texto: texto, p_rev: rev }),
    confirmar: (p, a, answer, anticipado, idem) => calificar<ResultadoConfirmar>({ action: 'pes', op: 'confirmar', practica_id: p, apartado_id: a, answer, anticipado, idem }),
    omitir: (p, a, idem) => rpc<ResultadoOmitir>('pes_omitir', { p_practica: p, p_apartado: a, p_idem: idem }),
    evento: (p, tipo: EventoCliente) => rpc('pes_evento_cliente', { p_practica: p, p_tipo: tipo }),
    variante: async (p, a) => (await calificar<{ parametros: Record<string, number> | null }>({ action: 'pes', op: 'variante', practica_id: p, apartado_id: a })).parametros,
  };
}

/** Temporizadores manuales (las pruebas deciden cuándo corre el autoguardado o el reintento). */
const sinTemporizador: Temporizador = { poner: () => null, quitar: () => undefined };
let relojLocal = Date.now();
let contadorId = 0;
const nuevoId = () => U(900000 + ++contadorId);
function sesion(uid: string, practica: string, almacen = new AlmacenMemoria(), red: Red = { modo: 'ok' }, registro: string[] = []) {
  return new SesionPes(practica, { api: conRed(apiEstudiante(uid, registro), red), almacen, reloj: () => relojLocal, nuevoId, temporizador: sinTemporizador });
}
const respuestas = async (uid: string, practica: string) =>
  sql<{ apartado_id: string; accion: string; m: string; q: string; revision: string }>(
    'select apartado_id, accion, m::text, q::text, revision from public.pes_respuestas where user_id = $1 and practica_id = $2 order by cerrado_at', [uid, practica]);
/** Simula que pasó el tiempo en el servidor (adelanta el revelado del apartado abierto). */
const pasar = (uid: string, practica: string, s: number) =>
  sql(`update public.pes_estado set revelado_at = revelado_at - make_interval(secs => $3) where user_id = $1 and practica_id = $2`, [uid, practica, s]);

// ---------------------------------------------------------------------------------------------------------------
async function limpiar() {
  await sql(`delete from public.classes where id::text like 'de760000-%'`);       // arrastra matrículas y PES (cascada)
  await sql(`delete from public.courses where id::text like 'de760000-%'`);
  await sql(`delete from auth.users where id::text like 'de760000-%'`);
}

async function preparar(): Promise<{ practica: string }> {
  await limpiar();
  const usuarios: [string, string][] = [[P, 'prof-pes-int'], [E1, 'sint-pesi-1'], [E2, 'sint-pesi-2'], [E3, 'sint-pesi-3'], [E4, 'sint-pesi-4']];
  for (const [id, login] of usuarios) {
    await sql(`insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ($1, $2, 'authenticated', 'authenticated', $3, '{}', now(), now())`, [id, `${login}@cuentas.aula.invalid`, JSON.stringify({ login_id: login, ...(id === P ? { aula_role: 'teacher' } : {}) })]);
  }
  await sql(`update public.profiles set must_change_password = false, active = true where id::text like 'de760000-%'`);
  await sql(`update public.profiles set role = 'teacher' where id = $1`, [P]);
  await sql(`insert into public.courses (id, title) values ($1, 'Curso PES integración')`, [CURSO]);
  await sql(`insert into public.units (id, course_id, slug, title, position) values ($1, $2, 'u', 'U', 1)`, [U(161), CURSO]);
  await sql(`insert into public.lessons (id, unit_id, course_id, slug, title) values ($1, $2, $3, 'l', 'L')`, [U(162), U(161), CURSO]);
  // problema por etapas del banco (3 etapas; la 2 con variante por estudiante)
  const etapas: [number, string, string, Record<string, unknown>][] = [
    [1, 'numeric', 'ENUNCIADO-2A ¿Cuánto tarda en caer?', { format: 'numeric', value: '3.0 s', relTol: 0.02 }],
    [2, 'numeric', 'ENUNCIADO-2B Con sus datos, ¿qué distancia recorre?', { format: 'numeric', value: '0 m', relTol: 0.02, variante: { plantilla: 'A', respuesta: 'd', unidad: 'm' } }],
    [3, 'truefalse', 'ENUNCIADO-2C ¿Se conserva la energía mecánica?', { format: 'truefalse', value: true, modelJustification: 'SECRETO-JUSTIFICACION' }],
  ];
  for (const [n, f, prompt, clave] of etapas) {
    await sql(`insert into public.exercises (id, course_id, lesson_id, slug, category, difficulty, role, format, prompt) values ($1, $2, $3, $4, 'numerica', 'intermedio', 'bank', $5, $6)`,
      [U(170 + n), CURSO, U(162), `flujo-${n}`, f, prompt]);
    await sql(`insert into public.exercise_keys (exercise_id, answer, explanation) values ($1, $2, $3)`, [U(170 + n), JSON.stringify(clave), `SECRETO-EXPL-2${n}`]);
    await sql(`insert into public.exercise_bank_meta (exercise_id, course_id, meta) values ($1, $2, $3)`,
      [U(170 + n), CURSO, JSON.stringify({ tipo: n === 3 ? 'conceptual' : 'calculo', problema: { id: 'flujo', etapa: n, total: 3, titulo: 'Caída libre' } })]);
  }
  await sql(`insert into public.classes (id, course_id, name, join_code, created_by) values ($1, $2, 'SPI', 'PESI7601', $3)`, [CLASE, CURSO, P]);
  await sql(`insert into public.class_teachers (class_id, user_id) values ($1, $2) on conflict do nothing`, [CLASE, P]);
  for (const e of [E1, E2, E3, E4]) await sql(`insert into public.enrollments (class_id, user_id) values ($1, $2)`, [CLASE, e]);

  // el profesor arma la práctica por las funciones del panel
  const prof = como(P);
  const practica = await prof<string>('pes_crear', { p_class: CLASE, p: { titulo: 'PES de integración', cierra_at: new Date(Date.now() + 2 * 86400000).toISOString() } });
  await prof('pes_ejercicio_redactado', { p_practica: practica, p: {
    titulo: 'Proyectil', contexto: 'Se lanza una piedra horizontalmente desde 12.5 m de altura.', apartados: [
      { enunciado: 'ENUNCIADO-1A ¿Desde qué altura se lanza?', formato: 'numeric', t_ref_s: 60, etapa: 'formulacion', clave: { format: 'numeric', value: '12.5 m', relTol: 0.02 }, explicacion: 'SECRETO-EXPL-1A' },
      { enunciado: 'ENUNCIADO-1B ¿Qué fuerza actúa en el aire?', formato: 'choice', opciones: ['Solo el peso', 'El peso y el empuje del lanzamiento'], t_ref_s: 30, etapa: 'prediccion', clave: { format: 'choice', correct: [0] } },
      { enunciado: 'ENUNCIADO-1C Explique la trayectoria.', formato: 'open', t_ref_s: 60, etapa: 'interpretacion', rubrica: 'SECRETO-RUBRICA: menciona MRU horizontal y MRUA vertical' },
    ] } });
  await prof('pes_ejercicio_desde_problema', { p_practica: practica, p_problema: 'flujo', p_desde: 1, p_hasta: 3, p_pesos: null, p_t_ref: [60, 60, 30] });
  await prof('pes_publicar', { p_practica: practica, p_estudiantes: null });
  return { practica };
}

// ---------------------------------------------------------------------------------------------------------------
async function flujo(practica: string) {
  const registro: string[] = [];
  const almacen = new AlmacenMemoria();
  const red: Red = { modo: 'ok' };
  let s = sesion(E1, practica, almacen, red, registro);

  seccion('Condiciones y revelación progresiva');
  await s.cargar();
  ok(s.e.fase === 'condiciones' && !s.e.vista?.apartado, 'antes de aceptar: pantalla de condiciones, ningún apartado');
  ok((await s.iniciar()) === 'ok' && s.e.fase === 'apartado' && s.e.vista?.apartado?.letra === 'A', 'al aceptar se revela solo el apartado A');
  const revelado = s.e.vista!.revelado_at;
  ok(s.e.vista!.t_min_s === 72, 'espera mínima del apartado A = 1.2 × 60 s = 72 s');

  seccion('Autoguardado y recarga');
  s.editar({ text: '12' });
  s.editar({ text: '12.5 m' });
  ok(s.e.guardado === 'pendiente' && s.e.rev === 2, 'cada edición sube la revisión y queda pendiente');
  await s.guardar();
  ok(s.e.guardado === 'guardado', 'el borrador se guarda en el servidor');
  s = sesion(E1, practica, new AlmacenMemoria(), red, registro);              // recarga en otro dispositivo (sin copia local)
  await s.cargar();
  ok(s.e.respuesta.text === '12.5 m' && s.e.vista!.revelado_at === revelado, 'al recargar se recupera el borrador del servidor y el tiempo NO se reinicia');
  // sin conexión: la edición queda en el dispositivo y gana al recargar
  s = sesion(E1, practica, almacen, red, registro);
  await s.cargar();
  red.modo = 'antes';
  s.editar({ text: '12.50 m' });
  await s.guardar();
  ok(s.e.guardado === 'sin_conexion', 'sin red: el guardado queda «sin conexión» (no se pierde)');
  red.modo = 'ok';
  s = sesion(E1, practica, almacen, red, registro);                            // recarga en el mismo dispositivo
  await s.cargar();
  ok(s.e.respuesta.text === '12.50 m' && s.e.guardado === 'pendiente', 'al recargar gana la copia local más nueva y se reenvía');
  await s.guardar();
  ok(s.e.guardado === 'guardado', 'la copia local llega al servidor al volver la red');

  seccion('Errores de formato, espera mínima y avance anticipado');
  s.editar({ text: 'doce metros y medio' });
  ok((await s.confirmar({ anticipado: true })) === 'formato' && s.e.mensajes.length > 0 && s.e.vista!.apartado!.letra === 'A',
    'una respuesta ilegible no cierra el apartado: se piden correcciones de formato');
  ok((await respuestas(E1, practica)).length === 0, '… y no queda ningún registro');
  s.editar({ text: '12.5 m' });
  ok((await s.confirmar()) === 'requiere_anticipar', 'antes de la espera mínima, confirmar exige aceptar la reducción');
  relojLocal += 3600_000;                                                      // el estudiante adelanta el reloj de su equipo
  ok((await s.confirmar()) === 'requiere_anticipar', 'adelantar el reloj del navegador no sirve: el servidor lo rechaza');
  ok((await respuestas(E1, practica)).length === 0 && s.e.pendiente === null, '… sin registro ni acción pendiente');
  relojLocal -= 3600_000;
  ok((await s.confirmar({ anticipado: true })) === 'ok' && s.e.vista!.apartado!.letra === 'B', 'con la reducción aceptada pasa a B');
  let r = await respuestas(E1, practica);
  ok(r.length === 1 && r[0].accion === 'anticipada' && Number(r[0].m) === 0.5 && Number(r[0].q) === 1, 'registrado: anticipada, m = 0.5, q = 1 (correcta)');

  seccion('Envío duplicado y respuesta perdida');
  s.editar({ selected: [0] });
  await pasar(E1, practica, 120);
  await s.cargar();                                                             // el tiempo pasó en el servidor
  ok(s.faltaMinimoS() === 0, 'tras la espera mínima ya no hace falta anticipar');
  const [a1, a2] = await Promise.all([s.confirmar(), s.confirmar()]);           // doble clic
  ok([a1, a2].sort().join() === 'ocupado,ok' && s.e.vista!.apartado!.letra === 'C', 'doble clic: una confirmación y la otra ignorada');
  r = await respuestas(E1, practica);
  ok(r.length === 2 && r[1].accion === 'confirmada' && Number(r[1].m) === 1, 'B registrada una sola vez, a tiempo (m = 1)');
  // C (abierta): la respuesta llega y se aplica, pero se pierde la contestación
  s.editar({ text: 'MRU horizontal y caída libre vertical: parábola.' });
  await pasar(E1, practica, 120);
  await s.cargar();
  red.modo = 'despues';
  ok((await s.confirmar()) === 'sin_conexion' && s.e.pendiente?.tipo === 'confirmar', 'respuesta perdida: la decisión queda guardada en el dispositivo');
  ok((await s.confirmar()) === 'ocupado', 'mientras tanto no se puede enviar otra');
  red.modo = 'ok';
  const idemPerdido = s.e.pendiente!.idem;
  s = sesion(E1, practica, almacen, red, registro);                            // el estudiante recarga la página
  await s.cargar();
  r = await respuestas(E1, practica);
  ok(r.length === 3 && s.e.pendiente === null && s.e.vista!.ejercicio!.posicion === 2 && s.e.vista!.apartado!.letra === 'A',
    'al recargar: C quedó registrada UNA vez y se continúa en el ejercicio 2');
  ok(r[2].revision === 'pendiente' && Number(r[2].q) === 0, 'la respuesta abierta queda pendiente de revisión (q = 0 provisional)');
  ok((await sql('select 1 from public.pes_respuestas where idem = $1', [idemPerdido])).length === 1, 'con la misma clave de idempotencia');

  seccion('Red caída antes de llegar; reintento');
  s.editar({ text: '3.0 s' });
  await pasar(E1, practica, 120);
  await s.cargar();
  red.modo = 'antes';
  ok((await s.confirmar()) === 'sin_conexion', 'sin red: la confirmación espera en el dispositivo');
  red.modo = 'ok';
  await s.reconectado();
  r = await respuestas(E1, practica);
  ok(r.length === 4 && s.e.vista!.apartado!.letra === 'B' && Number(r[3].q) === 1, 'al volver la red se envía una vez (2A correcta)');

  seccion('Variante individual');
  ok(s.e.vista!.apartado!.variante === true, 'el apartado 2B usa números propios del estudiante');
  const api1 = apiEstudiante(E1, registro);
  const params = await api1.variante(practica, s.e.vista!.apartado!.id);
  ok(!!params && Object.keys(params).length > 0, `el servidor entrega solo los parámetros (${Object.keys(params ?? {}).join(', ')})`);
  const [{ semilla }] = await sql<{ semilla: string }>('select semilla::text from public.pes_asignaciones where user_id = $1 and practica_id = $2', [E1, practica]);
  const [{ clave }] = await sql<{ clave: NumericKey }>('select k.clave from public.pes_claves k where k.apartado_id = $1', [s.e.vista!.apartado!.id]);
  const correcta = String(claveConcreta(clave, semilla, s.e.vista!.apartado!.id).value);
  s.editar({ text: correcta });
  await pasar(E1, practica, 120);
  await s.cargar();
  await s.confirmar();
  r = await respuestas(E1, practica);
  ok(Number(r[4].q) === 1, 'la respuesta correcta de SU versión se califica como correcta');

  seccion('Omisión definitiva y cierre de apartados');
  const apC = s.e.vista!.apartado!.id;
  ok((await s.omitir()) === 'ok' && s.e.fase === 'completada', 'omitir 2C (definitivo) completa la práctica');
  r = await respuestas(E1, practica);
  ok(r.length === 6 && r[5].accion === 'omitida' && Number(r[5].q) === 0, 'el omitido vale 0');
  // un borrador tardío de un apartado ya cerrado se rechaza
  let rechazado = false;
  try { await api1.borrador(practica, apC, '{"value":true}', 99); } catch { rechazado = true; }
  ok(rechazado, 'un autoguardado tardío de un apartado cerrado se rechaza');
  let reabierto = false;
  try { await api1.confirmar(practica, apC, { value: true, justification: 'x' }, true, nuevoId()); reabierto = true; } catch { /* esperado */ }
  ok(!reabierto, 'confirmar un apartado cerrado (con clave nueva) se rechaza');

  seccion('Fugas: lo que recibió el navegador');
  const todo = registro.join('\n');
  const prohibido = ['SECRETO', '"relTol"', '"correct"', '"accepted"', '"rubric"', '"modelJustification"', '"variante":{', '"arrastre"', '"clave"', '"rubrica"', '"explicacion"', '"credit"', '"status"'];
  const hallado = prohibido.filter((x) => todo.includes(x));
  ok(hallado.length === 0, `ninguna clave, rúbrica, explicación ni calificación en ${registro.length} respuestas${hallado.length ? ' — HALLADO: ' + hallado.join(', ') : ''}`);
  const orden = ['1A', '1B', '1C', '2A', '2B', '2C'];
  const primeras: string[] = [];
  let variasALaVez = false;
  for (const x of registro) {
    const m = [...new Set([...x.matchAll(/ENUNCIADO-(\d[A-C])/g)].map((y) => y[1]))];
    if (m.length > 1) variasALaVez = true;
    for (const k of m) if (!primeras.includes(k)) primeras.push(k);
  }
  ok(!variasALaVez && primeras.join() === orden.join(), `un solo enunciado por respuesta y en orden (${primeras.join(' → ')})`);
}

// ---------------------------------------------------------------------------------------------------------------
async function concurrencia(practica: string) {
  seccion('Concurrencia desde el estudiante');
  // E2 abre la práctica en 8 pestañas y confirma en todas a la vez
  const s0 = sesion(E2, practica);
  await s0.cargar();
  await s0.iniciar();
  const pestanas = Array.from({ length: 8 }, () => sesion(E2, practica));
  for (const t of pestanas) { await t.cargar(); t.editar({ text: '12.5 m' }); }
  const res = await Promise.all(pestanas.map((t) => t.confirmar({ anticipado: true })));
  const r = await respuestas(E2, practica);
  ok(res.filter((x) => x === 'ok').length === 1 && res.filter((x) => x === 'recargado').length === 7 && r.length === 1,
    `8 pestañas confirman a la vez: 1 aceptada, 7 recargan el estado (${res.join(', ')})`);
  ok(pestanas.every((t) => t.e.vista?.apartado?.letra === 'B'), 'todas las pestañas terminan mostrando el apartado B');
  ok(pestanas.filter((t) => t.e.aviso).length === 7, 'las que llegaron tarde avisan de que el apartado ya estaba cerrado');
  // misma acción reenviada 6 veces a la vez (misma clave): una sola aplicación
  const api = apiEstudiante(E2, []);
  const ap = pestanas[0].e.vista!.apartado!.id;
  const idem = nuevoId();
  const rs = await Promise.allSettled(Array.from({ length: 6 }, () => api.confirmar(practica, ap, { selected: [0] }, true, idem)));
  const repetidas = rs.filter((x) => x.status === 'fulfilled' && x.value.confirmado && x.value.estado.repetida).length;
  ok(rs.every((x) => x.status === 'fulfilled') && repetidas === 5 && (await respuestas(E2, practica)).length === 2, 'reenvío ×6 simultáneo con la misma clave: 1 aplicación, 5 «repetida»');
  // omitir y confirmar a la vez el mismo apartado
  const v = await api.actual(practica);
  const rc = await Promise.allSettled([api.confirmar(practica, v.apartado!.id, { text: 'x y z' }, true, nuevoId()), api.omitir(practica, v.apartado!.id, nuevoId())]);
  ok(rc.filter((x) => x.status === 'fulfilled').length === 1 && (await respuestas(E2, practica)).length === 3, 'omitir y confirmar a la vez: solo una queda registrada');
}

// ---------------------------------------------------------------------------------------------------------------
async function plazoYAdaptaciones(practica: string) {
  seccion('Adaptaciones y plazo');
  const prof = como(P);
  await prof('pes_adaptacion', { p_practica: practica, p_user: E3, p_tiempo_extra_min: 90, p_factor_espera: null, p_pegado: true, p_nota: 'Tiempo adicional' });
  await prof('pes_adaptacion', { p_practica: practica, p_user: E4, p_tiempo_extra_min: null, p_factor_espera: 0.5, p_pegado: null, p_nota: 'Espera reducida' });
  const s3 = sesion(E3, practica); await s3.cargar(); await s3.iniciar();
  const s4 = sesion(E4, practica); await s4.cargar(); await s4.iniciar();
  ok(s3.e.vista!.t_min_s === 72 && s3.e.vista!.pegado_permitido === true, 'tiempo adicional: la espera mínima no cambia (72 s) y se permite pegar');
  ok(s4.e.vista!.t_min_s === 36, 'factor de espera 0.5: la espera mínima baja a 36 s');
  // vence el plazo general: E4 queda fuera, E3 (90 min más) sigue
  const c = await pool.connect();                // en UNA conexión: se salta el congelado para simular que pasó la fecha
  try {
    await c.query('set session_replication_role = replica');
    await c.query(`update public.pes_practicas set cierra_at = now() - interval '1 second' where id = $1`, [practica]);
  } finally { await c.query('set session_replication_role = origin'); c.release(); }
  s4.editar({ text: '12.5 m' });
  ok((await s4.confirmar({ anticipado: true })) === 'recargado' && s4.e.fase === 'vencida', 'al vencer el plazo, confirmar recarga y muestra «vencida»');
  s3.editar({ text: '12.5 m' });
  ok((await s3.confirmar({ anticipado: true })) === 'ok', 'quien tiene tiempo adicional sigue trabajando después del plazo general');
}

// ---------------------------------------------------------------------------------------------------------------
async function paridad() {
  seccion('Paridad SQL ↔ TypeScript (provisional, validada, máxima)');
  const prof = como(P);
  const practica = await prof<string>('pes_crear', { p_class: CLASE, p: { titulo: 'Paridad', cierra_at: new Date(Date.now() + 86400000).toISOString() } });
  let semilla = 2026;
  const azar = () => (semilla = (semilla * 48271) % 2147483647) / 2147483647;
  const N = 5;
  for (let e = 0; e < N; e++) {
    const k = 3 + Math.floor(azar() * 3);
    const crudos = Array.from({ length: k }, () => 1 + Math.floor(azar() * 9));
    const suma = crudos.reduce((a, b) => a + b, 0);
    const pesos = crudos.map((c) => Math.round((c / suma) * 1e5) / 1e5);
    pesos[k - 1] = Math.round((1 - pesos.slice(0, -1).reduce((a, b) => a + b, 0)) * 1e5) / 1e5;
    await prof('pes_ejercicio_redactado', { p_practica: practica, p: { titulo: `E${e}`, contexto: '', apartados: pesos.map((w, i) => ({
      enunciado: `p${e}${i}`, formato: 'numeric', t_ref_s: 60, etapa: 'otra', peso: w, clave: { format: 'numeric', value: '1 m' } })) } });
  }
  // 30 estudiantes sintéticos con respuestas aleatorias (insertadas directamente: aquí se prueba la fórmula, no el flujo)
  const est: string[] = [];
  for (let i = 0; i < 30; i++) {
    const id = U(500 + i);
    est.push(id);
    await sql(`insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ($1, $2, 'authenticated', 'authenticated', $3, '{}', now(), now())`, [id, `par${i}@cuentas.aula.invalid`, JSON.stringify({ login_id: `sint-par-${i}` })]);
    await sql(`update public.profiles set must_change_password = false, active = true where id = $1`, [id]);
    await sql(`insert into public.enrollments (class_id, user_id) values ($1, $2)`, [CLASE, id]);
  }
  await prof('pes_politica_control', { p_practica: practica, p: { modo: 'ajuste', peso: 0.25, descripcion: 'Control presencial sobre un ejercicio realizado.' } });
  await prof('pes_publicar', { p_practica: practica, p_estudiantes: est });
  const aps = await sql<{ id: string; peso: string }>('select id, peso::text from public.pes_apartados where practica_id = $1', [practica]);
  const ejs = await sql<{ id: string }>('select id from public.pes_ejercicios where practica_id = $1 order by posicion', [practica]);
  let conControl = 0, controlesIguales = 0;
  let iguales = 0, maxDif = 0;
  for (const uid of est) {
    const entrada: ApartadoPuntuado[] = [];
    for (const a of aps) {
      const t = azar();
      if (t < 0.25) { entrada.push({ peso: Number(a.peso), q: null, m: 1 }); continue; }
      const omitida = t < 0.35, pendiente = !omitida && t < 0.45;
      const m = azar() < 0.4 ? 0.5 : 1;
      const q = omitida || pendiente ? 0 : Math.round(azar() * 1e5) / 1e5;
      const validada = !pendiente && azar() < 0.6;
      await sql(`insert into public.pes_respuestas (practica_id, user_id, apartado_id, accion, revelado_at, segundos, t_min_s, m, q, revision, idem, validada)
        values ($1, $2, $3, $4, now(), 10, 72, $5, $6, $7, gen_random_uuid(), $8)`,
        [practica, uid, a.id, omitida ? 'omitida' : m < 1 ? 'anticipada' : 'confirmada', m, q, pendiente ? 'pendiente' : 'auto', validada]);
      entrada.push({ peso: Number(a.peso), q, m, omitido: omitida, pendienteRevision: pendiente, validada });
    }
    const estado = ['apartado_abierto', 'completada', 'vencida'][Math.floor(azar() * 3)];
    await sql(`update public.pes_estado set estado = $3 where practica_id = $1 and user_id = $2`, [practica, uid, estado]);
    const [{ s }] = await sql<{ s: { provisional: { P: number; S: number }; validada: { P: number; completa: boolean }; maxima_alcanzable: { P: number }; puede_responder: boolean } }>(
      'select public.pes_puntaje($1, $2) s', [practica, uid]);
    const ts = puntajePes(entrada, N, { pMax: 8, alfa: 2 }, estado === 'apartado_abierto');
    // control presencial: 0 a 2 controles con resultados aleatorios en un ejercicio que haya respondido
    const resultados: number[] = [];
    for (let k = Math.floor(azar() * 3); k > 0; k--) {
      for (const e of ejs) {
        try {
          const c = await prof<{ id: string }>('pes_control_preparar', { p_practica: practica, p_user: uid, p_ejercicio: e.id });
          const r = Math.round(azar() * 4) / 4;
          await prof('pes_control_registrar', { p_control: c.id, p_resultado: r, p_nota: 'prueba de paridad' });
          resultados.push(r);
          break;
        } catch { /* ese ejercicio no tiene respuestas: se prueba el siguiente */ }
      }
    }
    if (resultados.length) {
      conControl++;
      const [{ c }] = await sql<{ c: { factor: number; validada_con_control: number } }>("select public.pes_puntaje($1, $2) -> 'control' c", [practica, uid]);
      const fts = factorControl({ modo: 'ajuste', peso: 0.25, descripcion: '' }, resultados);
      if (Math.abs(c.factor - fts) < 1e-6 && Math.abs(c.validada_con_control - ts.validada.p * fts) < 2e-6) controlesIguales++;
    }
    const d = Math.max(Math.abs(s.provisional.P - ts.provisional.p), Math.abs(s.validada.P - ts.validada.p), Math.abs(s.maxima_alcanzable.P - ts.maxima.p),
      Math.abs(s.provisional.S - ts.provisional.S));
    maxDif = Math.max(maxDif, d);
    if (d < 2e-6 && s.validada.completa === ts.validada.completa && s.puede_responder === (estado === 'apartado_abierto')) iguales++;
  }
  ok(iguales === est.length, `30 estudiantes aleatorios: SQL y TypeScript coinciden en las tres puntuaciones (${iguales}/30; diferencia máxima ${maxDif.toExponential(1)})`);
  ok(conControl > 0 && controlesIguales === conControl, `control presencial (ajuste, w = 0,25, el más favorable): SQL y TypeScript coinciden en ${controlesIguales}/${conControl}`);
  // monitor: una fila por estudiante y los indicadores calculables sobre datos reales
  const mon = await prof<DatosMonitor>('pes_monitor', { p_practica: practica });
  ok(mon.estudiantes.length === 30 && mon.estudiantes.every((x) => Array.isArray(indicadores(x, mon.practica.apartados, Date.parse(mon.ahora)))),
    `monitor: ${mon.estudiantes.length} filas con progreso, tiempos, puntuaciones e indicadores`);
}

// ---------------------------------------------------------------------------------------------------------------
async function tablaComo(uid: string, t: string) {
  const c = await pool.connect();
  try {
    await c.query('begin'); await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    const r = await c.query(`select * from public.${t} limit 1`);
    await c.query('commit');
    return { error: null, data: r.rows };
  } catch (e) { await c.query('rollback').catch(() => undefined); return { error: (e as Error).message }; } finally { c.release(); }
}

/** Criterio de aceptación 2: 100 ejercicios con apartados A–D, 30 estudiantes con respuestas; tiempos de las consultas. */
async function carga100() {
  seccion('Carga: 100 ejercicios × 4 apartados, 30 estudiantes');
  const prof = como(P);
  const practica = await prof<string>('pes_crear', { p_class: CLASE, p: { titulo: 'Cien ejercicios', cierra_at: new Date(Date.now() + 40 * 86400000).toISOString() } });
  let t0 = Date.now();
  for (let e = 1; e <= 100; e++) {
    await prof('pes_ejercicio_redactado', { p_practica: practica, p: { titulo: `E${e}`, contexto: '', apartados: ['A', 'B', 'C', 'D'].map((l, i) => ({
      enunciado: `Ejercicio ${e}, apartado ${l}`, formato: 'numeric', t_ref_s: 300, etapa: ['prediccion', 'formulacion', 'resolucion', 'interpretacion'][i],
      clave: { format: 'numeric', value: `${e} m` } })) } });
  }
  const tCrear = Date.now() - t0;
  const est = Array.from({ length: 30 }, (_, i) => U(500 + i));          // los de la prueba de paridad, ya matriculados
  await prof('pes_publicar', { p_practica: practica, p_estudiantes: est });
  const aps = await sql<{ id: string }>('select a.id from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where a.practica_id = $1 order by e.posicion, a.posicion', [practica]);
  ok(aps.length === 400, `400 apartados creados por el panel en ${(tCrear / 1000).toFixed(1)} s`);
  // respuestas: cada estudiante hizo entre 0 y 200 apartados (inserción directa, como en la paridad)
  let semilla = 77;
  const azar = () => (semilla = (semilla * 48271) % 2147483647) / 2147483647;
  for (const uid of est) {
    const n = Math.floor(azar() * 200);
    if (!n) continue;
    await sql(`insert into public.pes_respuestas (practica_id, user_id, apartado_id, accion, revelado_at, segundos, t_min_s, m, q, revision, idem)
      select $1, $2, a.id, 'confirmada', now(), 400, 360, 1, 1, 'auto', gen_random_uuid() from unnest($3::uuid[]) a(id)`, [practica, uid, aps.slice(0, n).map((a) => a.id)]);
    await sql(`update public.pes_estado set estado = 'apartado_abierto', apartado_id = $3, revelado_at = now() - interval '1 minute' where practica_id = $1 and user_id = $2`, [practica, uid, aps[n].id]);
  }
  const medir = async <T>(f: () => Promise<T>) => { const t = Date.now(); const r = await f(); return { r, ms: Date.now() - t }; };
  const mon = await medir(() => prof<DatosMonitor>('pes_monitor', { p_practica: practica }));
  ok(mon.r.estudiantes.length === 30 && mon.r.practica.apartados === 400, `monitor de 30 estudiantes × 400 apartados en ${mon.ms} ms`);
  const quien = mon.r.estudiantes.find((x) => x.estado === 'apartado_abierto')!.user_id;   // uno con un apartado abierto
  const api = apiEstudiante(quien, []);
  const act = await medir(() => api.actual(practica));
  ok(act.r.estado === 'apartado_abierto', `vista del apartado abierto en ${act.ms} ms`);
  const conf = await medir(() => api.confirmar(practica, act.r.apartado!.id, { text: '1 m' }, true, nuevoId()));
  ok(conf.r.confirmado === true, `confirmación (calificar + transición) en ${conf.ms} ms`);
  const [{ s: punt }] = await sql<{ s: { N: number } }>('select public.pes_puntaje($1, $2) s', [practica, quien]);
  ok(punt.N === 100, 'N = 100 en la fórmula');
  ok(mon.ms < 5000 && act.ms < 1000 && conf.ms < 1500, 'tiempos dentro de lo razonable para un uso interactivo (monitor < 5 s, vista < 1 s, confirmación < 1,5 s)');
}

async function simulador() {
  seccion('Simulador docente (asignación de prueba, en borrador)');
  const prof = como(P);
  const practica = await prof<string>('pes_crear', { p_class: CLASE, p: { titulo: 'Piloto' } });
  await prof('pes_ejercicio_redactado', { p_practica: practica, p: { titulo: 'Plano', contexto: 'Un bloque baja por un plano.', apartados: [
    { enunciado: 'PILOTO-A Prediga', formato: 'choice', opciones: ['Acelera', 'Va constante'], t_ref_s: 60, etapa: 'prediccion', clave: { format: 'choice', correct: [0] }, explicacion: 'SECRETO-PILOTO-EXPLICACION' },
    { enunciado: 'PILOTO-B Calcule la aceleración', formato: 'numeric', t_ref_s: 120, etapa: 'resolucion', clave: { format: 'numeric', value: '4.9 m/s^2', relTol: 0.02 } },
    { enunciado: 'PILOTO-C Interprete el resultado', formato: 'open', t_ref_s: 120, etapa: 'interpretacion', rubrica: 'SECRETO-PILOTO-RUBRICA: relaciona con g·sen θ' },
  ] } });
  await prof('pes_piloto_iniciar', { p_practica: practica });
  const s = sesion(P, practica);
  await s.cargar();
  ok(s.e.fase === 'condiciones', 'el profesor abre su práctica en BORRADOR como estudiante de prueba');
  await s.iniciar();
  ok(s.e.vista?.apartado?.letra === 'A' && s.e.vista.t_min_s === 72, 'recorre los mismos estados y tiempos que un estudiante (A, espera 72 s)');
  // sondas REST con la sesión del profesor: nada privado sale y nada se salta
  const det = await prof<{ ejercicios: { apartados: { id: string; enunciado: string; rubrica: string; explicacion: string }[] }[] }>('pes_detalle_docente', { p_practica: practica });
  const aps = det.ejercicios.flatMap((e) => e.apartados);
  const abierto = s.e.vista!.apartado!.id;
  const cliente: ClienteSondas = {
    tabla: (t) => tablaComo(P, t),
    rpc: async (fn, args) => { try { return { error: null, data: await llamar('authenticated', P, fn, args) }; } catch (e) { return { error: (e as Error).message }; } },
    calificar: async (body) => { try { return { error: null, data: await handle(body, P, dbServicio) }; } catch (e) { return { error: (e as Error).message }; } },
  };
  const res = await ejecutarSondas(cliente, {
    practica, apartadoFuturo: aps[2].id,
    secretos: aps.flatMap((a) => [a.rubrica, a.explicacion, ...(a.id === abierto ? [] : [a.enunciado])]).filter(Boolean),
  });
  const malas = res.filter((x) => !x.ok);
  ok(malas.length === 0, `${res.length} sondas REST no autorizadas: todas rechazadas o sin datos privados${malas.length ? ' — FALLAN: ' + malas.map((x) => `${x.nombre} (${x.obtenido})`).join('; ') : ''}`);
  ok(s.e.vista?.apartado?.id === abierto && (await respuestas(P, practica)).length === 0, 'las sondas no cambiaron el estado del simulador');
  // respuestas correctas e incorrectas, avance anticipado, adelantar el reloj, omitir
  s.editar({ selected: [1] });
  ok((await s.confirmar({ anticipado: true })) === 'ok' && s.e.vista!.apartado!.letra === 'B', 'avance anticipado con una respuesta incorrecta');
  await prof('pes_piloto_adelantar', { p_practica: practica, p_segundos: 200 });
  await s.cargar();
  s.editar({ text: '4.9 m/s^2' });
  ok(s.faltaMinimoS() === 0 && (await s.confirmar()) === 'ok', 'adelantar el reloj del simulador permite comprobar la puntuación completa sin esperar');
  ok((await s.omitir()) === 'ok' && s.e.fase === 'completada', 'omitir el último apartado completa la práctica');
  const d = await prof<{ respuestas: { estado: string | null; m: number; q: number; adelantado: boolean; accion: string }[]; puntaje: { provisional: { P: number } } }>('pes_piloto_detalle', { p_practica: practica });
  ok(d.respuestas.length === 3 && d.respuestas[0].estado === 'incorrect' && Number(d.respuestas[0].m) === 0.5 && d.respuestas[1].estado === 'correct'
    && Number(d.respuestas[1].m) === 1 && d.respuestas[1].adelantado && d.respuestas[2].accion === 'omitida', 'el profesor inspecciona la calificación de cada apartado (y ve qué tiempos adelantó)');
  const esperado = puntajePes([{ peso: 0.33333, q: 0, m: 0.5 }, { peso: 0.33333, q: 1, m: 1 }, { peso: 0.33334, q: 0, m: 1, omitido: true }], 1).provisional.p;
  ok(Math.abs(d.puntaje.provisional.P - esperado) < 1e-5, `puntuación del simulador = la del motor de TypeScript (${d.puntaje.provisional.P.toFixed(4)})`);
  // desconexión simulada en el simulador
  await prof('pes_piloto_reiniciar', { p_practica: practica });
  const red: Red = { modo: 'despues' };
  const s2 = sesion(P, practica, new AlmacenMemoria(), red);
  red.modo = 'ok'; await s2.cargar(); await s2.iniciar();
  ok(s2.e.vista?.apartado?.letra === 'A' && (await respuestas(P, practica)).length === 0, 'reiniciar el simulador vuelve a empezar desde A, sin respuestas');
  s2.editar({ selected: [0] });
  red.modo = 'despues';
  ok((await s2.confirmar({ anticipado: true })) === 'sin_conexion', 'desconexión simulada: la decisión queda pendiente en el dispositivo');
  red.modo = 'ok';
  await s2.reconectado();
  ok((await respuestas(P, practica)).length === 1 && s2.e.vista?.apartado?.letra === 'B', 'al reconectar se aplica una sola vez');
  // el simulador no aparece en nada de lo real
  const lista = await prof<{ id: string; asignados: number }[]>('pes_lista_docente', { p_class: CLASE });
  ok(lista.find((x) => x.id === practica)?.asignados === 0, 'el simulador no cuenta como estudiante asignado');
}

// ---------------------------------------------------------------------------------------------------------------
try {
  const { practica } = await preparar();
  await flujo(practica);
  await concurrencia(practica);
  await plazoYAdaptaciones(practica);
  await paridad();
  await simulador();
  await carga100();
  // las prácticas ordinarias no se tocaron
  const [{ n }] = await sql<{ n: string }>(`select count(*)::text n from public.attempts where user_id::text like 'de760000-%'`);
  ok(n === '0', 'ningún intento ordinario creado por la PES');
} catch (e) {
  fallos++;
  console.log('✖ error inesperado:', (e as Error).stack ?? e);
} finally {
  await limpiar().catch((e) => { fallos++; console.log('✖ no se pudieron borrar los datos de prueba:', (e as Error).message); });
  await pool.end();
}
console.log(fallos ? `\n✖ ${fallos} fallo(s), ${pasadas} comprobaciones correctas` : `\n✔ PES · FLUJO COMPLETO: ${pasadas} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
