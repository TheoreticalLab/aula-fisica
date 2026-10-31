/**
 * LIEIA · D6 v2 — Sensibilidad temporal a la dificultad (sustituye en el análisis al D6 v1 de detectores.ts, que se
 * conserva sin cambios para reproducir informes anteriores).
 *
 * Problemas del D6 v1 que esta versión corrige (auditoría del 2026-10-30):
 *  1. La «normalidad» se estimaba con la misma sección investigada: el resultado de un estudiante cambiaba al cambiar
 *     sus compañeros. Aquí la referencia es EXTERNA, calibrada aparte, versionada y fija durante la evaluación.
 *  2. Medía sensibilidad a la intensidad temporal del ítem, no a su dificultad. Aquí se separan: μ_j (intensidad
 *     temporal calibrada) y D_j (dificultad calibrada o declarada).
 *  3. Si no había variación devolvía «pendiente 1» (normal). Aquí, sin al menos dos niveles evaluables, el resultado
 *     es NO IDENTIFICABLE: nunca un número arbitrario.
 *  4. No distinguía aciertos de errores, omisiones ni cobertura de niveles. Aquí se informan por separado.
 *
 * Modelo (D6-A):  log T_ij = μ_j + α_i + β_i (D_j − D_ref) + ε_ij,   ε_ij ~ N(0, σ_j²)
 *   T_ij = tiempo OBSERVABLE atribuible a la pregunta (nunca 0 si falta: se excluye); μ_j, σ_j, D_j, D_ref: de la
 *   referencia; α_i: velocidad general del estudiante (se elimina al centrar); β_i: desviación individual de la
 *   sensibilidad. En la población de referencia β_i ~ N(0, τ_β²). Contraste unilateral de INSENSIBILIDAD (β_i < 0: el
 *   tiempo no crece con la dificultad como en la referencia): z = β̂ / √(SE² + τ_β²), p = Φ(z).
 *   SE: la del estimador de mínimos cuadrados ponderados con σ_j conocidas (de la referencia).
 * Identificación: < 2 niveles evaluables → no identificable; 2 niveles → contraste parcial; ≥ 3 → identificable; en
 *   ambos casos solo si SE ≤ se_max. se_max NO es un mínimo arbitrario de preguntas: sale del análisis de precisión de
 *   la referencia (SE que da ≥ 80 % de potencia contra la insensibilidad completa a α = 0,05) y se comprueba por
 *   simulación (d6Validacion.ts).
 *
 * D6-B — Rapidez relativa: respuestas CORRECTAS mucho más rápidas que lo habitual en ese ítem en la referencia
 *   (log T − μ_j < −z_rapida·√(σ_j² + τ_α²)). La p NO usa una binomial ingenua (que castigaría a quien es rápido en
 *   general, porque sus ítems están correlacionados): integra sobre la velocidad personal α ~ N(0, τ_α²) de la
 *   referencia. Respuestas transcritas desde papel o muy entrenadas también son rápidas. Las incorrectas rápidas se
 *   cuentan aparte (descriptivo).
 *
 * p y q NO son probabilidades de que el estudiante haya usado IA ni de culpabilidad: miden lo improbable que sería el
 * patrón observado si el estudiante se comportara como la población de referencia.
 */
import { normalCdf, poissonBinomialCola } from './estadistica';

export const VERSION_D6 = 'd6-2.0';

export type Nivel = 1 | 2 | 3; // básica, intermedia, desafiante
export const NIVEL_NOMBRE: Record<Nivel, string> = { 1: 'básica', 2: 'intermedia', 3: 'desafiante' };

export interface ItemReferencia {
  mu: number;        // intensidad temporal: media de log T (s) en la referencia, descontada la velocidad personal
  sigma: number;     // desviación residual de log T en ese ítem
  D: number;         // dificultad (logits si es empírica; nivel − 2 si es declarada)
  nivel: Nivel;
  fuente_D: 'empirica' | 'declarada';
  n: number;         // respuestas con tiempo usadas para calibrar
}

export interface ReferenciaD6 {
  version: string;   // p. ej. «ref-FG1-2026-10-30»: fija durante una evaluación
  creada: string;
  descripcion: string;
  fuente: 'calibrada' | 'provisional';
  items: Record<string, ItemReferencia>;
  D_ref: number;
  tau_alpha: number;       // dispersión entre personas de la velocidad general
  tau_beta: number;        // dispersión entre personas de β_i
  pendiente_mu_D: number;  // cuánto crece log T con D en la referencia (= efecto de la insensibilidad completa)
  se_max: number;          // precisión exigida a β̂ (0 = la referencia no permite identificar insensibilidad)
  z_rapida: number;        // umbral de D6-B
}

export interface RespuestaD6 {
  exercise_id: string;
  respondida: boolean;
  correcta: boolean | null;
  tiempo_s: number | null;                                  // tiempo observable atribuible (null = no observado)
  calidad?: 'observado' | 'parcial' | 'no_observado';
}

export type EstadoD6A = 'identificable' | 'contraste_parcial' | 'no_identificable' | 'precision_insuficiente' | 'insuficiente' | 'referencia_no_informativa';

export const ESTADO_D6A: Record<EstadoD6A, string> = {
  identificable: 'Identificable (tres niveles)',
  contraste_parcial: 'Contraste parcial (dos niveles)',
  no_identificable: 'No identificable',
  precision_insuficiente: 'Precisión insuficiente',
  insuficiente: 'Datos insuficientes',
  referencia_no_informativa: 'Referencia no informativa',
};

export interface ResultadoD6A {
  estado: EstadoD6A;
  niveles: Nivel[];
  n_evaluables: number; n_sin_tiempo: number; n_omitidas: number; n_sin_referencia: number; n_parciales: number;
  beta: number | null; se: number | null; ic95: [number, number] | null; z: number | null; p: number | null;
  beta_robusta: number | null;     // Theil–Sen (comprobación de robustez)
  beta_correctas: number | null;   // solo con las respuestas correctas
  referencia: string; version: string; advertencias: string[];
}

export interface ResultadoD6B {
  estado: 'evaluable' | 'insuficiente';
  n_correctas_evaluables: number; rapidas_correctas: number; esperadas: number; p: number | null;
  rapidas_incorrectas: number; n_incorrectas_evaluables: number;
  referencia: string; version: string; advertencias: string[];
}

const ln = Math.log;

function theilSen(xs: number[], ys: number[]): number | null {
  const ps: number[] = [];
  for (let a = 0; a < xs.length; a++) for (let b = a + 1; b < xs.length; b++) if (Math.abs(xs[b] - xs[a]) > 1e-9) ps.push((ys[b] - ys[a]) / (xs[b] - xs[a]));
  if (!ps.length) return null;
  ps.sort((u, v) => u - v);
  const h = Math.floor(ps.length / 2);
  return ps.length % 2 ? ps[h] : (ps[h - 1] + ps[h]) / 2;
}

/** Mínimos cuadrados ponderados con varianzas conocidas: pendiente y su error típico. */
export function mcp(xs: number[], ys: number[], ws: number[]): { beta: number; se: number } | null {
  const W = ws.reduce((s, w) => s + w, 0);
  if (!(W > 0)) return null;
  const mx = xs.reduce((s, x, k) => s + ws[k] * x, 0) / W, my = ys.reduce((s, y, k) => s + ws[k] * y, 0) / W;
  let sxx = 0, sxy = 0;
  xs.forEach((x, k) => { sxx += ws[k] * (x - mx) ** 2; sxy += ws[k] * (x - mx) * (ys[k] - my); });
  if (sxx <= 1e-12) return null;
  return { beta: sxy / sxx, se: Math.sqrt(1 / sxx) };
}

// Cuadratura sobre α ~ N(0, τ_α²): 41 nodos equiespaciados en ±5 desviaciones con pesos normales
const NODOS = (() => {
  const k = 41, out: { x: number; w: number }[] = [];
  let tot = 0;
  for (let i = 0; i < k; i++) { const x = -5 + (10 * i) / (k - 1); const w = Math.exp((-x * x) / 2); out.push({ x, w }); tot += w; }
  return out.map((n) => ({ x: n.x, w: n.w / tot }));
})();

/** D6-B: P(X ≥ k) integrando sobre la velocidad personal de la referencia (los ítems de una persona no son independientes). */
function colaRapidas(items: ItemReferencia[], k: number, ref: ReferenciaD6): { p: number; esperadas: number } {
  let p = 0, esperadas = 0;
  for (const n of NODOS) {
    const a = n.x * ref.tau_alpha;
    const ps = items.map((it) => normalCdf((-ref.z_rapida * Math.sqrt(it.sigma ** 2 + ref.tau_alpha ** 2) - a) / it.sigma));
    p += n.w * poissonBinomialCola(ps, k);
    esperadas += n.w * ps.reduce((s, v) => s + v, 0);
  }
  return { p: Math.min(1, p), esperadas };
}

export interface OpcionesD6 {
  /** Tiempos parcialmente observados (con una pausa, pestaña oculta o desconexión dentro): por defecto se excluyen,
   *  porque la simulación muestra que las pausas no descontadas duplican la tasa de falsos positivos de D6-A. */
  parciales?: 'excluir' | 'usar';
}

export function d6(respuestas: RespuestaD6[], ref: ReferenciaD6, op: OpcionesD6 = {}): { a: ResultadoD6A; b: ResultadoD6B } {
  const usarParciales = op.parciales === 'usar';
  const adv: string[] = [];
  let sinTiempo = 0, omitidas = 0, sinRef = 0, parciales = 0;
  const ev: { r: RespuestaD6; it: ItemReferencia; t: number }[] = [];
  for (const r of respuestas) {
    if (!r.respondida) { omitidas++; continue; }
    const it = ref.items[r.exercise_id];
    if (!it) { sinRef++; continue; }
    if (r.tiempo_s === null || !(r.tiempo_s > 0) || r.calidad === 'no_observado') { sinTiempo++; continue; }
    if (r.calidad === 'parcial') { parciales++; if (!usarParciales) continue; }
    ev.push({ r, it, t: r.tiempo_s });
  }
  if (omitidas) adv.push(`${omitidas} pregunta(s) sin responder: no se usan ni se cuentan como tiempo 0.`);
  if (sinTiempo) adv.push(`${sinTiempo} respuesta(s) sin tiempo observable: excluidas (no se imputan).`);
  if (sinRef) adv.push(`${sinRef} pregunta(s) sin calibración en la referencia ${ref.version}: excluidas.`);
  if (parciales) adv.push(usarParciales
    ? `${parciales} tiempo(s) solo parcialmente observados (pausas, pestaña oculta o desconexión) incluidos: interpretar con cautela.`
    : `${parciales} tiempo(s) solo parcialmente observados (pausas, pestaña oculta o desconexión): excluidos.`);
  if (ref.fuente === 'provisional') adv.push('Referencia PROVISIONAL (dificultad declarada o calibración con pocos datos): resultados exploratorios.');
  const niveles = [...new Set(ev.map((e) => e.it.nivel))].sort() as Nivel[];

  // ---- D6-A ----
  const base = { niveles, n_evaluables: ev.length, n_sin_tiempo: sinTiempo, n_omitidas: omitidas, n_sin_referencia: sinRef, n_parciales: parciales,
    referencia: ref.version, version: VERSION_D6 };
  const vacio = { beta: null, se: null, ic95: null, z: null, p: null, beta_robusta: null, beta_correctas: null };
  let a: ResultadoD6A;
  if (ev.length < 2) {
    a = { ...base, ...vacio, estado: 'insuficiente', advertencias: [...adv, 'Menos de dos respuestas con tiempo observable.'] };
  } else if (niveles.length < 2) {
    a = { ...base, ...vacio, estado: 'no_identificable',
      advertencias: [...adv, `Solo hay respuestas evaluables de nivel ${NIVEL_NOMBRE[niveles[0]]}: la relación entre dificultad y tiempo NO es identificable (no se asigna ningún valor).`] };
  } else {
    const xs = ev.map((e) => e.it.D - ref.D_ref), ys = ev.map((e) => ln(e.t) - e.it.mu), ws = ev.map((e) => 1 / e.it.sigma ** 2);
    const f = mcp(xs, ys, ws);
    if (!f) {
      a = { ...base, ...vacio, estado: 'no_identificable', advertencias: [...adv, 'Las dificultades evaluables no varían: pendiente no identificable.'] };
    } else {
      const corr = ev.filter((e) => e.r.correcta === true);
      const fc = new Set(corr.map((e) => e.it.nivel)).size >= 2
        ? mcp(corr.map((e) => e.it.D - ref.D_ref), corr.map((e) => ln(e.t) - e.it.mu), corr.map((e) => 1 / e.it.sigma ** 2)) : null;
      const comun = { ...base, beta: f.beta, se: f.se, ic95: [f.beta - 1.96 * f.se, f.beta + 1.96 * f.se] as [number, number],
        beta_robusta: theilSen(xs, ys), beta_correctas: fc?.beta ?? null };
      const extra: string[] = [];
      if (comun.beta_robusta !== null && Math.sign(comun.beta_robusta) !== Math.sign(f.beta) && Math.abs(comun.beta_robusta - f.beta) > f.se) {
        extra.push('La estimación robusta (Theil–Sen) no coincide en signo con la principal: unos pocos tiempos dominan el resultado.');
      }
      if (ref.se_max <= 0) {
        a = { ...comun, z: null, p: null, estado: 'referencia_no_informativa',
          advertencias: [...adv, ...extra, `En la referencia ${ref.version} el tiempo apenas crece con la dificultad: la insensibilidad no se distingue de la normalidad.`] };
      } else if (f.se > ref.se_max) {
        a = { ...comun, z: null, p: null, estado: 'precision_insuficiente',
          advertencias: [...adv, ...extra, `Error típico ${f.se.toFixed(2)} > ${ref.se_max.toFixed(2)} exigido por el análisis de precisión: no se contrasta.`] };
      } else {
        const z = f.beta / Math.sqrt(f.se ** 2 + ref.tau_beta ** 2);
        a = { ...comun, z, p: normalCdf(z), estado: niveles.length >= 3 ? 'identificable' : 'contraste_parcial',
          advertencias: [...adv, ...extra, ...(niveles.length === 2 ? [`Contraste parcial entre dos niveles (${niveles.map((n) => NIVEL_NOMBRE[n]).join(' y ')}).`] : [])] };
      }
    }
  }

  // ---- D6-B ----
  const corr = ev.filter((e) => e.r.correcta === true), inc = ev.filter((e) => e.r.correcta === false);
  const rapida = (e: { t: number; it: ItemReferencia }) => ln(e.t) - e.it.mu < -ref.z_rapida * Math.sqrt(e.it.sigma ** 2 + ref.tau_alpha ** 2);
  const kC = corr.filter(rapida).length;
  const cola = corr.length ? colaRapidas(corr.map((e) => e.it), kC, ref) : null;
  const b: ResultadoD6B = {
    estado: corr.length ? 'evaluable' : 'insuficiente', n_correctas_evaluables: corr.length, rapidas_correctas: kC,
    esperadas: cola?.esperadas ?? 0, p: cola?.p ?? null, rapidas_incorrectas: inc.filter(rapida).length, n_incorrectas_evaluables: inc.length,
    referencia: ref.version, version: VERSION_D6,
    advertencias: [...(corr.length ? [] : ['Sin respuestas correctas con tiempo observable.']),
      'Las respuestas transcritas desde papel o muy entrenadas también son rápidas: es un indicio para revisar, no una prueba.'],
  };
  return { a, b };
}

// ---------------------------------------------------------------------------------------------------------
// Calibración de la referencia con una cohorte de CALIBRACIÓN (distinta de la que se investiga)

export interface DatoCalibracion { estudiante: string; exercise_id: string; tiempo_s: number | null; correcta: boolean | null }

export interface OpcionesCalibracion {
  version: string;
  descripcion?: string;
  dificultad?: Record<string, number>;   // dificultad empírica (logits) si existe; si no, se usa el nivel declarado
  z_rapida?: number;
  minimo_por_item?: number;              // por debajo, la referencia queda marcada como provisional
  ahora?: string;
}

export function calibrarReferencia(datos: DatoCalibracion[], declarados: Record<string, Nivel>, op: OpcionesCalibracion): ReferenciaD6 {
  const min = op.minimo_por_item ?? 20;
  const conT = datos.filter((d) => d.tiempo_s !== null && d.tiempo_s > 0 && declarados[d.exercise_id] !== undefined)
    .map((d) => ({ e: d.estudiante, j: d.exercise_id, y: ln(d.tiempo_s!) }));
  const porItem = new Map<string, typeof conT>(), porEst = new Map<string, typeof conT>();
  for (const d of conT) {
    if (!porItem.has(d.j)) porItem.set(d.j, []);
    if (!porEst.has(d.e)) porEst.set(d.e, []);
    porItem.get(d.j)!.push(d);
    porEst.get(d.e)!.push(d);
  }
  // modelo aditivo log T = μ_j + α_i (α centrada), por mínimos cuadrados alternados
  const mu = new Map<string, number>(), alfa = new Map<string, number>([...porEst.keys()].map((e) => [e, 0]));
  for (let it = 0; it < 30; it++) {
    for (const [j, xs] of porItem) mu.set(j, xs.reduce((s, d) => s + d.y - alfa.get(d.e)!, 0) / xs.length);
    for (const [e, xs] of porEst) alfa.set(e, xs.reduce((s, d) => s + d.y - mu.get(d.j)!, 0) / xs.length);
    const m = [...alfa.values()].reduce((s, v) => s + v, 0) / (alfa.size || 1);
    for (const e of alfa.keys()) alfa.set(e, alfa.get(e)! - m);
  }
  const items: Record<string, ItemReferencia> = {};
  let provisional = false;
  for (const [j, xs] of porItem) {
    const res = xs.map((d) => d.y - mu.get(j)! - alfa.get(d.e)!);
    const sigma = Math.max(0.1, Math.sqrt(res.reduce((s, r) => s + r * r, 0) / Math.max(1, xs.length - 1)));
    const nivel = declarados[j];
    const emp = op.dificultad?.[j];
    if (xs.length < min || emp === undefined) provisional = true;
    items[j] = { mu: mu.get(j)!, sigma, D: emp ?? nivel - 2, nivel, fuente_D: emp === undefined ? 'declarada' : 'empirica', n: xs.length };
  }
  const lista = Object.values(items);
  const D_ref = lista.reduce((s, r) => s + r.D, 0) / (lista.length || 1);
  const pend = mcp(lista.map((r) => r.D - D_ref), lista.map((r) => r.mu), lista.map(() => 1));
  const pendiente_mu_D = pend?.beta ?? 0;
  // dispersión de la velocidad general (descontado el error de muestreo de α̂)
  const ests = [...porEst.values()];
  const va = ests.reduce((s, xs) => s + alfa.get(xs[0].e)! ** 2, 0) / Math.max(1, ests.length - 1)
    - ests.reduce((s, xs) => s + xs.reduce((u, d) => u + items[d.j].sigma ** 2, 0) / xs.length ** 2, 0) / (ests.length || 1);
  const tau_alpha = Math.sqrt(Math.max(0, va));
  // dispersión de β_i (método de momentos: varianza de β̂_i menos su varianza de muestreo media)
  const betas: { b: number; v: number }[] = [];
  for (const xs of ests) {
    if (new Set(xs.map((d) => items[d.j].nivel)).size < 2) continue;
    const f = mcp(xs.map((d) => items[d.j].D - D_ref), xs.map((d) => d.y - items[d.j].mu), xs.map((d) => 1 / items[d.j].sigma ** 2));
    if (f) betas.push({ b: f.beta, v: f.se ** 2 });
  }
  const mb = betas.reduce((s, x) => s + x.b, 0) / (betas.length || 1);
  const vb = betas.reduce((s, x) => s + (x.b - mb) ** 2, 0) / Math.max(1, betas.length - 1) - betas.reduce((s, x) => s + x.v, 0) / (betas.length || 1);
  const tau_beta = Math.max(0.02, Math.sqrt(Math.max(0, vb)));
  // precisión exigida: potencia ≥ 80 % contra la insensibilidad completa (β = −pendiente_mu_D), α = 0,05 unilateral:
  // |pendiente| / √(SE² + τ²) ≥ z_0,95 + z_0,80
  const objetivo = Math.abs(pendiente_mu_D) / (1.6449 + 0.8416);
  const se_max = objetivo > tau_beta ? Math.sqrt(objetivo ** 2 - tau_beta ** 2) : 0;
  return {
    version: op.version, creada: op.ahora ?? new Date().toISOString(), descripcion: op.descripcion ?? '',
    fuente: provisional ? 'provisional' : 'calibrada', items, D_ref, tau_alpha, tau_beta, pendiente_mu_D, se_max, z_rapida: op.z_rapida ?? 2,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Diagnóstico de transporte de la referencia (a nivel de cohorte).
// NO cambia ningún resultado individual (la normalidad no depende del grupo): solo avisa de que la referencia quizá
// no describe a esta cohorte. Bajo la referencia, E[β̂_i] = 0; una media de la cohorte muy alejada de 0 indica que
// (a) la población es distinta de la de calibración, o (b) hay un problema extendido (p. ej. contaminación masiva).
// Con estos datos no se distinguen: la decisión (recalibrar o investigar) corresponde a una persona.

export interface DiagnosticoReferencia {
  estado: 'compatible' | 'deriva' | 'insuficiente';
  n: number; media_beta: number | null; se: number | null; z: number | null;
  mensaje: string;
}

export function diagnosticoReferencia(resultados: ResultadoD6A[], ref: ReferenciaD6, zUmbral = 3): DiagnosticoReferencia {
  const ev = resultados.filter((r) => r.beta !== null && r.se !== null && (r.estado === 'identificable' || r.estado === 'contraste_parcial'));
  if (ev.length < 5) {
    return { estado: 'insuficiente', n: ev.length, media_beta: null, se: null, z: null,
      mensaje: 'Menos de cinco estudiantes evaluables: no se puede comprobar si la referencia describe a esta cohorte.' };
  }
  const ws = ev.map((r) => 1 / (r.se! ** 2 + ref.tau_beta ** 2));
  const W = ws.reduce((s, w) => s + w, 0);
  const media = ev.reduce((s, r, k) => s + ws[k] * r.beta!, 0) / W, se = Math.sqrt(1 / W), z = media / se;
  return Math.abs(z) > zUmbral
    ? { estado: 'deriva', n: ev.length, media_beta: media, se, z,
      mensaje: `La cohorte se aparta de la referencia ${ref.version} (media de β ${media.toFixed(2)} ± ${se.toFixed(2)}). Puede ser una población distinta de la de calibración (y entonces D6-A da falsos positivos) o un problema extendido en la cohorte; estos datos no lo distinguen. Antes de priorizar por D6-A, revise la referencia o recalíbrela con una cohorte comparable.` }
    : { estado: 'compatible', n: ev.length, media_beta: media, se, z, mensaje: `La cohorte es compatible con la referencia ${ref.version}.` };
}
