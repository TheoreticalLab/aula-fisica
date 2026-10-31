/**
 * Generador reproducible de versiones numéricas de los problemas de choques.
 *
 * - Semilla → siempre la misma versión (PRNG mulberry32): una pregunta se reconstruye exactamente para auditoría.
 * - Los parámetros se sortean en rangos físicamente válidos y se redondean a la rejilla con que se escriben en el
 *   enunciado; las respuestas se calculan con el motor (choques.ts) A PARTIR DE LOS VALORES REDONDEADOS.
 * - Una versión que viole una regla de validez (resultado irrazonable, choque que no ocurre, cuerpo que no llega
 *   cuando la plantilla exige que llegue…) se descarta y se prueba la semilla siguiente, de forma determinista.
 *
 * Alcance: sirve para generar y auditar versiones en la biblioteca y en las pruebas. La plataforma todavía no sortea
 * una versión distinta para cada intento (eso exigiría generar la clave en el servidor y guardar los parámetros por
 * intento); ver docs/UNIDAD9_CHOQUES.md.
 */
import { caidaHorizontal, choque1D, choque2DAngulos, frenadoHorizontal, rebote, recorrerDistancia, subidaPlano } from './choques';

export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RangoParametro { nombre: string; unidad: string; min: number; max: number; paso: number }

export interface Variante {
  plantilla: string;
  semilla: number;
  /** semilla efectivamente usada (puede ser mayor si se descartaron versiones inválidas) */
  semillaUsada: number;
  parametros: Record<string, number>;
  respuestas: Record<string, number>;
}

interface Plantilla {
  descripcion: string;
  rangos: RangoParametro[];
  calcular: (p: Record<string, number>) => Record<string, number>;
  /** reglas de validez además de que todo sea finito */
  valida: (p: Record<string, number>, r: Record<string, number>) => boolean;
}

const G = 9.8;

export const PLANTILLAS: Record<string, Plantilla> = {
  // Familia A: choque totalmente inelástico y frenado por fricción
  A: {
    descripcion: 'Un cuerpo choca con otro en reposo, quedan unidos y frenan por fricción.',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.5, max: 6, paso: 0.5 },
      { nombre: 'm2', unidad: 'kg', min: 0.5, max: 6, paso: 0.5 },
      { nombre: 'v1', unidad: 'm/s', min: 2, max: 12, paso: 0.5 },
      { nombre: 'mu', unidad: '', min: 0.1, max: 0.6, paso: 0.05 },
    ],
    calcular: ({ m1, m2, v1, mu }) => {
      const c = choque1D(m1, v1, m2, 0, 0), f = frenadoHorizontal(m1 + m2, c.v1f, mu, G);
      return { v: c.v1f, P: c.p_inicial, Ki: c.K_inicial, Kf: c.K_final, dK_choque: -c.delta_K, Ff: f.Ff, a: f.a, t: f.t, d: f.d, W: f.W };
    },
    valida: (_p, r) => r.d > 0.05 && r.d < 60 && r.t < 20,
  },
  // Familia B: quedan unidos y deben recorrer una distancia D: ¿llegan? (la plantilla fija si llegan o no con `llega`)
  B: {
    descripcion: 'Quedan unidos y deslizan hacia un punto a distancia D; se decide si llegan y, si llegan, en cuánto tiempo.',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'm2', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'v1', unidad: 'm/s', min: 3, max: 12, paso: 0.5 },
      { nombre: 'mu', unidad: '', min: 0.1, max: 0.5, paso: 0.05 },
      { nombre: 'D', unidad: 'm', min: 0.5, max: 10, paso: 0.5 },
    ],
    calcular: ({ m1, m2, v1, mu, D }): Record<string, number> => {
      const c = choque1D(m1, v1, m2, 0, 0), r = recorrerDistancia(c.v1f, D, mu, G);
      return r.llega ? { v: c.v1f, llega: 1, t: r.t, v_llegada: r.v } : { v: c.v1f, llega: 0, d_detencion: r.d_detencion, t_detencion: r.t_detencion };
    },
    // descartar los casos «casi en el límite» (llega con v ≈ 0 o se detiene a pocos cm): ambiguos al redondear
    valida: (p, r) => (r.llega ? r.v_llegada > 0.3 : Math.abs(r.d_detencion - p.D) > 0.2),
  },
  // Familia C: quedan unidos y suben por un plano inclinado (con o sin fricción)
  C: {
    descripcion: 'Quedan unidos y suben por un plano inclinado; distancia sobre el plano y altura.',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'm2', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'v1', unidad: 'm/s', min: 2, max: 10, paso: 0.5 },
      { nombre: 'theta', unidad: '°', min: 15, max: 45, paso: 5 },
      { nombre: 'mu', unidad: '', min: 0, max: 0.4, paso: 0.05 },
    ],
    calcular: ({ m1, m2, v1, theta, mu }) => {
      const c = choque1D(m1, v1, m2, 0, 0), s = subidaPlano(c.v1f, theta, mu, G);
      return { v: c.v1f, s: s.s, h: s.h, a: s.a };
    },
    // con fricción, el bloque debe quedarse arriba (μs no se da: se exige μk < tan θ para que el modelo «se detiene
    // y vuelve a bajar» o «se queda» no cambie lo que se pide, que es solo la subida)
    valida: (p, r) => r.s > 0.05 && r.s < 30 && p.mu < Math.tan((p.theta * Math.PI) / 180),
  },
  // Familia D: choque sobre una plataforma y caída
  D: {
    descripcion: 'Quedan unidos en el borde de una plataforma de altura h y caen.',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.1, max: 2, paso: 0.1 },
      { nombre: 'm2', unidad: 'kg', min: 0.1, max: 2, paso: 0.1 },
      { nombre: 'v1', unidad: 'm/s', min: 1, max: 8, paso: 0.5 },
      { nombre: 'h', unidad: 'm', min: 0.5, max: 3, paso: 0.1 },
    ],
    calcular: ({ m1, m2, v1, h }) => {
      const c = choque1D(m1, v1, m2, 0, 0), k = caidaHorizontal(c.v1f, h, G);
      return { v: c.v1f, t: k.t, alcance: k.alcance, v_suelo: k.v, angulo: k.angulo_bajo_horizontal };
    },
    valida: (_p, r) => r.alcance > 0.05,
  },
  // Familia E: sentidos opuestos (signo de P aleatorio: positivo, negativo o casi nulo se clasifican)
  E: {
    descripcion: 'Dos cuerpos con sentidos opuestos chocan y quedan unidos.',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'm2', unidad: 'kg', min: 0.5, max: 5, paso: 0.5 },
      { nombre: 'v1', unidad: 'm/s', min: 1, max: 8, paso: 0.5 },
      { nombre: 'v2', unidad: 'm/s', min: -8, max: -1, paso: 0.5 },
    ],
    calcular: ({ m1, m2, v1, v2 }) => {
      const c = choque1D(m1, v1, m2, v2, 0);
      return { P: c.p_inicial, v: c.v1f, Ki: c.K_inicial, Kf: c.K_final, dK: -c.delta_K };
    },
    valida: () => true,
  },
  // Familia G: pelota que rebota (fuerza neta media frente a fuerza media del suelo)
  G: {
    descripcion: 'Una pelota cae desde h₁ y rebota con coeficiente e; contacto de duración Δt.',
    rangos: [
      { nombre: 'm', unidad: 'kg', min: 0.05, max: 0.6, paso: 0.05 },
      { nombre: 'h1', unidad: 'm', min: 0.5, max: 3, paso: 0.1 },
      { nombre: 'e', unidad: '', min: 0.3, max: 0.9, paso: 0.05 },
      { nombre: 'dt', unidad: 's', min: 0.005, max: 0.05, paso: 0.005 },
    ],
    calcular: ({ m, h1, e, dt }) => {
      const r = rebote(m, h1, e, G, dt);
      return { v_antes: r.v_antes, v_despues: r.v_despues, h2: r.h2, J: r.J, F_neta: r.F_neta_media!, F_suelo: r.F_suelo_media! };
    },
    valida: () => true,
  },
  // Familia L: choque en 2D con ángulos de salida
  L: {
    descripcion: 'El cuerpo 1 llega por +x contra el 2 en reposo; salen con ángulos α₁ (arriba) y α₂ (abajo).',
    rangos: [
      { nombre: 'm1', unidad: 'kg', min: 0.5, max: 3, paso: 0.5 },
      { nombre: 'm2', unidad: 'kg', min: 0.5, max: 3, paso: 0.5 },
      { nombre: 'v1', unidad: 'm/s', min: 2, max: 10, paso: 0.5 },
      { nombre: 'a1', unidad: '°', min: 15, max: 60, paso: 5 },
      { nombre: 'a2', unidad: '°', min: 15, max: 60, paso: 5 },
    ],
    calcular: ({ m1, m2, v1, a1, a2 }) => {
      const c = choque2DAngulos(m1, v1, m2, a1, a2);
      return { u1: c.u1, u2: c.u2, Ki: c.K_inicial, Kf: c.K_final };
    },
    // sin «creación» de energía cinética: K final ≤ K inicial (si no, los ángulos son físicamente imposibles)
    valida: (_p, r) => r.Kf <= r.Ki * (1 + 1e-9),
  },
};

const enRejilla = (x: number, r: RangoParametro) => {
  const n = Math.round((x - r.min) / r.paso);
  return Number((r.min + n * r.paso).toFixed(6));
};

/** Versión determinista de una plantilla para una semilla. Lanza un error si 1000 semillas seguidas fueran inválidas. */
export function generarVariante(plantilla: string, semilla: number): Variante {
  const P = PLANTILLAS[plantilla];
  if (!P) throw new Error(`Plantilla desconocida «${plantilla}»`);
  for (let k = 0; k < 1000; k++) {
    const rnd = mulberry32(semilla + k);
    const parametros: Record<string, number> = {};
    for (const r of P.rangos) parametros[r.nombre] = enRejilla(r.min + rnd() * (r.max - r.min), r);
    const respuestas = P.calcular(parametros);
    if (Object.values(respuestas).every(Number.isFinite) && P.valida(parametros, respuestas)) {
      return { plantilla, semilla, semillaUsada: semilla + k, parametros, respuestas };
    }
  }
  throw new Error(`Sin versión válida de «${plantilla}» a partir de la semilla ${semilla}`);
}
