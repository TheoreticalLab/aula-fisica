/**
 * Tiempo mínimo de realización (migración 78): lógica del cliente y bloqueo de la entrega en la Edge Function «calificar».
 * El conteo del tiempo y la reducción de la nota se prueban en supabase/pruebas/tiempo_minimo.sql.
 */
import { describe, expect, it } from 'vitest';
import { avance, duracion, estaActivo, factorNota, INACTIVIDAD_MS, puedeEntregar } from '@/lib/tiempoMinimo';
import { handle, HttpError, type Db } from '../supabase/functions/calificar/handler.ts';

describe('lógica del cliente', () => {
  it('activo = visible y con interacción en los últimos 2 min', () => {
    expect(estaActivo(true, 0, INACTIVIDAD_MS - 1)).toBe(true);
    expect(estaActivo(true, 0, INACTIVIDAD_MS)).toBe(false);
    expect(estaActivo(false, 0, 1)).toBe(false);
  });
  it('duraciones, avance y factor', () => {
    expect(duracion(45)).toBe('45 s');
    expect(duracion(12 * 60 + 20)).toBe('12 min');
    expect(duracion(3900)).toBe('1 h 05 min');
    expect(avance({ aplica: true, minimo_s: 3600, segundos: 1800 })).toBe(50);
    expect(avance({ aplica: true, minimo_s: 3600, segundos: 9000 })).toBe(100);
    expect(avance({ aplica: false })).toBe(100);
    expect(factorNota(1200, 3600)).toBeCloseTo(1 / 3);
    expect(factorNota(5000, 3600)).toBe(1);
  });
  it('el botón «Entregar» solo se habilita si no aplica, se cumplió o la práctica cerró', () => {
    expect(puedeEntregar(null)).toBe(true);
    expect(puedeEntregar({ aplica: false })).toBe(true);
    expect(puedeEntregar({ aplica: true, cumplido: false, cerrada: false })).toBe(false);
    expect(puedeEntregar({ aplica: true, cumplido: true })).toBe(true);
    expect(puedeEntregar({ aplica: true, cumplido: false, cerrada: true })).toBe(true);
  });
});

describe('Edge Function calificar · entrega con tiempo mínimo', () => {
  const A = '11111111-1111-4111-8111-111111111111', U = '22222222-2222-4222-8222-222222222222', ACT = '44444444-4444-4444-8444-444444444444';
  function mockDb(verificar: { message: string; code: string } | null) {
    const calls: string[] = [];
    const db: Db = {
      rpc: async (fn) => {
        calls.push(fn);
        if (fn === 'svc_tiempo_minimo_verificar') return { data: verificar ? null : { aplica: true }, error: verificar };
        if (fn === 'svc_submit_context') return { data: { mode: 'practice', items: [] }, error: null };
        if (fn === 'svc_finalize_context') return { data: [{ attempt_id: A, user_id: U }], error: null };
        return { data: { status: 'submitted' }, error: null };
      },
    };
    return { db, calls };
  }
  it('el estudiante no entrega antes del mínimo: 409 con el mensaje del servidor y sin calificar', async () => {
    const { db, calls } = mockDb({ message: 'Todavía no puede entregar: le faltan 40 min.', code: 'P0001' });
    await expect(handle({ action: 'submit', attempt_id: A }, U, db)).rejects.toMatchObject({ status: 409, message: 'Todavía no puede entregar: le faltan 40 min.' });
    expect(calls).not.toContain('svc_record_submission');
  });
  it('cumplido (o sin mínimo): entrega normal', async () => {
    const { db, calls } = mockDb(null);
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(calls).toEqual(['svc_tiempo_minimo_verificar', 'svc_submit_context', 'svc_record_submission']);
  });
  it('sin la migración (función ausente): no bloquea', async () => {
    const { db, calls } = mockDb({ message: 'Could not find the function', code: 'PGRST202' });
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(calls).toContain('svc_record_submission');
  });
  it('otro fallo al comprobar: no se entrega (500)', async () => {
    const { db, calls } = mockDb({ message: 'timeout', code: '57014' });
    await expect(handle({ action: 'submit', attempt_id: A }, U, db)).rejects.toBeInstanceOf(HttpError);
    expect(calls).not.toContain('svc_record_submission');
  });
  it('la entrega del profesor («Entregar y calificar») no se bloquea: la nota la reduce el servidor', async () => {
    const { db, calls } = mockDb({ message: 'Todavía no puede entregar', code: 'P0001' });
    const r = await handle({ action: 'finalize', activity_id: ACT }, U, db) as { finalized: number };
    expect(r.finalized).toBe(1);
    expect(calls).not.toContain('svc_tiempo_minimo_verificar');
  });
});
