import { describe, expect, it } from 'vitest';
import { analizarCarga, AVISO_PEGADO, avisoAnticipado, pesosIguales, puntajePes, tiempoMinimo, validarEjercicio, type ApartadoPuntuado } from '@/lib/pes';

/** N ejercicios de 4 apartados de peso 0.25; `f(i)` da (q, m) del apartado i. */
function practica(n: number, f: (i: number) => [number, number]): ApartadoPuntuado[] {
  return Array.from({ length: n * 4 }, (_, i) => { const [q, m] = f(i); return { peso: 0.25, q, m, validada: true }; });
}

describe('PES · calificación (ejemplos de la especificación, P_max = 8, α = 2)', () => {
  it('todo correcto y sin anticipaciones: 8', () => {
    expect(puntajePes(practica(100, () => [1, 1]), 100).provisional.p).toBeCloseTo(8, 10);
  });
  it('todo correcto y todo anticipado: 4', () => {
    expect(puntajePes(practica(100, () => [1, 0.5]), 100).provisional.p).toBeCloseTo(4, 10);
  });
  it('todo correcto y la mitad del crédito anticipado: 6', () => {
    expect(puntajePes(practica(100, (i) => [1, i % 2 ? 0.5 : 1]), 100).provisional.p).toBeCloseTo(6, 10);
  });
  it('mitad del dominio, sin anticipaciones: 2', () => {
    expect(puntajePes(practica(100, (i) => [i % 2 ? 1 : 0, 1]), 100).provisional.p).toBeCloseTo(2, 10);
  });
  it('curva no lineal para N = 100: S = 10, 25, 50, 75, 100 → 0.08, 0.50, 2.00, 4.50, 8.00', () => {
    const esperado: [number, number][] = [[10, 0.08], [25, 0.5], [50, 2], [75, 4.5], [100, 8]];
    for (const [s, p] of esperado) {
      const r = puntajePes(practica(100, (i) => [i < s * 4 ? 1 : 0, 1]), 100);
      expect(r.provisional.S).toBeCloseTo(s, 10);
      expect(Number(r.provisional.p.toFixed(2))).toBe(p);
    }
  });
  it('S = 0 da 0 (sin dividir entre cero) y nunca supera P_max', () => {
    const r = puntajePes(practica(3, () => [0, 0.5]), 3);
    expect(r.provisional.p).toBe(0);
    expect(r.provisional.fTiempo).toBe(0);
    expect(puntajePes([{ peso: 1, q: 1.7, m: 3 }], 1).provisional.p).toBe(8);
    expect(puntajePes([], 0).provisional.p).toBe(0);
  });
});

describe('PES · provisional, validada y máxima alcanzable', () => {
  // el caso de supabase/pruebas/pes.sql (E1 terminó: ya no puede responder)
  const E1: ApartadoPuntuado[] = [
    { peso: 0.33333, q: 1, m: 0.5 }, { peso: 0.33333, q: 0, m: 1 }, { peso: 0.33334, q: 0, m: 1, omitido: true },
    { peso: 0.1, q: 1, m: 1 }, { peso: 0.2, q: 0.5, m: 0.5 }, { peso: 0.3, q: 0, m: 1, pendienteRevision: true }, { peso: 0.4, q: 1, m: 1 },
  ];
  it('provisional: S = 0.93333, S·m = 0.716665 (pendiente = 0)', () => {
    const r = puntajePes(E1, 2, undefined, false);
    expect(r.provisional.S).toBeCloseTo(0.93333, 10);
    expect(r.provisional.Sm).toBeCloseTo(0.716665, 10);
    expect(r.provisional.p).toBeCloseTo((8 * 0.93333 * 0.716665) / 4, 10);
  });
  it('validada: 0 hasta que el profesor valida; luego, solo lo validado', () => {
    expect(puntajePes(E1, 2, undefined, false).validada.p).toBe(0);
    const revisado = E1.map((a, i) => (i === 5 ? { ...a, q: 0.8, pendienteRevision: false, validada: true } : a));
    expect(puntajePes(revisado, 2, undefined, false).validada.p).toBeCloseTo((8 * 0.24 * 0.24) / 4, 10);
    const todo = revisado.map((a) => ({ ...a, validada: true }));
    const r = puntajePes(todo, 2, undefined, false);
    expect(r.validada.p).toBeCloseTo(r.provisional.p, 12);
    expect(r.validada.completa).toBe(true);
  });
  it('máxima: el pendiente con crédito completo (con su m); lo libre solo si aún puede responder', () => {
    expect(puntajePes(E1, 2, undefined, false).maxima.p).toBeCloseTo((8 * 1.23333 * 1.016665) / 4, 10);
    const libre: ApartadoPuntuado[] = [{ peso: 0.5, q: 1, m: 1 }, { peso: 0.5, q: null, m: 1 }];
    expect(puntajePes(libre, 1, undefined, true).maxima.p).toBeCloseTo(8, 10);
    expect(puntajePes(libre, 1, undefined, false).maxima.p).toBeCloseTo(2, 10);         // venció: ya no suma
  });
  it('un pendiente que se anticipó solo puede recuperar w·m; un omitido no se recupera', () => {
    expect(puntajePes([{ peso: 0.5, q: 1, m: 1 }, { peso: 0.5, q: 0, m: 0.5, pendienteRevision: true }], 1).maxima.p).toBeCloseTo(8 * 0.75, 10);
    expect(puntajePes([{ peso: 0.5, q: 0, m: 1, omitido: true }, { peso: 0.5, q: null, m: 1 }], 1).maxima.p).toBeCloseTo(2, 10);
  });
  it('orden siempre: validada ≤ provisional ≤ máxima (casos aleatorios)', () => {
    let semilla = 7;
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(azar() * 4);
      const aps: ApartadoPuntuado[] = [];
      for (let e = 0; e < n; e++) for (const w of pesosIguales(3 + Math.floor(azar() * 3))) {
        const t = azar();
        aps.push(t < 0.2 ? { peso: w, q: null, m: 1 } : t < 0.3 ? { peso: w, q: 0, m: 1, omitido: true, validada: azar() < 0.5 }
          : t < 0.4 ? { peso: w, q: 0, m: azar() < 0.5 ? 0.5 : 1, pendienteRevision: true }
          : { peso: w, q: Math.round(azar() * 4) / 4, m: azar() < 0.5 ? 0.5 : 1, validada: azar() < 0.6 });
      }
      const r = puntajePes(aps, n, undefined, azar() < 0.5);
      expect(r.validada.p).toBeLessThanOrEqual(r.provisional.p + 1e-12);
      expect(r.provisional.p).toBeLessThanOrEqual(r.maxima.p + 1e-12);
      expect(r.maxima.p).toBeLessThanOrEqual(8 + 1e-12);
    }
  });
});

describe('PES · tiempos y adaptaciones', () => {
  it('espera mínima = 1.20·T_ref (como la base: 288 s)', () => {
    expect(tiempoMinimo(240)).toBe(288);
    expect(tiempoMinimo(240, 0)).toBe(240);
  });
  it('el factor de espera solo reduce: una adaptación nunca alarga la espera', () => {
    expect(tiempoMinimo(240, 0.2, 0.5)).toBe(144);
    expect(tiempoMinimo(240, 0.2, 0)).toBe(0);
    expect(tiempoMinimo(240, 0.2, 1.5)).toBe(288);
  });
  it('aviso obligatorio de avance anticipado y aviso honesto del bloqueo de pegado', () => {
    expect(avisoAnticipado()).toBe('Si avanza ahora, la puntuación obtenible en este apartado se reducirá al 50%. Esta decisión es irreversible');
    expect(avisoAnticipado(0.7)).toContain('al 70%');
    expect(AVISO_PEGADO).toMatch(/no impide ni comprueba/);
  });
  it('3 a 5 apartados con pesos que suman 1; pesos iguales como en la base', () => {
    expect(validarEjercicio([0.5, 0.5])).toMatch(/3 a 5/);
    expect(validarEjercicio([0.5, 0.2, 0.2])).toMatch(/sumar 1/);
    expect(validarEjercicio([0.1, 0.2, 0.3, 0.4])).toBeNull();
    expect(pesosIguales(3)).toEqual([0.33333, 0.33333, 0.33334]);
    for (const n of [3, 4, 5]) expect(validarEjercicio(pesosIguales(n))).toBeNull();
  });
});

describe('PES · carga temporal frente al plazo', () => {
  const ahora = new Date('2026-11-03T12:00:00-04:00');
  const dias = (d: number) => new Date(ahora.getTime() + d * 86400000);
  const ej = (n: number, k = 4, t = 360) => Array.from({ length: n }, () => Array(k).fill(t));

  it('100 ejercicios × 4 apartados × 6 min: 40 h de trabajo, 48 h de espera mínima', () => {
    const c = analizarCarga({ tRefs: ej(100), ahora, cierra: dias(30) });
    expect(c.referenciaH).toBeCloseTo(40, 6);
    expect(c.esperaH).toBeCloseTo(48, 6);
    expect(c.horasPorDia).toBeCloseTo(1.6, 6);
    expect(c.avisos.some((a) => a.nivel === 'error')).toBe(false);
    expect(c.avisos.some((a) => a.nivel === 'info' && /Carga total alta/.test(a.texto))).toBe(true);
  });
  it('advierte cuando la carga diaria supera lo razonable y marca error si es más del doble', () => {
    expect(analizarCarga({ tRefs: ej(100), ahora, cierra: dias(12) }).avisos.find((a) => a.nivel === 'aviso')?.texto).toMatch(/Carga alta: 4,0 h diarias/);
    expect(analizarCarga({ tRefs: ej(100), ahora, cierra: dias(7) }).avisos.find((a) => a.nivel === 'error')?.texto).toMatch(/Carga excesiva/);
  });
  it('imposible: la espera mínima no cabe antes del cierre', () => {
    const c = analizarCarga({ tRefs: ej(100), ahora, cierra: dias(1.5) });
    expect(c.avisos[0]).toMatchObject({ nivel: 'error' });
    expect(c.avisos[0].texto).toMatch(/^Imposible/);
  });
  it('sin fecha límite, o ya vencida: error', () => {
    expect(analizarCarga({ tRefs: ej(2), ahora }).avisos[0].texto).toMatch(/Falta la fecha límite/);
    expect(analizarCarga({ tRefs: ej(2), ahora, cierra: dias(-1) }).avisos[0].texto).toMatch(/ya pasó/);
  });
  it('bloques: carga por bloque, bloques tras el cierre y ejercicios que nunca se liberan', () => {
    // 10 ejercicios hoy (4,8 h de espera en las 12 h que quedan del día: cabe, pero son 9,6 h diarias)
    const c = analizarCarga({ tRefs: ej(20), ahora, cierra: dias(10),
      liberacion: [{ desde: '2026-11-03', ejercicios: 10 }, { desde: '2026-11-04', ejercicios: 15 }, { desde: '2026-11-20', ejercicios: 18 }] });
    expect(c.bloques).toHaveLength(3);
    expect(c.bloques[0].ejercicios).toEqual([1, 10]);
    expect(c.avisos.some((a) => a.nivel === 'aviso' && /Bloque del 2026-11-03 \(ejercicios 1–10\): 9,6 h diarias/.test(a.texto))).toBe(true);
    expect(c.avisos.some((a) => /2026-11-20 se libera después/.test(a.texto))).toBe(true);
    expect(c.avisos.some((a) => /19–20 nunca se liberan/.test(a.texto))).toBe(true);
    // 30 ejercicios hoy: 14,4 h de espera no caben en 12 h
    const d = analizarCarga({ tRefs: ej(30), ahora, cierra: dias(10), liberacion: [{ desde: '2026-11-03', ejercicios: 30 }, { desde: '2026-11-04', ejercicios: 30 }] });
    expect(d.avisos.some((a) => a.nivel === 'error' && /Bloque del 2026-11-03.*no cabe/.test(a.texto))).toBe(true);
    expect(d.avisos.some((a) => /2026-11-04 no libera ejercicios nuevos/.test(a.texto))).toBe(true);
  });
  it('una práctica razonable no genera avisos', () => {
    expect(analizarCarga({ tRefs: ej(6, 4, 240), ahora, cierra: dias(14) }).avisos).toEqual([]);
  });
});
