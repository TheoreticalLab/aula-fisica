/**
 * LIEIA · Estadística básica sin dependencias: distribuciones, Poisson-binomial exacta, Benjamini–Hochberg,
 * mezcla beta-uniforme (probabilidad posterior de dependencia a partir de valores p), Kaplan–Meier, ROC/AUC,
 * calibración (Brier, ECE) e intervalos de Wilson. Probado en tests/lieia.test.ts.
 */

export const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
export function desviacion(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
export function cuantil(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const o = [...xs].sort((a, b) => a - b);
  const h = (o.length - 1) * q;
  const lo = Math.floor(h);
  return o[lo] + (o[Math.min(lo + 1, o.length - 1)] - o[lo]) * (h - lo);
}
export const mediana = (xs: number[]) => cuantil(xs, 0.5);
export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  const mx = media(x.slice(0, n)), my = media(y.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Función de error (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export const logistica = (x: number) => 1 / (1 + Math.exp(-x));

/** P(X ≥ k) para X = suma de Bernoulli independientes con probabilidades ps (Poisson-binomial, exacta por DP). */
export function poissonBinomialCola(ps: number[], k: number): number {
  if (k <= 0) return 1;
  if (k > ps.length) return 0;
  let dist = new Float64Array(ps.length + 1);
  dist[0] = 1;
  for (let i = 0; i < ps.length; i++) {
    const p = Math.min(1, Math.max(0, ps[i]));
    const sig = new Float64Array(ps.length + 1);
    for (let j = 0; j <= i; j++) {
      sig[j] += dist[j] * (1 - p);
      sig[j + 1] += dist[j] * p;
    }
    dist = sig;
  }
  let cola = 0;
  for (let j = k; j <= ps.length; j++) cola += dist[j];
  return Math.min(1, Math.max(0, cola));
}

/** Valores q de Benjamini–Hochberg (control de la tasa de falsos descubrimientos). */
export function benjaminiHochberg(ps: number[]): number[] {
  const n = ps.length;
  const idx = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(n);
  let min = 1;
  for (let r = n - 1; r >= 0; r--) {
    const [p, i] = idx[r];
    min = Math.min(min, (p * n) / (r + 1));
    q[i] = Math.min(1, min);
  }
  return q;
}

/**
 * Mezcla beta-uniforme (Pounds y Morris, 2003) ajustada por máxima verosimilitud a los valores p:
 *   f(p) = λ + (1 − λ) a p^(a−1), 0 < a < 1.
 * π0 = λ + (1 − λ)a acota la proporción de hipótesis nulas; la probabilidad posterior de dependencia es
 * 1 − π0 / f(p) (1 − «fdr local»). Con pocos valores p el ajuste es inestable: se devuelve null (abstención).
 */
export function mezclaBetaUniforme(ps: number[]): { lambda: number; a: number; pi0: number; posterior: (p: number) => number } | null {
  const xs = ps.filter((p) => Number.isFinite(p)).map((p) => Math.min(1, Math.max(1e-12, p)));
  if (xs.length < 30) return null;
  const ll = (lambda: number, a: number) => xs.reduce((s, p) => s + Math.log(lambda + (1 - lambda) * a * p ** (a - 1)), 0);
  let mejor = { lambda: 1, a: 0.5, v: ll(1, 0.5) };
  // búsqueda en rejilla gruesa y refinamiento local (2 parámetros acotados: robusto y suficiente)
  for (let li = 0; li <= 40; li++) {
    for (let ai = 1; ai <= 40; ai++) {
      const lambda = li / 40, a = ai / 41;
      const v = ll(lambda, a);
      if (v > mejor.v) mejor = { lambda, a, v };
    }
  }
  let paso = 1 / 40;
  for (let it = 0; it < 30; it++) {
    let mejoro = false;
    for (const [dl, da] of [[paso, 0], [-paso, 0], [0, paso], [0, -paso]]) {
      const lambda = Math.min(1, Math.max(0, mejor.lambda + dl)), a = Math.min(0.999, Math.max(0.001, mejor.a + da));
      const v = ll(lambda, a);
      if (v > mejor.v + 1e-12) { mejor = { lambda, a, v }; mejoro = true; }
    }
    if (!mejoro) paso /= 2;
  }
  const { lambda, a } = mejor;
  const pi0 = Math.min(1, lambda + (1 - lambda) * a);
  return {
    lambda, a, pi0,
    posterior: (p) => {
      const q = Math.min(1, Math.max(1e-12, p));
      const f = lambda + (1 - lambda) * a * q ** (a - 1);
      return Math.min(1, Math.max(0, 1 - pi0 / f));
    },
  };
}

/** Función gamma incompleta regularizada superior Q(s, x) (para la cola de la chi cuadrado). */
function lnGamma(z: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
export function gammaQ(s: number, x: number): number {
  if (x <= 0) return 1;
  if (x < s + 1) {
    let sum = 1 / s, del = sum, ap = s;
    for (let n = 0; n < 200; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
    return Math.max(0, 1 - sum * Math.exp(-x + s * Math.log(x) - lnGamma(s)));
  }
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.min(1, Math.exp(-x + s * Math.log(x) - lnGamma(s)) * h);
}
export const chiCuadradoCola = (x: number, gl: number) => gammaQ(gl / 2, x / 2);

/** Kaplan–Meier: supervivencia S(t) con censura (evento = respondió; censurado = no respondió antes del fin). */
export function kaplanMeier(datos: { t: number; evento: boolean }[]): { t: number; s: number; enRiesgo: number }[] {
  const o = [...datos].sort((a, b) => a.t - b.t);
  let s = 1, enRiesgo = o.length;
  const out = [{ t: 0, s: 1, enRiesgo }];
  let i = 0;
  while (i < o.length) {
    const t = o[i].t;
    let eventos = 0, total = 0;
    while (i < o.length && o[i].t === t) { if (o[i].evento) eventos++; total++; i++; }
    if (eventos > 0) { s *= 1 - eventos / enRiesgo; out.push({ t, s, enRiesgo }); }
    enRiesgo -= total;
  }
  return out;
}

/** Área bajo la curva ROC (Mann–Whitney, con empates a medias). */
export function auc(puntajes: number[], positivos: boolean[]): number {
  const pos = puntajes.filter((_, i) => positivos[i]);
  const neg = puntajes.filter((_, i) => !positivos[i]);
  if (!pos.length || !neg.length) return NaN;
  const todos = puntajes.map((x, i) => ({ x, p: positivos[i] })).sort((a, b) => a.x - b.x);
  let suma = 0;
  for (let i = 0; i < todos.length; ) {
    let j = i;
    while (j < todos.length && todos[j].x === todos[i].x) j++;
    const rango = (i + j + 1) / 2;
    for (let k = i; k < j; k++) if (todos[k].p) suma += rango;
    i = j;
  }
  return (suma - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

/** Curva ROC (para dibujar): puntos (FPR, TPR) al recorrer los umbrales. */
export function curvaRoc(puntajes: number[], positivos: boolean[], puntos = 40): { fpr: number; tpr: number }[] {
  const P = positivos.filter(Boolean).length, N = positivos.length - P;
  if (!P || !N) return [];
  const umbrales = [...new Set(puntajes)].sort((a, b) => b - a);
  const paso = Math.max(1, Math.floor(umbrales.length / puntos));
  const out = [{ fpr: 0, tpr: 0 }];
  for (let k = 0; k < umbrales.length; k += paso) {
    const u = umbrales[k];
    let tp = 0, fp = 0;
    puntajes.forEach((x, i) => { if (x >= u) { if (positivos[i]) tp++; else fp++; } });
    out.push({ fpr: fp / N, tpr: tp / P });
  }
  out.push({ fpr: 1, tpr: 1 });
  return out;
}

/** Calibración: Brier, error de calibración esperado (ECE) y tabla de fiabilidad por tramos. */
export function calibracion(prob: number[], verdad: boolean[], tramos = 10) {
  const n = prob.length;
  const brier = n ? prob.reduce((s, p, i) => s + (p - (verdad[i] ? 1 : 0)) ** 2, 0) / n : NaN;
  const tabla = Array.from({ length: tramos }, (_, k) => ({ desde: k / tramos, hasta: (k + 1) / tramos, n: 0, predicha: 0, observada: 0 }));
  prob.forEach((p, i) => {
    const k = Math.min(tramos - 1, Math.floor(p * tramos));
    tabla[k].n++;
    tabla[k].predicha += p;
    tabla[k].observada += verdad[i] ? 1 : 0;
  });
  let ece = 0;
  for (const t of tabla) {
    if (t.n) {
      t.predicha /= t.n;
      t.observada /= t.n;
      ece += (t.n / n) * Math.abs(t.predicha - t.observada);
    }
  }
  return { brier, ece: n ? ece : NaN, tabla };
}

/** Intervalo de Wilson al 95 % para una proporción. */
export function wilson(exitos: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = exitos / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}
