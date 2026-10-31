/**
 * LIEIA · D6 v2 — Sensibilidad temporal a la dificultad. ESTADO: EXPERIMENTAL (no se usa con datos reales hasta tener
 * una referencia real apropiada y una validación independiente). El D6 v1 (detectores.ts) está RETIRADO por defectos
 * metodológicos (validacion.ts → OBSOLETOS) y se conserva solo para reproducir informes anteriores.
 *
 * Modelo (D6-A):  log T_ij = μ_j + α_i + β_i (D_j − D_ref) + ε_ij,   ε_ij ~ N(0, σ_j²)
 *   T_ij = tiempo OBSERVABLE de trabajo en la pregunta, reconstruido desde sus intervalos (§ reconstruirTiempo): se
 *   suman los intervalos de trabajo y se descuentan pausas declaradas, pestaña oculta y desconexiones. Una pregunta
 *   solo se excluye cuando su tiempo no se puede reconstruir con fiabilidad. Nunca se imputa ni vale 0.
 *   μ_j, σ_j, D_j, D_ref vienen de una referencia EXTERNA (otra cohorte), versionada y fija; α_i es la velocidad general
 *   (se elimina al centrar); β_i es la desviación de la sensibilidad. Bajo la referencia β_i ~ N(0, τ_β²).
 *   z = β̂ / √(SE² + τ_β²),  p = Φ(z)  (unilateral: insensibilidad). La varianza de cada residuo incluye la incertidumbre
 *   de μ̂_j en la referencia.
 *
 * D6-B — Rapidez relativa: respuestas CORRECTAS mucho más rápidas que lo habitual en ese ítem en la referencia. La p
 *   integra sobre la velocidad personal α ~ N(0, τ_α²) DE LA REFERENCIA; no se estima ni se descuenta la velocidad del
 *   propio estudiante (una normalización interna borraría justamente la rapidez de quien recibe ayuda en todo el examen).
 *
 * Política de abstención en dos niveles (§ analizarCohorteD6):
 *   1. Individual: estados de identificación (identificable, contraste parcial, precisión insuficiente, datos temporales
 *      inválidos, no identificable). Sin identificación no hay número de sustitución.
 *   2. Cohorte: la referencia debe ser APLICABLE a la población evaluada. Requisitos de contexto (referencia calibrada,
 *      mismo protocolo, misma asignatura, modalidad y versión de telemetría, vigencia) y una prueba de EQUIVALENCIA: con la
 *      localización y la escala robustas de los z de la cohorte, la tasa de falsos positivos en el peor caso plausible
 *      debe ser ≤ fpr_max. Si no se demuestra, TODOS los resultados individuales de esa cohorte se abstienen. Nunca se
 *      recalibra con la sección investigada. Precio: con contaminación extensa la cohorte también se abstiene (no se
 *      distingue de una población distinta); se informa como observación de cohorte, no individual.
 *
 * p y q NO son probabilidades de que el estudiante haya usado IA ni de culpabilidad: miden lo improbable que sería el
 * patrón observado si el estudiante se comportara como la población de referencia.
 */
import { normalCdf, poissonBinomialCola } from './estadistica';

// ---------------------------------------------------------------------------------------------------------
// Protocolo CONGELADO. Cualquier cambio exige una versión nueva (la prueba de la huella lo impide en silencio).

export const PROTOCOLO_D6 = Object.freeze({
  version: 'd6-2.1',
  alfa: 0.05,
  potencia_objetivo: 0.8,           // se_max: potencia ≥ 80 % frente a la insensibilidad completa
  z_rapida: 2,                      // D6-B: «rápida» = más de 2 desviaciones por debajo de lo habitual en el ítem
  fpr_max_aplicabilidad: 0.1,       // peor tasa de falsos positivos tolerada para declarar aplicable la referencia (2α)
  escala_aplicabilidad: 'si_significativa' as 'estimada' | 'si_significativa',
  huber_k: 1.345,
  minimo_por_item_referencia: 20,
  inactividad_max_s: 300,           // inactividad con la pregunta visible: hasta 5 min cuenta como trabajo (pensar)
  tolerancia_log_reconstruccion: 0.1, // ambigüedad máxima ln(t_max/t_min) para aceptar un tiempo reconstruido
  semillas_desarrollo: [1, 3, 5, 7, 11, 42, 99, 314, 2026, 2718],
  semillas_evaluacion: { desde: 50_000, cantidad: 100 },
  evaluacion: { replicas: 3, tam_cohorte: 60, tam_calibracion: 300 },
});
export type ProtocoloD6 = typeof PROTOCOLO_D6;

/** Huella (FNV-1a de 32 bits) del protocolo: detecta cambios; no es criptográfica. */
export function huellaProtocolo(p: object = PROTOCOLO_D6): string {
  const s = JSON.stringify(p);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export const ESTADO_D6V2 = 'experimental' as const;

// ---------------------------------------------------------------------------------------------------------
// Tipos

export type Nivel = 1 | 2 | 3; // básica, intermedia, desafiante
export const NIVEL_NOMBRE: Record<Nivel, string> = { 1: 'básica', 2: 'intermedia', 3: 'desafiante' };

export interface ItemReferencia {
  mu: number;        // intensidad temporal: media de log T (s) en la referencia, descontada la velocidad personal
  se_mu: number;     // incertidumbre de μ̂_j (σ_j/√n)
  sigma: number;     // desviación residual de log T en ese ítem
  D: number;         // dificultad (logits si es empírica; nivel − 2 si es declarada)
  nivel: Nivel;
  fuente_D: 'empirica' | 'declarada';
  n: number;
}

export interface AmbitoReferencia { asignatura: string; modalidad: 'examen' | 'practica'; telemetria: string }

export interface ReferenciaD6 {
  version: string;   // p. ej. «ref-FG1-2026-10-30»
  protocolo: string; // versión de PROTOCOLO_D6 con que se calibró
  creada: string;
  vigente_hasta?: string;
  descripcion: string;
  ambito: AmbitoReferencia;
  fuente: 'calibrada' | 'provisional';
  items: Record<string, ItemReferencia>;
  D_ref: number;
  tau_alpha: number;
  tau_beta: number;
  pendiente_mu_D: number;  // cuánto crece log T con D en la referencia (= efecto de la insensibilidad completa)
  se_max: number;          // precisión exigida a β̂ (0 = no se puede identificar insensibilidad con esta referencia)
}

/** 'otra_pregunta': la pregunta no estaba activa (el estudiante estaba en otra): se sabe y se descuenta. */
export type TipoIntervalo = 'trabajo' | 'inactividad' | 'pausa_declarada' | 'oculta' | 'desconexion' | 'desconocido' | 'otra_pregunta';
export interface Intervalo { inicio: number; fin: number; tipo: TipoIntervalo } // segundos, reloj del servidor

export interface RespuestaD6 {
  exercise_id: string;
  respondida: boolean;
  correcta: boolean | null;
  intervalos?: Intervalo[];                                 // preferido: se reconstruye el tiempo
  tiempo_s?: number | null;                                 // alternativa: tiempo ya reconstruido
  calidad?: 'observado' | 'parcial' | 'no_observado';       // 'parcial' sin intervalos = no reconstruible
}

// ---------------------------------------------------------------------------------------------------------
// Reconstrucción del tiempo observable de una pregunta

export type EstadoTiempo = 'valido' | 'aproximado' | 'no_reconstruible' | 'sin_datos';
export interface TiempoReconstruido {
  estado: EstadoTiempo; t: number | null; t_min: number; t_max: number;
  trabajo: number; descontado: number; desconocido: number; motivo?: string;
}

export function reconstruirTiempo(intervalos: Intervalo[], p: ProtocoloD6 = PROTOCOLO_D6): TiempoReconstruido {
  const vacio = { t: null, t_min: 0, t_max: 0, trabajo: 0, descontado: 0, desconocido: 0 };
  if (!intervalos.length) return { ...vacio, estado: 'sin_datos' };
  const xs = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  for (let k = 0; k < xs.length; k++) {
    if (!(xs[k].fin >= xs[k].inicio)) return { ...vacio, estado: 'no_reconstruible', motivo: 'intervalo con fin anterior al inicio' };
    if (k && xs[k].inicio < xs[k - 1].fin - 1) return { ...vacio, estado: 'no_reconstruible', motivo: 'intervalos solapados (telemetría inconsistente)' };
  }
  let trabajo = 0, descontado = 0, desconocido = 0;
  for (let k = 0; k < xs.length; k++) {
    const d = xs[k].fin - xs[k].inicio;
    if (k && xs[k].inicio > xs[k - 1].fin + 1) desconocido += xs[k].inicio - xs[k - 1].fin; // hueco sin registro
    switch (xs[k].tipo) {
      case 'trabajo': trabajo += d; break;
      case 'inactividad': trabajo += Math.min(d, p.inactividad_max_s); desconocido += Math.max(0, d - p.inactividad_max_s); break;
      case 'desconocido': desconocido += d; break;
      default: descontado += d; // pausa declarada, pestaña oculta, desconexión, otra pregunta: no es trabajo observable en la pregunta
    }
  }
  const t_min = trabajo, t_max = trabajo + desconocido;
  const base = { t_min, t_max, trabajo, descontado, desconocido };
  if (t_min <= 0) return { ...base, t: null, estado: t_max > 0 ? 'no_reconstruible' : 'sin_datos', motivo: t_max > 0 ? 'sin tiempo de trabajo identificado' : undefined };
  if (desconocido <= 0) return { ...base, t: trabajo, estado: 'valido' };
  if (Math.log(t_max / t_min) <= p.tolerancia_log_reconstruccion) return { ...base, t: Math.sqrt(t_min * t_max), estado: 'aproximado' };
  return { ...base, t: null, estado: 'no_reconstruible', motivo: `tiempo sin clasificar demasiado grande (${Math.round(desconocido)} s de ${Math.round(t_max)} s)` };
}

/** Estrategias alternativas SOLO para estudios comparativos (la de producción es «reconstruir»). */
export type EstrategiaPausas = 'reconstruir' | 'excluir_pregunta' | 'reloj';

function tiempoDe(r: RespuestaD6, estr: EstrategiaPausas, p: ProtocoloD6): TiempoReconstruido {
  if (r.intervalos) {
    if (estr === 'reloj') {
      const ini = Math.min(...r.intervalos.map((x) => x.inicio)), fin = Math.max(...r.intervalos.map((x) => x.fin));
      return fin > ini ? { estado: 'valido', t: fin - ini, t_min: fin - ini, t_max: fin - ini, trabajo: fin - ini, descontado: 0, desconocido: 0 }
        : { estado: 'sin_datos', t: null, t_min: 0, t_max: 0, trabajo: 0, descontado: 0, desconocido: 0 };
    }
    if (estr === 'excluir_pregunta' && r.intervalos.some((x) => x.tipo !== 'trabajo')) {
      return { estado: 'no_reconstruible', t: null, t_min: 0, t_max: 0, trabajo: 0, descontado: 0, desconocido: 0, motivo: 'contiene una pausa (estrategia de exclusión)' };
    }
    return reconstruirTiempo(r.intervalos, p);
  }
  const t = r.tiempo_s ?? null;
  if (t === null || !(t > 0) || r.calidad === 'no_observado') return { estado: 'sin_datos', t: null, t_min: 0, t_max: 0, trabajo: 0, descontado: 0, desconocido: 0 };
  if (r.calidad === 'parcial') return { estado: 'no_reconstruible', t: null, t_min: 0, t_max: 0, trabajo: 0, descontado: 0, desconocido: 0, motivo: 'tiempo parcial sin intervalos' };
  return { estado: 'valido', t, t_min: t, t_max: t, trabajo: t, descontado: 0, desconocido: 0 };
}

// ---------------------------------------------------------------------------------------------------------
// Estados

export type EstadoIdentificacion = 'identificable' | 'contraste_parcial' | 'precision_insuficiente' | 'datos_temporales_invalidos' | 'no_identificable';
export type EstadoD6A = EstadoIdentificacion | 'sin_datos' | 'referencia_no_informativa' | 'referencia_no_aplicable';

export const ESTADO_D6A: Record<EstadoD6A, { titulo: string; explicacion: string }> = {
  identificable: { titulo: 'Sensibilidad identificable', explicacion: 'Tres niveles de dificultad con tiempos válidos y precisión suficiente.' },
  contraste_parcial: { titulo: 'Contraste parcial', explicacion: 'Solo dos niveles con tiempos válidos; precisión suficiente para ese contraste.' },
  precision_insuficiente: { titulo: 'Precisión insuficiente', explicacion: 'Hay niveles distintos, pero la pendiente es demasiado incierta para contrastar.' },
  datos_temporales_invalidos: { titulo: 'Datos temporales inválidos', explicacion: 'El examen cubría niveles distintos, pero sus tiempos no se pudieron reconstruir con fiabilidad.' },
  no_identificable: { titulo: 'Sensibilidad no identificable', explicacion: 'Las preguntas respondidas son de un solo nivel: la relación entre dificultad y tiempo no existe en los datos.' },
  sin_datos: { titulo: 'Sin datos', explicacion: 'Menos de dos preguntas respondidas con calibración en la referencia.' },
  referencia_no_informativa: { titulo: 'Referencia no informativa', explicacion: 'En la referencia el tiempo apenas crece con la dificultad: la insensibilidad no se distingue de la normalidad.' },
  referencia_no_aplicable: { titulo: 'Referencia no aplicable', explicacion: 'No se demostró que la referencia describa a esta cohorte: todos los resultados de la cohorte se abstienen.' },
};

export interface ResultadoD6A {
  estado: EstadoD6A;
  niveles_respondidos: Nivel[]; niveles_validos: Nivel[];
  n_validos: number; n_aproximados: number; n_no_reconstruibles: number; n_sin_tiempo: number; n_omitidas: number; n_sin_referencia: number;
  beta: number | null; se: number | null; ic95: [number, number] | null; z: number | null; p: number | null;
  beta_robusta: number | null; beta_correctas: number | null;
  velocidad: { a: number; se: number } | null; // residuo medio de log T (para la aplicabilidad de D6-B), no se usa en la p individual
  referencia: string; version: string; advertencias: string[];
}

export interface ResultadoD6B {
  estado: 'evaluable' | 'sin_datos' | 'referencia_no_aplicable';
  n_correctas_validas: number; rapidas_correctas: number; esperadas: number; p: number | null;
  k_critico: number | null;     // mínimo de rápidas para p < α con estas preguntas
  rapidas_incorrectas: number; n_incorrectas_validas: number;
  referencia: string; version: string; advertencias: string[];
}

// ---------------------------------------------------------------------------------------------------------
// Utilidades estadísticas

const ln = Math.log;
const Z_ALFA = 1.6448536; // Φ⁻¹(0,95)
const Z_POT = 0.8416212;  // Φ⁻¹(0,80)

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

const fi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

/** Estimador de Huber (propuesta 2): localización y escala robustas con sus errores típicos (sándwich). */
export function huber(z: number[], k = PROTOCOLO_D6.huber_k): { mu: number; s: number; se_mu: number; se_s: number } | null {
  const n = z.length;
  if (n < 3) return null;
  const ord = [...z].sort((a, b) => a - b), med = ord[Math.floor(n / 2)];
  const mad = [...z.map((v) => Math.abs(v - med))].sort((a, b) => a - b)[Math.floor(n / 2)];
  let mu = med, s = 1.4826 * mad || 1;
  const bk = 2 * normalCdf(k) - 1 - 2 * k * fi(k) + 2 * k * k * (1 - normalCdf(k)); // E_Φ[ψ_k(Z)²]
  for (let it = 0; it < 100; it++) {
    const r = z.map((v) => (v - mu) / s), psi = r.map((v) => Math.max(-k, Math.min(k, v)));
    const dentro = r.filter((v) => Math.abs(v) <= k).length / n;
    if (!dentro) break;
    const mu2 = mu + (s * psi.reduce((a, v) => a + v, 0)) / n / dentro;
    const s2 = s * Math.sqrt(psi.reduce((a, v) => a + v * v, 0) / n / bk);
    const fin = Math.abs(mu2 - mu) < 1e-10 && Math.abs(s2 - s) < 1e-10;
    mu = mu2; s = s2;
    if (fin) break;
  }
  const r = z.map((v) => (v - mu) / s), psi = r.map((v) => Math.max(-k, Math.min(k, v)));
  const dentro = r.filter((v) => Math.abs(v) <= k).length / n;
  const m2 = psi.reduce((a, v) => a + v * v, 0) / n;
  const se_mu = (s * Math.sqrt(m2)) / Math.max(dentro, 1e-9) / Math.sqrt(n);
  const er2 = r.reduce((a, v) => a + (Math.abs(v) <= k ? v * v : 0), 0) / n;
  const se_s = (s * Math.sqrt(psi.reduce((a, v) => a + (v * v - bk) ** 2, 0) / n)) / (2 * Math.max(er2, 1e-9)) / Math.sqrt(n);
  return { mu, s, se_mu, se_s };
}

// Cuadratura sobre α ~ N(0, τ_α²): 41 nodos equiespaciados en ±5 desviaciones con pesos normales
const NODOS = (() => {
  const k = 41, out: { x: number; w: number }[] = [];
  let tot = 0;
  for (let i = 0; i < k; i++) { const x = -5 + (10 * i) / (k - 1); const w = Math.exp((-x * x) / 2); out.push({ x, w }); tot += w; }
  return out.map((n) => ({ x: n.x, w: n.w / tot }));
})();

const varItem = (it: ItemReferencia) => it.sigma ** 2 + it.se_mu ** 2;
const umbralRapida = (it: ItemReferencia, ref: ReferenciaD6, p: ProtocoloD6) => -p.z_rapida * Math.sqrt(varItem(it) + ref.tau_alpha ** 2);

/** P(rápida | α) para cada ítem. */
const probsRapida = (items: ItemReferencia[], a: number, ref: ReferenciaD6, p: ProtocoloD6) =>
  items.map((it) => normalCdf((umbralRapida(it, ref, p) - a) / Math.sqrt(varItem(it))));

/** D6-B: P(X ≥ k) integrando α ~ N(desplazamiento, (escala·τ_α)²). Con (0, 1) es la nula de la referencia. */
function colaRapidas(items: ItemReferencia[], k: number, ref: ReferenciaD6, p: ProtocoloD6, desplazamiento = 0, escala = 1) {
  let cola = 0, esperadas = 0;
  for (const n of NODOS) {
    const ps = probsRapida(items, desplazamiento + n.x * escala * ref.tau_alpha, ref, p);
    cola += n.w * poissonBinomialCola(ps, k);
    esperadas += n.w * ps.reduce((s, v) => s + v, 0);
  }
  return { p: Math.min(1, cola), esperadas };
}

// ---------------------------------------------------------------------------------------------------------
// Análisis individual (preliminar: sin la comprobación de aplicabilidad de la cohorte)

export interface OpcionesD6 {
  estrategiaPausas?: EstrategiaPausas;
  protocolo?: ProtocoloD6;
  /** SOLO validación: conserva la p previa a la puerta de aplicabilidad para medir qué evita la abstención. */
  incluirPreliminar?: boolean;
}

export function d6Individual(respuestas: RespuestaD6[], ref: ReferenciaD6, op: OpcionesD6 = {}): { a: ResultadoD6A; b: ResultadoD6B; criticos: ItemReferencia[] } {
  const P = op.protocolo ?? PROTOCOLO_D6, estr = op.estrategiaPausas ?? 'reconstruir';
  const adv: string[] = [];
  let omitidas = 0, sinRef = 0, sinTiempo = 0, noRec = 0, aprox = 0;
  const respondidas: ItemReferencia[] = [];
  const ev: { r: RespuestaD6; it: ItemReferencia; t: number }[] = [];
  const motivos = new Map<string, number>();
  for (const r of respuestas) {
    if (!r.respondida) { omitidas++; continue; }
    const it = ref.items[r.exercise_id];
    if (!it) { sinRef++; continue; }
    respondidas.push(it);
    const t = tiempoDe(r, estr, P);
    if (t.estado === 'sin_datos') { sinTiempo++; continue; }
    if (t.estado === 'no_reconstruible') { noRec++; if (t.motivo) motivos.set(t.motivo, (motivos.get(t.motivo) ?? 0) + 1); continue; }
    if (t.estado === 'aproximado') aprox++;
    ev.push({ r, it, t: t.t! });
  }
  if (omitidas) adv.push(`${omitidas} pregunta(s) sin responder: no se usan ni se cuentan como tiempo 0.`);
  if (sinTiempo) adv.push(`${sinTiempo} respuesta(s) sin tiempo registrado: excluidas (no se imputan).`);
  if (noRec) adv.push(`${noRec} respuesta(s) con tiempo no reconstruible: excluidas (${[...motivos].map(([m, c]) => `${m}: ${c}`).join('; ')}).`);
  if (aprox) adv.push(`${aprox} tiempo(s) reconstruidos con una ambigüedad pequeña (≤ ${Math.round(100 * (Math.exp(P.tolerancia_log_reconstruccion) - 1))} %).`);
  if (sinRef) adv.push(`${sinRef} pregunta(s) sin calibración en la referencia ${ref.version}: excluidas.`);
  const nivResp = [...new Set(respondidas.map((it) => it.nivel))].sort() as Nivel[];
  const nivVal = [...new Set(ev.map((e) => e.it.nivel))].sort() as Nivel[];

  // velocidad general (residuo medio ponderado): solo para la aplicabilidad de D6-B en la cohorte
  let velocidad: ResultadoD6A['velocidad'] = null;
  if (ev.length) {
    const ws = ev.map((e) => 1 / varItem(e.it)), W = ws.reduce((s, w) => s + w, 0);
    velocidad = { a: ev.reduce((s, e, k) => s + ws[k] * (ln(e.t) - e.it.mu), 0) / W, se: Math.sqrt(ref.tau_alpha ** 2 + 1 / W) };
  }

  const base = { niveles_respondidos: nivResp, niveles_validos: nivVal, n_validos: ev.length, n_aproximados: aprox, n_no_reconstruibles: noRec,
    n_sin_tiempo: sinTiempo, n_omitidas: omitidas, n_sin_referencia: sinRef, velocidad, referencia: ref.version, version: P.version };
  const vacio = { beta: null, se: null, ic95: null, z: null, p: null, beta_robusta: null, beta_correctas: null };
  let a: ResultadoD6A;
  if (respondidas.length < 2) {
    a = { ...base, ...vacio, estado: 'sin_datos', advertencias: [...adv, ESTADO_D6A.sin_datos.explicacion] };
  } else if (nivResp.length < 2) {
    a = { ...base, ...vacio, estado: 'no_identificable',
      advertencias: [...adv, `Todas las preguntas respondidas son de nivel ${NIVEL_NOMBRE[nivResp[0]]}: la relación entre dificultad y tiempo NO es identificable (no se asigna ningún valor).`] };
  } else if (nivVal.length < 2) {
    a = { ...base, ...vacio, estado: 'datos_temporales_invalidos',
      advertencias: [...adv, `El examen cubría ${nivResp.length} niveles, pero solo ${nivVal.length ? `el nivel ${NIVEL_NOMBRE[nivVal[0]]} tiene` : 'ninguno tiene'} tiempos válidos: no se calcula la pendiente.`] };
  } else {
    const xs = ev.map((e) => e.it.D - ref.D_ref), ys = ev.map((e) => ln(e.t) - e.it.mu), ws = ev.map((e) => 1 / varItem(e.it));
    const f = mcp(xs, ys, ws);
    if (!f) {
      a = { ...base, ...vacio, estado: 'no_identificable', advertencias: [...adv, 'Las dificultades de las preguntas válidas no varían: pendiente no identificable.'] };
    } else {
      const corr = ev.filter((e) => e.r.correcta === true);
      const fc = new Set(corr.map((e) => e.it.nivel)).size >= 2
        ? mcp(corr.map((e) => e.it.D - ref.D_ref), corr.map((e) => ln(e.t) - e.it.mu), corr.map((e) => 1 / varItem(e.it))) : null;
      const comun = { ...base, beta: f.beta, se: f.se, ic95: [f.beta - 1.96 * f.se, f.beta + 1.96 * f.se] as [number, number],
        beta_robusta: theilSen(xs, ys), beta_correctas: fc?.beta ?? null };
      const extra: string[] = [];
      if (comun.beta_robusta !== null && Math.sign(comun.beta_robusta) !== Math.sign(f.beta) && Math.abs(comun.beta_robusta - f.beta) > f.se) {
        extra.push('La estimación robusta (Theil–Sen) no coincide en signo con la principal: unos pocos tiempos dominan el resultado.');
      }
      if (ref.se_max <= 0) {
        a = { ...comun, z: null, p: null, estado: 'referencia_no_informativa', advertencias: [...adv, ...extra, ESTADO_D6A.referencia_no_informativa.explicacion] };
      } else if (f.se > ref.se_max) {
        a = { ...comun, z: null, p: null, estado: 'precision_insuficiente',
          advertencias: [...adv, ...extra, `Error típico ${f.se.toFixed(2)} > ${ref.se_max.toFixed(2)} (exigido por la calibración actual para una potencia del ${Math.round(100 * P.potencia_objetivo)} %): no se contrasta.`] };
      } else {
        const z = f.beta / Math.sqrt(f.se ** 2 + ref.tau_beta ** 2);
        a = { ...comun, z, p: normalCdf(z), estado: nivVal.length >= 3 ? 'identificable' : 'contraste_parcial',
          advertencias: [...adv, ...extra, ...(nivVal.length === 2 ? [`Contraste parcial entre dos niveles (${nivVal.map((n) => NIVEL_NOMBRE[n]).join(' y ')}).`] : [])] };
      }
    }
  }

  // D6-B: nula de la REFERENCIA (no se estima la velocidad del estudiante)
  const corr = ev.filter((e) => e.r.correcta === true), inc = ev.filter((e) => e.r.correcta === false);
  const rapida = (e: { t: number; it: ItemReferencia }) => ln(e.t) - e.it.mu < umbralRapida(e.it, ref, P);
  const kC = corr.filter(rapida).length, itsC = corr.map((e) => e.it);
  let kCrit: number | null = null;
  if (itsC.length) for (let k = 1; k <= itsC.length; k++) if (colaRapidas(itsC, k, ref, P).p < P.alfa) { kCrit = k; break; }
  const cola = itsC.length ? colaRapidas(itsC, kC, ref, P) : null;
  const b: ResultadoD6B = {
    estado: itsC.length ? 'evaluable' : 'sin_datos', n_correctas_validas: itsC.length, rapidas_correctas: kC, esperadas: cola?.esperadas ?? 0,
    p: cola?.p ?? null, k_critico: kCrit, rapidas_incorrectas: inc.filter(rapida).length, n_incorrectas_validas: inc.length,
    referencia: ref.version, version: P.version,
    advertencias: [...(itsC.length ? [] : ['Sin respuestas correctas con tiempo válido.']),
      'La rapidez personal legítima extrema y las respuestas transcritas o muy entrenadas también son rápidas: es un indicio para revisar, no una prueba.'],
  };
  return { a, b, criticos: itsC };
}

// ---------------------------------------------------------------------------------------------------------
// Aplicabilidad de la referencia a la cohorte (política de abstención)

export interface ContextoCohorte { asignatura: string; modalidad: 'examen' | 'practica'; telemetria: string; fecha: string }

export interface Aplicabilidad {
  aplicable: boolean;
  motivos: string[];                 // por qué no (vacío si aplica)
  n: number;                         // estudiantes que entran en la comprobación
  localizacion: number | null; escala: number | null; li_localizacion: number | null; escala_efectiva: number | null;
  fpr_peor: number | null;           // peor tasa de falsos positivos plausible
}

function contextoAplicable(ref: ReferenciaD6, c: ContextoCohorte, P: ProtocoloD6): string[] {
  const m: string[] = [];
  if (ref.fuente !== 'calibrada') m.push('La referencia es provisional (dificultad declarada o pocos datos por pregunta).');
  if (ref.protocolo !== P.version) m.push(`La referencia se calibró con el protocolo ${ref.protocolo}, no con ${P.version}.`);
  if (ref.ambito.asignatura !== c.asignatura) m.push(`La referencia es de «${ref.ambito.asignatura}», no de «${c.asignatura}».`);
  if (ref.ambito.modalidad !== c.modalidad) m.push(`La referencia es de ${ref.ambito.modalidad}, y esto es ${c.modalidad}.`);
  if (ref.ambito.telemetria !== c.telemetria) m.push(`Telemetría distinta (${ref.ambito.telemetria} frente a ${c.telemetria}): los tiempos no son comparables.`);
  if (ref.vigente_hasta && c.fecha > ref.vigente_hasta) m.push(`La referencia venció el ${ref.vigente_hasta}.`);
  return m;
}

/** Prueba de equivalencia sobre z ~ N(0,1) bajo la referencia; fpr(μ, s) da la tasa de falsos positivos del detector. */
function equivalencia(z: number[], fpr: (mu: number, s: number) => number, P: ProtocoloD6): Omit<Aplicabilidad, 'aplicable' | 'motivos'> & { ok: boolean; motivo?: string } {
  const h = huber(z, P.huber_k);
  if (!h) return { ok: false, n: z.length, localizacion: null, escala: null, li_localizacion: null, escala_efectiva: null, fpr_peor: null, motivo: `Solo ${z.length} estudiante(s) evaluables: no se puede comprobar que la referencia describa a esta cohorte.` };
  const li = h.mu - Z_ALFA * h.se_mu, ls = h.mu + Z_ALFA * h.se_mu;
  const sEff = P.escala_aplicabilidad === 'estimada' ? Math.max(1, h.s) : (h.s - Z_ALFA * h.se_s > 1 ? h.s : 1);
  // el peor extremo del intervalo (para D6-A, el inferior; se evalúan ambos por generalidad)
  const fp = Math.max(fpr(li, sEff), fpr(ls, sEff));
  const ok = fp <= P.fpr_max_aplicabilidad;
  return { ok, n: z.length, localizacion: h.mu, escala: h.s, li_localizacion: li, escala_efectiva: sEff, fpr_peor: fp,
    motivo: ok ? undefined : `La cohorte no es demostrablemente compatible con la referencia: localización ${h.mu.toFixed(2)} (límite ${li.toFixed(2)}), escala ${h.s.toFixed(2)}; falsos positivos en el peor caso plausible ${(100 * fp).toFixed(1)} % > ${(100 * P.fpr_max_aplicabilidad).toFixed(0)} %. Puede ser una población distinta de la de calibración o un problema extendido en la cohorte; estos datos no lo distinguen.` };
}

export interface ResultadoCohorteD6 {
  version: string; protocolo: string; estado_detector: typeof ESTADO_D6V2; referencia: string;
  aplicabilidad: { a: Aplicabilidad; b: Aplicabilidad };
  estudiantes: { id: string; a: ResultadoD6A; b: ResultadoD6B; preliminar?: { pa: number | null; pb: number | null } }[];
}

/** Análisis completo de una cohorte: identificación individual + aplicabilidad de la referencia (abstención colectiva). */
export function analizarCohorteD6(cohorte: { id: string; respuestas: RespuestaD6[] }[], ref: ReferenciaD6, contexto: ContextoCohorte, op: OpcionesD6 = {}): ResultadoCohorteD6 {
  const P = op.protocolo ?? PROTOCOLO_D6;
  const ind = cohorte.map((e) => ({ id: e.id, ...d6Individual(e.respuestas, ref, op) }));
  const ctx = contextoAplicable(ref, contexto, P);

  // D6-A: z de los estudiantes con contraste (identificable o parcial)
  const zA = ind.map((e) => e.a.z).filter((z): z is number => z !== null);
  const eqA = equivalencia(zA, (mu, s) => normalCdf((-Z_ALFA - mu) / s), P);
  // D6-B: velocidad general estandarizada; FPR = media de P(X ≥ k*) con α desplazada/escalada
  const conB = ind.filter((e) => e.a.velocidad && e.b.k_critico !== null);
  const zB = ind.filter((e) => e.a.velocidad).map((e) => e.a.velocidad!.a / e.a.velocidad!.se);
  const tauEff = Math.sqrt(ref.tau_alpha ** 2 + (conB.length ? conB.reduce((s, e) => s + (e.a.velocidad!.se ** 2 - ref.tau_alpha ** 2), 0) / conB.length : 0));
  const fprB = (mu: number, s: number) => (conB.length
    ? conB.reduce((acc, e) => acc + colaRapidas(e.criticos, e.b.k_critico!, ref, P, mu * tauEff, s).p, 0) / conB.length : 1);
  const eqB = equivalencia(zB, fprB, P);

  const ap = (eq: ReturnType<typeof equivalencia>): Aplicabilidad => {
    const { ok, motivo, ...resto } = eq;
    const motivos = [...ctx, ...(ok ? [] : [motivo!])];
    return { aplicable: !motivos.length, motivos, ...resto };
  };
  const apA = ap(eqA), apB = ap(eqB);
  const estudiantes = ind.map(({ id, a, b }) => ({
    id,
    ...(op.incluirPreliminar ? { preliminar: { pa: a.p, pb: b.p } } : {}),
    a: apA.aplicable || a.p === null ? a : { ...a, estado: 'referencia_no_aplicable' as const, z: null, p: null, advertencias: [...a.advertencias, ...apA.motivos] },
    b: apB.aplicable || b.p === null ? b : { ...b, estado: 'referencia_no_aplicable' as const, p: null, advertencias: [...b.advertencias, ...apB.motivos] },
  }));
  return { version: P.version, protocolo: huellaProtocolo(P), estado_detector: ESTADO_D6V2, referencia: ref.version, aplicabilidad: { a: apA, b: apB }, estudiantes };
}

// ---------------------------------------------------------------------------------------------------------
// Calibración de la referencia con una cohorte de CALIBRACIÓN (distinta de la que se investiga)

export interface DatoCalibracion { estudiante: string; exercise_id: string; tiempo_s: number | null; correcta: boolean | null }

export interface OpcionesCalibracion {
  version: string;
  ambito: AmbitoReferencia;
  descripcion?: string;
  dificultad?: Record<string, number>;   // dificultad empírica (logits) si existe; si no, se usa el nivel declarado
  vigente_hasta?: string;
  ahora?: string;
  protocolo?: ProtocoloD6;
}

export function calibrarReferencia(datos: DatoCalibracion[], declarados: Record<string, Nivel>, op: OpcionesCalibracion): ReferenciaD6 {
  const P = op.protocolo ?? PROTOCOLO_D6;
  const conT = datos.filter((d) => d.tiempo_s !== null && d.tiempo_s > 0 && declarados[d.exercise_id] !== undefined)
    .map((d) => ({ e: d.estudiante, j: d.exercise_id, y: ln(d.tiempo_s!) }));
  const porItem = new Map<string, typeof conT>(), porEst = new Map<string, typeof conT>();
  for (const d of conT) {
    if (!porItem.has(d.j)) porItem.set(d.j, []);
    if (!porEst.has(d.e)) porEst.set(d.e, []);
    porItem.get(d.j)!.push(d);
    porEst.get(d.e)!.push(d);
  }
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
    if (xs.length < P.minimo_por_item_referencia || emp === undefined) provisional = true;
    items[j] = { mu: mu.get(j)!, se_mu: sigma / Math.sqrt(xs.length), sigma, D: emp ?? nivel - 2, nivel, fuente_D: emp === undefined ? 'declarada' : 'empirica', n: xs.length };
  }
  const lista = Object.values(items);
  const D_ref = lista.reduce((s, r) => s + r.D, 0) / (lista.length || 1);
  const pend = mcp(lista.map((r) => r.D - D_ref), lista.map((r) => r.mu), lista.map(() => 1));
  const pendiente_mu_D = pend?.beta ?? 0;
  const ests = [...porEst.values()];
  const va = ests.reduce((s, xs) => s + alfa.get(xs[0].e)! ** 2, 0) / Math.max(1, ests.length - 1)
    - ests.reduce((s, xs) => s + xs.reduce((u, d) => u + items[d.j].sigma ** 2, 0) / xs.length ** 2, 0) / (ests.length || 1);
  const tau_alpha = Math.sqrt(Math.max(0, va));
  const betas: { b: number; v: number }[] = [];
  for (const xs of ests) {
    if (new Set(xs.map((d) => items[d.j].nivel)).size < 2) continue;
    const f = mcp(xs.map((d) => items[d.j].D - D_ref), xs.map((d) => d.y - items[d.j].mu), xs.map((d) => 1 / items[d.j].sigma ** 2));
    if (f) betas.push({ b: f.beta, v: f.se ** 2 });
  }
  const mb = betas.reduce((s, x) => s + x.b, 0) / (betas.length || 1);
  const vb = betas.reduce((s, x) => s + (x.b - mb) ** 2, 0) / Math.max(1, betas.length - 1) - betas.reduce((s, x) => s + x.v, 0) / (betas.length || 1);
  const tau_beta = Math.max(0.02, Math.sqrt(Math.max(0, vb)));
  // precisión exigida: |pendiente| / √(SE² + τ²) ≥ z_{1−α} + z_{potencia}
  const objetivo = Math.abs(pendiente_mu_D) / (Z_ALFA + Z_POT);
  const se_max = objetivo > tau_beta ? Math.sqrt(objetivo ** 2 - tau_beta ** 2) : 0;
  return {
    version: op.version, protocolo: P.version, creada: op.ahora ?? new Date().toISOString(), vigente_hasta: op.vigente_hasta, descripcion: op.descripcion ?? '',
    ambito: op.ambito, fuente: provisional ? 'provisional' : 'calibrada', items, D_ref, tau_alpha, tau_beta, pendiente_mu_D, se_max,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Diseño del examen: qué precisión y potencia da un conjunto de preguntas con la calibración ACTUAL.
// No es una regla universal: cambia con la referencia (σ_j, pendiente, τ_β) y con la dificultad de las preguntas.

export interface PreguntaDiseno { D: number; sigma: number; se_mu?: number }

export function precisionDiseno(preguntas: PreguntaDiseno[], ref: Pick<ReferenciaD6, 'tau_beta' | 'pendiente_mu_D' | 'se_max'>, P: ProtocoloD6 = PROTOCOLO_D6) {
  const f = mcp(preguntas.map((q) => q.D), preguntas.map(() => 0), preguntas.map((q) => 1 / (q.sigma ** 2 + (q.se_mu ?? 0) ** 2)));
  if (!f) return { se: null, potencia: null, suficiente: false };
  const potencia = normalCdf(Math.abs(ref.pendiente_mu_D) / Math.sqrt(f.se ** 2 + ref.tau_beta ** 2) - (-normalInv(P.alfa)));
  return { se: f.se, potencia, suficiente: ref.se_max > 0 && f.se <= ref.se_max };
}

function normalInv(p: number): number {
  // Acklam (suficiente para cuantiles de diseño)
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155211954];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(p, 1 - p);
  let x: number;
  if (q < 0.02425) { const t = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1); }
  else { const t = q - 0.5, r = t * t; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); return p < 0.5 ? x : -x; }
  return p < 0.5 ? x : -x;
}
