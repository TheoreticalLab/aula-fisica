/**
 * LIEIA · análisis factorial exploratorio: cada pieza contra una referencia independiente y el conjunto contra
 * estructuras conocidas (una y dos dimensiones), además de la abstención.
 */
import { describe, expect, it } from 'vitest';
import { analisisFactorial, autovalores, bvnSuperior, kmo, MIN_FACTORIAL, tetracorica, varimax } from '@/lib/lieia/ciencia/factorial';
import type { Matriz } from '@/lib/lieia/ciencia/psicometria';
import type { Pregunta } from '@/lib/lieia/ciencia/modelo';
import { normalCdf } from '@/lib/lieia/estadistica';
import { mulberry32 } from '@/lib/azar';

/** Referencia: P(X>h, Y>k) = ∫_h^∞ φ(x) Φ((ρx − k)/√(1−ρ²)) dx, por Simpson con paso fino. */
function bvnReferencia(h: number, k: number, r: number): number {
  const a = h, b = 9, n = 20000, dx = (b - a) / n;
  const f = (x: number) => (Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)) * normalCdf((r * x - k) / Math.sqrt(1 - r * r));
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * dx);
  return (s * dx) / 3;
}

function normales(azar: () => number): () => number {
  return () => { const u = Math.max(azar(), 1e-12), v = azar(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
}

/** Matriz de respuestas de un modelo factorial normal-ojiva: y = Σ λ·θ + ε, correcta si y > umbral. */
function simularMatriz(n: number, cargas: number[][], umbrales: number[], semilla: number): Matriz {
  const z = normales(mulberry32(semilla));
  const K = cargas.length, m = cargas[0].length;
  const x = Array.from({ length: n }, () => {
    const theta = Array.from({ length: m }, () => z());
    return cargas.map((l, j) => {
      const comun = l.reduce((s, lj, f) => s + lj * theta[f], 0);
      const unico = Math.sqrt(Math.max(0, 1 - l.reduce((s, lj) => s + lj * lj, 0)));
      return (comun + unico * z() > umbrales[j] ? 1 : 0) as 0 | 1;
    });
  });
  const items = Array.from({ length: K }, (_, j) => `p${j + 1}`);
  const vacio = () => Array.from({ length: n }, () => Array(K).fill(null));
  return { items, estudiantes: x.map((_, i) => `s${i}`), x, tiempos: vacio(), fichas: vacio(), cambios: x.map(() => Array(K).fill(0)), posiciones: x.map(() => items.map((_, j) => j)) };
}

describe('normal bivariada (Genz)', () => {
  it('coincide con la fórmula cerrada en h = k = 0 para todo ρ', () => {
    for (const r of [-0.99, -0.95, -0.6, -0.2, 0, 0.29, 0.5, 0.8, 0.93, 0.99]) {
      expect(bvnSuperior(0, 0, r)).toBeCloseTo(0.25 + Math.asin(r) / (2 * Math.PI), 6);
    }
  });
  it('coincide con la integración numérica en las tres ramas del algoritmo', () => {
    for (const [h, k, r] of [[0.5, -1, 0.1], [1.2, 0.3, 0.6], [-0.7, 0.4, -0.5], [0.5, -1, 0.97], [0.5, -1, -0.97], [-1.5, -1.2, 0.95], [1.1, 1.4, -0.94]]) {
      expect(bvnSuperior(h, k, r)).toBeCloseTo(bvnReferencia(h, k, r), 5);
    }
  });
  it('con ρ = 0 es el producto de las marginales', () => {
    expect(bvnSuperior(0.8, -0.3, 0)).toBeCloseTo(normalCdf(-0.8) * normalCdf(0.3), 7);
  });
});

describe('tetracórica', () => {
  it('recupera la correlación de una normal bivariada dicotomizada (n grande)', () => {
    const z = normales(mulberry32(5));
    for (const [rho, t1, t2] of [[0.5, 0.3, -0.4], [0.8, -0.5, 0.2], [-0.4, 0, 0.6]]) {
      let a = 0, b = 0, c = 0, d = 0;
      for (let i = 0; i < 40000; i++) {
        const u = z(), v = rho * u + Math.sqrt(1 - rho * rho) * z();
        const x = u > t1, y = v > t2;
        if (x && y) a++; else if (x) b++; else if (y) c++; else d++;
      }
      expect(Math.abs(tetracorica(a, b, c, d) - rho)).toBeLessThan(0.03);
    }
  });
  it('tablas independientes dan ≈ 0 y celdas vacías no rompen la estimación', () => {
    expect(Math.abs(tetracorica(250, 250, 250, 250))).toBeLessThan(1e-6);
    const r = tetracorica(30, 0, 0, 30);
    expect(r).toBeGreaterThan(0.9);
    expect(r).toBeLessThan(1);
  });
});

describe('álgebra', () => {
  it('autovalores y autovectores reconstruyen la matriz', () => {
    const A = [[4, 1, 0.5], [1, 3, 0.2], [0.5, 0.2, 2]];
    const { valores, vectores } = autovalores(A);
    expect(valores[0]).toBeGreaterThanOrEqual(valores[1]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      expect(vectores.reduce((s, v, k) => s + v[i] * v[j] * valores[k], 0)).toBeCloseTo(A[i][j], 9);
    }
    expect(valores.reduce((s, x) => s + x, 0)).toBeCloseTo(9, 9);
  });
  it('varimax conserva las comunalidades y simplifica una estructura rotada', () => {
    const verdad = [[0.8, 0], [0.7, 0], [0.75, 0], [0, 0.8], [0, 0.7], [0, 0.6]];
    const ang = 0.6, c = Math.cos(ang), s = Math.sin(ang);
    const rotada = verdad.map(([a, b]) => [a * c - b * s, a * s + b * c]);
    const v = varimax(rotada);
    v.forEach((f, i) => expect(f[0] ** 2 + f[1] ** 2).toBeCloseTo(verdad[i][0] ** 2 + verdad[i][1] ** 2, 9));
    // cada pregunta vuelve a tener una carga casi nula
    v.forEach((f) => expect(Math.min(Math.abs(f[0]), Math.abs(f[1]))).toBeLessThan(0.02));
  });
  it('KMO de una matriz con estructura común es alto', () => {
    const R = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0.5)));
    expect(kmo(R).global).toBeGreaterThan(0.8);
  });
});

describe('análisis factorial completo', () => {
  const umbrales = [-0.8, -0.4, 0, 0.3, 0.6, -0.2, 0.1, 0.5, -0.6, 0.2, -0.1, 0.4];
  it('datos unidimensionales: un factor, esencialmente unidimensional', () => {
    const m = simularMatriz(500, umbrales.map(() => [0.65]), umbrales, 11);
    const r = analisisFactorial(m, [], 3, 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.m).toBe(1);
    expect(r.unidimensional.esencial).toBe(true);
    expect(r.items.every((it) => it.factor === 0)).toBe(true);
    // la carga estimada se acerca a la verdadera (0.65)
    const media = r.items.reduce((s, it) => s + it.cargas[0], 0) / r.items.length;
    expect(Math.abs(media - 0.65)).toBeLessThan(0.08);
  });

  it('dos dimensiones: las separa y agrupa las preguntas correctas; la etiqueta sale de los conceptos', () => {
    const cargas = umbrales.map((_, j) => (j < 6 ? [0.7, 0] : [0, 0.7]));
    const m = simularMatriz(600, cargas, umbrales, 12);
    const preguntas = m.items.map((id, j) => ({ id, concepts: [j < 6 ? 'cinematica' : 'energia'] }) as unknown as Pregunta);
    const r = analisisFactorial(m, preguntas, 3, 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.m).toBe(2);
    expect(r.unidimensional.esencial).toBe(false);
    const grupoA = new Set(r.items.slice(0, 6).map((it) => it.factor));
    const grupoB = new Set(r.items.slice(6).map((it) => it.factor));
    expect(grupoA.size).toBe(1);
    expect(grupoB.size).toBe(1);
    expect([...grupoA][0]).not.toBe([...grupoB][0]);
    const etiquetas = r.factores.map((f) => f.conceptos[0]).sort();
    expect(etiquetas).toEqual(['cinematica', 'energia']);
    expect(r.factores[0].etiqueta).toMatch(/a priori, confianza baja/);
  });

  it('preguntas independientes: no inventa factores', () => {
    const m = simularMatriz(400, umbrales.map(() => [0]), umbrales, 13);
    const r = analisisFactorial(m, [], 3, 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.m).toBe(0);
    expect(r.avisos.join(' ')).toMatch(/no se detecta una estructura común/);
  });

  it('es reproducible con la misma semilla', () => {
    const m = simularMatriz(300, umbrales.map(() => [0.6]), umbrales, 14);
    const a = analisisFactorial(m, [], 9, 20), b = analisisFactorial(m, [], 9, 20);
    expect(a).toEqual(b);
  });

  it('se abstiene con pocos estudiantes, pocos por pregunta o preguntas casi constantes', () => {
    const pocos = analisisFactorial(simularMatriz(MIN_FACTORIAL - 1, umbrales.map(() => [0.6]), umbrales, 15));
    expect(pocos.ok).toBe(false);
    if (!pocos.ok) expect(pocos.motivo).toMatch(/al menos 100/);
    // 30 preguntas con 120 estudiantes: menos de 5 por pregunta
    const u30 = Array.from({ length: 30 }, (_, j) => (j % 7) / 10 - 0.3);
    const porPregunta = analisisFactorial(simularMatriz(120, u30.map(() => [0.6]), u30, 16));
    expect(porPregunta.ok).toBe(false);
    if (!porPregunta.ok) expect(porPregunta.motivo).toMatch(/5 por pregunta/);
    // una pregunta que todos aciertan se excluye y se explica
    const conConstante = simularMatriz(300, [...umbrales.map(() => [0.6]), [0.6]], [...umbrales, -9], 17);
    const r = analisisFactorial(conConstante, [], 3, 20);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.excluidos.map((e) => e.id)).toEqual(['p13']);
  });

  it('con una matriz mal condicionada no informa KMO/Bartlett (serían arbitrarios) y no desaconseja un factor fuerte', () => {
    // un factor fuerte (carga 0.6), 40 preguntas y 200 estudiantes: el KMO por la inversa daría ≈ 0.5 (falso «débil»)
    const u40 = Array.from({ length: 40 }, (_, j) => (j % 9) / 6 - 0.6);
    const r = analisisFactorial(simularMatriz(200, u40.map(() => [0.6]), u40, 19), [], 3, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kmo).toBeNull();
    expect(r.bartlett).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/KMO y Bartlett no se informan/);
    expect(r.avisos.join(' ')).not.toMatch(/estructura común es débil/);
    expect(r.m).toBe(1);
    expect(r.confianza).toBe('baja');
  });

  it('con una matriz bien condicionada informa KMO alto para un factor fuerte', () => {
    const r = analisisFactorial(simularMatriz(1000, umbrales.map(() => [0.7]), umbrales, 20), [], 3, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kmo).not.toBeNull();
    expect(r.kmo!).toBeGreaterThan(0.8);
    expect(r.bartlett!.p).toBeLessThan(0.001);
  });

  it('la confianza nunca es alta y el método queda descrito', () => {
    const r = analisisFactorial(simularMatriz(400, umbrales.map(() => [0.7]), umbrales, 18), [], 3, 20);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(['media', 'baja']).toContain(r.confianza);
    expect(r.metodo).toMatch(/Tetracóricas/);
    expect(r.umbralParalelo).toHaveLength(r.autovalores.length);
  });
});
