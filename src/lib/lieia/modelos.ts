/**
 * LIEIA · Modelos que separan lo legítimo de lo dependiente:
 *  - Rasch (TRI de 1 parámetro) con a priori normales (estimación MAP; jerárquico en el sentido de que habilidades y
 *    dificultades se contraen hacia su media poblacional): P(acierto) = logística(θ_i − b_j).
 *  - Tiempos lognormales (van der Linden, 2006): log d_ij = β_j − τ_i + ε, ε ~ N(0, σ_j²), con β_j = exigencia de
 *    tiempo del ítem y τ_i = velocidad del estudiante. Los residuos estandarizados quitan dificultad, orden común y ritmo.
 *  - Popularidad de cada respuesta incorrecta por ítem (para la probabilidad de coincidir por azar).
 */
import { logistica } from './estadistica';
import type { ExamenObservado } from './tipos';

export interface Rasch { theta: number[]; b: number[]; p: (i: number, j: number) => number }

export function ajustarRasch(x: (boolean | null)[][], iter = 60): Rasch {
  const n = x.length, m = x[0]?.length ?? 0;
  const theta = new Array(n).fill(0), b = new Array(m).fill(0);
  const VAR_T = 1, VAR_B = 4;
  for (let it = 0; it < iter; it++) {
    let cambio = 0;
    for (let i = 0; i < n; i++) {
      let g = -theta[i] / VAR_T, h = -1 / VAR_T;
      for (let j = 0; j < m; j++) {
        const v = x[i][j];
        if (v === null) continue;
        const p = logistica(theta[i] - b[j]);
        g += (v ? 1 : 0) - p;
        h -= p * (1 - p);
      }
      const d = Math.max(-1, Math.min(1, g / h));
      theta[i] -= d;
      cambio = Math.max(cambio, Math.abs(d));
    }
    for (let j = 0; j < m; j++) {
      let g = -b[j] / VAR_B, h = -1 / VAR_B;
      for (let i = 0; i < n; i++) {
        const v = x[i][j];
        if (v === null) continue;
        const p = logistica(theta[i] - b[j]);
        g -= (v ? 1 : 0) - p;
        h -= p * (1 - p);
      }
      const d = Math.max(-1, Math.min(1, g / h));
      b[j] -= d;
      cambio = Math.max(cambio, Math.abs(d));
    }
    if (cambio < 1e-5) break;
  }
  return { theta, b, p: (i, j) => logistica(theta[i] - b[j]) };
}

/**
 * Duraciones por ítem a partir de las marcas de tiempo: para cada estudiante se ordenan sus ítems por la primera
 * respuesta y la duración de un ítem es el tiempo desde la respuesta anterior (o desde su inicio).
 */
export function duraciones(ex: ExamenObservado): (number | null)[][] {
  return ex.r.map((fila, i) => {
    const out: (number | null)[] = fila.map(() => null);
    const orden = fila.map((r, j) => ({ j, t: r.primera ?? r.t })).filter((o) => o.t !== null).sort((a, b) => (a.t as number) - (b.t as number));
    let previo = ex.estudiantes[i].inicio;
    for (const o of orden) {
      out[o.j] = Math.max(1, (o.t as number) - previo);
      previo = o.t as number;
    }
    return out;
  });
}

export interface ModeloTiempos {
  beta: number[]; tau: number[]; sigma: number[]; z: (number | null)[][]; logd: (number | null)[][];
  gamma: number;                     // efecto de la posición (fatiga/aprendizaje en el tiempo); 0 si el orden es común
  pc: (number | null)[][] | null;    // posición relativa centrada (−0,5 … 0,5) de cada ítem para cada estudiante
}

/**
 * log d_ij = β_j − τ_i + γ·pc_ij + ε. Con orden COMÚN, la posición está confundida con el ítem y β ya la absorbe
 * (γ = 0). Con orden variable por estudiante (aleatorio, contrabalanceado), γ separa la fatiga del ítem.
 */
export function ajustarTiempos(d: (number | null)[][], iter = 50, pos?: (number | null)[][]): ModeloTiempos {
  const n = d.length, m = d[0]?.length ?? 0;
  const logd = d.map((f) => f.map((v) => (v === null ? null : Math.log(v))));
  const pc = pos ?? null;
  const g = (i: number, j: number) => (pc ? (pc[i][j] ?? 0) : 0);
  const beta = new Array(m).fill(0), tau = new Array(n).fill(0);
  let gamma = 0;
  for (let it = 0; it < iter; it++) {
    for (let j = 0; j < m; j++) {
      let s = 0, c = 0;
      for (let i = 0; i < n; i++) { const v = logd[i][j]; if (v !== null) { s += v + tau[i] - gamma * g(i, j); c++; } }
      beta[j] = c ? s / c : 0;
    }
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = 0; j < m; j++) { const v = logd[i][j]; if (v !== null) { s += beta[j] + gamma * g(i, j) - v; c++; } }
      tau[i] = c ? s / c : 0;
    }
    const mt = tau.reduce((s, v) => s + v, 0) / (n || 1);
    for (let i = 0; i < n; i++) tau[i] -= mt;
    if (pc) {
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const v = logd[i][j]; const p = pc[i][j]; if (v !== null && p !== null) { num += (v - beta[j] + tau[i]) * p; den += p * p; } }
      gamma = den > 0 ? num / den : 0;
    }
  }
  const sigma = beta.map((bj, j) => {
    let s = 0, c = 0;
    for (let i = 0; i < n; i++) { const v = logd[i][j]; if (v !== null) { s += (v - bj + tau[i] - gamma * g(i, j)) ** 2; c++; } }
    return c > 1 ? Math.max(0.05, Math.sqrt(s / (c - 1))) : 0.5;
  });
  const z = logd.map((f, i) => f.map((v, j) => (v === null ? null : (v - beta[j] + tau[i] - gamma * g(i, j)) / sigma[j])));
  return { beta, tau, sigma, z, logd, gamma, pc };
}

/** Posición relativa centrada de cada ítem en el orden en que respondió cada estudiante, y si el orden varía. */
export function posiciones(ex: ExamenObservado): { pc: (number | null)[][]; varia: boolean } {
  const ordenes = ex.r.map((fila) => fila.map((r, j) => ({ j, t: r.primera ?? r.t })).filter((x) => x.t !== null).sort((a, b) => (a.t as number) - (b.t as number)).map((x) => x.j));
  const pc = ex.r.map((fila, i) => {
    const out: (number | null)[] = fila.map(() => null);
    const o = ordenes[i];
    o.forEach((j, k) => { out[j] = o.length > 1 ? k / (o.length - 1) - 0.5 : 0; });
    return out;
  });
  // ¿varía el orden? (proporción de estudiantes cuyo orden difiere del más frecuente)
  const claves = ordenes.map((o) => o.join(','));
  const frec = new Map<string, number>();
  for (const k of claves) frec.set(k, (frec.get(k) ?? 0) + 1);
  const moda = Math.max(0, ...frec.values());
  return { pc, varia: ordenes.length > 0 && moda / ordenes.length < 0.8 };
}

/**
 * Probabilidad de que dos estudiantes elijan por azar la MISMA respuesta incorrecta en el ítem j, dada su habilidad:
 *   (1 − P_i)(1 − P_j) Σ_c f_c², con f_c la popularidad (suavizada) de cada respuesta incorrecta entre los DEMÁS
 *   estudiantes (se excluye a la pareja para no contar su propia coincidencia como «popular»).
 */
export function probCoincidirIncorrecta(ex: ExamenObservado, rasch: Rasch, i: number, k: number, j: number): number {
  const conteo = new Map<string, number>();
  let total = 0;
  for (let s = 0; s < ex.r.length; s++) {
    if (s === i || s === k) continue;
    const r = ex.r[s][j];
    if (r.respuesta !== null && r.correcta === false) { conteo.set(r.respuesta, (conteo.get(r.respuesta) ?? 0) + 1); total++; }
  }
  const ALFA = 0.5;
  // categorías observadas + una «otra» que representa las respuestas incorrectas no vistas
  // categorías aún no vistas: las opciones restantes en selección; en respuestas abiertas, muchas posibles (20)
  const opciones = ex.items[j].opciones;
  const extra = opciones ? Math.max(1, opciones - 1 - conteo.size) : 20;
  const den = total + ALFA * (conteo.size + extra);
  let suma = 0;
  for (const c of conteo.values()) suma += ((c + ALFA) / den) ** 2;
  // cada categoría no vista recibe ALFA/den: su aporte a Σ f² es extra·(ALFA/den)²
  suma += extra * (ALFA / den) ** 2;
  return (1 - rasch.p(i, j)) * (1 - rasch.p(k, j)) * Math.min(1, suma);
}
