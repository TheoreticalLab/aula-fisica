/**
 * Motor físico de choques (Física General 1). Lógica pura, unidades SI, una dimensión con signo salvo donde se indica.
 * Lo usan el Laboratorio de choques (simulación), las soluciones de referencia de los ejercicios y las pruebas.
 *
 * Principios y dónde se aplican:
 *  · Cantidad de movimiento p = m v (vector; en 1D el signo indica el sentido). Se conserva en el CHOQUE porque el
 *    impulso externo durante el contacto, breve, es despreciable. NO se conserva durante un deslizamiento con fricción
 *    (impulso externo −μk m g Δt en el sentido opuesto al movimiento).
 *  · Coeficiente de restitución e = −(v2' − v1')/(v2 − v1) ∈ [0, 1]: 1 elástico, 0 totalmente inelástico (quedan unidos).
 *  · Energía cinética K = ½ m v². En un choque inelástico DISMINUYE: se transforma en energía interna, deformación,
 *    vibraciones y sonido. La energía total no desaparece.
 *  · Fricción cinética Ff = μk N. En horizontal, mientras desliza: a = −μk g · signo(v). Al detenerse, se detiene
 *    (no se extrapola el movimiento: con μs ≥ μk sigue en reposo).
 */

export const G_POR_DEFECTO = 9.8;

const cuadrado = (x: number) => x * x;
export const energiaCinetica = (m: number, v: number) => 0.5 * m * v * v;

export interface ResultadoChoque {
  v1f: number; v2f: number;
  p_inicial: number; p_final: number;
  K_inicial: number; K_final: number;
  delta_K: number;                     // K_final − K_inicial (≤ 0)
  J1: number; J2: number;              // impulso sobre cada cuerpo (J1 = −J2)
  tipo: 'elastico' | 'totalmente_inelastico' | 'parcialmente_inelastico';
}

/** Choque frontal en 1D con coeficiente de restitución e. */
export function choque1D(m1: number, v1: number, m2: number, v2: number, e: number): ResultadoChoque {
  if (!(m1 > 0 && m2 > 0)) throw new Error('Las masas deben ser positivas');
  if (!(e >= 0 && e <= 1)) throw new Error('El coeficiente de restitución debe estar entre 0 y 1');
  const M = m1 + m2, p = m1 * v1 + m2 * v2;
  const v1f = (p + m2 * e * (v2 - v1)) / M;
  const v2f = (p + m1 * e * (v1 - v2)) / M;
  const Ki = energiaCinetica(m1, v1) + energiaCinetica(m2, v2), Kf = energiaCinetica(m1, v1f) + energiaCinetica(m2, v2f);
  return {
    v1f, v2f, p_inicial: p, p_final: m1 * v1f + m2 * v2f, K_inicial: Ki, K_final: Kf, delta_K: Kf - Ki,
    J1: m1 * (v1f - v1), J2: m2 * (v2f - v2),
    tipo: e === 1 ? 'elastico' : e === 0 ? 'totalmente_inelastico' : 'parcialmente_inelastico',
  };
}

/** ¿Llegan a chocar? (el cuerpo 1 a la izquierda del 2): solo si se acercan. */
export const seAcercan = (v1: number, v2: number) => v1 > v2;

export interface Frenado { Ff: number; a: number; t: number; d: number; W: number; impulso: number }

/** Deslizamiento horizontal con fricción cinética uniforme hasta detenerse (no se extrapola después). */
export function frenadoHorizontal(m: number, v0: number, mu: number, g = G_POR_DEFECTO): Frenado {
  if (!(m > 0) || !(mu >= 0) || !(g > 0)) throw new Error('Parámetros inválidos');
  if (v0 === 0) return { Ff: 0, a: 0, t: 0, d: 0, W: 0, impulso: 0 };
  const s = Math.sign(v0);
  const Ff = mu * m * g;                          // módulo
  if (mu === 0) return { Ff: 0, a: 0, t: Infinity, d: Infinity, W: 0, impulso: 0 };
  const a = -s * mu * g;                          // opuesta al movimiento
  const t = Math.abs(v0) / (mu * g);
  const d = cuadrado(v0) / (2 * mu * g);          // distancia (módulo)
  return { Ff, a, t, d, W: -Ff * d, impulso: -s * Ff * t };   // impulso = −m v0
}

/** Posición y velocidad en el instante t de un deslizamiento con fricción que empieza en x0 con v0 (se detiene y queda quieto). */
export function deslizar(x0: number, v0: number, mu: number, g: number, t: number): { x: number; v: number; detenido: boolean } {
  if (v0 === 0 || mu === 0) return { x: x0 + v0 * t, v: v0, detenido: v0 === 0 };
  const s = Math.sign(v0), tp = Math.abs(v0) / (mu * g);
  if (t >= tp) return { x: x0 + s * cuadrado(v0) / (2 * mu * g), v: 0, detenido: true };
  const a = -s * mu * g;
  return { x: x0 + v0 * t + 0.5 * a * t * t, v: v0 + a * t, detenido: false };
}

/**
 * Recorrer una distancia D con fricción partiendo con rapidez v0: ¿llega? Si llega, tiempo y velocidad al llegar
 * (la raíz físicamente válida: el primer paso por D). Si se detiene antes, lo dice y da dónde.
 */
export function recorrerDistancia(v0: number, D: number, mu: number, g = G_POR_DEFECTO):
  { llega: true; t: number; v: number } | { llega: false; d_detencion: number; t_detencion: number } {
  const v = Math.abs(v0), a = mu * g;
  const dmax = a === 0 ? Infinity : v * v / (2 * a);
  if (D > dmax + 1e-12) return { llega: false, d_detencion: dmax, t_detencion: v / a };
  const vf = Math.sqrt(Math.max(0, v * v - 2 * a * D));
  return { llega: true, t: a === 0 ? D / v : (v - vf) / a, v: vf };
}

/** Subida por un plano inclinado (ángulo θ en grados) con fricción cinética μ, partiendo con rapidez v0 en la base. */
export function subidaPlano(v0: number, thetaGrados: number, mu = 0, g = G_POR_DEFECTO) {
  const th = (thetaGrados * Math.PI) / 180;
  const a = g * (Math.sin(th) + mu * Math.cos(th));          // desaceleración al subir
  const s = (v0 * v0) / (2 * a);                              // distancia sobre el plano
  const h = s * Math.sin(th);                                 // altura vertical (≠ distancia)
  return { a: -a, s, h, t: v0 / a, W_friccion: -mu * Math.cos(th) * g * s, /* por unidad de masa */ };
}

/** Caída desde una plataforma de altura h saliendo horizontalmente con rapidez vx. */
export function caidaHorizontal(vx: number, h: number, g = G_POR_DEFECTO) {
  const t = Math.sqrt((2 * h) / g), vy = g * t;
  return { t, alcance: vx * t, vy, v: Math.hypot(vx, vy), angulo_bajo_horizontal: (Math.atan2(vy, vx) * 180) / Math.PI };
}

/** Pelota que cae desde h1 y rebota con coeficiente e (suelo fijo). Signo positivo hacia arriba. */
export function rebote(m: number, h1: number, e: number, g = G_POR_DEFECTO, dt_contacto?: number) {
  const v_antes = -Math.sqrt(2 * g * h1), v_despues = -e * v_antes;
  const J = m * (v_despues - v_antes);                         // impulso NETO sobre la pelota (hacia arriba)
  const h2 = (v_despues * v_despues) / (2 * g);
  const r = { v_antes, v_despues, h2, J, F_neta_media: null as number | null, F_suelo_media: null as number | null };
  if (dt_contacto && dt_contacto > 0) {
    r.F_neta_media = J / dt_contacto;                          // ΔP/Δt
    r.F_suelo_media = J / dt_contacto + m * g;                 // N − mg = F neta → N = F neta + mg
  }
  return r;
}

/** e a partir de las alturas de caída y de rebote. */
export const restitucionPorAlturas = (h1: number, h2: number) => Math.sqrt(h2 / h1);

/** Compresión máxima de un resorte (k) que frena a una masa m con rapidez v (sin fricción). */
export const compresionResorte = (m: number, v: number, k: number) => Math.abs(v) * Math.sqrt(m / k);

/** Impulso y fuerza media. */
export const impulsoDeFuerza = (F: number, dt: number) => F * dt;
export const fuerzaMedia = (m: number, vi: number, vf: number, dt: number) => (m * (vf - vi)) / dt;

/**
 * Modelo de contacto declarado: pulso semisinusoidal F(t) = (πJ / 2Δt) sen(πt/Δt) en 0 ≤ t ≤ Δt. Su área es J.
 * Solo el impulso lo fijan las leyes de conservación; la forma y la duración son hipótesis del modelo.
 */
export function pulsoContacto(J: number, dt: number, n = 60) {
  const pico = (Math.PI * J) / (2 * dt);
  const puntos = Array.from({ length: n + 1 }, (_, i) => {
    const t = (dt * i) / n;
    return { t, F: pico * Math.sin((Math.PI * t) / dt) };
  });
  return { pico, media: J / dt, puntos };
}

/**
 * Choque en 2D: el cuerpo 1 llega por +x con v1 contra el 2 en reposo; después, el 1 sale con ángulo α1 (sobre +x) y
 * el 2 con ángulo α2 (bajo +x, ángulos en grados, positivos). Conservación por componentes → rapideces finales.
 */
export function choque2DAngulos(m1: number, v1: number, m2: number, alfa1: number, alfa2: number) {
  const a1 = (alfa1 * Math.PI) / 180, a2 = (alfa2 * Math.PI) / 180;
  // x: m1 v1 = m1 u1 cos a1 + m2 u2 cos a2 ;  y: 0 = m1 u1 sin a1 − m2 u2 sin a2
  const u1 = (v1 * Math.sin(a2)) / Math.sin(a1 + a2);
  const u2 = (m1 * u1 * Math.sin(a1)) / (m2 * Math.sin(a2));
  const Ki = energiaCinetica(m1, v1), Kf = energiaCinetica(m1, u1) + energiaCinetica(m2, u2);
  return { u1, u2, px: m1 * u1 * Math.cos(a1) + m2 * u2 * Math.cos(a2), py: m1 * u1 * Math.sin(a1) - m2 * u2 * Math.sin(a2), K_inicial: Ki, K_final: Kf };
}

/** Choque totalmente inelástico en 2D (quedan unidos): velocidad del conjunto. */
export function choque2DUnidos(m1: number, v1x: number, v1y: number, m2: number, v2x: number, v2y: number) {
  const M = m1 + m2, vx = (m1 * v1x + m2 * v2x) / M, vy = (m1 * v1y + m2 * v2y) / M;
  return { vx, vy, v: Math.hypot(vx, vy), angulo: (Math.atan2(vy, vx) * 180) / Math.PI };
}

// ---------------------------------------------------------------------------------------------------------
// Laboratorio: simulación temporal en dos etapas (A: aproximación y choque; B: movimiento posterior con fricción)

export interface ParamsLaboratorio {
  m1: number; m2: number; v1: number; v2: number; e: number;
  mu: number;                 // fricción cinética después del choque (0 = sin fricción)
  g: number;
  separacion: number;         // distancia inicial entre los bordes (m)
  ancho?: number;             // ancho de cada bloque (m), para dibujar
}

export interface Muestra { t: number; x1: number; x2: number; v1: number; v2: number; p1: number; p2: number; K1: number; K2: number; etapa: 'A' | 'B' }

export interface Simulacion {
  choca: boolean;
  t_choque: number | null;
  choque: ResultadoChoque | null;
  frenado1: Frenado | null; frenado2: Frenado | null;
  muestras: Muestra[];
  t_fin: number;
  /** Energía cinética transformada durante el choque y durante el deslizamiento (J, positivas) */
  transformada_choque: number; transformada_deslizamiento: number;
}

/**
 * Simulación determinista: los bloques se acercan sin fricción (etapa A: superficie lisa antes del choque) y, tras el
 * choque instantáneo, deslizan sobre la superficie con fricción μ (etapa B) hasta detenerse. Un solo choque.
 */
export function simularLaboratorio(p: ParamsLaboratorio, dt = 0.01): Simulacion {
  const w = p.ancho ?? 0.4;
  const x1_0 = 0, x2_0 = w + p.separacion;
  const choca = seAcercan(p.v1, p.v2) && p.separacion >= 0;
  const t_choque = choca ? p.separacion / (p.v1 - p.v2) : null;
  const ch = choca ? choque1D(p.m1, p.v1, p.m2, p.v2, p.e) : null;
  const unidos = !!ch && p.e === 0;
  // unidos: un solo cuerpo de masa m1 + m2 (la fuerza y el trabajo de fricción dependen de la masa total)
  const f1 = ch ? frenadoHorizontal(unidos ? p.m1 + p.m2 : p.m1, ch.v1f, p.mu, p.g) : null;
  const f2 = ch ? (unidos ? f1 : frenadoHorizontal(p.m2, ch.v2f, p.mu, p.g)) : null;
  const tB = f1 && f2 ? Math.max(f1.t, f2.t) : 0;
  const t_fin = t_choque === null ? 4 : t_choque + (Number.isFinite(tB) ? tB : 4) + 0.5;
  const muestras: Muestra[] = [];
  const pasos = Math.min(4000, Math.ceil(t_fin / dt));
  for (let k = 0; k <= pasos; k++) {
    const t = Math.min(t_fin, k * dt);
    let x1: number, x2: number, v1: number, v2: number, etapa: 'A' | 'B';
    if (t_choque === null || t < t_choque) {
      x1 = x1_0 + p.v1 * t; x2 = x2_0 + p.v2 * t; v1 = p.v1; v2 = p.v2; etapa = 'A';
    } else {
      const tc = t - t_choque, xc1 = x1_0 + p.v1 * t_choque, xc2 = x2_0 + p.v2 * t_choque;
      const a = deslizar(xc1, ch!.v1f, p.mu, p.g, tc), b = unidos ? { x: a.x + w, v: a.v } : deslizar(xc2, ch!.v2f, p.mu, p.g, tc);
      x1 = a.x; x2 = b.x; v1 = a.v; v2 = b.v; etapa = 'B';
    }
    muestras.push({ t, x1, x2, v1, v2, p1: p.m1 * v1, p2: p.m2 * v2, K1: energiaCinetica(p.m1, v1), K2: energiaCinetica(p.m2, v2), etapa });
  }
  const tc = ch ? -ch.delta_K : 0;
  return {
    choca, t_choque, choque: ch, frenado1: f1, frenado2: unidos ? null : f2, muestras, t_fin,
    transformada_choque: tc, transformada_deslizamiento: ch && p.mu > 0 ? ch.K_final : 0,
  };
}
