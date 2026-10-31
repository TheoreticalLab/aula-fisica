/**
 * Pruebas de la Edge Function «calificar» con una base de datos simulada.
 */
import { describe, expect, it } from 'vitest';
import { handle, HttpError, type Db } from '../supabase/functions/calificar/handler.ts';

const A = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';

function mockDb(responses: Record<string, unknown>, errors: Record<string, { message: string; code?: string }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: Db = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (errors[fn]) return { data: null, error: errors[fn] };
      return { data: responses[fn] ?? null, error: null };
    },
  };
  return { db, calls };
}

describe('acción check', () => {
  it('califica en el servidor y registra el resultado', async () => {
    const { db, calls } = mockDb({
      svc_check_context: { key: { format: 'numeric', value: '20 m/s' }, format: 'numeric', option_count: null, max_tries: 3 },
      svc_record_check: { status: 'correct', credit: 1, tries: 1, locked: true },
    });
    const out = (await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '72 km/h' } }, U, db)) as {
      result: { status: string };
      recorded: boolean;
    };
    expect(out.result.status).toBe('correct');
    expect(out.recorded).toBe(true);
    expect(calls.map((c) => c.fn)).toEqual(['svc_check_context', 'svc_record_check']);
    // el id de usuario lo pone el servidor, no el cliente
    expect(calls[0].args.p_user).toBe(U);
    expect(calls[1].args.p_result).toMatchObject({ status: 'correct', credit: 1 });
  });

  it('una respuesta ilegible no consume intento', async () => {
    const { db, calls } = mockDb({
      svc_check_context: { key: { format: 'numeric', value: '20 m/s' }, format: 'numeric', option_count: null, max_tries: 3 },
    });
    const out = (await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: 'veinte' } }, U, db)) as { recorded: boolean };
    expect(out.recorded).toBe(false);
    expect(calls.map((c) => c.fn)).toEqual(['svc_check_context', 'svc_save_draft']);
  });

  it('no devuelve la clave al cliente', async () => {
    const { db } = mockDb({
      svc_check_context: { key: { format: 'choice', correct: [2] }, format: 'choice', option_count: 4, max_tries: 3 },
      svc_record_check: { status: 'incorrect', credit: 0, tries: 1, locked: false, solution: null },
    });
    const out = await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { selected: [0] } }, U, db);
    expect(JSON.stringify(out)).not.toContain('"correct":[2]');
  });

  it('propaga los rechazos de autorización como 403', async () => {
    const { db } = mockDb({}, { svc_check_context: { message: 'El ejercicio no pertenece a este intento', code: '42501' } });
    await expect(handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '1' } }, U, db)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('oculta los errores internos', async () => {
    const { db } = mockDb({}, { svc_check_context: { message: 'relation "x" does not exist', code: '42P01' } });
    const p = handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '1' } }, U, db);
    await expect(p).rejects.toBeInstanceOf(HttpError);
    await expect(p).rejects.toMatchObject({ status: 500, message: 'Error interno al calificar' });
  });

  it('valida parámetros', async () => {
    const { db } = mockDb({});
    await expect(handle({ action: 'check', attempt_id: 'x', exercise_id: E, answer: {} }, U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { selected: 'a' } }, U, db)).rejects.toMatchObject({
      status: 400,
    });
    await expect(handle({ action: 'borrar' }, U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle(null, U, db)).rejects.toMatchObject({ status: 400 });
  });

  it('una clave mal escrita va a revisión manual sin penalizar', async () => {
    const { db, calls } = mockDb({
      svc_check_context: { key: { format: 'numeric', value: 'mal' }, format: 'numeric', option_count: null, max_tries: 3 },
      svc_record_check: { status: 'pending_review' },
    });
    await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '3 m' } }, U, db);
    expect(calls[1].args.p_result).toMatchObject({ status: 'pending_review', code: 'key_error' });
  });
});

describe('acción submit', () => {
  it('califica todos los ítems de una evaluación', async () => {
    const E2 = '44444444-4444-4444-8444-444444444444';
    const E3 = '55555555-5555-4555-8555-555555555555';
    const { db, calls } = mockDb({
      svc_submit_context: {
        mode: 'exam',
        items: [
          { exercise_id: E, format: 'numeric', option_count: null, key: { format: 'numeric', value: '9.8 m/s^2' }, answer: { text: '9.81 m/s²' }, status: 'draft' },
          { exercise_id: E2, format: 'choice', option_count: 4, key: { format: 'choice', correct: [1] }, answer: null, status: 'draft' },
          { exercise_id: E3, format: 'open', option_count: null, key: { format: 'open', rubric: 'r' }, answer: { text: 'desarrollo' }, status: 'draft' },
        ],
      },
      svc_record_submission: { status: 'submitted' },
    });
    await handle({ action: 'submit', attempt_id: A }, U, db);
    const results = calls[1].args.p_results as { exercise_id: string; status: string; code: string }[];
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ exercise_id: E, status: 'correct' });
    expect(results[1]).toMatchObject({ exercise_id: E2, status: 'incorrect', code: 'blank' });
    expect(results[2]).toMatchObject({ exercise_id: E3, status: 'pending_review' });
  });

  it('en una actividad de práctica respeta lo ya comprobado', async () => {
    const { db, calls } = mockDb({
      svc_submit_context: {
        mode: 'practice',
        items: [
          { exercise_id: E, format: 'choice', option_count: 3, key: { format: 'choice', correct: [0] }, answer: { selected: [0] }, status: 'correct' },
        ],
      },
      svc_record_submission: { status: 'submitted' },
    });
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(calls[1].args.p_results).toEqual([]);
  });
});

describe('acción finalize', () => {
  it('entrega los intentos abiertos de cada estudiante con su propio id', async () => {
    const S1 = '66666666-6666-4666-8666-666666666666';
    const { db, calls } = mockDb({
      svc_finalize_context: [{ attempt_id: A, user_id: S1 }],
      svc_submit_context: { mode: 'exam', items: [] },
      svc_record_submission: { status: 'submitted' },
    });
    const out = (await handle({ action: 'finalize', activity_id: E }, U, db)) as { finalized: number };
    expect(out.finalized).toBe(1);
    expect(calls[0].args.p_teacher).toBe(U);
    expect(calls[1].args.p_user).toBe(S1);
  });
});

describe('arrastre en problemas por etapas', () => {
  const clave = { format: 'numeric', value: '3.2 m', arrastre: { desde: 'mec-u9c-15-4', expresion: 'x^2/(2*0.25*10)' } };
  const ctx = { svc_check_context: { key: clave, format: 'numeric', option_count: null, max_tries: 3 }, svc_record_check: { status: 'correct' } };

  it('check: con la respuesta previa del mismo estudiante no penaliza dos veces', async () => {
    const { db, calls } = mockDb({ ...ctx, svc_respuesta_etapa: '6 m/s' });
    const out = (await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '7.2 m' } }, U, db)) as { result: { status: string; code: string } };
    expect(out.result).toMatchObject({ status: 'correct', code: 'arrastre' });
    const consulta = calls.find((c) => c.fn === 'svc_respuesta_etapa')!;
    expect(consulta.args).toEqual({ p_user: U, p_attempt: A, p_exercise: E, p_desde: 'mec-u9c-15-4' });
  });
  it('check: si la función aún no existe en la base, califica sin arrastre', async () => {
    const { db } = mockDb(ctx, { svc_respuesta_etapa: { message: 'function does not exist', code: '42883' } });
    const out = (await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '7.2 m' } }, U, db)) as { result: { status: string } };
    expect(out.result.status).toBe('incorrect');
  });
  it('check: sin arrastre en la clave no se consulta nada más', async () => {
    const { db, calls } = mockDb({ svc_check_context: { key: { format: 'numeric', value: '3.2 m' }, format: 'numeric', option_count: null, max_tries: 3 } });
    await handle({ action: 'check', attempt_id: A, exercise_id: E, answer: { text: '3.2 m' } }, U, db);
    expect(calls.some((c) => c.fn === 'svc_respuesta_etapa')).toBe(false);
  });
  it('submit: el arrastre también vale al entregar una evaluación', async () => {
    const { db, calls } = mockDb({
      svc_submit_context: { mode: 'exam', items: [{ exercise_id: E, format: 'numeric', option_count: null, key: clave, answer: { text: '7.2 m' }, status: 'draft' }] },
      svc_respuesta_etapa: '6 m/s',
      svc_record_submission: { status: 'submitted' },
    });
    await handle({ action: 'submit', attempt_id: A }, U, db);
    const rec = calls.find((c) => c.fn === 'svc_record_submission')!;
    expect((rec.args.p_results as { status: string; code: string }[])[0]).toMatchObject({ status: 'correct', code: 'arrastre' });
  });
});
