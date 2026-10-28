/**
 * LIEIA · Diseño científico del examen (sin dependencias):
 *  - Calibración TRI de 2 parámetros con a priori (MAP): dificultad b, discriminación a y sus errores típicos.
 *  - Tiempos: exigencia de tiempo β (log-segundos) y dispersión σ por ítem (modelo lognormal de LIEIA).
 *  - Estado de cada parámetro: «calibrado», «provisional» o «no calibrado» (a priori según la etiqueta del ítem).
 *  - Información del examen I(θ) y error típico de la habilidad, con banda de incertidumbre por Monte Carlo.
 *  - Tiempo total esperado por velocidad del estudiante y riesgo de no terminar con un límite (equidad).
 *  - Selección óptima de preguntas: máxima información esperada sobre la población con restricciones PEDAGÓGICAS
 *    (cobertura de conceptos, tiempo, preguntas obligatorias, tope de ítems sin calibrar). La detección no entra en
 *    la función objetivo: la validez pedagógica manda.
 *  - Equivalencia de versiones (grupos isomorfos): diferencia de dificultad y de tiempo entre variantes.
 */
import { crearAzar } from './azar';
import { logistica } from './estadistica';
import { ajustarTiempos } from './modelos';

export type EstadoCalibracion = 'calibrado' | 'provisional' | 'no_calibrado';
export interface Calibracion {
  a: number; b: number; se_a: number; se_b: number;
  beta_t: number; sigma_t: number;   // log-segundos
  n_resp: number; n_tiempos: number;
  estado: EstadoCalibracion;
}
export interface ItemBanco {
  exercise_id: string; titulo: string; dificultad: 'basico' | 'intermedio' | 'desafiante'; formato: string; categoria: string;
  conceptos: string[]; calibracion: Calibracion | null;
}

/** Reglas de estado (las mismas que aplica el servidor al guardar). */
export function estadoDe(n: number, se_b: number, se_a: number): EstadoCalibracion {
  if (n >= 100 && se_b <= 0.3 && se_a <= 0.35) return 'calibrado';
  if (n >= 20 && se_b <= 0.8) return 'provisional';
  return 'no_calibrado';
}

/** A priori explícitos para un ítem sin calibrar (etiqueta de dificultad y formato). Incertidumbre amplia. */
export function aPriori(it: Pick<ItemBanco, 'dificultad' | 'formato'>): Calibracion {
  const b = it.dificultad === 'basico' ? -1 : it.dificultad === 'intermedio' ? 0 : 1.2;
  const t = it.formato === 'choice' || it.formato === 'truefalse' ? 60 : it.formato === 'numeric' ? 150 : 300;
  return { a: 1, b, se_a: 0.5, se_b: 1, beta_t: Math.log(t), sigma_t: 0.6, n_resp: 0, n_tiempos: 0, estado: 'no_calibrado' };
}
export const parametros = (it: ItemBanco): Calibracion => it.calibracion ?? aPriori(it);

// ---------------------------------------------------------------------------------------------------------------
// Calibración 2PL (MAP alternado) a partir de respuestas (estudiante, ítem, acierto) y duraciones opcionales
// ---------------------------------------------------------------------------------------------------------------
export interface DatosCalibracion { estudiantes: number; items: number; respuestas: { s: number; e: number; x: boolean }[]; duraciones: { s: number; e: number; d: number }[] }

/**
 * Máxima verosimilitud MARGINAL (Bock–Aitkin, EM con cuadratura sobre θ ~ N(0, 1)) con a priori b ~ N(0, 2²) y
 * log a ~ N(0, 0,5²). La versión anterior (verosimilitud conjunta, JML) se descartó en la validación: su error
 * CRECÍA con el tamaño de muestra (inconsistencia conocida de JML en 2PL). Errores típicos: producto cruzado de
 * los gradientes por estudiante (XPD) más la precisión del a priori.
 */
export function calibrar2PL(d: DatosCalibracion, iter = 200): { items: Calibracion[]; theta: number[]; sdVelocidad: number } {
  const { estudiantes: n, items: m } = d;
  const K = 31;
  const nodos = Array.from({ length: K }, (_, k) => -4 + (8 * k) / (K - 1));
  const pesos = nodos.map((q) => Math.exp(-0.5 * q * q));
  const sw = pesos.reduce((s, w) => s + w, 0);
  for (let k = 0; k < K; k++) pesos[k] /= sw;
  const b = new Array(m).fill(0), la = new Array(m).fill(0); // la = log a
  const porS: { e: number; x: number }[][] = Array.from({ length: n }, () => []);
  const porE: { s: number; x: number }[][] = Array.from({ length: m }, () => []);
  for (const r of d.respuestas) { porS[r.s].push({ e: r.e, x: r.x ? 1 : 0 }); porE[r.e].push({ s: r.s, x: r.x ? 1 : 0 }); }
  const VB = 4, VLA = 0.25;
  const post: Float64Array[] = Array.from({ length: n }, () => new Float64Array(K));
  const ePaso = () => {
    for (let i = 0; i < n; i++) {
      const lp = new Float64Array(K);
      for (let k = 0; k < K; k++) {
        let s = Math.log(pesos[k]);
        for (const r of porS[i]) { const p = logistica(Math.exp(la[r.e]) * (nodos[k] - b[r.e])); s += r.x ? Math.log(Math.max(1e-12, p)) : Math.log(Math.max(1e-12, 1 - p)); }
        lp[k] = s;
      }
      const mx = Math.max(...lp);
      let z = 0;
      for (let k = 0; k < K; k++) { lp[k] = Math.exp(lp[k] - mx); z += lp[k]; }
      for (let k = 0; k < K; k++) post[i][k] = lp[k] / z;
    }
  };
  for (let it = 0; it < iter; it++) {
    ePaso();
    let cambio = 0;
    for (let j = 0; j < m; j++) {
      // conteos esperados por nodo
      const nk = new Float64Array(K), rk = new Float64Array(K);
      for (const r of porE[j]) for (let k = 0; k < K; k++) { nk[k] += post[r.s][k]; rk[k] += post[r.s][k] * r.x; }
      for (let paso = 0; paso < 4; paso++) {
        const a = Math.exp(la[j]);
        // gradiente y hessiano (Fisher) en (b, la)
        let gb = -b[j] / VB, ga = -la[j] / VLA, hbb = -1 / VB, haa = -1 / VLA, hab = 0;
        for (let k = 0; k < K; k++) {
          if (nk[k] < 1e-12) continue;
          const zq = nodos[k] - b[j];
          const p = logistica(a * zq);
          const res = rk[k] - nk[k] * p, w = nk[k] * p * (1 - p);
          gb += -a * res; ga += a * zq * res;
          hbb -= w * a * a; haa -= w * (a * zq) ** 2; hab -= -w * a * a * zq;
        }
        const det = hbb * haa - hab * hab;
        if (!(det > 0)) break;
        let db = (gb * haa - ga * hab) / det, da = (ga * hbb - gb * hab) / det;
        db = Math.max(-1, Math.min(1, db)); da = Math.max(-0.5, Math.min(0.5, da));
        b[j] -= db; la[j] -= da;
        la[j] = Math.max(Math.log(0.15), Math.min(Math.log(5), la[j]));
        cambio = Math.max(cambio, Math.abs(db), Math.abs(da));
      }
    }
    if (cambio < 1e-4) break;
  }
  ePaso();
  const theta = post.map((ps) => ps.reduce((s, p, k) => s + p * nodos[k], 0)); // EAP
  // tiempos (matriz dispersa estudiante × ítem)
  const mat: (number | null)[][] = Array.from({ length: n }, () => new Array(m).fill(null));
  const nT = new Array(m).fill(0);
  for (const r of d.duraciones) if (r.d > 0) { mat[r.s][r.e] = r.d; nT[r.e]++; }
  const tm = d.duraciones.length ? ajustarTiempos(mat) : null;
  const items = b.map((bj, j) => {
    const a = Math.exp(la[j]);
    // información por producto cruzado de gradientes por estudiante (marginalizando θ) + a priori
    let ibb = 1 / VB, iaa = 1 / VLA, iab = 0;
    for (const r of porE[j]) {
      let gb = 0, ga = 0;
      for (let k = 0; k < K; k++) { const zq = nodos[k] - bj; const res = r.x - logistica(a * zq); gb += post[r.s][k] * (-a * res); ga += post[r.s][k] * (a * zq * res); }
      ibb += gb * gb; iaa += ga * ga; iab += gb * ga;
    }
    const det = ibb * iaa - iab * iab;
    const se_b = det > 0 ? Math.sqrt(iaa / det) : 1, se_la = det > 0 ? Math.sqrt(ibb / det) : 0.5;
    const se_a = a * se_la;
    const n_resp = porE[j].length;
    return {
      a, b: bj, se_a, se_b,
      beta_t: tm && nT[j] >= 3 ? tm.beta[j] : NaN, sigma_t: tm && nT[j] >= 3 ? tm.sigma[j] : NaN,
      n_resp, n_tiempos: nT[j], estado: estadoDe(n_resp, se_b, se_a),
    };
  });
  const sdV = tm ? Math.sqrt(tm.tau.reduce((s, t) => s + t * t, 0) / Math.max(1, tm.tau.length - 1)) : 0.3;
  return { items, theta, sdVelocidad: sdV };
}

// ---------------------------------------------------------------------------------------------------------------
// Información, tiempos y equidad
// ---------------------------------------------------------------------------------------------------------------
export const informacionItem = (c: Pick<Calibracion, 'a' | 'b'>, theta: number) => { const p = logistica(c.a * (theta - c.b)); return c.a * c.a * p * (1 - p); };

export const THETAS = Array.from({ length: 41 }, (_, k) => -4 + k * 0.2);

/** Curva de información del examen con banda del 10–90 % propagando la incertidumbre de a y b. */
export function curvaInformacion(cs: Calibracion[], simulaciones = 200, semilla = 1) {
  const az = crearAzar(semilla);
  const nominal = THETAS.map((t) => cs.reduce((s, c) => s + informacionItem(c, t), 0));
  const muestras = THETAS.map(() => [] as number[]);
  for (let k = 0; k < simulaciones; k++) {
    const ps = cs.map((c) => ({ a: Math.exp(Math.log(c.a) + az.normal(0, c.se_a / c.a)), b: c.b + az.normal(0, c.se_b) }));
    THETAS.forEach((t, i) => muestras[i].push(ps.reduce((s, c) => s + informacionItem(c, t), 0)));
  }
  const q = (xs: number[], p: number) => { const o = [...xs].sort((x, y) => x - y); return o[Math.floor(p * (o.length - 1))]; };
  return THETAS.map((t, i) => ({ theta: t, info: nominal[i], se: nominal[i] > 0 ? 1 / Math.sqrt(nominal[i]) : Infinity, p10: q(muestras[i], 0.1), p90: q(muestras[i], 0.9) }));
}

/** Información esperada sobre una población de habilidades N(μ, σ) (cuadratura en la rejilla). */
export function informacionEsperada(cs: Calibracion[], mu = 0, sigma = 1): number {
  let s = 0, w = 0;
  for (const t of THETAS) { const pw = Math.exp(-0.5 * ((t - mu) / sigma) ** 2); w += pw; s += pw * cs.reduce((x, c) => x + informacionItem(c, t), 0); }
  return s / w;
}

/** Tiempo total (minutos) por percentil de velocidad y probabilidad de superar un límite (Monte Carlo). */
export function tiempoExamen(cs: Calibracion[], sdVelocidad: number, limiteMin: number | null, simulaciones = 2000, semilla = 2) {
  const az = crearAzar(semilla);
  const totales: { tau: number; t: number }[] = [];
  for (let k = 0; k < simulaciones; k++) {
    const tau = az.normal(0, sdVelocidad);
    let t = 0;
    for (const c of cs) t += Math.exp(c.beta_t - tau + c.sigma_t * az.normal() + az.normal(0, c.n_tiempos ? 0.05 : 0.25));
    totales.push({ tau, t: t / 60 });
  }
  const ord = totales.map((x) => x.t).sort((a, b) => a - b);
  const q = (p: number) => ord[Math.floor(p * (ord.length - 1))];
  const lentos = totales.filter((x) => x.tau < -sdVelocidad);  // el 16 % más lento
  return {
    mediana: q(0.5), p10: q(0.1), p90: q(0.9), p95: q(0.95),
    superaLimite: limiteMin ? totales.filter((x) => x.t > limiteMin).length / totales.length : null,
    superaLimiteLentos: limiteMin && lentos.length ? lentos.filter((x) => x.t > limiteMin).length / lentos.length : null,
    histograma: (() => { const max = q(0.995); const tr = 20; const h = new Array(tr).fill(0); for (const x of ord) if (x <= max) h[Math.min(tr - 1, Math.floor((x / max) * tr))]++; return h.map((v, k) => ({ desde: (k * max) / tr, n: v / ord.length })); })(),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Selección óptima con restricciones pedagógicas
// ---------------------------------------------------------------------------------------------------------------
export interface Restricciones {
  n: number;                          // nº de preguntas
  conceptos: string[];                // conceptos que DEBEN quedar cubiertos (al menos uno cada uno)
  obligatorios: string[];             // exercise_id incluidos sí o sí (p. ej. anclas)
  limiteMin: number | null;           // tiempo mediano máximo (con margen del 20 %)
  maxSinCalibrar: number;             // fracción máxima de ítems «no calibrados»
  poblacion: { mu: number; sigma: number };
}

export function seleccionOptima(banco: ItemBanco[], r: Restricciones) {
  const elegidos: ItemBanco[] = banco.filter((it) => r.obligatorios.includes(it.exercise_id));
  const tiempoMed = (xs: ItemBanco[]) => xs.reduce((s, it) => s + Math.exp(parametros(it).beta_t), 0) / 60;
  const cubiertos = () => new Set(elegidos.flatMap((it) => it.conceptos));
  const sinCal = () => elegidos.filter((it) => parametros(it).estado === 'no_calibrado').length;
  const avisos: string[] = [];
  while (elegidos.length < r.n) {
    const faltan = r.conceptos.filter((c) => !cubiertos().has(c));
    const plazas = r.n - elegidos.length;
    const candidatos = banco.filter((it) => !elegidos.includes(it))
      .filter((it) => !r.limiteMin || tiempoMed([...elegidos, it]) <= r.limiteMin / 1.2)
      .filter((it) => parametros(it).estado !== 'no_calibrado' || (sinCal() + 1) / r.n <= r.maxSinCalibrar)
      // si quedan tantas plazas como conceptos sin cubrir, solo valen ítems que cubran alguno
      .filter((it) => faltan.length < plazas || it.conceptos.some((c) => faltan.includes(c)));
    if (!candidatos.length) { avisos.push('No hay más preguntas que cumplan las restricciones; el examen queda más corto.'); break; }
    const base = informacionEsperada(elegidos.map(parametros), r.poblacion.mu, r.poblacion.sigma);
    let mejor = candidatos[0], ganancia = -Infinity;
    for (const it of candidatos) {
      const c = parametros(it);
      // ganancia de información, descontada por la incertidumbre de la calibración
      const g = (informacionEsperada([...elegidos.map(parametros), c], r.poblacion.mu, r.poblacion.sigma) - base) / (1 + c.se_b ** 2)
        + (it.conceptos.some((x) => faltan.includes(x)) ? 1e3 : 0);
      if (g > ganancia) { ganancia = g; mejor = it; }
    }
    elegidos.push(mejor);
  }
  const faltan = r.conceptos.filter((c) => !cubiertos().has(c));
  if (faltan.length) avisos.push(`Conceptos sin cubrir: ${faltan.join(', ')}.`);
  return { elegidos, informacion: informacionEsperada(elegidos.map(parametros), r.poblacion.mu, r.poblacion.sigma), tiempoMediano: tiempoMed(elegidos), avisos };
}

// ---------------------------------------------------------------------------------------------------------------
// Equivalencia de versiones (grupos isomorfos) — equidad
// ---------------------------------------------------------------------------------------------------------------
export function equivalencia(grupos: { grupo: string; items: ItemBanco[] }[]) {
  return grupos.map((g) => {
    const ps = g.items.map(parametros);
    const bs = ps.map((p) => p.b), ts = ps.map((p) => Math.exp(p.beta_t));
    const db = Math.max(...bs) - Math.min(...bs), rt = Math.max(...ts) / Math.max(1, Math.min(...ts));
    const incierto = ps.some((p) => p.estado === 'no_calibrado');
    return { grupo: g.grupo, variantes: g.items.length, difDificultad: db, razonTiempo: rt, incierto, equivalente: !incierto && db <= 0.5 && rt <= 1.3 };
  });
}
