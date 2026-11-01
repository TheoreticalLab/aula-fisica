/**
 * Choque entre dos discos en el plano (sin fricción ni rotación). El impulso actúa a lo largo de la línea que une los
 * centros en el instante del contacto (normal n̂); la componente tangencial de cada velocidad no cambia.
 *   J = −(1 + e)·(u·n̂) / (1/m₁ + 1/m₂),  u = v₂ − v₁ (velocidad relativa)   ⇒   v₁' = v₁ − (J/m₁) n̂,  v₂' = v₂ + (J/m₂) n̂
 * Se conserva la cantidad de movimiento (vectorial); la energía cinética solo si e = 1.
 * Montaje: el disco 1 parte de (−d, 0) con velocidad v₁ en +x; el disco 2 está en (0, b) con velocidad v₂ a un ángulo α₂.
 * El parámetro de impacto b es la separación perpendicular entre la trayectoria de 1 y el centro de 2 (choque si |b| < 2R
 * cuando 2 está en reposo).
 */

export type V = [number, number];
const suma = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const resta = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const esc = (k: number, a: V): V => [k * a[0], k * a[1]];
const punto = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
export const modulo = (a: V) => Math.hypot(a[0], a[1]);
export const anguloGrados = (a: V) => (Math.atan2(a[1], a[0]) * 180) / Math.PI;

export interface Params2D { m1: number; m2: number; v1: number; v2: number; ang2: number; b: number; e: number; R: number; d?: number }

export interface Choque2D {
  choca: boolean; tc: number | null; n: V | null;
  v1i: V; v2i: V; v1f: V; v2f: V;
  pIni: V; pFin: V; Kini: number; Kfin: number; J: V | null;
  /** ángulo entre las velocidades finales (útil: 90° en un choque elástico de masas iguales con 2 en reposo) */
  anguloEntreFinales: number | null;
}

export function choque2D(p: Params2D): Choque2D {
  const d = p.d ?? 1.5;
  const r1: V = [-d, 0], r2: V = [0, p.b];
  const v1i: V = [p.v1, 0];
  const a2 = (p.ang2 * Math.PI) / 180;
  const v2i: V = [p.v2 * Math.cos(a2), p.v2 * Math.sin(a2)];
  const K = (m: number, v: V) => 0.5 * m * punto(v, v);
  const pIni = suma(esc(p.m1, v1i), esc(p.m2, v2i));
  const Kini = K(p.m1, v1i) + K(p.m2, v2i);
  // instante de contacto: |r + u t| = 2R con r = r2 − r1, u = v2 − v1 (menor raíz positiva)
  const r = resta(r2, r1), u = resta(v2i, v1i), D = 2 * p.R;
  const A = punto(u, u), B = 2 * punto(r, u), C = punto(r, r) - D * D;
  const disc = B * B - 4 * A * C;
  const sinChoque: Choque2D = { choca: false, tc: null, n: null, v1i, v2i, v1f: v1i, v2f: v2i, pIni, pFin: pIni, Kini, Kfin: Kini, J: null, anguloEntreFinales: null };
  if (A < 1e-12 || disc < 0 || C <= 0) return sinChoque;
  const tc = (-B - Math.sqrt(disc)) / (2 * A);
  if (!(tc > 0)) return sinChoque;
  const rc = suma(r, esc(tc, u));
  const n = esc(1 / modulo(rc), rc);
  const un = punto(u, n);
  if (un >= 0) return sinChoque;                                   // no se acercan a lo largo de la normal
  const Jm = (-(1 + p.e) * un) / (1 / p.m1 + 1 / p.m2);
  const v1f = resta(v1i, esc(Jm / p.m1, n)), v2f = suma(v2i, esc(Jm / p.m2, n));
  const pFin = suma(esc(p.m1, v1f), esc(p.m2, v2f));
  const m1f = modulo(v1f), m2f = modulo(v2f);
  return {
    choca: true, tc, n, v1i, v2i, v1f, v2f, pIni, pFin, Kini, Kfin: K(p.m1, v1f) + K(p.m2, v2f), J: esc(Jm, n),
    anguloEntreFinales: m1f > 1e-9 && m2f > 1e-9 ? (Math.acos(Math.max(-1, Math.min(1, punto(v1f, v2f) / (m1f * m2f)))) * 180) / Math.PI : null,
  };
}

/** Posiciones en el tiempo (antes y después del contacto), para animar. */
export function trayectorias(p: Params2D, c: Choque2D, n = 240) {
  const d = p.d ?? 1.5;
  const tc = c.tc ?? (d + 1) / Math.max(0.1, Math.abs(p.v1));
  const tFin = tc * 2.2;
  const r1c: V = suma([-d, 0], esc(tc, c.v1i)), r2c: V = suma([0, p.b], esc(tc, c.v2i));
  return { tFin, muestras: Array.from({ length: n + 1 }, (_, k) => {
    const t = (tFin * k) / n;
    const antes = !c.choca || t <= tc;
    const x1: V = antes ? suma([-d, 0], esc(t, c.v1i)) : suma(r1c, esc(t - tc, c.v1f));
    const x2: V = antes ? suma([0, p.b], esc(t, c.v2i)) : suma(r2c, esc(t - tc, c.v2f));
    return { t, x1, x2, despues: !antes };
  }) };
}
