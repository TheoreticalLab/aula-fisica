/**
 * Acción «pes» de la función «calificar» (Práctica Extraordinaria Secuencial) con una base simulada:
 * califica en el servidor, nunca devuelve el acierto, no cierra un apartado con una respuesta ilegible y usa la
 * semilla de la asignación para las variantes.
 */
import { describe, expect, it } from 'vitest';
import { claveConcreta, parametrosVariante } from '../supabase/functions/_shared/calificacion/variante.ts';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos.ts';
import { handle, HttpError, type Db } from '../supabase/functions/calificar/handler.ts';

const PR = '11111111-1111-4111-8111-111111111111';
const AP = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';
const SEM = '44444444-4444-4444-8444-444444444444';
const IDEM = '55555555-5555-4555-8555-555555555555';

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
const preparar = (clave: unknown, extra: Record<string, unknown> = {}) => ({ svc_pes_preparar: { clave, opciones: 0, previo: null, semilla: SEM, ...extra }, svc_pes_confirmar: { repetida: false, accion: 'confirmada', actual: { estado: 'apartado_abierto' } } });
const confirmar = (answer: unknown, extra: Record<string, unknown> = {}) => ({ action: 'pes', op: 'confirmar', practica_id: PR, apartado_id: AP, answer, idem: IDEM, ...extra });

describe('acción pes · confirmar', () => {
  it('califica en el servidor, registra el resultado y NO lo devuelve al estudiante', async () => {
    const { db, calls } = mockDb(preparar({ format: 'numeric', value: '5 m', relTol: 0.02 }));
    const out = (await handle(confirmar({ text: '5.0 m' }), U, db)) as Record<string, unknown>;
    expect(calls.map((c) => c.fn)).toEqual(['svc_pes_preparar', 'svc_pes_confirmar']);
    expect(calls[0].args).toEqual({ p_user: U, p_practica: PR, p_apartado: AP });
    expect(calls[1].args).toMatchObject({ p_user: U, p_respuesta: { text: '5.0 m' }, p_resultado: { status: 'correct', credit: 1 }, p_anticipado: false, p_idem: IDEM });
    expect(out.confirmado).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/correct|credit|5 m/);
  });

  it('una respuesta incorrecta también se registra (q = 0), sin decírselo', async () => {
    const { db, calls } = mockDb(preparar({ format: 'numeric', value: '5 m', relTol: 0.02 }));
    await handle(confirmar({ text: '9 m' }), U, db);
    expect(calls[1].args.p_resultado).toMatchObject({ credit: 0 });
  });

  it('el avance anticipado solo se acepta con el booleano true explícito', async () => {
    for (const [v, esperado] of [[true, true], ['true', false], [1, false], [undefined, false]] as const) {
      const { db, calls } = mockDb(preparar({ format: 'numeric', value: '5 m' }));
      await handle(confirmar({ text: '5 m' }, { anticipado: v }), U, db);
      expect(calls[1].args.p_anticipado).toBe(esperado);
    }
  });

  it('una respuesta ilegible no cierra el apartado (es irreversible): se pide corregir el formato', async () => {
    const { db, calls } = mockDb(preparar({ format: 'numeric', value: '5 m' }));
    const out = (await handle(confirmar({ text: 'cinco metros y algo' }), U, db)) as { confirmado: boolean; mensajes: string[] };
    expect(out.confirmado).toBe(false);
    expect(out.mensajes.length).toBeGreaterThan(0);
    expect(calls.map((c) => c.fn)).toEqual(['svc_pes_preparar']);
  });

  it('sin clave o abierta: queda pendiente de revisión docente', async () => {
    for (const clave of [null, { format: 'open', rubric: 'r' }]) {
      const { db, calls } = mockDb(preparar(clave));
      await handle(confirmar({ text: 'Porque la energía se conserva' }), U, db);
      expect(calls[1].args.p_resultado).toMatchObject({ status: 'pending_review', credit: 0 });
    }
  });

  it('selección: usa el número de opciones del apartado', async () => {
    const { db, calls } = mockDb(preparar({ format: 'choice', correct: [1] }, { opciones: 3 }));
    await handle(confirmar({ selected: [1] }), U, db);
    expect(calls[1].args.p_resultado).toMatchObject({ status: 'correct', credit: 1 });
  });

  it('las reglas de la base (apartado no abierto, tiempo mínimo) llegan como 409; los permisos como 403', async () => {
    const r1 = mockDb({}, { svc_pes_preparar: { message: 'Ese apartado no está abierto', code: 'P0001' } });
    await expect(handle(confirmar({ text: '5 m' }), U, r1.db)).rejects.toMatchObject({ status: 409, message: 'Ese apartado no está abierto' });
    const r2 = mockDb({}, { svc_pes_preparar: { message: 'No tiene asignada esta práctica', code: '42501' } });
    await expect(handle(confirmar({ text: '5 m' }), U, r2.db)).rejects.toMatchObject({ status: 403 });
    const r3 = mockDb({ svc_pes_preparar: preparar({ format: 'numeric', value: '5 m' }).svc_pes_preparar }, { svc_pes_confirmar: { message: 'Aún no se alcanza el tiempo mínimo', code: 'P0001' } });
    await expect(handle(confirmar({ text: '5 m' }), U, r3.db)).rejects.toMatchObject({ status: 409 });
  });

  it('valida identificadores, idempotencia, forma de la respuesta y operación', async () => {
    const { db } = mockDb({});
    await expect(handle(confirmar({ text: '5 m' }, { idem: 'x' }), U, db)).rejects.toBeInstanceOf(HttpError);
    await expect(handle(confirmar({ text: '5 m' }, { apartado_id: 'nope' }), U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle(confirmar(42), U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle({ action: 'pes', op: 'saltar', practica_id: PR, apartado_id: AP }, U, db)).rejects.toMatchObject({ status: 400 });
  });
});

describe('acción pes · variantes (números propios de cada estudiante)', () => {
  const CLAVE: NumericKey = { format: 'numeric', value: '0 m', relTol: 0.02, variante: { plantilla: 'A', respuesta: 'd', unidad: 'm' } };

  it('los parámetros salen de la semilla de la asignación y del apartado; nunca la respuesta', async () => {
    const { db, calls } = mockDb({ svc_pes_variante: { plantilla: 'A', semilla: SEM } });
    const out = (await handle({ action: 'pes', op: 'variante', practica_id: PR, apartado_id: AP }, U, db)) as { parametros: Record<string, unknown> };
    expect(calls[0].args).toEqual({ p_user: U, p_practica: PR, p_apartado: AP });
    expect(out.parametros).toEqual(parametrosVariante('A', SEM, AP).parametros);
    expect(JSON.stringify(out)).not.toContain(String(claveConcreta(CLAVE, SEM, AP).value));
  });

  it('se califica con la clave concreta de esos mismos números', async () => {
    const valor = claveConcreta(CLAVE, SEM, AP).value;
    const { db, calls } = mockDb(preparar(CLAVE));
    await handle(confirmar({ text: valor }), U, db);
    expect(calls[1].args.p_resultado).toMatchObject({ status: 'correct', credit: 1 });
    // con los números de OTRO estudiante (otra semilla) la respuesta no coincide
    const otro = claveConcreta(CLAVE, '66666666-6666-4666-8666-666666666666', AP).value;
    expect(otro).not.toBe(valor);
    const r = mockDb(preparar(CLAVE));
    await handle(confirmar({ text: otro }), U, r.db);
    expect(r.calls[1].args.p_resultado).not.toMatchObject({ status: 'correct' });
  });

  it('sin plantilla: parámetros nulos', async () => {
    const { db } = mockDb({ svc_pes_variante: { plantilla: null, semilla: SEM } });
    expect(await handle({ action: 'pes', op: 'variante', practica_id: PR, apartado_id: AP }, U, db)).toEqual({ parametros: null });
  });
});
