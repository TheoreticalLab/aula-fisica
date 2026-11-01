/**
 * LIEIA · análisis factorial exploratorio de un examen (procedencia EMPÍRICA, siempre exploratorio).
 *
 * Pregunta científica: ¿las respuestas se explican por una sola dimensión o hay grupos de preguntas que covarían entre sí
 * más de lo que la dificultad explica? Es lo que necesita la TRI (supone unidimensionalidad) y el diseño de exámenes.
 *
 * Método (decisiones documentadas en docs/LIEIA_LABORATORIO.md):
 *  - Correlaciones TETRACÓRICAS (no phi): con preguntas 0/1, la phi depende de la dificultad y fabrica «factores de
 *    dificultad». Se estiman por máxima verosimilitud de cada tabla 2×2 (normal bivariada de Genz; bisección en ρ),
 *    con corrección de 0,5 en tablas con celdas vacías y datos por pares (lo omitido cuenta como 0; lo no calificado se
 *    excluye del par).
 *  - Matriz no definida positiva → suavizado por autovalores (se avisa).
 *  - Adecuación: KMO y prueba de esfericidad de Bartlett (aproximada con tetracóricas).
 *  - Número de factores: análisis paralelo de Horn (percentil 95 de los autovalores de datos independientes con las
 *    mismas proporciones de acierto y el mismo n; semilla fija → reproducible).
 *  - Extracción por ejes principales iterada (comunalidades iniciales = correlación múltiple al cuadrado) y rotación
 *    varimax con normalización de Kaiser. Casos Heywood (comunalidad ≥ 1) se acotan y se avisan.
 * Abstención: al menos 100 estudiantes y 5 por pregunta analizada; se excluyen preguntas casi constantes.
 * Un factor es un patrón de correlación, NO una habilidad demostrada; la etiqueta sugerida por los conceptos compartidos
 * es a priori y de confianza baja. La confianza del conjunto nunca es «alta»: el análisis es exploratorio.
 */
import { chiCuadradoCola, normalCdf } from '../estadistica';
import { mulberry32 } from '@/lib/azar';
import type { Confianza, Pregunta } from './modelo';
import type { Matriz } from './psicometria';
import { probit } from './simulacion';

export const MIN_FACTORIAL = 100;
export const POR_PREGUNTA = 5;
/** carga mínima para asignar una pregunta a un factor; por debajo de CARGA_DEBIL se considera sin carga */
export const CARGA_MIN = 0.4, CARGA_DEBIL = 0.3;
/** proporción de acierto fuera de [P_EXTREMA, 1 − P_EXTREMA]: la tetracórica es inestable y se excluye */
export const P_EXTREMA = 0.05;
/** menor autovalor de R a partir del cual KMO y Bartlett son fiables (por debajo dependen del ruido de la inversa) */
export const MIN_AUTOVALOR_ADECUACION = 0.1;

// ---------------------------------------------------------------------------------------------------------------------
// Normal bivariada: P(X > h, Y > k) con correlación r. Algoritmo BVND de A. Genz (Statistics and Computing, 2004),
// error < 1e-15 con la normal exacta; aquí limitado por normalCdf (≈ 1e-7), suficiente para las tetracóricas.
// ---------------------------------------------------------------------------------------------------------------------
const GL: { w: number[]; x: number[] }[] = [
  { w: [0.1713244923791705, 0.3607615730481384, 0.4679139345726904], x: [-0.9324695142031522, -0.6612093864662647, -0.238619186083197] },
  {
    w: [0.04717533638651177, 0.1069393259953183, 0.1600783285433464, 0.2031674267230659, 0.2334925365383547, 0.2491470458134029],
    x: [-0.9815606342467191, -0.904117256370475, -0.769902674194305, -0.5873179542866171, -0.3678314989981802, -0.1252334085114692],
  },
  {
    w: [0.01761400713915212, 0.04060142980038694, 0.06267204833410906, 0.08327674157670475, 0.1019301198172404, 0.1181945319615184,
      0.1316886384491766, 0.1420961093183821, 0.1491729864726037, 0.1527533871307259],
    x: [-0.9931285991850949, -0.9639719272779138, -0.9122344282513259, -0.8391169718222188, -0.7463319064601508, -0.636053680726515,
      -0.5108670019508271, -0.3737060887154196, -0.2277858511416451, -0.07652652113349733],
  },
];
const DOS_PI = 2 * Math.PI;

export function bvnSuperior(h: number, k: number, r: number): number {
  const { w, x } = Math.abs(r) < 0.3 ? GL[0] : Math.abs(r) < 0.75 ? GL[1] : GL[2];
  let hk = h * k, bvn = 0;
  if (Math.abs(r) < 0.925) {
    const hs = (h * h + k * k) / 2, asr = Math.asin(r);
    for (let i = 0; i < x.length; i++) {
      let sn = Math.sin((asr * (x[i] + 1)) / 2);
      bvn += w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
      sn = Math.sin((asr * (-x[i] + 1)) / 2);
      bvn += w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
    }
    return (bvn * asr) / (2 * DOS_PI) + normalCdf(-h) * normalCdf(-k);
  }
  if (r < 0) { k = -k; hk = -hk; }
  if (Math.abs(r) < 1) {
    const as = (1 - r) * (1 + r);
    let a = Math.sqrt(as);
    const bs = (h - k) ** 2, c = (4 - hk) / 8, d = (12 - hk) / 16;
    bvn = a * Math.exp(-(bs / as + hk) / 2) * (1 - (c * (bs - as) * (1 - (d * bs) / 5)) / 3 + (c * d * as * as) / 5);
    if (hk > -160) {
      const b = Math.sqrt(bs);
      bvn -= Math.exp(-hk / 2) * Math.sqrt(DOS_PI) * normalCdf(-b / a) * b * (1 - (c * bs * (1 - (d * bs) / 5)) / 3);
    }
    a /= 2;
    for (let i = 0; i < x.length; i++) {
      let xs = (a * (x[i] + 1)) ** 2;
      let rs = Math.sqrt(1 - xs);
      bvn += a * w[i] * (Math.exp(-bs / (2 * xs) - hk / (1 + rs)) / rs - Math.exp(-(bs / xs + hk) / 2) * (1 + c * xs * (1 + d * xs)));
      xs = (as * (-x[i] + 1) ** 2) / 4;
      rs = Math.sqrt(1 - xs);
      bvn += a * w[i] * Math.exp(-(bs / xs + hk) / 2) * (Math.exp((-hk * (1 - rs)) / (2 * (1 + rs))) / rs - (1 + c * xs * (1 + d * xs)));
    }
    bvn = -bvn / DOS_PI;
  }
  if (r > 0) return bvn + normalCdf(-Math.max(h, k));
  bvn = -bvn;
  if (k > h) bvn += h < 0 ? normalCdf(k) - normalCdf(h) : normalCdf(-h) - normalCdf(-k);
  return bvn;
}

// ---------------------------------------------------------------------------------------------------------------------
// Tetracórica de una tabla 2×2: a = ambos correctos, b = solo la primera, c = solo la segunda, d = ninguna.
// ---------------------------------------------------------------------------------------------------------------------
export function tetracorica(a: number, b: number, c: number, d: number): number {
  if ([a, b, c, d].some((v) => v === 0)) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }
  const n = a + b + c + d, p1 = (a + b) / n, p2 = (a + c) / n, p11 = a / n;
  const h = -probit(p1), k = -probit(p2);
  let lo = -0.999, hi = 0.999;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (bvnSuperior(h, k, mid) < p11) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------------------------------------------------
// Álgebra: autovalores de una matriz simétrica (Jacobi cíclico), inversa por autovalores.
// ---------------------------------------------------------------------------------------------------------------------
export function autovalores(A: number[][]): { valores: number[]; vectores: number[][] } {
  const n = A.length;
  const a = A.map((f) => f.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let barrido = 0; barrido < 100; barrido++) {
    let fuera = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) fuera += a[p][q] ** 2;
    if (fuera < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const orden = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { valores: orden.map((i) => a[i][i]), vectores: orden.map((i) => v.map((f) => f[i])) };
}

function inversa(R: number[][]): number[][] {
  const { valores, vectores } = autovalores(R);
  const n = R.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => vectores.reduce((s, vec, k) => s + (vec[i] * vec[j]) / valores[k], 0)));
}

/** Suaviza una matriz de correlación no definida positiva (autovalores acotados por debajo y reescalado a diagonal 1). */
export function suavizar(R: number[][], piso = 1e-3): { R: number[][]; suavizada: boolean } {
  const { valores, vectores } = autovalores(R);
  if (valores[valores.length - 1] > piso) return { R, suavizada: false };
  const n = R.length;
  const vals = valores.map((l) => Math.max(l, piso));
  const S = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => vectores.reduce((s, vec, k) => s + vec[i] * vec[j] * vals[k], 0)));
  return { R: S.map((f, i) => f.map((x, j) => x / Math.sqrt(S[i][i] * S[j][j]))), suavizada: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// Datos: matriz 0/1 por pares
// ---------------------------------------------------------------------------------------------------------------------
type Fila = (0 | 1 | null)[];
const filasDe = (m: Matriz): Fila[] => m.x.map((f) => f.map((c) => (c === 1 ? 1 : c === 0 || c === 'omitida' ? 0 : null)));

export function matrizTetracorica(filas: Fila[], cols: number[]): { R: number[][]; nMin: number } {
  const K = cols.length;
  const R: number[][] = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? 1 : 0)));
  let nMin = Infinity;
  for (let i = 0; i < K; i++) {
    for (let j = i + 1; j < K; j++) {
      let a = 0, b = 0, c = 0, d = 0;
      for (const f of filas) {
        const x = f[cols[i]], y = f[cols[j]];
        if (x === null || y === null) continue;
        if (x && y) a++; else if (x) b++; else if (y) c++; else d++;
      }
      nMin = Math.min(nMin, a + b + c + d);
      R[i][j] = R[j][i] = tetracorica(a, b, c, d);
    }
  }
  return { R, nMin: Number.isFinite(nMin) ? nMin : 0 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Extracción y rotación
// ---------------------------------------------------------------------------------------------------------------------
export function ejesPrincipales(R: number[][], m: number): { cargas: number[][]; comunalidades: number[]; heywood: boolean; iteraciones: number } {
  const K = R.length;
  const inv = inversa(R);
  let h2 = inv.map((f, i) => Math.min(0.995, Math.max(0.05, 1 - 1 / f[i])));
  let heywood = false, cargas: number[][] = [], it = 0;
  for (it = 1; it <= 300; it++) {
    const Rr = R.map((f, i) => f.map((x, j) => (i === j ? h2[i] : x)));
    const { valores, vectores } = autovalores(Rr);
    cargas = Array.from({ length: K }, (_, i) => Array.from({ length: m }, (_, f) => vectores[f][i] * Math.sqrt(Math.max(valores[f], 0))));
    const nuevo = cargas.map((fila) => fila.reduce((s, l) => s + l * l, 0));
    if (nuevo.some((x) => x >= 0.995)) heywood = true;
    const acotado = nuevo.map((x) => Math.min(x, 0.995));
    const cambio = Math.max(...acotado.map((x, i) => Math.abs(x - h2[i])));
    h2 = acotado;
    if (cambio < 1e-5) break;
  }
  return { cargas, comunalidades: cargas.map((fila) => fila.reduce((s, l) => s + l * l, 0)), heywood, iteraciones: it };
}

/** Varimax con normalización de Kaiser (rotaciones por pares de Kaiser, hasta que ningún ángulo supere 1e-7). */
export function varimax(L: number[][]): number[][] {
  const m = L[0]?.length ?? 0;
  if (m < 2) return L.map((f) => f.slice());
  const h = L.map((f) => Math.sqrt(f.reduce((s, x) => s + x * x, 0)) || 1);
  const x = L.map((f, i) => f.map((v) => v / h[i]));
  const p = x.length;
  for (let barrido = 0; barrido < 500; barrido++) {
    let maxAng = 0;
    for (let j = 0; j < m; j++) {
      for (let k = j + 1; k < m; k++) {
        let A = 0, B = 0, C = 0, D = 0;
        for (let i = 0; i < p; i++) {
          const u = x[i][j] ** 2 - x[i][k] ** 2, v = 2 * x[i][j] * x[i][k];
          A += u; B += v; C += u * u - v * v; D += 2 * u * v;
        }
        const phi = Math.atan2(D - (2 * A * B) / p, C - (A * A - B * B) / p) / 4;
        maxAng = Math.max(maxAng, Math.abs(phi));
        const c = Math.cos(phi), s = Math.sin(phi);
        for (let i = 0; i < p; i++) {
          const a = x[i][j], b = x[i][k];
          x[i][j] = a * c + b * s; x[i][k] = -a * s + b * c;
        }
      }
    }
    if (maxAng < 1e-7) break;
  }
  return x.map((f, i) => f.map((v) => v * h[i]));
}

/** KMO global y por pregunta (correlaciones frente a correlaciones parciales). */
export function kmo(R: number[][]): { global: number; porItem: number[] } {
  const inv = inversa(R);
  const K = R.length;
  let r2 = 0, p2 = 0;
  const porItem: number[] = [];
  for (let i = 0; i < K; i++) {
    let ri = 0, pi = 0;
    for (let j = 0; j < K; j++) {
      if (i === j) continue;
      const parcial = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]);
      ri += R[i][j] ** 2; pi += parcial ** 2;
    }
    porItem.push(ri / (ri + pi)); r2 += ri; p2 += pi;
  }
  return { global: r2 / (r2 + p2), porItem };
}

// ---------------------------------------------------------------------------------------------------------------------
// Análisis completo
// ---------------------------------------------------------------------------------------------------------------------
export interface ItemFactorial { id: string; cargas: number[]; comunalidad: number; factor: number | null; cruzada: boolean; kmo: number | null }
export interface Factor { indice: number; varianza: number; items: string[]; conceptos: string[]; etiqueta: string | null }
export interface ResultadoFactorial {
  ok: true; n: number; nMinPar: number; items: ItemFactorial[]; excluidos: { id: string; motivo: string }[];
  autovalores: number[]; umbralParalelo: number[]; factores: Factor[]; m: number;
  /** null si la matriz está mal condicionada (ver MIN_AUTOVALOR_ADECUACION) */
  kmo: number | null; bartlett: { chi2: number; gl: number; p: number } | null; suavizada: boolean; heywood: boolean;
  unidimensional: { razon: number; esencial: boolean }; confianza: Confianza; avisos: string[]; metodo: string; semilla: number; replicas: number;
}
export type Factorial = ResultadoFactorial | { ok: false; n: number; motivo: string };

export function analisisFactorial(mat: Matriz, preguntas: Pregunta[] = [], semilla = 20261101, replicas = 50): Factorial {
  const filas = filasDe(mat);
  const n = filas.length;
  if (n < MIN_FACTORIAL) return { ok: false, n, motivo: `Hay ${n} estudiantes; el análisis factorial necesita al menos ${MIN_FACTORIAL} (con menos, las correlaciones tetracóricas son demasiado inestables para separar dimensiones).` };
  const excluidos: { id: string; motivo: string }[] = [];
  const cols: number[] = [];
  mat.items.forEach((id, j) => {
    const vals = filas.map((f) => f[j]).filter((v): v is 0 | 1 => v !== null);
    const p = vals.length ? vals.reduce<number>((s, v) => s + v, 0) / vals.length : NaN;
    if (vals.length < n / 2) excluidos.push({ id, motivo: `solo ${vals.length} respuestas calificadas` });
    else if (!(p >= P_EXTREMA && p <= 1 - P_EXTREMA)) excluidos.push({ id, motivo: `proporción de acierto ${(p * 100).toFixed(0)} %: casi constante` });
    else cols.push(j);
  });
  const K = cols.length;
  if (K < 4) return { ok: false, n, motivo: `Quedan ${K} preguntas analizables (se excluyen las casi constantes); hacen falta al menos 4.` };
  if (n < POR_PREGUNTA * K) return { ok: false, n, motivo: `Con ${K} preguntas hacen falta al menos ${POR_PREGUNTA * K} estudiantes (${POR_PREGUNTA} por pregunta); hay ${n}.` };
  const avisos: string[] = [];
  const t = matrizTetracorica(filas, cols);
  const { R, suavizada } = suavizar(t.R);
  if (suavizada) avisos.push('La matriz de tetracóricas no era definida positiva (habitual con muestras moderadas) y se suavizó; las cargas son aproximadas.');
  const eig = autovalores(R).valores;
  // KMO y Bartlett dependen de la INVERSA de R: con una matriz mal condicionada (autovalores pequeños por el ruido de
  // muestreo) se vuelven arbitrarios aunque las cargas sean buenas (comprobado por simulación: un factor con KMO
  // poblacional 0,995 da 0,53 con n = 400 y K = 40). Solo se informan si la matriz está bien condicionada.
  const condicionada = !suavizada && eig[K - 1] >= MIN_AUTOVALOR_ADECUACION;
  let ad: { global: number; porItem: number[] } | null = null;
  let bartlett: { chi2: number; gl: number; p: number } | null = null;
  if (condicionada) {
    ad = kmo(R);
    const lnDet = eig.reduce((s, l) => s + Math.log(l), 0);
    const chi2 = -(n - 1 - (2 * K + 5) / 6) * lnDet, gl = (K * (K - 1)) / 2;
    bartlett = { chi2, gl, p: chiCuadradoCola(chi2, gl) };
    if (ad.global < 0.6) avisos.push(`KMO = ${ad.global.toFixed(2)} (< 0,6): las correlaciones parciales son grandes frente a las totales; la estructura común es débil.`);
    if (bartlett.p > 0.05) avisos.push('La prueba de Bartlett no descarta que las preguntas sean independientes.');
  } else {
    avisos.push(`KMO y Bartlett no se informan: con ${n} estudiantes y ${K} preguntas la matriz está mal condicionada (menor autovalor ${eig[K - 1].toFixed(3)}) y darían valores arbitrarios. El número de factores se decide con el análisis paralelo, que no depende de la inversa.`);
  }

  // análisis paralelo de Horn: datos independientes con las mismas proporciones y el mismo n
  const ps = cols.map((j) => { const v = filas.map((f) => f[j]).filter((x): x is 0 | 1 => x !== null); return v.reduce<number>((s, x) => s + x, 0) / v.length; });
  const azar = mulberry32(semilla);
  const sim: number[][] = [];
  for (let r = 0; r < replicas; r++) {
    const datos: Fila[] = Array.from({ length: n }, () => ps.map((p) => (azar() < p ? 1 : 0)));
    sim.push(autovalores(suavizar(matrizTetracorica(datos, ps.map((_, i) => i)).R).R).valores);
  }
  const umbral = eig.map((_, k) => { const col = sim.map((s) => s[k]).sort((a, b) => a - b); return col[Math.min(col.length - 1, Math.ceil(0.95 * col.length) - 1)]; });
  let m = 0;
  while (m < K && eig[m] > umbral[m]) m++;
  const razon = eig[0] / Math.max(eig[1], 1e-9);
  const unidimensional = { razon, esencial: m <= 1 && razon >= 3 };

  let items: ItemFactorial[] = [];
  let factores: Factor[] = [];
  let heywood = false;
  if (m === 0) {
    avisos.push('Ningún autovalor supera al de datos independientes: no se detecta una estructura común más allá del azar.');
    items = cols.map((j, i) => ({ id: mat.items[j], cargas: [], comunalidad: 0, factor: null, cruzada: false, kmo: ad ? ad.porItem[i] : null }));
  } else {
    const ext = ejesPrincipales(R, m);
    heywood = ext.heywood;
    if (heywood) avisos.push('Alguna comunalidad llegó a 1 (caso Heywood) y se acotó: suele indicar pocos datos o demasiados factores.');
    let L = m > 1 ? varimax(ext.cargas) : ext.cargas;
    // signo positivo y orden por varianza explicada
    const ss = Array.from({ length: m }, (_, f) => L.reduce((s, fila) => s + fila[f] ** 2, 0));
    const orden = Array.from({ length: m }, (_, f) => f).sort((a, b) => ss[b] - ss[a]);
    L = L.map((fila) => orden.map((f) => fila[f]));
    for (let f = 0; f < m; f++) if (L.reduce((s, fila) => s + fila[f], 0) < 0) L.forEach((fila) => { fila[f] = -fila[f]; });
    items = cols.map((j, i) => {
      const abs = L[i].map(Math.abs);
      const ord = abs.map((_, f) => f).sort((a, b) => abs[b] - abs[a]);
      const principal = abs[ord[0]] >= CARGA_MIN ? ord[0] : null;
      const cruzada = m > 1 && abs[ord[1]] >= CARGA_DEBIL && abs[ord[0]] - abs[ord[1]] < 0.2;
      return { id: mat.items[j], cargas: L[i], comunalidad: L[i].reduce((s, l) => s + l * l, 0), factor: principal, cruzada, kmo: ad ? ad.porItem[i] : null };
    });
    const porId = new Map(preguntas.map((p) => [p.id, p]));
    factores = Array.from({ length: m }, (_, f) => {
      const suyos = items.filter((it) => it.factor === f && !it.cruzada).map((it) => it.id);
      const cuenta = new Map<string, number>();
      for (const id of suyos) for (const c of porId.get(id)?.concepts ?? []) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
      const conceptos = [...cuenta.entries()].filter(([, c]) => suyos.length >= 2 && c >= Math.ceil(suyos.length / 2)).sort((a, b) => b[1] - a[1]).map(([c]) => c);
      return { indice: f + 1, varianza: L.reduce((s, fila) => s + fila[f] ** 2, 0) / K, items: suyos, conceptos, etiqueta: conceptos.length ? `posiblemente «${conceptos.slice(0, 3).join(', ')}» (a priori, confianza baja)` : null };
    });
    const sinCarga = items.filter((it) => it.cargas.every((l) => Math.abs(l) < CARGA_DEBIL)).length;
    if (sinCarga) avisos.push(`${sinCarga} pregunta(s) no cargan en ningún factor (|carga| < ${CARGA_DEBIL}): miden algo propio o tienen mucho ruido.`);
  }
  if (n < 200) avisos.push(`Con ${n} estudiantes el resultado es preliminar: confírmelo con otra aplicación antes de usarlo en un diseño.`);
  const confianza: Confianza = n >= 300 && condicionada && (ad?.global ?? 0) >= 0.7 && !heywood ? 'media' : 'baja';
  return {
    ok: true, n, nMinPar: t.nMin, items, excluidos, autovalores: eig, umbralParalelo: umbral, factores, m,
    kmo: ad ? ad.global : null, bartlett, suavizada, heywood, unidimensional, confianza, avisos, semilla, replicas,
    metodo: `Tetracóricas por pares (normal bivariada de Genz), análisis paralelo de Horn (${replicas} réplicas, percentil 95, semilla ${semilla}), ejes principales iterados y varimax con normalización de Kaiser.`,
  };
}
