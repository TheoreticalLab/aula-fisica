/**
 * LIEIA · Generador pseudoaleatorio con semilla (reproducible): mulberry32 + utilidades de muestreo.
 * Misma semilla ⇒ mismos datos sintéticos y mismos resultados en cualquier equipo.
 */
export interface Azar {
  u(): number;               // uniforme [0, 1)
  normal(m?: number, s?: number): number;
  entero(n: number): number; // 0..n-1
  elegir<T>(xs: readonly T[]): T;
  barajar<T>(xs: T[]): T[];  // en el sitio (Fisher–Yates)
  bernoulli(p: number): boolean;
  categorica(ps: readonly number[]): number;
  exponencial(tasa: number): number;
}

export function crearAzar(semilla: number): Azar {
  let a = semilla >>> 0 || 0x9e3779b9;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let guardado: number | null = null;
  const normal = (m = 0, s = 1) => {
    if (guardado !== null) {
      const z = guardado;
      guardado = null;
      return m + s * z;
    }
    let x = 0, y = 0, r = 0;
    do {
      x = 2 * u() - 1;
      y = 2 * u() - 1;
      r = x * x + y * y;
    } while (r === 0 || r >= 1);
    const f = Math.sqrt((-2 * Math.log(r)) / r);
    guardado = y * f;
    return m + s * x * f;
  };
  const entero = (n: number) => Math.floor(u() * n);
  return {
    u, normal, entero,
    elegir: (xs) => xs[entero(xs.length)],
    barajar: (xs) => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = entero(i + 1);
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      return xs;
    },
    bernoulli: (p) => u() < p,
    categorica: (ps) => {
      const tot = ps.reduce((s, x) => s + x, 0);
      let r = u() * tot;
      for (let i = 0; i < ps.length; i++) {
        r -= ps[i];
        if (r <= 0) return i;
      }
      return ps.length - 1;
    },
    exponencial: (tasa) => -Math.log(1 - u()) / tasa,
  };
}

/** Semilla derivada (para que cada réplica y cada prueba de permutación sea independiente y reproducible). */
export function derivarSemilla(base: number, ...partes: number[]): number {
  let h = (base ^ 0x85ebca6b) >>> 0;
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0xcc9e2d51) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
