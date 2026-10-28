import { describe, expect, it } from 'vitest';
import type { ResultadoEstudiante, ResultadoPareja } from '../src/lib/lieia/detectores';
import { integridadDe } from '../src/lib/lieia/integridadEstudiante';

const est = (i: number, puntaje: number): ResultadoEstudiante => ({
  i, puntaje, respondidas: 10, theta: 0, d4: null, d5: null, d6: null, d8: null, cambios: 0, d7: null, oculto: 0,
  q4: null, q5: null, q6: null, q7: null, q8: null,
});
const par = (i: number, j: number, p1: number, q1: number, d3?: { lider: number | null; retardo: number; p: number; q: number }): ResultadoPareja => ({
  i, j, d1: { identicas: 3, esperadas: 0.5, comunes: 6, p: p1 }, d2: { r: 0.1, n: 10, p: 0.5 },
  d3: d3 ? { max: 1, retardo: d3.retardo, lider: d3.lider, p: d3.p } : null,
  q1, q2: 0.9, q3: d3 ? d3.q : null, post1: null, post2: null,
});

const analisis = {
  estudiantes: [est(0, 9), est(1, 7), est(2, 7), est(3, 4)],
  parejas: [
    par(0, 1, 0.5, 0.9),
    par(0, 2, 0.001, 0.02, { lider: 0, retardo: -40, p: 0.01, q: 0.05 }),
    par(1, 2, 0.04, 0.15),
    par(2, 3, 0.03, 0.12, { lider: 3, retardo: 12, p: 0.2, q: 0.5 }),
    par(0, 3, 0.002, 0.01),
  ],
};
const todos = () => true;

describe('LIEIA · integridad de un estudiante en la ficha', () => {
  it('extrae solo las parejas en que participa, con q < 0,2, ordenadas por evidencia', () => {
    const r = integridadDe(2, analisis, todos)!;
    expect(r.parejas.map((x) => x.otro)).toEqual([0, 3, 1]);
    expect(r.parejas.every((x) => x.par.i === 2 || x.par.j === 2)).toBe(true);
  });

  it('indica quién responde primero desde el punto de vista del estudiante y el adelanto en positivo', () => {
    const conCero = integridadDe(2, analisis, todos)!.parejas.find((x) => x.otro === 0)!;
    expect(conCero.primero).toBe('otro');
    expect(conCero.adelanto).toBe(40);
    const desdeCero = integridadDe(0, analisis, todos)!.parejas.find((x) => x.otro === 2)!;
    expect(desdeCero.primero).toBe('estudiante');
    const conTres = integridadDe(2, analisis, todos)!.parejas.find((x) => x.otro === 3)!;
    expect(conTres.primero).toBe('otro');
  });

  it('ignora los detectores no habilitados (no validados)', () => {
    const r = integridadDe(2, analisis, (d) => d !== 'd1')!;
    // sin D1 solo queda la sincronía D3 con el estudiante 0 (q = 0,05); la de 3 tiene q = 0,5
    expect(r.parejas.map((x) => x.otro)).toEqual([0]);
    expect(r.parejas[0].q1).toBeNull();
  });

  it('calcula el puesto por aciertos con empates y devuelve null si el estudiante no está', () => {
    expect(integridadDe(0, analisis, todos)!.puesto).toBe(1);
    expect(integridadDe(1, analisis, todos)!.puesto).toBe(2);
    expect(integridadDe(2, analisis, todos)!.puesto).toBe(2);
    expect(integridadDe(3, analisis, todos)!.total).toBe(4);
    expect(integridadDe(9, analisis, todos)).toBeNull();
  });
});
