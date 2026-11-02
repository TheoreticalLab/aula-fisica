import { describe, expect, it } from 'vitest';
import { clasificar, prioridades, recuento, type ConceptoMapa } from '../src/lib/tutoria';

const c = (o: { p?: [number, number | null]; e?: [number, number | null]; k?: [number, number | null]; g?: [number, number | null]; slug?: string } = {}): ConceptoMapa => ({
  slug: o.slug ?? 'x', nombre: 'X', leccion: 'L', leccion_id: null, ultima: null,
  practica: { n: o.p?.[0] ?? 0, score: o.p?.[1] ?? null },
  evaluaciones: { n: o.e?.[0] ?? 0, score: o.e?.[1] ?? null },
  controles: { n: o.k?.[0] ?? 0, pct: o.k?.[1] ?? null, practica: null },
  general: { n: o.g?.[0] ?? (o.p?.[0] ?? 0) + (o.e?.[0] ?? 0), score: o.g?.[1] ?? o.p?.[1] ?? o.e?.[1] ?? null },
});

describe('Mapa de dominio para tutorías · migración 68', () => {
  it('sin respuestas: sin evidencia', () => {
    expect(clasificar(c()).estado).toBe('sin_evidencia');
  });
  it('bien en práctica y mal en control o evaluación: practicar la resolución autónoma (sin hablar de IA)', () => {
    const r = clasificar(c({ p: [4, 0.9], k: [1, 0.2] }));
    expect(r.estado).toBe('autonomia');
    expect(r.motivo).toMatch(/controles \(20 %\)/);
    expect(r.motivo).not.toMatch(/IA|trampa|copi/i);
    expect(clasificar(c({ p: [3, 1], e: [1, 0] })).estado).toBe('autonomia');
  });
  it('acierta poco: con dificultad', () => {
    expect(clasificar(c({ p: [5, 0.3] })).estado).toBe('dificultad');
    expect(clasificar(c({ p: [1, 0.6], k: [1, 0.3] })).estado).toBe('dificultad');
  });
  it('bien en práctica y verificado en control o evaluación: consolidado', () => {
    expect(clasificar(c({ p: [4, 0.9], k: [1, 0.8], g: [4, 0.9] })).estado).toBe('consolidado');
    expect(clasificar(c({ p: [4, 0.9], e: [2, 0.85], g: [6, 0.88] })).estado).toBe('consolidado');
  });
  it('bien en práctica sin evaluación ni control: por comprobar sin apoyo', () => {
    expect(clasificar(c({ p: [3, 0.9] })).estado).toBe('por_verificar');
  });
  it('pocas respuestas o término medio: en progreso', () => {
    expect(clasificar(c({ p: [1, 1] })).estado).toBe('en_progreso');
    expect(clasificar(c({ p: [4, 0.65] })).estado).toBe('en_progreso');
  });
  it('prioridades: primero autonomía, luego dificultad (la más baja antes), luego por comprobar; nunca consolidados', () => {
    const lista = [
      c({ slug: 'ok', p: [4, 0.9], k: [1, 0.9], g: [4, 0.9] }),
      c({ slug: 'dif-media', p: [4, 0.45] }),
      c({ slug: 'verif', p: [3, 0.9] }),
      c({ slug: 'auto', p: [4, 0.9], k: [1, 0.1] }),
      c({ slug: 'dif-baja', p: [4, 0.1] }),
      c({ slug: 'nada' }),
    ];
    expect(prioridades(lista).map((x) => x.c.slug)).toEqual(['auto', 'dif-baja', 'dif-media', 'verif']);
    expect(recuento(lista)).toMatchObject({ consolidado: 1, autonomia: 1, dificultad: 2, por_verificar: 1, sin_evidencia: 1 });
  });
});
