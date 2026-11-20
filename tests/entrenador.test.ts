/** Entrenador: corrección inmediata con el motor de siempre y Edge Function «entrenador» (la clave nunca sale del servidor). */
import { describe, expect, it } from 'vitest';
import { corregir } from '../supabase/functions/entrenador/evaluar';
import { handle, HttpError, type Db } from '../supabase/functions/entrenador/handler';

const CLAVE = {
  partes: [
    { format: 'numeric' as const, value: '0.5556 m/s', relTol: 0.02, commonErrors: [{ value: '55.56 m/s', message: 'No convirtió los centímetros a metros.' }] },
    { format: 'numeric' as const, value: '0.1096 J', relTol: 0.02, commonErrors: [{ value: '0.2192 J', message: 'Olvidó el factor ½.' }] },
  ],
};

describe('corregir (Entrenador)', () => {
  it('acepta solo el número en la unidad indicada o con su unidad, y convierte', () => {
    expect(corregir(CLAVE, ['0.556', '0.11'])).toMatchObject({ valida: true, correcta: true });
    expect(corregir(CLAVE, ['0.5556 m/s', '109.6 mJ'])).toMatchObject({ valida: true, correcta: true });
    expect(corregir(CLAVE, ['55.56 cm/s', '0.1096'])).toMatchObject({ valida: true, correcta: true });
  });
  it('dice qué casilla falló y reconoce el error típico', () => {
    const c = corregir(CLAVE, ['55.56', '0.2192']);
    expect(c.valida).toBe(true);
    if (!c.valida) return;
    expect(c.correcta).toBe(false);
    expect(c.partes.map((p) => p.correcta)).toEqual([false, false]);
    expect(c.partes[0].mensaje).toContain('centímetros');
    expect(c.partes[1].mensaje).toContain('½');
    const d = corregir(CLAVE, ['0.5556', '0.3']);
    if (!d.valida) throw new Error('debería ser válida');
    expect(d.partes.map((p) => p.correcta)).toEqual([true, false]);
    expect(d.partes[0].mensaje).toBeNull();
  });
  it('una unidad de otra magnitud es incorrecta, no inválida', () => {
    const c = corregir(CLAVE, ['0.5556 J', '0.1096 J']);
    expect(c).toMatchObject({ valida: true, correcta: false });
  });
  it('vacío, ilegible o con casillas de menos: intento no válido, sin decir si es correcto', () => {
    expect(corregir(CLAVE, ['', '0.11'])).toEqual({ valida: false, mensajes: ['Casilla a: escriba un valor.'] });
    expect(corregir(CLAVE, ['hola', '0.11']).valida).toBe(false);
    expect(corregir(CLAVE, ['0.5556'])).toMatchObject({ valida: false });
    expect(corregir({ partes: [CLAVE.partes[0]] }, [''])).toEqual({ valida: false, mensajes: ['escriba un valor.'] });
  });
});

const U = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const I = '33333333-3333-4333-8333-333333333333';
const RESP = { registrada: true, ejercicio: { id: E, estado: 'abierto' } };

function mockDb(clave: unknown = { abierto: true, clave: CLAVE }, errores: Record<string, { message: string; code?: string }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: Db = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      if (errores[fn]) return { data: null, error: errores[fn] };
      if (fn === 'svc_entrenador_clave') return { data: clave, error: null };
      if (fn === 'svc_entrenador_responder') return { data: RESP, error: null };
      return { data: null, error: { message: 'desconocida' } };
    },
  };
  return { db, calls };
}
const cuerpo = (partes: unknown, extra: Record<string, unknown> = {}) => ({ action: 'responder', ejercicio_id: E, idem: I, partes, ...extra });

describe('handler entrenador', () => {
  it('califica en el servidor y registra con el usuario del JWT, con el detalle por casilla', async () => {
    const { db, calls } = mockDb();
    const r = await handle(cuerpo(['0.556', '0.2192'], { segundos_cliente: 95 }), U, db);
    expect(r).toEqual(RESP);
    expect(calls.map((c) => c.fn)).toEqual(['svc_entrenador_clave', 'svc_entrenador_responder']);
    expect(calls[0].args).toEqual({ p_user: U, p_ejercicio: E });
    expect(calls[1].args).toMatchObject({ p_user: U, p_ejercicio: E, p_idem: I, p_correcta: false, p_partes: ['0.556', '0.2192'], p_segundos_cliente: 95 });
    expect((calls[1].args.p_detalle as { partes: { correcta: boolean }[] }).partes.map((p) => p.correcta)).toEqual([true, false]);
  });
  it('intento no válido: no escribe nada ni gasta intento', async () => {
    const { db, calls } = mockDb();
    const r = await handle(cuerpo(['', '0.1']), U, db);
    expect(r).toMatchObject({ valida: false });
    expect(calls.map((c) => c.fn)).toEqual(['svc_entrenador_clave']);
    expect(JSON.stringify(r)).not.toContain('0.5556');
  });
  it('ejercicio ya cerrado: no califica y la base devuelve el estado vigente', async () => {
    const { db, calls } = mockDb({ abierto: false, clave: null });
    await handle(cuerpo(['1', '2']), U, db);
    expect(calls[1].args).toMatchObject({ p_correcta: false, p_detalle: null });
  });
  it('rechaza solicitudes mal formadas y traduce los errores de acceso', async () => {
    const { db } = mockDb();
    await expect(handle({ action: 'otra' }, U, db)).rejects.toThrow(HttpError);
    await expect(handle(cuerpo(['1'], { ejercicio_id: 'x' }), U, db)).rejects.toMatchObject({ status: 400 });
    await expect(handle(cuerpo('1'), U, db)).rejects.toMatchObject({ status: 400 });
    const sinAcceso = mockDb(undefined, { svc_entrenador_clave: { message: 'Ese ejercicio no le corresponde', code: '42501' } });
    await expect(handle(cuerpo(['1', '2']), U, sinAcceso.db)).rejects.toMatchObject({ status: 403, message: 'Ese ejercicio no le corresponde' });
    const interno = mockDb(undefined, { svc_entrenador_responder: { message: 'detalle interno', code: 'XX000' } });
    await expect(handle(cuerpo(['1', '2']), U, interno.db)).rejects.toMatchObject({ status: 500, message: 'Error interno del Entrenador' });
  });
});
