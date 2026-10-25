/**
 * Prueba de punta a punta contra el proyecto real, por el MISMO camino que la interfaz
 * (Edge Functions «acceder», «admin-cuentas» y «calificar», RPC y RLS). Sin claves privilegiadas.
 * Se ejecuta con pruebas/prueba_e2e.py, que pide el ID y la contraseña del administrador sin mostrarlos.
 * Crea datos marcados con «PRUEBA»: una sección, la cuenta prueba-NN y una evaluación.
 * No imprime contraseñas ni tokens.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ROOT = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const ADMIN_ID = process.env.AULA_ADMIN_ID ?? '';
const ADMIN_PW = process.env.AULA_ADMIN_PASSWORD ?? '';
let fallos = 0;
const ok = (cond: boolean, txt: string) => {
  if (!cond) fallos++;
  console.log(`${cond ? '✔' : '✖'} ${txt}`);
};
// La prueba no usa Realtime; en Node 18 no hay WebSocket nativo, así que se le da uno vacío.
class SinWebSocket {
  constructor() {
    throw new Error('Realtime no se usa en esta prueba');
  }
}
const cliente = () =>
  createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: SinWebSocket as unknown as typeof WebSocket },
  });

async function fn<T>(sb: SupabaseClient | null, nombre: string, body: Record<string, unknown>) {
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
  const r = await fetch(`${URL_}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ANON}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  return { data: (r.ok ? j : null) as T | null, status: r.status, error: r.ok ? undefined : (j?.error as string | undefined) };
}

async function entrar(id: string, password: string) {
  const r = await fn<{ access_token: string; refresh_token: string; must_change_password: boolean }>(null, 'acceder', { id, password });
  if (!r.data) return { sb: null, r };
  const sb = cliente();
  await sb.auth.setSession({ access_token: r.data.access_token, refresh_token: r.data.refresh_token });
  return { sb, r };
}

async function main() {
  // --- administrador: entra con su ID por la función «acceder» ---
  const a = await entrar(ADMIN_ID, ADMIN_PW);
  ok(!!a.sb, `El administrador entra con su ID por «acceder»${a.r.error ? ': ' + a.r.error : ''}`);
  if (!a.sb) return;
  const admin = a.sb;
  const course = (await admin.from('courses').select('id').eq('code', 'FIS-BASICA').single()).data!.id as string;
  const leccion = (await admin.from('lessons').select('id').eq('slug', 'mru').single()).data!.id as string;
  const ejs = (await admin.from('exercises').select('id, slug').in('slug', ['b2-mru-01', 'b2-mru-02', 'b2-mru-04', 'b2-mru-06'])).data ?? [];
  const ej = Object.fromEntries(ejs.map((e) => [e.slug, e.id as string]));

  // --- 1. sección y cuenta de prueba ---
  const { data: seccion, error: e1 } = await admin.from('classes').insert({ course_id: course, name: 'PRUEBA – Sección de prueba', term: 'prueba' }).select().single();
  ok(!e1 && !!seccion, `Sección de prueba creada${e1 ? ': ' + e1.message : ''}`);
  if (!seccion) return;
  const idPrueba = `prueba-${Date.now().toString(36).slice(-5)}`;
  const cre = await fn<{ resultados: { password?: string; matriculas?: number; error?: string }[] }>(admin, 'admin-cuentas', {
    accion: 'crear',
    cuentas: [{ login_id: idPrueba, full_name: 'Estudiante de Prueba', class_ids: [seccion.id] }],
  });
  const r0 = cre.data?.resultados[0];
  ok(!!r0?.password && r0.matriculas === 1, `Cuenta ${idPrueba} creada con contraseña provisional y matriculada${cre.error ? ': ' + cre.error : r0?.error ? ': ' + r0.error : ''}`);
  if (!r0?.password) return;

  // --- 2. acceso del estudiante ---
  const malo = await fn(null, 'acceder', { id: idPrueba, password: 'incorrecta-123' });
  const noExiste = await fn(null, 'acceder', { id: 'no-existe-777', password: 'incorrecta-123' });
  ok(malo.status === 401 && noExiste.status === 401 && malo.error === noExiste.error, `Contraseña incorrecta e ID inexistente reciben la misma respuesta («${malo.error}»)`);
  const e = await entrar(idPrueba.toUpperCase(), r0.password);
  ok(!!e.sb && e.r.data?.must_change_password === true, 'Entra con el ID (en mayúsculas) y la contraseña provisional; se le pide cambiarla');
  if (!e.sb) return;
  const est = e.sb;
  const antes = await est.rpc('my_classes');
  ok(Array.isArray(antes.data) && antes.data.length === 0, 'Con la contraseña provisional no ve ninguna clase');
  ok(!!(await est.rpc('confirm_password_changed')).error, 'No puede saltarse el cambio sin cambiar realmente la contraseña');
  const up = await est.auth.updateUser({ password: 'Prueba-' + randomUUID().slice(0, 12) });
  ok(!up.error, `Contraseña cambiada${up.error ? ': ' + up.error.message : ''}`);
  ok((await est.rpc('confirm_password_changed')).data === true, 'El servidor confirma el cambio de contraseña');
  const despues = await est.rpc('my_classes');
  ok(Array.isArray(despues.data) && despues.data.length === 1, 'Ahora ve exactamente su sección');

  // --- 3. práctica calificada en el servidor ---
  const { data: att } = await est.rpc('start_lesson_practice', { p_lesson: leccion });
  type Chk = { result: { status: string; messages: string[] }; state?: { credit: number; solution: unknown } };
  const mal = await fn<Chk>(est, 'calificar', { action: 'check', attempt_id: att, exercise_id: ej['b2-mru-01'], answer: { text: '1.6 m' } });
  ok(mal.data?.result.status === 'incorrect', `Error típico diagnosticado: «${mal.data?.result.messages[0] ?? mal.error}»`);
  const unidad = await fn<Chk>(est, 'calificar', { action: 'check', attempt_id: att, exercise_id: ej['b2-mru-01'], answer: { text: '1000 s' } });
  ok(unidad.data?.result.status === 'incorrect', `Unidad equivocada detectada: «${unidad.data?.result.messages[0] ?? unidad.error}»`);
  const bien = await fn<Chk>(est, 'calificar', { action: 'check', attempt_id: att, exercise_id: ej['b2-mru-01'], answer: { text: '1 km' } });
  ok(bien.data?.result.status === 'correct' && !!bien.data.state?.solution, `«1 km» aceptado como equivalente a 1000 m (crédito ${bien.data?.state?.credit} por los reintentos) y se muestra la solución`);
  ok(!!(await est.rpc('get_hint', { p_attempt: att, p_exercise: ej['b2-mru-02'] })).data?.hint, 'Pista progresiva disponible en la práctica');

  // --- 4. evaluación ---
  const { data: act, error: e4 } = await admin
    .from('activities')
    .insert({ class_id: seccion.id, title: 'PRUEBA – Evaluación', mode: 'exam', reveal_policy: 'after_submit', hints_enabled: false, max_attempts: 1, published: true })
    .select()
    .single();
  ok(!e4 && !!act, `Evaluación creada${e4 ? ': ' + e4.message : ''}`);
  if (!act) return;
  await admin.from('activity_items').insert([
    { activity_id: act.id, exercise_id: ej['b2-mru-04'], position: 1 },
    { activity_id: act.id, exercise_id: ej['b2-mru-06'], position: 2 },
  ]);
  const { data: intento, error: e5 } = await est.rpc('start_activity_attempt', { p_activity: act.id });
  ok(!e5 && !!intento, 'El estudiante empieza la evaluación');
  await est.rpc('save_response', { p_attempt: intento, p_exercise: ej['b2-mru-04'], p_answer: { selected: [2] } });
  await est.rpc('save_response', { p_attempt: intento, p_exercise: ej['b2-mru-06'], p_answer: { selected: [0] } });
  const vAntes = await est.rpc('get_attempt', { p_attempt: intento });
  ok((vAntes.data?.items ?? []).every((i: { solution: unknown }) => i.solution === null), 'Durante la evaluación no se ven soluciones');
  ok(!!(await est.rpc('get_hint', { p_attempt: intento, p_exercise: ej['b2-mru-04'] })).error, 'En la evaluación no hay pistas');
  const ent = await fn<{ state: { status: string } }>(est, 'calificar', { action: 'submit', attempt_id: intento });
  ok(ent.data?.state.status === 'submitted', `Evaluación entregada y calificada en el servidor${ent.error ? ': ' + ent.error : ''}`);
  const v = await est.rpc('get_attempt', { p_attempt: intento });
  const estados = (v.data?.items ?? []).map((i: { response: { status: string } }) => i.response?.status);
  ok(JSON.stringify(estados) === '["correct","incorrect"]' && v.data?.attempt.score === null, `Tras entregar ve qué acertó (${estados.join(', ')}) pero no su nota mientras no se publique`);
  const gb = await admin.rpc('gradebook', { p_class: seccion.id });
  const nota = gb.data?.students?.[0]?.grades?.[act.id]?.best;
  ok(Number(nota) === 1, `El profesor ve la nota en el libro de calificaciones: ${nota} de 2`);
  await admin.from('activities').update({ grades_published: true }).eq('id', act.id);
  ok(Number((await est.rpc('get_attempt', { p_attempt: intento })).data?.attempt.score) === 1, 'Tras publicar las notas, el estudiante ve la suya');

  // --- 5. seguridad desde la sesión del estudiante ---
  ok(((await est.from('exercise_keys').select('exercise_id').limit(1)).data ?? []).length === 0, 'El estudiante no puede leer claves de respuesta');
  ok(((await est.from('responses').select('id').limit(1)).data ?? []).length === 0, 'El estudiante no lee la tabla de respuestas directamente');
  const perfiles = (await est.from('profiles').select('role')).data ?? [];
  ok(perfiles.filter((p) => p.role === 'student').length === 1, `Solo ve su propio perfil de estudiante (perfiles visibles: ${perfiles.length}, el suyo y el de su profesor)`);
  ok((await fn(est, 'admin-cuentas', { accion: 'crear', cuentas: [{ login_id: 'intruso-1', full_name: 'X' }] })).status === 403, 'Un estudiante no puede usar la gestión de cuentas');

  // --- 6. activación con la clave de la sección ---
  const clave = (await admin.from('classes').select('join_code').eq('id', seccion.id).single()).data?.join_code as string;
  const idAct = `activa-${Date.now().toString(36).slice(-5)}`;
  const claveMala = await fn(null, 'activar', { clave: 'ZZZZZZZZ', id: idAct, nombre: 'Estudiante Activado', password: 'Fisica-2026-' + randomUUID().slice(0, 6) });
  ok(claveMala.status === 400, `Una clave de sección incorrecta se rechaza («${claveMala.error}»)`);
  const pwAct = 'Fisica-2026-' + randomUUID().slice(0, 6);
  const act2 = await fn<{ seccion: string; access_token?: string; refresh_token?: string }>(null, 'activar', {
    clave: clave.toLowerCase(),
    id: idAct,
    nombre: 'Estudiante Activado',
    password: pwAct,
  });
  ok(act2.status === 200 && act2.data?.seccion === 'PRUEBA – Sección de prueba' && !!act2.data?.access_token, `Activación con la clave de la sección${act2.error ? ': ' + act2.error : ''}`);
  const repetida = await fn(null, 'activar', { clave, id: idAct, nombre: 'Otro Nombre', password: pwAct });
  ok(repetida.status === 409, 'No se puede activar dos veces el mismo ID');
  const ea = await entrar(idAct, pwAct);
  ok(!!ea.sb && ea.r.data?.must_change_password === false, 'El estudiante activado entra con su ID y la contraseña que eligió (sin cambio obligatorio)');
  if (ea.sb) {
    const cl = (await ea.sb.rpc('my_classes')).data ?? [];
    ok(cl.length === 1 && cl[0].class_id === seccion.id, 'Queda matriculado solo en su sección');
    await ea.sb.auth.signOut();
  }
  await admin.from('classes').update({ join_open: false }).eq('id', seccion.id);
  const cerrada = await fn(null, 'activar', { clave, id: idAct + 'x', nombre: 'Tarde Llegado', password: pwAct });
  ok(cerrada.status === 400 && /cerrada/.test(String(cerrada.error)), 'Con la activación cerrada, la clave ya no sirve');

  await est.auth.signOut();
  await admin.auth.signOut();
  console.log(`\nDatos de prueba creados: sección «PRUEBA – Sección de prueba», cuenta ${idPrueba}, evaluación «PRUEBA – Evaluación».`);
}

main()
  .catch((e) => {
    fallos++;
    console.log('✖ Error inesperado: ' + String(e?.message ?? e).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ***'));
  })
  .finally(() => {
    console.log(fallos ? `\n✖ ${fallos} comprobaciones fallaron` : '\n✔ PRUEBA DE PUNTA A PUNTA SUPERADA');
    process.exit(fallos ? 1 : 0);
  });
