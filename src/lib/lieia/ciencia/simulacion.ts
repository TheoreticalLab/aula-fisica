/**
 * LIEIA · simulador de exámenes (etapa 6). Estudiantes SINTÉTICOS bajo supuestos explícitos: los resultados son
 * «simulados», nunca observaciones, y no se mezclan con datos reales.
 *
 * Modelo: habilidad θ ~ N(μ, σ); velocidad τ ~ N(0, σ_v). Por pregunta, en el orden de presentación:
 *   tiempo t = exp(β_t − τ + 0,6·ε)  (β_t calibrado si hay datos de tiempo; si no, del tiempo previsto a priori)
 *   si el tiempo acumulado supera el límite → «no alcanzada» (omisión por tiempo)
 *   si no, omisión por desconocimiento con probabilidad k·(1 − P) / 2  (k = propensión a omitir, supuesto)
 *   si responde, acierta con P = logística(a·(θ − b))  (2PL calibrado si existe; si no, a priori: a = 1, b por dificultad)
 * Reproducible por semilla. Incluye cálculos analíticos de tamaño muestral (correlación y dos proporciones).
 */
import { mulberry32 } from '@/lib/fisica/variantes';
import { aPriori, type Calibracion } from '../diseno';
import { logistica, normalCdf } from '../estadistica';

export interface ItemSim { id: string; etiqueta: string; dificultad: 'basico' | 'intermedio' | 'desafiante'; formato: string; tiempoMin: number; cal?: Calibracion | null }
export interface Escenario {
  nombre: string; n: number; mu: number; sigma: number; limiteMin: number | null; orden: 'fijo' | 'inverso' | 'aleatorio';
  propensionOmitir: number; sdVelocidad: number; excluir: string[];
}
export const ESCENARIO_BASE: Escenario = { nombre: 'Base', n: 40, mu: 0, sigma: 1, limiteMin: null, orden: 'fijo', propensionOmitir: 0.3, sdVelocidad: 0.3, excluir: [] };

export interface ResultadoSim {
  escenario: Escenario; replicas: number; semilla: number; procedenciaParametros: { calibrados: number; aPriori: number };
  puntuacion: { media: number; sd: number };
  kr20: { mediana: number; p10: number; p90: number } | null;
  terminan: number;                                   // fracción que llega a la última pregunta
  porItem: { id: string; etiqueta: string; aciertos: number; omiteTiempo: number; omiteDesconocimiento: number }[];
  supuestos: string[];
}

function normal(rnd: () => number) { return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()); }

function kr20(filas: number[][]): number | null {
  const k = filas[0]?.length ?? 0;
  if (k < 3 || filas.length < 3) return null;
  const tot = filas.map((f) => f.reduce((s, v) => s + v, 0)), m = tot.reduce((s, v) => s + v, 0) / tot.length;
  const vt = tot.reduce((s, v) => s + (v - m) ** 2, 0) / (tot.length - 1);
  if (!(vt > 0)) return null;
  let pq = 0;
  for (let j = 0; j < k; j++) { const p = filas.reduce((s, f) => s + f[j], 0) / filas.length; pq += p * (1 - p); }
  return (k / (k - 1)) * (1 - pq / vt);
}

export function simular(items: ItemSim[], e: Escenario, replicas = 200, semilla = 20261101): ResultadoSim {
  const rnd = mulberry32(semilla);
  const its = items.filter((i) => !e.excluir.includes(i.id));
  const params = its.map((i) => {
    const ap = aPriori({ dificultad: i.dificultad, formato: i.formato });
    const c = i.cal && i.cal.estado !== 'no_calibrado' ? i.cal : null;
    return { a: c?.a ?? ap.a, b: c?.b ?? ap.b, beta: c && Number.isFinite(c.beta_t) ? c.beta_t : Math.log(i.tiempoMin * 60), calibrado: !!c };
  });
  const K = its.length;
  const acum = its.map(() => ({ ac: 0, ot: 0, od: 0 }));
  const puntos: number[] = [], krs: number[] = [];
  let terminan = 0, total = 0;
  for (let r = 0; r < replicas; r++) {
    const filas: number[][] = [];
    for (let s = 0; s < e.n; s++) {
      const th = e.mu + e.sigma * normal(rnd), tau = e.sdVelocidad * normal(rnd);
      const orden = its.map((_, j) => j);
      if (e.orden === 'inverso') orden.reverse();
      if (e.orden === 'aleatorio') for (let k = K - 1; k > 0; k--) { const q = Math.floor(rnd() * (k + 1)); [orden[k], orden[q]] = [orden[q], orden[k]]; }
      const fila = new Array(K).fill(0);
      let t = 0, llego = true;
      for (const j of orden) {
        const p = params[j];
        t += Math.exp(p.beta - tau + 0.6 * normal(rnd));
        if (e.limiteMin && t > e.limiteMin * 60) { acum[j].ot++; llego = false; continue; }
        const P = logistica(p.a * (th - p.b));
        if (rnd() < (e.propensionOmitir * (1 - P)) / 2) { acum[j].od++; continue; }
        if (rnd() < P) { fila[j] = 1; acum[j].ac++; }
      }
      if (llego) terminan++;
      total++;
      filas.push(fila);
      puntos.push(fila.reduce((x, v) => x + v, 0));
    }
    const k = kr20(filas);
    if (k !== null) krs.push(k);
  }
  const m = puntos.reduce((s, v) => s + v, 0) / puntos.length;
  krs.sort((a, b) => a - b);
  const q = (p: number) => krs[Math.floor(p * (krs.length - 1))];
  const calibrados = params.filter((p) => p.calibrado).length;
  return {
    escenario: e, replicas, semilla, procedenciaParametros: { calibrados, aPriori: K - calibrados },
    puntuacion: { media: m, sd: Math.sqrt(puntos.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, puntos.length - 1)) },
    kr20: krs.length ? { mediana: q(0.5), p10: q(0.1), p90: q(0.9) } : null,
    terminan: terminan / total,
    porItem: its.map((i, j) => ({ id: i.id, etiqueta: i.etiqueta, aciertos: acum[j].ac / total, omiteTiempo: acum[j].ot / total, omiteDesconocimiento: acum[j].od / total })),
    supuestos: [
      `${replicas} réplicas de ${e.n} estudiantes sintéticos; habilidad N(${e.mu}, ${e.sigma}²); dispersión de velocidad ${e.sdVelocidad}; semilla ${semilla}.`,
      calibrados ? `${calibrados} pregunta(s) con parámetros calibrados (TRI) y ${K - calibrados} con parámetros a priori (a = 1, b según la dificultad del autor).` : 'Todas las preguntas con parámetros A PRIORI (no calibrados): los resultados dependen de la dificultad asignada por el autor.',
      `Tiempo por pregunta: lognormal alrededor del tiempo previsto${e.limiteMin ? `; límite ${e.limiteMin} min (lo no alcanzado cuenta como omisión por tiempo)` : '; sin límite de tiempo'}.`,
      `Omisión por desconocimiento con propensión ${e.propensionOmitir} (supuesto, no estimado de datos). Orden: ${e.orden}.`,
    ],
  };
}

// ----------------------------------------------------------------------------------------------------------------
// Potencia por simulación de una investigación correlacional concreta
// ----------------------------------------------------------------------------------------------------------------
export interface PotenciaSim { n: number; rho: number; potencia: number; rMedia: number; atenuacion: number; replicas: number; semilla: number; supuestos: string[] }

/**
 * Dos habilidades con correlación verdadera ρ, medidas con las preguntas de cada grupo (2PL calibrado o a priori).
 * Potencia = fracción de réplicas en que la correlación entre subpuntuaciones es significativa (α = 0,05 bilateral).
 * La correlación observada media sale ATENUADA por el error de medida de usar pocas preguntas.
 */
export function potenciaCorrelacionalSimulada(grupoA: ItemSim[], grupoB: ItemSim[], rho: number, n: number, replicas = 300, semilla = 7): PotenciaSim {
  const rnd = mulberry32(semilla);
  const par = (i: ItemSim) => { const ap = aPriori({ dificultad: i.dificultad, formato: i.formato }); const c = i.cal && i.cal.estado !== 'no_calibrado' ? i.cal : null; return { a: c?.a ?? ap.a, b: c?.b ?? ap.b }; };
  const pa = grupoA.map(par), pb = grupoB.map(par);
  const zc = probit(0.975);
  let sig = 0, sumR = 0, validas = 0;
  for (let r = 0; r < replicas; r++) {
    const xa: number[] = [], xb: number[] = [];
    for (let s = 0; s < n; s++) {
      const u = normal(rnd), v = normal(rnd);
      const ta = u, tb = rho * u + Math.sqrt(1 - rho * rho) * v;
      xa.push(pa.reduce((t, p) => t + (rnd() < logistica(p.a * (ta - p.b)) ? 1 : 0), 0));
      xb.push(pb.reduce((t, p) => t + (rnd() < logistica(p.a * (tb - p.b)) ? 1 : 0), 0));
    }
    const ma = xa.reduce((t, v) => t + v, 0) / n, mb = xb.reduce((t, v) => t + v, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let s = 0; s < n; s++) { sab += (xa[s] - ma) * (xb[s] - mb); saa += (xa[s] - ma) ** 2; sbb += (xb[s] - mb) ** 2; }
    if (!(saa > 0 && sbb > 0)) continue;
    const rr = sab / Math.sqrt(saa * sbb);
    validas++; sumR += rr;
    if (Math.abs(Math.atanh(Math.max(-0.999, Math.min(0.999, rr)))) * Math.sqrt(n - 3) > zc) sig++;
  }
  const rMedia = validas ? sumR / validas : 0;
  return {
    n, rho, potencia: validas ? sig / validas : 0, rMedia, atenuacion: rho ? rMedia / rho : 1, replicas, semilla,
    supuestos: [`Correlación verdadera entre habilidades ρ = ${rho}; ${grupoA.length} y ${grupoB.length} preguntas; ${n} estudiantes por réplica; ${replicas} réplicas; semilla ${semilla}.`,
      `Parámetros: ${[...grupoA, ...grupoB].filter((i) => i.cal && i.cal.estado !== 'no_calibrado').length ? 'en parte calibrados' : 'a priori (no calibrados)'}. Estudiantes sintéticos: no describe al grupo real.`],
  };
}

// ----------------------------------------------------------------------------------------------------------------
// Tamaño muestral (analítico)
// ----------------------------------------------------------------------------------------------------------------
/** Inversa de la normal estándar (Acklam, error < 1,2·10⁻⁹). */
export function probit(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) return -probit(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Estudiantes necesarios para detectar una correlación r (bilateral) con la potencia dada (transformación de Fisher). */
export function nCorrelacion(r: number, alfa = 0.05, potencia = 0.8): number {
  const z = probit(1 - alfa / 2) + probit(potencia);
  return Math.ceil((z / Math.atanh(Math.abs(r))) ** 2 + 3);
}
/** Potencia para detectar r con n estudiantes. */
export function potenciaCorrelacion(r: number, n: number, alfa = 0.05): number {
  if (n <= 3) return 0;
  return normalCdf(Math.abs(Math.atanh(r)) * Math.sqrt(n - 3) - probit(1 - alfa / 2));
}
/** Estudiantes POR GRUPO para detectar p1 ≠ p2 (dos grupos independientes). */
export function nProporciones(p1: number, p2: number, alfa = 0.05, potencia = 0.8): number {
  const pb = (p1 + p2) / 2, za = probit(1 - alfa / 2), zb = probit(potencia);
  return Math.ceil(((za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / (p1 - p2) ** 2);
}
