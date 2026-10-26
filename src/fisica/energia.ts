/**
 * Modelos físicos de los simuladores de trabajo y energía, conservación de la energía, oscilador masa-resorte
 * y colisiones. Datos puros (sin React): los validan las pruebas de tests/fisica-energia.test.ts frente a
 * soluciones analíticas conocidas.
 */
import { gradosARad } from './modelos';

// ---------------------------------------------------------------------------------------------------------
// Trabajo y energía cinética: bloque en superficie horizontal, fuerza constante a un ángulo φ, fricción cinética
// ---------------------------------------------------------------------------------------------------------
export interface ResultadoTrabajo {
  valido: boolean;
  motivo?: string;
  N: number;
  Fx: number;
  f: number;
  a: number;
  /** Distancia realmente recorrida (puede ser menor que d si el bloque se detiene). */
  s: number;
  seDetiene: boolean;
  W: { F: number; friccion: number; normal: number; peso: number; neto: number };
  K0: number;
  K1: number;
  v1: number;
  /** Duración del recorrido. */
  tFin: number;
}

export function trabajoEnergia(p: { m: number; F: number; phi: number; muK: number; d: number; v0: number; g: number }): ResultadoTrabajo {
  const phi = gradosARad(p.phi);
  const N = p.m * p.g - p.F * Math.sin(phi);
  const Fx = p.F * Math.cos(phi);
  const base = { N, Fx, f: 0, a: 0, s: 0, seDetiene: false, W: { F: 0, friccion: 0, normal: 0, peso: 0, neto: 0 }, K0: 0.5 * p.m * p.v0 ** 2, K1: 0, v1: 0, tFin: 0 };
  if (N < 0) return { ...base, valido: false, motivo: 'La componente vertical de la fuerza levantaría el bloque (N < 0): el modelo no se aplica.' };
  const f = p.muK * N;
  const K0 = 0.5 * p.m * p.v0 ** 2;
  // partiendo del reposo, si el empuje no supera la fricción el bloque no arranca (se supone μs ≥ μk)
  if (p.v0 === 0 && Fx <= f) {
    return { ...base, valido: true, f: Fx, K1: 0, motivo: 'El empuje horizontal no supera la fricción: el bloque no se mueve y ninguna fuerza hace trabajo.' };
  }
  const a = (Fx - f) / p.m;
  let s = p.d;
  let seDetiene = false;
  if (a < 0) {
    const sParada = (p.v0 * p.v0) / (2 * -a);
    if (sParada < p.d) { s = sParada; seDetiene = true; }
  }
  const W = { F: Fx * s, friccion: -f * s, normal: 0, peso: 0, neto: (Fx - f) * s };
  const K1 = Math.max(0, K0 + W.neto);
  const v1 = Math.sqrt((2 * K1) / p.m);
  const tFin = Math.abs(a) < 1e-12 ? (p.v0 > 0 ? s / p.v0 : 0) : (v1 - p.v0) / a;
  return { valido: true, N, Fx, f, a, s, seDetiene, W, K0, K1, v1, tFin };
}

// ---------------------------------------------------------------------------------------------------------
// Conservación de la energía: pista con rampa izquierda (θ1), tramo horizontal L y rampa derecha (θ2)
// Coordenada s a lo largo de la pista: s < 0 rampa izquierda (fondo en s = 0), 0 ≤ s ≤ L plano, s > L rampa derecha.
// Integración EXACTA por tramos: en cada tramo, con el sentido de v fijo, la aceleración es constante.
// ---------------------------------------------------------------------------------------------------------
export interface ParamsPista { m: number; h0: number; v0: number; theta1: number; theta2: number; L: number; muK: number; g: number }
interface Tramo { t0: number; s0: number; v0: number; a: number; dur: number; eTerm0: number; mu: number; cos: number }

export function alturaPista(p: ParamsPista, s: number): number {
  if (s < 0) return -s * Math.sin(gradosARad(p.theta1));
  if (s <= p.L) return 0;
  return (s - p.L) * Math.sin(gradosARad(p.theta2));
}

function zona(p: ParamsPista, s: number, v: number): 'izq' | 'plano' | 'der' {
  // en las fronteras decide el sentido del movimiento
  if (s < 0 || (s === 0 && v < 0)) return 'izq';
  if (s > p.L || (s === p.L && v > 0)) return 'der';
  return 'plano';
}

export function simularPista(p: ParamsPista, tMax = 60) {
  const th1 = gradosARad(p.theta1);
  const th2 = gradosARad(p.theta2);
  const tramos: Tramo[] = [];
  let t = 0;
  let s = -p.h0 / Math.sin(th1);
  let v = p.v0; // hacia la derecha (bajando la rampa izquierda)
  let eTerm = 0;
  let detenido = false;
  for (let iter = 0; iter < 10_000 && t < tMax; iter++) {
    const z = zona(p, s, v);
    const cos = z === 'izq' ? Math.cos(th1) : z === 'der' ? Math.cos(th2) : 1;
    const gPend = z === 'izq' ? p.g * Math.sin(th1) : z === 'der' ? -p.g * Math.sin(th2) : 0; // componente de g a lo largo de +s
    const fr = p.muK * p.g * cos;
    if (Math.abs(v) < 1e-12) {
      // en reposo: ¿puede la fricción (μs = μk) sostenerlo?
      if (Math.abs(gPend) <= fr + 1e-12) { detenido = true; break; }
      v = 0;
    }
    const sentido = Math.abs(v) < 1e-12 ? Math.sign(gPend) : Math.sign(v);
    const a = gPend - sentido * fr;
    // próximo evento: v = 0 (si a se opone a v) o llegada a una frontera del tramo
    const candidatos: number[] = [];
    if (Math.abs(v) > 1e-12 && Math.sign(a) === -Math.sign(v)) candidatos.push(-v / a);
    const fronteras = z === 'izq' ? [0] : z === 'der' ? [p.L] : [0, p.L];
    for (const sb of fronteras) {
      const ds = sb - s;
      if (Math.abs(ds) < 1e-12) continue;
      // s + v τ + ½ a τ² = sb  →  menor raíz positiva
      const A = 0.5 * a, B = v, C = -ds;
      const raices = Math.abs(A) < 1e-14 ? (Math.abs(B) > 1e-14 ? [-C / B] : []) : (() => {
        const disc = B * B - 4 * A * C;
        if (disc < 0) return [];
        const r = Math.sqrt(disc);
        return [(-B - r) / (2 * A), (-B + r) / (2 * A)];
      })();
      for (const r of raices) if (r > 1e-12) candidatos.push(r);
    }
    let dur = candidatos.length ? Math.min(...candidatos) : tMax - t;
    if (t + dur > tMax) dur = tMax - t;
    tramos.push({ t0: t, s0: s, v0: v, a, dur, eTerm0: eTerm, mu: p.muK, cos });
    const s1 = s + v * dur + 0.5 * a * dur * dur;
    const v1 = v + a * dur;
    eTerm += p.muK * p.m * p.g * cos * Math.abs(s1 - s); // en cada tramo el sentido no cambia
    t += dur;
    s = Math.abs(s1) < 1e-9 ? 0 : Math.abs(s1 - p.L) < 1e-9 ? p.L : s1;
    v = Math.abs(v1) < 1e-9 ? 0 : v1;
  }
  const E0 = 0.5 * p.m * p.v0 ** 2 + p.m * p.g * p.h0;
  const estado = (tt: number) => {
    const tr = tramos.find((x) => tt >= x.t0 && tt <= x.t0 + x.dur + 1e-12) ?? tramos[tramos.length - 1];
    const tau = Math.max(0, Math.min(tt - tr.t0, tr.dur));
    const sx = tr.s0 + tr.v0 * tau + 0.5 * tr.a * tau * tau;
    const vx = tr.v0 + tr.a * tau;
    const y = alturaPista(p, sx);
    const K = 0.5 * p.m * vx * vx;
    const U = p.m * p.g * y;
    const Eterm = tr.eTerm0 + tr.mu * p.m * p.g * tr.cos * Math.abs(sx - tr.s0);
    return { t: tt, s: sx, v: vx, y, K, U, Emec: K + U, Eterm, Etotal: K + U + Eterm };
  };
  const tFin = tramos.length ? tramos[tramos.length - 1].t0 + tramos[tramos.length - 1].dur : 0;
  return { tramos, estado, E0, detenido, tFin };
}

// ---------------------------------------------------------------------------------------------------------
// Oscilador masa-resorte (coordenada x medida desde el equilibrio)
// ---------------------------------------------------------------------------------------------------------
export function oscilador(p: { m: number; k: number; x0: number; v0: number; vertical?: number; g?: number }) {
  const omega = Math.sqrt(p.k / p.m);
  const T = (2 * Math.PI) / omega;
  const A = Math.sqrt(p.x0 ** 2 + (p.v0 / omega) ** 2);
  // x = A cos(ωt + φ): x0 = A cos φ, v0 = −Aω sen φ
  const phi = A === 0 ? 0 : Math.atan2(-p.v0 / omega, p.x0);
  const E = 0.5 * p.k * A * A;
  const g = p.g ?? 9.8;
  const estiramientoEquilibrio = p.vertical ? (p.m * g) / p.k : 0;
  const estado = (t: number) => {
    const fase = omega * t + phi;
    const x = A * Math.cos(fase);
    const v = -A * omega * Math.sin(fase);
    const a = -omega * omega * x;
    return { t, x, v, a, K: 0.5 * p.m * v * v, U: 0.5 * p.k * x * x };
  };
  return { omega, f: omega / (2 * Math.PI), T, A, phi, E, vMax: A * omega, aMax: A * omega * omega, estiramientoEquilibrio, estado };
}

/** Integración de Verlet (velocidad) de m x'' = −k x. Conserva la energía sin deriva acumulada. */
export function verletOscilador(m: number, k: number, x0: number, v0: number, dt: number, pasos: number) {
  const xs = [x0];
  const vs = [v0];
  let x = x0;
  let v = v0;
  let a = (-k * x) / m;
  for (let i = 0; i < pasos; i++) {
    x += v * dt + 0.5 * a * dt * dt;
    const a1 = (-k * x) / m;
    v += 0.5 * (a + a1) * dt;
    a = a1;
    xs.push(x);
    vs.push(v);
  }
  const energia = xs.map((xi, i) => 0.5 * m * vs[i] ** 2 + 0.5 * k * xi ** 2);
  return { xs, vs, energia };
}

/** Energías del resorte VERTICAL con x desde el equilibrio (positiva hacia abajo), referidas a la longitud natural. */
export function energiasVertical(m: number, k: number, g: number, x: number, v: number) {
  const D = (m * g) / k; // estiramiento en el equilibrio
  const elastica = 0.5 * k * (D + x) ** 2;
  const gravitacional = -m * g * x; // cero en el equilibrio, eje hacia abajo
  return { K: 0.5 * m * v * v, elastica, gravitacional, suma: elastica + gravitacional, equivalente: 0.5 * k * x * x + 0.5 * k * D * D };
}

// ---------------------------------------------------------------------------------------------------------
// Colisiones en una dimensión con coeficiente de restitución
// ---------------------------------------------------------------------------------------------------------
export function colision1D(m1: number, m2: number, v1: number, v2: number, e: number) {
  const M = m1 + m2;
  const p = m1 * v1 + m2 * v2;
  const seAcercan = v1 > v2; // el carro 1 está a la izquierda del 2
  const v1f = seAcercan ? (p + m2 * e * (v2 - v1)) / M : v1;
  const v2f = seAcercan ? (p + m1 * e * (v1 - v2)) / M : v2;
  const K0 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const K1 = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
  return { seAcercan, v1f, v2f, p0: p, p1: m1 * v1f + m2 * v2f, K0, K1, perdidaK: K0 - K1, vcm: p / M };
}
