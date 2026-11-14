/** Edge Function «maraton»: el usuario sale del JWT, la clave nunca sale del servidor y un intento no válido no escribe nada. */
import { describe, expect, it } from 'vitest';
import { handle, HttpError, type Db } from '../supabase/functions/maraton/handler';

const U = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
const I = '33333333-3333-4333-8333-333333333333';
const CLAVE = { partes: [{ format: 'numeric', value: '7.777 m/s', relTol: 0.02 }, { format: 'numeric', value: '0.3333', relTol: 0.02, unitRequired: false }] };
const ESTADO = { maraton: { id: 'm' }, jornada: { numero: 1, respondidos: 1 }, problema: null, comodines_disponibles: 10 };

function mockDb(clave: unknown = { abierta: true, clave: CLAVE }, errores: Record<string, { message: string; code?: string }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: Db = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      if (errores[fn]) return { data: null, error: errores[fn] };
      if (fn === 'svc_maraton_clave') return { data: clave, error: null };
      if (fn === 'svc_maraton_responder') return { data: ESTADO, error: null };
      return { data: null, error: { message: 'desconocida' } };
    },
  };
  return { db, calls };
}
const cuerpo = (partes: unknown, extra: Record<string, unknown> = {}) => ({ action: 'responder', presentacion_id: P, idem: I, partes, ...extra });

describe('handler maraton', () => {
  it('respuesta correcta: califica en el servidor y registra con el usuario del JWT', async () => {
    const { db, calls } = mockDb();
    const r = await handle(cuerpo(['7.78 m/s', '0.333'], { procedimiento: 'p = mv', segundos_cliente: 321 }), U, db);
    expect(r).toEqual(ESTADO);
    expect(calls.map((c) => c.fn)).toEqual(['svc_maraton_clave', 'svc_maraton_responder']);
    expect(calls[0].args).toEqual({ p_user: U, p_presentacion: P });
    expect(calls[1].args).toMatchObject({ p_user: U, p_presentacion: P, p_idem: I, p_correcta: true, p_respuesta: { partes: ['7.78 m/s', '0.333'] }, p_procedimiento: 'p = mv', p_segundos_cliente: 321 });
  });
  it('respuesta incorrecta pero válida: se registra como incorrecta', async () => {
    const { db, calls } = mockDb();
    await handle(cuerpo(['1 m/s', '0.333']), U, db);
    expect(calls[1].args.p_correcta).toBe(false);
  });
  it('intento no válido (sin unidad / vacío): no escribe nada y no revela la clave', async () => {
    const { db, calls } = mockDb();
    const r = await handle(cuerpo(['7.78', '']), U, db);
    expect(r).toMatchObject({ valida: false });
    expect(calls.map((c) => c.fn)).toEqual(['svc_maraton_clave']);
    expect(JSON.stringify(r)).not.toMatch(/7\.777|0\.3333/);
  });
  it('la salida nunca contiene la clave', async () => {
    const { db } = mockDb();
    const r = await handle(cuerpo(['7.78 m/s', '0.333']), U, db);
    expect(JSON.stringify(r)).not.toMatch(/7\.777|0\.3333|clave/);
  });
  it('problema ya cerrado (doble envío): la base decide sin cambiar nada', async () => {
    const { db, calls } = mockDb({ abierta: false, clave: null });
    await handle(cuerpo(['7.78 m/s', '0.333']), U, db);
    expect(calls[1].fn).toBe('svc_maraton_responder');
    expect(calls[1].args.p_correcta).toBe(false);
  });
  it('el usuario no se puede suplantar desde el cuerpo', async () => {
    const { db, calls } = mockDb();
    await handle({ ...cuerpo(['7.78 m/s', '0.333']), p_user: 'otro', user_id: 'otro' }, U, db);
    expect(calls.every((c) => c.args.p_user === U)).toBe(true);
  });
  it('entradas mal formadas → 400', async () => {
    const { db } = mockDb();
    await expect(handle({ action: 'otra' }, U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle(cuerpo(['1 m/s'], { idem: 'x' }), U, db)).rejects.toBeInstanceOf(HttpError);
    await expect(handle(cuerpo([]), U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle(cuerpo(Array(7).fill('1 m/s')), U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle({ ...cuerpo(['1 m/s']), presentacion_id: 'no-uuid' }, U, db)).rejects.toMatchObject({ status: 400 });
  });
  it('errores de autorización y de reglas se traducen a 403 y 409; los internos no filtran detalles', async () => {
    await expect(handle(cuerpo(['1 m/s', '1']), U, mockDb(undefined, { svc_maraton_clave: { message: 'Ese problema no le corresponde', code: '42501' } }).db)).rejects.toMatchObject({ status: 403 });
    await expect(handle(cuerpo(['1 m/s', '1']), U, mockDb(undefined, { svc_maraton_responder: { message: 'No le quedan comodines', code: 'P0001' } }).db)).rejects.toMatchObject({ status: 409, message: 'No le quedan comodines' });
    await expect(handle(cuerpo(['1 m/s', '1']), U, mockDb(undefined, { svc_maraton_clave: { message: 'detalle interno', code: 'XX000' } }).db)).rejects.toMatchObject({ status: 500, message: 'Error interno del maratón' });
  });
});
