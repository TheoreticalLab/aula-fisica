/**
 * Lógica de la Edge Function «calificar», independiente de Deno para poder probarla con Vitest.
 *
 * Acciones:
 *  - check     { attempt_id, exercise_id, answer }  → califica un ejercicio de práctica (retroalimentación inmediata)
 *  - submit    { attempt_id }                       → entrega y califica un intento completo de una actividad
 *  - finalize  { activity_id }                      → (profesor) entrega y califica los intentos que quedaron abiertos
 *  - variante  { attempt_id, exercise_id }          → parámetros de la versión de ese intento (nunca la respuesta)
 *  - adaptativo { attempt_id, tras }                → examen adaptativo: siguiente pregunta tras «tras» (sin revelar aciertos)
 *  - pes       { op: 'confirmar', practica_id, apartado_id, answer, anticipado, idem } → cierra el apartado abierto de una
 *              Práctica Extraordinaria Secuencial (sin revelar aciertos); { op: 'variante', practica_id, apartado_id } → sus números
 *
 * La autorización la deciden las funciones SQL svc_* (reciben el id del usuario verificado por el JWT);
 * este módulo solo interpreta y compara respuestas.
 */
import { grade, validateAnswerShape } from '../_shared/calificacion/calificar.ts';
import { gradeConArrastre } from '../_shared/calificacion/arrastre.ts';
import { claveConcreta, parametrosVariante } from '../_shared/calificacion/variante.ts';
import type { AnswerKey, GradeResult, StudentAnswer } from '../_shared/calificacion/tipos.ts';

export interface Db {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, `Parámetro ${name} inválido`);
  return v;
}

async function call<T>(db: Db, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    // Los errores de autorización (42501) y de reglas (P0001) traen mensajes pensados para el usuario.
    const status = error.code === '42501' ? 403 : error.code === 'P0001' || error.code === '22023' ? 409 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno al calificar' : error.message);
  }
  return data as T;
}

function safeGrade(key: AnswerKey | null, answer: StudentAnswer, optionCount?: number | null, previo?: string | null, ids?: { attempt: string; exercise: string }): GradeResult {
  if (!key) return { status: 'pending_review', credit: 0, messages: ['El ejercicio no tiene clave; lo revisará el profesor.'], code: 'no_key' };
  try {
    // variante por intento: la clave concreta (valor y errores típicos con SUS números) se calcula aquí, en el servidor
    if (key.format === 'numeric' && key.variante) {
      if (!ids) throw new Error('variante sin intento');
      key = claveConcreta(key, ids.attempt, ids.exercise);
    }
    if (key.format === 'numeric' && key.arrastre) return gradeConArrastre(key, answer.text ?? '', previo);
    return grade(key, answer, optionCount ?? undefined);
  } catch {
    // Clave mal escrita por el profesor: no se penaliza al estudiante, se envía a revisión manual.
    return { status: 'pending_review', credit: 0, messages: ['No se pudo calificar automáticamente; lo revisará el profesor.'], code: 'key_error' };
  }
}

/**
 * Respuesta del mismo estudiante, en el mismo intento, a la etapa anterior de un problema por etapas (arrastre).
 * Si la función SQL todavía no está en la base (migración pendiente) o falla, devuelve null: se califica sin arrastre.
 */
async function respuestaEtapa(db: Db, userId: string, attemptId: string, exerciseId: string, key: AnswerKey | null): Promise<string | null> {
  if (!key || key.format !== 'numeric' || !key.arrastre) return null;
  const { data, error } = await db.rpc('svc_respuesta_etapa', { p_user: userId, p_attempt: attemptId, p_exercise: exerciseId, p_desde: key.arrastre.desde });
  return error || typeof data !== 'string' ? null : data;
}

interface CheckContext {
  key: AnswerKey;
  format: string;
  option_count: number | null;
  max_tries: number;
}

interface SubmitItem {
  exercise_id: string;
  format: string;
  option_count: number | null;
  key: AnswerKey | null;
  answer: StudentAnswer | null;
  status: string | null;
}

async function gradeAndRecordSubmission(db: Db, userId: string, attemptId: string) {
  const ctx = await call<{ mode: string; items: SubmitItem[] }>(db, 'svc_submit_context', { p_user: userId, p_attempt: attemptId });
  const pendientes = ctx.items
    // en actividades de práctica, lo ya comprobado conserva su resultado
    .filter((it) => ctx.mode === 'exam' || it.status === null || it.status === 'draft' || it.status === 'invalid');
  const previos = await Promise.all(pendientes.map((it) => respuestaEtapa(db, userId, attemptId, it.exercise_id, it.key)));
  // Práctica de Control (migración 62): un formato no interpretable no es un cero, lo revisa el profesor
  const control = ctx.mode === 'exam' && (await esControl(db, attemptId));
  const results = pendientes
    .map((it, i) => {
      const answer = validateAnswerShape(it.answer ?? {}) ?? {};
      const r = safeGrade(it.key, answer, it.option_count, previos[i], { attempt: attemptId, exercise: it.exercise_id });
      if (r.status === 'invalid' && control && tieneContenido(answer)) {
        return { exercise_id: it.exercise_id, answer, status: 'pending_review', credit: 0, code: 'format_review', messages: ['No se pudo interpretar automáticamente: lo revisará el profesor. ' + r.messages.join(' ')] };
      }
      if (r.status === 'invalid') {
        return { exercise_id: it.exercise_id, answer, status: 'incorrect', credit: 0, code: 'blank', messages: ['Sin respuesta válida: ' + r.messages.join(' ')] };
      }
      return { exercise_id: it.exercise_id, answer, status: r.status, credit: r.credit, code: r.code, messages: r.messages };
    });
  return call<{ status: string }>(db, 'svc_record_submission', { p_user: userId, p_attempt: attemptId, p_results: results });
}

/**
 * Tiempo mínimo de realización (migración 78): el ESTUDIANTE no puede entregar antes de cumplir el tiempo activo
 * mientras la práctica siga abierta. La entrega del profesor («finalize») no pasa por aquí: allí la nota se reduce.
 * Si la función aún no existe (migración pendiente) no se bloquea; cualquier otro fallo impide la entrega.
 */
async function verificarTiempoMinimo(db: Db, userId: string, attemptId: string): Promise<void> {
  const { error } = await db.rpc('svc_tiempo_minimo_verificar', { p_user: userId, p_attempt: attemptId });
  if (!error) return;
  if (error.code === 'P0001') throw new HttpError(409, error.message);
  if (error.code === '42883' || error.code === 'PGRST202') return;
  throw new HttpError(500, 'Error interno al comprobar el tiempo mínimo');
}

/** ¿Es el intento de una Práctica de Control? Si la función aún no existe (migración pendiente), se trata como examen normal. */
async function esControl(db: Db, attemptId: string): Promise<boolean> {
  const { data, error } = await db.rpc('svc_es_control', { p_attempt: attemptId });
  return !error && data === true;
}

const tieneContenido = (a: StudentAnswer) => !!(a.text?.trim() || a.selected?.length || typeof a.value === 'boolean');

/** Mensaje del primer intento cuando la respuesta no se entiende: genérico, para no revelar la unidad ni el resultado. */
export const MENSAJE_FORMATO_INICIAL = 'No se pudo interpretar la respuesta. Revise el número y la unidad (por ejemplo, 9.8 m/s^2) o marque «No sé resolverlo».';

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Práctica con aprendizaje asistido (acción «asistida»):
 *  - inicial        primer intento + declaración. Solo se valida que se pueda interpretar; NUNCA se devuelve si es correcto.
 *  - corregida      respuesta después de estudiar: retroalimentación normal del motor (comprobaciones limitadas).
 *  - transferencia  ejercicio distinto con el mismo concepto: retroalimentación normal.
 * Las reglas de orden, inmutabilidad y permisos las impone el servidor (svc_asistida_*). Idempotente por client_id.
 */
const FUENTES_AYUDA = ['ia', 'libro', 'apuntes', 'persona', 'video', 'simulador'];

async function pasoAsistido(b: Record<string, unknown>, userId: string, db: Db): Promise<unknown> {
  const attempt = uuid(b.attempt_id, 'attempt_id');
  const exercise = uuid(b.exercise_id, 'exercise_id');
  const clientId = uuid(b.client_id, 'client_id');
  const fase = b.fase;
  if (fase !== 'inicial' && fase !== 'corregida' && fase !== 'transferencia') throw new HttpError(400, 'Fase inválida');
  const noSe = fase === 'inicial' && b.no_se === true;
  const answer = noSe ? {} : validateAnswerShape(b.answer);
  if (!answer) throw new HttpError(400, 'Respuesta con formato inválido');
  if (fase === 'inicial' && !['autonomo', 'consulto_ayuda', 'no_pudo'].includes(String(b.declaracion))) throw new HttpError(400, 'Indique cómo realizó el primer intento');
  const ctx = await call<{ repetido?: boolean; estado?: unknown; key: AnswerKey | null; option_count: number | null; transfer_exercise_id?: string | null }>(db, 'svc_asistida_contexto',
    { p_user: userId, p_attempt: attempt, p_exercise: exercise, p_fase: fase, p_client_id: clientId });
  if (ctx.repetido) return { guardado: true, repetido: true, estado: ctx.estado };
  const result: GradeResult = noSe
    ? { status: 'incorrect', credit: 0, messages: ['No supo resolverlo en el primer intento.'], code: 'no_se' }
    // la transferencia se califica con la clave (y la variante) de SU ejercicio, no la del ejercicio original
    : safeGrade(ctx.key, answer, ctx.option_count, null, { attempt, exercise: fase === 'transferencia' && ctx.transfer_exercise_id ? ctx.transfer_exercise_id : exercise });
  if (!noSe && result.status === 'invalid') {
    // no se guarda: el estudiante corrige el formato (en el primer intento, sin pistas sobre la respuesta)
    return { guardado: false, mensajes: fase === 'inicial' ? [MENSAJE_FORMATO_INICIAL] : result.messages };
  }
  // tipos de ayuda del primer intento (migración 61): el servidor descarta los desconocidos
  const fuentes = fase === 'inicial' && b.declaracion === 'consulto_ayuda' && Array.isArray(b.fuentes)
    ? b.fuentes.filter((f): f is string => typeof f === 'string' && FUENTES_AYUDA.includes(f)).slice(0, 6) : null;
  const datos = { answer, procedimiento: texto(b.procedimiento, 5000), explicacion: texto(b.explicacion, 3000), no_se: noSe, declaracion: fase === 'inicial' ? b.declaracion : null, fuentes };
  const estado = await call<unknown>(db, 'svc_asistida_registrar', {
    p_user: userId, p_attempt: attempt, p_exercise: exercise, p_fase: fase, p_datos: datos, p_resultado: result, p_client_id: clientId,
  });
  return fase === 'inicial' ? { guardado: true, estado } : { guardado: true, resultado: result, estado };
}

export async function handle(body: unknown, userId: string, db: Db): Promise<unknown> {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Cuerpo inválido');
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'check': {
      const attempt = uuid(b.attempt_id, 'attempt_id');
      const exercise = uuid(b.exercise_id, 'exercise_id');
      const answer = validateAnswerShape(b.answer);
      if (!answer) throw new HttpError(400, 'Respuesta con formato inválido');
      const ctx = await call<CheckContext>(db, 'svc_check_context', { p_user: userId, p_attempt: attempt, p_exercise: exercise });
      const result = safeGrade(ctx.key, answer, ctx.option_count, await respuestaEtapa(db, userId, attempt, exercise, ctx.key), { attempt, exercise });
      if (result.status === 'invalid') {
        // No se pudo interpretar: no consume intento y se guarda como borrador.
        await call(db, 'svc_save_draft', { p_user: userId, p_attempt: attempt, p_exercise: exercise, p_answer: answer }).catch(() => undefined);
        return { result, recorded: false };
      }
      const state = await call<Record<string, unknown>>(db, 'svc_record_check', {
        p_user: userId,
        p_attempt: attempt,
        p_exercise: exercise,
        p_answer: answer,
        p_result: result,
      });
      return { result, recorded: true, state };
    }
    case 'submit': {
      const attempt = uuid(b.attempt_id, 'attempt_id');
      await verificarTiempoMinimo(db, userId, attempt);
      const state = await gradeAndRecordSubmission(db, userId, attempt);
      return { state };
    }
    case 'finalize': {
      const activity = uuid(b.activity_id, 'activity_id');
      const open = await call<{ attempt_id: string; user_id: string }[]>(db, 'svc_finalize_context', { p_teacher: userId, p_activity: activity });
      let done = 0;
      const errors: string[] = [];
      for (const o of open) {
        try {
          await gradeAndRecordSubmission(db, o.user_id, o.attempt_id);
          done++;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      return { finalized: done, errors };
    }
    case 'asistida':
      return pasoAsistido(b, userId, db);
    case 'adaptativo': {
      // examen adaptativo: califica aquí, SIN devolverlas, las respuestas ya dadas y pide la siguiente pregunta.
      // Al estudiante solo le llega qué pregunta sigue (o que terminó); nunca si acertó.
      const attempt = uuid(b.attempt_id, 'attempt_id');
      const tras = uuid(b.tras, 'tras');
      const ctx = await call<{ mode: string; items: SubmitItem[] }>(db, 'svc_submit_context', { p_user: userId, p_attempt: attempt });
      const creditos = Object.fromEntries(ctx.items.map((it) => {
        const answer = validateAnswerShape(it.answer ?? {}) ?? {};
        const r = safeGrade(it.key, answer, it.option_count, null, { attempt, exercise: it.exercise_id });
        return [it.exercise_id, r.status === 'invalid' || r.status === 'pending_review' ? 0 : r.credit];
      }));
      const r = await call<{ siguiente: string | null; fin: boolean; administradas: number; max_items: number }>(db, 'svc_adaptativo_siguiente',
        { p_user: userId, p_attempt: attempt, p_tras: tras, p_creditos: creditos });
      return { siguiente: r.siguiente, fin: r.fin, administradas: r.administradas, max_items: r.max_items };
    }
    case 'variante': {
      // números del enunciado de SU versión (sin respuestas). Autorización: el dueño del intento o su profesorado.
      const attempt = uuid(b.attempt_id, 'attempt_id');
      const exercise = uuid(b.exercise_id, 'exercise_id');
      const def = await call<{ plantilla: string } | null>(db, 'svc_variante_info', { p_user: userId, p_attempt: attempt, p_exercise: exercise });
      if (!def?.plantilla) return { parametros: null };
      return { parametros: parametrosVariante(def.plantilla, attempt, exercise).parametros };
    }
    case 'pes': {
      // Práctica Extraordinaria Secuencial: solo el apartado ABIERTO del propio estudiante (lo comprueban las svc_pes_*).
      const practica = uuid(b.practica_id, 'practica_id');
      const apartado = uuid(b.apartado_id, 'apartado_id');
      if (b.op === 'variante') {
        const def = await call<{ plantilla: string | null; semilla: string }>(db, 'svc_pes_variante', { p_user: userId, p_practica: practica, p_apartado: apartado });
        return { parametros: def?.plantilla ? parametrosVariante(def.plantilla, def.semilla, apartado).parametros : null };
      }
      if (b.op !== 'confirmar') throw new HttpError(400, 'Operación desconocida');
      const idem = uuid(b.idem, 'idem');
      const answer = validateAnswerShape(b.answer);
      if (!answer) throw new HttpError(400, 'Respuesta con formato inválido');
      const ctx = await call<{ clave: AnswerKey | null; opciones: number; previo: string | null; semilla: string }>(db, 'svc_pes_preparar', {
        p_user: userId, p_practica: practica, p_apartado: apartado,
      });
      // la variante usa la semilla de la asignación del estudiante (sus números) y el apartado
      const result = safeGrade(ctx.clave, answer, ctx.opciones || null, ctx.previo, { attempt: ctx.semilla, exercise: apartado });
      // Respuesta que no se pudo interpretar: NO cierra el apartado (es irreversible); se pide corregir el formato.
      if (result.status === 'invalid') return { confirmado: false, mensajes: result.messages };
      const estado = await call<Record<string, unknown>>(db, 'svc_pes_confirmar', {
        p_user: userId, p_practica: practica, p_apartado: apartado, p_respuesta: answer,
        p_resultado: { status: result.status, credit: result.credit, code: result.code ?? null },
        p_anticipado: b.anticipado === true, p_idem: idem,
      });
      // al estudiante no se le dice si acertó (los resultados se publican después)
      return { confirmado: true, estado };
    }
    default:
      throw new HttpError(400, 'Acción desconocida');
  }
}
