/**
 * Examen adaptativo: el motor del cliente conserva su estado cuando el servidor añade preguntas, y la acción
 * «adaptativo» de calificar califica en el servidor sin devolver aciertos.
 */
import { describe, expect, it } from 'vitest';
import { abrir, ampliarOrden, crearMotor, irA, type ConfigExamen } from '@/lib/examen/motor';
import { handle, type Db } from '../supabase/functions/calificar/handler.ts';
import { claveConcreta } from '../supabase/functions/_shared/calificacion/variante.ts';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos.ts';

const A = '11111111-1111-4111-8111-111111111111';
const U = '33333333-3333-4333-8333-333333333333';
const E1 = '22222222-2222-4222-8222-222222222221', E2 = '22222222-2222-4222-8222-222222222222', E3 = '22222222-2222-4222-8222-222222222223', E4 = '22222222-2222-4222-8222-222222222224';
const CFG: ConfigExamen = { presentacion: 'una_a_la_vez', navegacion: 'solo_adelante', duracion_s: null, pausas: { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false } };

describe('motor del cliente con orden creciente', () => {
  it('ampliar el orden conserva visitadas y tramos; un orden distinto empieza de nuevo', () => {
    let m = abrir(crearMotor([E1]), 1000, { activa: E1, incertidumbre_ms: 5000 });
    const ampliado = ampliarOrden(m, [E1, E2]);
    expect(ampliado.orden).toEqual([E1, E2]);
    expect(ampliado.visitadas).toEqual(m.visitadas);
    expect(ampliado.tramos).toEqual(m.tramos);
    const r = irA(ampliado, 5000, E2, CFG);
    expect(r.ok).toBe(true);
    m = r.estado;
    // solo hacia adelante: no se puede volver a la primera
    expect(irA(m, 6000, E1, CFG).ok).toBe(false);
    expect(ampliarOrden(m, [E2, E1]).fase).toBe('sin_abrir');
  });
});

describe('acción «adaptativo» de calificar', () => {
  const variante: NumericKey = { format: 'numeric', value: '0 m', variante: { plantilla: 'A', respuesta: 'd', unidad: 'm' } };
  function db() {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const d: Db = {
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (fn === 'svc_submit_context') return { data: { mode: 'exam', items: [
          { exercise_id: E1, format: 'numeric', option_count: null, key: { format: 'numeric', value: '20 m/s' }, answer: { text: '72 km/h' }, status: 'draft' },
          { exercise_id: E2, format: 'numeric', option_count: null, key: { format: 'numeric', value: '20 m/s' }, answer: { text: '5 m/s' }, status: 'draft' },
          { exercise_id: E3, format: 'numeric', option_count: null, key: { format: 'numeric', value: '20 m/s' }, answer: null, status: null },
          { exercise_id: E4, format: 'numeric', option_count: null, key: variante, answer: { text: claveConcreta(variante, A, E4).value }, status: 'draft' },
        ] }, error: null };
        if (fn === 'svc_adaptativo_siguiente') return { data: { siguiente: E2, fin: false, administradas: 5, max_items: 10 }, error: null };
        return { data: null, error: { message: 'desconocida' } };
      },
    };
    return { d, calls };
  }

  it('califica en el servidor (incluidas las variantes por intento) y pasa los créditos; al cliente solo le dice qué sigue', async () => {
    const { d, calls } = db();
    const out = await handle({ action: 'adaptativo', attempt_id: A, tras: E4 }, U, d);
    expect(out).toEqual({ siguiente: E2, fin: false, administradas: 5, max_items: 10 });
    const sig = calls.find((c) => c.fn === 'svc_adaptativo_siguiente')!.args;
    expect(sig).toMatchObject({ p_user: U, p_attempt: A, p_tras: E4 });
    expect(sig.p_creditos).toEqual({ [E1]: 1, [E2]: 0, [E3]: 0, [E4]: 1 });
    expect(JSON.stringify(out)).not.toMatch(/credit|correct|status/);
  });

  it('valida los identificadores', async () => {
    const { d } = db();
    await expect(handle({ action: 'adaptativo', attempt_id: A, tras: 'x' }, U, d)).rejects.toMatchObject({ status: 400 });
  });
});
