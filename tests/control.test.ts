import { describe, expect, it } from 'vitest';
import {
  ajusteTiempo, diagnostico, ejemploAjuste, factorControl, minutosEstimados, notaFinal, PESOS_SELECCION, puntajeSeleccion, resultadoAgregado, W_MAX,
} from '../src/lib/control';
import { handle } from '../supabase/functions/calificar/handler';
import type { Db } from '../supabase/functions/calificar/handler';

describe('Prácticas de Control · ajuste de la nota', () => {
  it('ejemplo de la especificación: 90 × [1 − 0,20 × (1 − 0,50)] = 81', () => {
    expect(notaFinal(90, 50, 0.2)).toBe(81);
    expect(ejemploAjuste(0.2)).toEqual({ original: 90, control: 50, final: 81, maximo: 20 });
  });
  it('100/100 conserva la nota; 0/100 descuenta exactamente w', () => {
    expect(notaFinal(90, 100, 0.2)).toBe(90);
    expect(notaFinal(90, 0, 0.2)).toBe(72);
    expect(notaFinal(0, 0, 0.2)).toBe(0);
  });
  it('sin control confirmado el factor es 1 (pendiente, ausencia, exención, incidencia)', () => {
    expect(factorControl(0.2, null)).toBe(1);
    expect(notaFinal(77, null, 0.2)).toBe(77);
  });
  it('límites: w acotado al máximo institucional y C acotado a [0, 100]', () => {
    expect(factorControl(0.9, 0)).toBeCloseTo(1 - W_MAX);
    expect(factorControl(-1, 0)).toBe(1);
    expect(factorControl(0.2, 1.7)).toBe(1);
    expect(factorControl(0.2, -0.5)).toBeCloseTo(0.8);
  });
  it('varias verificaciones: una sola regla agregada (el mejor), nunca descuentos encadenados', () => {
    expect(resultadoAgregado([0.5, 0.3, null])).toBe(0.5);
    expect(resultadoAgregado([null])).toBeNull();
    const conMejor = factorControl(0.2, resultadoAgregado([0.5, 0.3]));
    expect(conMejor).toBeCloseTo(0.9);
    expect(conMejor).toBeGreaterThan(factorControl(0.2, 0.5) * factorControl(0.2, 0.3));
  });
});

describe('Prácticas de Control · selección individual (espejo de control_seleccionar)', () => {
  it('los pesos suman 1 y el puntaje está en [0, 1]', () => {
    expect(Object.values(PESOS_SELECCION).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(puntajeSeleccion({ necesidad: 1, diagnostico: 1, cobertura: 1, tiempo: 1, validado: 1, azar: 1 })).toBe(1);
    expect(puntajeSeleccion({ necesidad: 0, diagnostico: 0, cobertura: 0, tiempo: 0, validado: 0, azar: 0 })).toBe(0);
  });
  it('diagnóstico: un producto correcto sin verificar es la evidencia más útil; declarar ayuda solo suma información', () => {
    expect(diagnostico(0.9, false)).toBe(1);
    expect(diagnostico(0.5, false)).toBe(0.7);
    expect(diagnostico(0.1, false)).toBe(0.4);
    expect(diagnostico(0.5, true)).toBeCloseTo(0.8);
    expect(diagnostico(1, true)).toBe(1);
    expect(diagnostico(null, false)).toBe(0.4);
  });
  it('tiempo: preferencia por ~70 % del tiempo; nada que exceda el límite entra como candidato', () => {
    expect(ajusteTiempo(4.9, 7)).toBeCloseTo(1);
    expect(ajusteTiempo(7, 7)).toBeCloseTo(0.7);
    expect(minutosEstimados('numeric', 'desafiante')).toBeGreaterThan(7);   // no cabe en un control de 7 minutos
    expect(minutosEstimados('truefalse', 'desafiante')).toBe(2);
  });
  it('una ficha aprobada pesa más que un ejercicio del banco con los mismos datos', () => {
    const base = { necesidad: 1, diagnostico: 1, cobertura: 1, tiempo: 1, azar: 0.5 };
    expect(puntajeSeleccion({ ...base, validado: 1 })).toBeGreaterThan(puntajeSeleccion({ ...base, validado: 0.5 }));
  });
});

describe('Prácticas de Control · entrega (Edge Function calificar)', () => {
  const A = '11111111-1111-4111-8111-111111111111', U = '22222222-2222-4222-8222-222222222222', E = '33333333-3333-4333-8333-333333333333';
  function mockDb(esControl: boolean | 'falla') {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const db: Db = {
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (fn === 'svc_submit_context') return { data: { mode: 'exam', items: [{ exercise_id: E, format: 'numeric', option_count: null, key: { format: 'numeric', value: '12 J' }, answer: { text: 'doce julios aprox' }, status: 'draft' }] }, error: null };
        if (fn === 'svc_es_control') return esControl === 'falla' ? { data: null, error: { message: 'no existe', code: '42883' } } : { data: esControl, error: null };
        return { data: { status: 'submitted' }, error: null };
      },
    };
    return { db, calls };
  }
  const resultado = (calls: { fn: string; args: Record<string, unknown> }[]) => (calls.find((c) => c.fn === 'svc_record_submission')!.args.p_results as { status: string; credit: number }[])[0];
  it('en un control, un formato no interpretable NO es un cero: va a revisión docente', async () => {
    const { db, calls } = mockDb(true);
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(resultado(calls)).toMatchObject({ status: 'pending_review', credit: 0 });
  });
  it('en un examen normal se conserva el comportamiento anterior', async () => {
    const { db, calls } = mockDb(false);
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(resultado(calls)).toMatchObject({ status: 'incorrect', credit: 0 });
  });
  it('si la migración aún no está, se trata como examen normal (sin romper la entrega)', async () => {
    const { db, calls } = mockDb('falla');
    await handle({ action: 'submit', attempt_id: A }, U, db);
    expect(resultado(calls).status).toBe('incorrect');
  });
});
