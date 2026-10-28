/**
 * LIEIA · Motor de inferencia. Cada detector contrasta una hipótesis nula EXPLÍCITA y devuelve un valor p
 * (o se abstiene si los datos no alcanzan). Las correcciones por comparaciones múltiples (Benjamini–Hochberg) y la
 * probabilidad posterior (mezcla beta-uniforme) se calculan sobre todas las parejas o estudiantes del examen.
 *
 * Por pareja (H0: responden independientemente, dadas su habilidad y la dificultad de cada ítem):
 *   D1  Respuestas incorrectas idénticas (prueba binomial generalizada, van der Linden y Sotaridona 2006).
 *   D2  Acoplamiento de tiempos: correlación de los residuos log-duración (quitada la exigencia de tiempo de cada
 *       ítem, que incluye el orden común, y la velocidad de cada estudiante); nula por permutación de ítems.
 *   D3  Sincronía de respuestas iguales: ¿responden lo mismo casi a la vez más de lo que explica el modelo de
 *       tiempos? Nula por bootstrap paramétrico (orden, velocidad e inicio de cada uno). Indica quién responde primero.
 *       (La primera versión, correlación cruzada con nula circular, se descartó: FPR ≈ 15 % en los controles.)
 * Por estudiante (H0: el estudiante se comporta según el modelo ajustado al grupo):
 *   D4  Ajuste de persona l_z (Drasgow 1985): aciertos y fallos incoherentes con su habilidad. Bootstrap paramétrico.
 *   D5  Aciertos en ítems difíciles para él resueltos inusualmente rápido. Bootstrap paramétrico.
 *   D6  Insensibilidad del tiempo a la exigencia del ítem (pendiente de log d frente a β): tarda lo mismo en todo.
 *   D7  Anomalía multivariante (distancia robusta sobre D4–D6, puntaje y pestaña oculta). Solo descriptiva.
 *   D8  Inconsistencia entre versiones isomorfas: acierta una variante y falla su gemela más de lo que explica el
 *       modelo (p. ej. conocía de antemano la respuesta de una pregunta concreta). Requiere grupos isomorfos.
 */
import { crearAzar, derivarSemilla } from './azar';
import { benjaminiHochberg, chiCuadradoCola, mediana, mezclaBetaUniforme, pearson, poissonBinomialCola } from './estadistica';
import { ajustarRasch, ajustarTiempos, duraciones, posiciones, type ModeloTiempos, type Rasch } from './modelos';
import type { ExamenObservado } from './tipos';

export interface OpcionesAnalisis { semilla: number; permutaciones: number; bootstrap: number; binSegundos: number; retardoMax: number; corregirPosicion: boolean }
export const OPCIONES_BASE: OpcionesAnalisis = { semilla: 20261027, permutaciones: 199, bootstrap: 199, binSegundos: 30, retardoMax: 4, corregirPosicion: true };

export interface ResultadoPareja {
  i: number; j: number;
  d1: { identicas: number; esperadas: number; comunes: number; p: number } | null;
  d2: { r: number; n: number; p: number } | null;
  d3: { max: number; retardo: number; lider: number | null; p: number } | null;
  q1: number | null; q2: number | null; q3: number | null;
  post1: number | null; post2: number | null;
}
export interface ResultadoEstudiante {
  i: number; puntaje: number; respondidas: number; theta: number;
  d4: { lz: number; p: number } | null;
  d5: { rapidas: number; esperadas: number; p: number } | null;
  d6: { pendiente: number; p: number } | null;
  d8: { discordancias: number; esperadas: number; pares: number; p: number } | null;
  cambios: number;
  d7: { distancia: number; p: number } | null;
  oculto: number;
  q4: number | null; q5: number | null; q6: number | null; q7: number | null; q8: number | null;
}
export interface Analisis {
  parejas: ResultadoPareja[];
  estudiantes: ResultadoEstudiante[];
  rasch: Rasch;
  tiempos: ModeloTiempos | null;
  abstenciones: string[];
  mezcla1: { pi0: number } | null;
  mezcla2: { pi0: number } | null;
}

const qs = (ps: (number | null)[]): (number | null)[] => {
  const idx = ps.map((p, k) => (p === null ? -1 : k)).filter((k) => k >= 0);
  const q = benjaminiHochberg(idx.map((k) => ps[k] as number));
  const out: (number | null)[] = ps.map(() => null);
  idx.forEach((k, r) => { out[k] = q[r]; });
  return out;
};

/** D1: prueba binomial generalizada sobre respuestas incorrectas idénticas (con popularidad excluyendo a la pareja). */
function d1(ex: ExamenObservado, rasch: Rasch, conteos: Map<string, number>[], totales: number[]) {
  const n = ex.r.length, m = ex.items.length;
  return (i: number, k: number) => {
    const ps: number[] = [];
    let identicas = 0, comunes = 0;
    for (let j = 0; j < m; j++) {
      const a = ex.r[i][j], b = ex.r[k][j];
      if (a.respuesta === null || b.respuesta === null || a.correcta === null || b.correcta === null) continue;
      comunes++;
      const conteo = new Map(conteos[j]);
      let total = totales[j];
      for (const r of [a, b]) if (r.correcta === false) { conteo.set(r.respuesta as string, (conteo.get(r.respuesta as string) ?? 1) - 1); total--; }
      const ALFA = 0.5;
      const vistos = [...conteo.values()].filter((c) => c > 0);
      const opciones = ex.items[j].opciones;
      const extra = opciones ? Math.max(1, opciones - 1 - vistos.length) : 20;
      const den = total + ALFA * (vistos.length + extra);
      let suma = extra * (ALFA / den) ** 2;
      for (const c of vistos) suma += ((c + ALFA) / den) ** 2;
      ps.push((1 - rasch.p(i, j)) * (1 - rasch.p(k, j)) * Math.min(1, suma));
      if (a.correcta === false && b.correcta === false && a.respuesta === b.respuesta) identicas++;
    }
    if (comunes < 5 || n < 10) return null;
    return { identicas, esperadas: ps.reduce((s, x) => s + x, 0), comunes, p: poissonBinomialCola(ps, identicas) };
  };
}

/** D2: correlación de residuos de duración con prueba de permutación (cola superior). */
function d2(tm: ModeloTiempos, B: number, semilla: number) {
  return (i: number, k: number) => {
    const x: number[] = [], y: number[] = [];
    tm.z[i].forEach((v, j) => { const w = tm.z[k][j]; if (v !== null && w !== null) { x.push(v); y.push(w); } });
    if (x.length < 8) return null;
    const r = pearson(x, y);
    if (!Number.isFinite(r)) return null;
    const az = crearAzar(derivarSemilla(semilla, 2, i, k));
    const yy = [...y];
    let mayores = 0;
    for (let b = 0; b < B; b++) { az.barajar(yy); if (pearson(x, yy) >= r) mayores++; }
    return { r, n: x.length, p: (mayores + 1) / (B + 1) };
  };
}

/**
 * D3: sincronía de respuestas iguales. S = Σ exp(−|t_i − t_k| / h) sobre los ítems en que ambos dieron la MISMA
 * respuesta. Nula por bootstrap paramétrico: B cronologías independientes por estudiante generadas con el modelo
 * lognormal ajustado, respetando su orden de respuesta, su velocidad y su hora de inicio (así la sincronía legítima
 * por orden común, ritmo parecido o inicio en tandas forma parte de la nula). Devuelve también quién responde primero.
 */
function d3Bootstrap(ex: ExamenObservado, tm: ModeloTiempos, o: OpcionesAnalisis) {
  const n = ex.r.length, m = ex.items.length;
  const H = 45;
  const ordenes = ex.r.map((fila) => fila.map((r, j) => ({ j, t: r.primera ?? r.t })).filter((x) => x.t !== null).sort((a, b) => (a.t as number) - (b.t as number)).map((x) => x.j));
  const B = o.bootstrap;
  // simulaciones: sim[b][i][j] = tiempo simulado de la respuesta del estudiante i al ítem j
  const az = crearAzar(derivarSemilla(o.semilla, 33));
  const sim: Float64Array[][] = [];
  for (let b = 0; b < B; b++) {
    sim.push(ordenes.map((ord, i) => {
      const t = new Float64Array(m).fill(NaN);
      let acc = ex.estudiantes[i].inicio;
      for (const j of ord) { acc += Math.exp(tm.beta[j] - tm.tau[i] + tm.gamma * (tm.pc?.[i][j] ?? 0) + tm.sigma[j] * az.normal()); t[j] = acc; }
      return t;
    }));
  }
  const iguales = (i: number, k: number) => {
    const js: number[] = [];
    for (let j = 0; j < m; j++) { const a = ex.r[i][j], c = ex.r[k][j]; if (a.respuesta !== null && a.respuesta === c.respuesta && a.t !== null && c.t !== null) js.push(j); }
    return js;
  };
  return (i: number, k: number) => {
    if (n < 6) return null;
    const js = iguales(i, k);
    if (js.length < 5) return null;
    const S = js.reduce((s, j) => s + Math.exp(-Math.abs((ex.r[i][j].t as number) - (ex.r[k][j].t as number)) / H), 0);
    let mayores = 0;
    for (let b = 0; b < B; b++) {
      let s = 0;
      for (const j of js) { const a = sim[b][i][j], c = sim[b][k][j]; if (!Number.isNaN(a) && !Number.isNaN(c)) s += Math.exp(-Math.abs(a - c) / H); }
      if (s >= S) mayores++;
    }
    const lags = js.map((j) => (ex.r[k][j].t as number) - (ex.r[i][j].t as number)).sort((a, b) => a - b);
    const med = lags[Math.floor(lags.length / 2)];
    return { max: S, retardo: med, lider: Math.abs(med) < 2 ? null : med > 0 ? i : k, p: (mayores + 1) / (B + 1) };
  };
}

/** (Versión descartada en la validación: nula por desplazamientos circulares, FPR ≈ 15 %. Se conserva para el laboratorio.) */
export function d3Circular(ex: ExamenObservado, o: OpcionesAnalisis) {
  const n = ex.r.length;
  const bin = o.binSegundos;
  const rel = ex.r.map((fila, i) => {
    const ts = fila.map((r) => r.t).filter((t): t is number => t !== null).map((t) => t - ex.estudiantes[i].inicio);
    return ts;
  });
  const len = Math.max(4, Math.ceil(Math.max(1, ...rel.flat()) / bin) + 1);
  const series = rel.map((ts) => { const s = new Float64Array(len); for (const t of ts) s[Math.min(len - 1, Math.max(0, Math.floor(t / bin)))]++; return s; });
  const comun = new Float64Array(len);
  for (const s of series) for (let b = 0; b < len; b++) comun[b] += s[b] / n;
  const res = series.map((s) => s.map((v, b) => v - comun[b]));
  const off = ex.estudiantes.map((e) => Math.round(e.inicio / bin));
  const L = o.retardoMax;
  // correlación (sin normalizar por varianza local: covarianza / (‖x‖‖y‖)) en el tiempo ABSOLUTO, para cada retardo
  const cc = (a: Float64Array, offA: number, b: Float64Array, offB: number, desplB: number) => {
    let mejor = -Infinity, arg = 0;
    const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0)) || 1, nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) || 1;
    for (let l = -L; l <= L; l++) {
      let s = 0;
      for (let t = 0; t < a.length; t++) {
        const tb = t + offA - offB - l; // b retrasado l bins respecto de a
        if (tb < 0 || tb >= b.length) continue;
        s += a[t] * b[(tb + desplB) % b.length];
      }
      const c = s / (na * nb);
      if (c > mejor) { mejor = c; arg = l; }
    }
    return { mejor, arg };
  };
  return (i: number, k: number) => {
    if (!ex.conTiempos || rel[i].length < 6 || rel[k].length < 6) return null;
    const obs = cc(res[i], off[i], res[k], off[k], 0);
    const az = crearAzar(derivarSemilla(o.semilla, 3, i, k));
    const B = Math.max(19, Math.floor(o.permutaciones / 2));
    let mayores = 0;
    for (let b = 0; b < B; b++) {
      const d = L + 1 + az.entero(Math.max(1, len - 2 * L - 2));
      if (cc(res[i], off[i], res[k], off[k], d).mejor >= obs.mejor) mayores++;
    }
    return { max: obs.mejor, retardo: obs.arg * bin, lider: obs.arg > 0 ? i : obs.arg < 0 ? k : null, p: (mayores + 1) / (B + 1) };
  };
}

function lz(x: (boolean | null)[], ps: number[]): number {
  let l = 0, e = 0, v = 0;
  x.forEach((xi, j) => {
    if (xi === null) return;
    const p = Math.min(1 - 1e-9, Math.max(1e-9, ps[j]));
    l += xi ? Math.log(p) : Math.log(1 - p);
    e += p * Math.log(p) + (1 - p) * Math.log(1 - p);
    v += p * (1 - p) * Math.log(p / (1 - p)) ** 2;
  });
  return v > 0 ? (l - e) / Math.sqrt(v) : 0;
}

export function analizar(ex: ExamenObservado, opciones: Partial<OpcionesAnalisis> = {}): Analisis {
  const o = { ...OPCIONES_BASE, ...opciones };
  const n = ex.r.length, m = ex.items.length;
  const abstenciones: string[] = [];
  const x = ex.r.map((f) => f.map((r) => (r.respuesta === null ? null : r.correcta)));
  const rasch = ajustarRasch(x);
  const posic = posiciones(ex);
  const usarPos = o.corregirPosicion && posic.varia;
  const tiempos = ex.conTiempos ? ajustarTiempos(duraciones(ex), 50, usarPos ? posic.pc : undefined) : null;
  if (!ex.conTiempos) abstenciones.push('Sin tiempos por pregunta registrados: los detectores temporales (D2, D3, D5, D6) se abstienen.');
  if (n < 10) abstenciones.push('Menos de 10 estudiantes: no se estima la popularidad de las respuestas incorrectas (D1 se abstiene).');

  const conteos = Array.from({ length: m }, (_, j) => {
    const c = new Map<string, number>();
    for (let i = 0; i < n; i++) { const r = ex.r[i][j]; if (r.respuesta !== null && r.correcta === false) c.set(r.respuesta, (c.get(r.respuesta) ?? 0) + 1); }
    return c;
  });
  const totales = conteos.map((c) => [...c.values()].reduce((s, v) => s + v, 0));
  const f1 = d1(ex, rasch, conteos, totales);
  const f2 = tiempos ? d2(tiempos, o.permutaciones, o.semilla) : null;
  const f3 = tiempos ? d3Bootstrap(ex, tiempos, o) : null;

  const parejas: ResultadoPareja[] = [];
  for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) {
    parejas.push({ i, j: k, d1: f1(i, k), d2: f2 ? f2(i, k) : null, d3: f3 ? f3(i, k) : null, q1: null, q2: null, q3: null, post1: null, post2: null });
  }
  const q1 = qs(parejas.map((p) => p.d1?.p ?? null)), q2 = qs(parejas.map((p) => p.d2?.p ?? null)), q3 = qs(parejas.map((p) => p.d3?.p ?? null));
  const mez1 = mezclaBetaUniforme(parejas.map((p) => p.d1?.p).filter((p): p is number => p !== undefined));
  const mez2 = mezclaBetaUniforme(parejas.map((p) => p.d2?.p).filter((p): p is number => p !== undefined));
  parejas.forEach((p, k) => {
    p.q1 = q1[k]; p.q2 = q2[k]; p.q3 = q3[k];
    p.post1 = mez1 && p.d1 ? mez1.posterior(p.d1.p) : null;
    p.post2 = mez2 && p.d2 ? mez2.posterior(p.d2.p) : null;
  });
  if (!mez1) abstenciones.push('Pocas parejas para estimar la probabilidad posterior de dependencia: se muestran solo valores p y q.');

  // --- por estudiante ---
  const B = o.bootstrap;
  const gruposIso = new Map<string, number[]>();
  ex.items.forEach((it, j) => { if (it.grupo) gruposIso.set(it.grupo, [...(gruposIso.get(it.grupo) ?? []), j]); });
  const estudiantes: ResultadoEstudiante[] = ex.r.map((fila, i) => {
    const az = crearAzar(derivarSemilla(o.semilla, 4, i));
    const ps = fila.map((_, j) => rasch.p(i, j));
    const xi = x[i];
    const respondidas = xi.filter((v) => v !== null).length;
    const puntaje = xi.filter((v) => v === true).length;
    let r4: ResultadoEstudiante['d4'] = null, r5: ResultadoEstudiante['d5'] = null, r6: ResultadoEstudiante['d6'] = null;
    if (respondidas >= 8) {
      const obs = lz(xi, ps);
      let menores = 0;
      for (let b = 0; b < B; b++) { const sim = xi.map((v, j) => (v === null ? null : az.u() < ps[j])); if (lz(sim, ps) <= obs) menores++; }
      r4 = { lz: obs, p: (menores + 1) / (B + 1) };
    }
    if (tiempos && respondidas >= 8) {
      const z = tiempos.z[i];
      const cuenta = (xs: (boolean | null)[], zs: (number | null)[]) => xs.reduce((s, v, j) => s + (v === true && ps[j] < 0.5 && zs[j] !== null && (zs[j] as number) < -1.2 ? 1 : 0), 0);
      const obs = cuenta(xi, z);
      let mayores = 0, suma = 0;
      for (let b = 0; b < B; b++) {
        const xs = xi.map((v, j) => (v === null ? null : az.u() < ps[j]));
        const zs = z.map((v) => (v === null ? null : az.normal()));
        const c = cuenta(xs, zs);
        suma += c;
        if (c >= obs) mayores++;
      }
      r5 = { rapidas: obs, esperadas: suma / B, p: (mayores + 1) / (B + 1) };
      // D6: pendiente de log d frente a β (esperada ≈ 1)
      const pend = (ld: (number | null)[]) => {
        const xs: number[] = [], ys: number[] = [];
        ld.forEach((v, j) => { if (v !== null) { xs.push(tiempos.beta[j]); ys.push(v); } });
        const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
        let sxy = 0, sxx = 0;
        xs.forEach((v, k) => { sxy += (v - mx) * (ys[k] - my); sxx += (v - mx) ** 2; });
        return sxx > 0 ? sxy / sxx : 1;
      };
      const pObs = pend(tiempos.logd[i]);
      let menores = 0;
      for (let b = 0; b < B; b++) {
        const sim = tiempos.logd[i].map((v, j) => (v === null ? null : tiempos.beta[j] - tiempos.tau[i] + tiempos.gamma * (tiempos.pc?.[i][j] ?? 0) + tiempos.sigma[j] * az.normal()));
        if (pend(sim) <= pObs) menores++;
      }
      r6 = { pendiente: pObs, p: (menores + 1) / (B + 1) };
    }
    // D8: inconsistencia entre versiones isomorfas. Por cada par de gemelas: 1 si acierta una y falla la otra, más el
    // exceso de diferencia de tiempo residual (|z_a − z_b| − 1)₊ si hay tiempos. Nula: bootstrap paramétrico del
    // modelo (aciertos ~ Rasch, residuos de tiempo ~ N(0,1) independientes).
    let r8: ResultadoEstudiante['d8'] = null;
    const pares: [number, number][] = [];
    for (const js of gruposIso.values()) for (let x1 = 0; x1 < js.length; x1++) for (let x2 = x1 + 1; x2 < js.length; x2++) if (xi[js[x1]] !== null && xi[js[x2]] !== null) pares.push([js[x1], js[x2]]);
    if (pares.length >= 3) {
      const zi = tiempos?.z[i] ?? null;
      const inc = (xs: (boolean | null)[], zs: (number | null)[] | null) => pares.reduce((s, [a, c]) => {
        let v = xs[a] !== xs[c] ? 1 : 0;
        if (zs && zs[a] !== null && zs[c] !== null) v += Math.max(0, Math.abs((zs[a] as number) - (zs[c] as number)) - 1);
        return s + v;
      }, 0);
      const obs = inc(xi, zi);
      let mayores = 0, suma = 0;
      for (let b = 0; b < B; b++) {
        const sim = xi.map((v, j) => (v === null ? null : az.u() < ps[j]));
        const zs = zi ? zi.map((v) => (v === null ? null : az.normal())) : null;
        const c = inc(sim, zs);
        suma += c;
        if (c >= obs) mayores++;
      }
      r8 = { discordancias: obs, esperadas: suma / B, pares: pares.length, p: (mayores + 1) / (B + 1) };
    }
    const cambios = fila.reduce((s, r) => s + Math.max(0, r.cambios - 1), 0);
    return { i, puntaje, respondidas, theta: rasch.theta[i], d4: r4, d5: r5, d6: r6, d7: null, d8: r8, cambios, oculto: ex.estudiantes[i].oculto, q4: null, q5: null, q6: null, q7: null, q8: null };
  });

  // D7: distancia robusta (descriptiva)
  const rasgos = estudiantes.map((e) => [e.d4 ? -e.d4.lz : null, e.d5 ? e.d5.rapidas - e.d5.esperadas : null, e.d6 ? -e.d6.pendiente : null, Math.log1p(e.oculto), e.respondidas ? e.puntaje / e.respondidas : null]);
  const robustos = rasgos[0].map((_, c) => {
    const col = rasgos.map((f) => f[c]).filter((v): v is number => v !== null);
    const med = mediana(col);
    const mad = mediana(col.map((v) => Math.abs(v - med))) * 1.4826 || 1;
    return { med, mad };
  });
  estudiantes.forEach((e, i) => {
    const zs = rasgos[i].map((v, c) => (v === null ? null : (v - robustos[c].med) / robustos[c].mad)).filter((v): v is number => v !== null);
    if (zs.length >= 3) { const d = zs.reduce((s, v) => s + v * v, 0); e.d7 = { distancia: Math.sqrt(d), p: chiCuadradoCola(d, zs.length) }; }
  });
  const q4 = qs(estudiantes.map((e) => e.d4?.p ?? null)), q5 = qs(estudiantes.map((e) => e.d5?.p ?? null));
  const q6 = qs(estudiantes.map((e) => e.d6?.p ?? null)), q7 = qs(estudiantes.map((e) => e.d7?.p ?? null));
  const q8 = qs(estudiantes.map((e) => e.d8?.p ?? null));
  estudiantes.forEach((e, k) => { e.q4 = q4[k]; e.q5 = q5[k]; e.q6 = q6[k]; e.q7 = q7[k]; e.q8 = q8[k]; });

  return { parejas, estudiantes, rasch, tiempos, abstenciones, mezcla1: mez1 ? { pi0: mez1.pi0 } : null, mezcla2: mez2 ? { pi0: mez2.pi0 } : null };
}

/** Grafo de dependencias: aristas con q < umbral en los detectores indicados; grado de cada nodo y componentes. */
export function grafo(a: Analisis, n: number, detectores: ('d1' | 'd2' | 'd3')[], umbral = 0.1) {
  const aristas = a.parejas.filter((p) => detectores.some((d) => { const q = p[d === 'd1' ? 'q1' : d === 'd2' ? 'q2' : 'q3']; return q !== null && q < umbral; }));
  const grado = new Array(n).fill(0);
  const lidera = new Array(n).fill(0); // aristas en las que el nodo responde primero (dirección temporal, D3)
  for (const e of aristas) { grado[e.i]++; grado[e.j]++; if (e.d3?.lider !== null && e.d3?.lider !== undefined) lidera[e.d3.lider]++; }
  const maxL = Math.max(0, ...lidera);
  const centro = maxL >= 2 && lidera.filter((v) => v === maxL).length === 1 ? lidera.indexOf(maxL) : null;
  const padre = [...Array(n).keys()];
  const raiz = (v: number): number => (padre[v] === v ? v : (padre[v] = raiz(padre[v])));
  for (const e of aristas) padre[raiz(e.i)] = raiz(e.j);
  const comps = new Map<number, number[]>();
  for (let v = 0; v < n; v++) if (grado[v] > 0) { const r = raiz(v); comps.set(r, [...(comps.get(r) ?? []), v]); }
  return { aristas, grado, lidera, centro, componentes: [...comps.values()].sort((x, y) => y.length - x.length) };
}
