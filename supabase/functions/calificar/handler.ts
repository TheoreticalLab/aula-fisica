/**
 * Lógica de la Edge Function «calificar», independiente de Deno para poder probarla con Vitest.
 *
 * Acciones:
 *  - check     { attempt_id, exercise_id, answer }  → califica un ejercicio de práctica (retroalimentación inmediata)
 *  - submit    { attempt_id }                       → entrega y califica un intento completo de una actividad
 *  - finalize  { activity_id }                      → (profesor) entrega y califica los intentos que quedaron abiertos
 *
 * La autorización la deciden las funciones SQL svc_* (reciben el id del usuario verificado por el JWT);
 * este módulo solo interpreta y compara respuestas.
 */
import { grade, validateAnswerShape } from '../_shared/calificacion/calificar.ts';
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

function safeGrade(key: AnswerKey | null, answer: StudentAnswer, optionCount?: number | null): GradeResult {
  if (!key) return { status: 'pending_review', credit: 0, messages: ['El ejercicio no tiene clave; lo revisará el profesor.'], code: 'no_key' };
  try {
    return grade(key, answer, optionCount ?? undefined);
  } catch {
    // Clave mal escrita por el profesor: no se penaliza al estudiante, se envía a revisión manual.
    return { status: 'pending_review', credit: 0, messages: ['No se pudo calificar automáticamente; lo revisará el profesor.'], code: 'key_error' };
  }
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
  const results = ctx.items
    // en actividades de práctica, lo ya comprobado conserva su resultado
    .filter((it) => ctx.mode === 'exam' || it.status === null || it.status === 'draft' || it.status === 'invalid')
    .map((it) => {
      const answer = validateAnswerShape(it.answer ?? {}) ?? {};
      const r = safeGrade(it.key, answer, it.option_count);
      if (r.status === 'invalid') {
        return { exercise_id: it.exercise_id, answer, status: 'incorrect', credit: 0, code: 'blank', messages: ['Sin respuesta válida: ' + r.messages.join(' ')] };
      }
      return { exercise_id: it.exercise_id, answer, status: r.status, credit: r.credit, code: r.code, messages: r.messages };
    });
  return call<{ status: string }>(db, 'svc_record_submission', { p_user: userId, p_attempt: attemptId, p_results: results });
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
      const result = safeGrade(ctx.key, answer, ctx.option_count);
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
    default:
      throw new HttpError(400, 'Acción desconocida');
  }
}
