/**
 * Marco del banco preconstruido del Maratón adaptativo (docs/MARATON_ADAPTATIVO.md §8).
 *
 * ASIGNATURA → TEMA → SUBTEMA → DIFICULTAD → PLANTILLA → VARIANTE.
 * Una plantilla genera variantes numéricas con programación tradicional (sin IA): sortea datos en rangos físicamente
 * válidos y redondeados a la rejilla con que se escriben, calcula las respuestas ANALÍTICAMENTE a partir de esos
 * valores redondeados, y aporta un verificador INDEPENDIENTE (simulación numérica, búsqueda de raíces o planteamiento
 * alternativo) que la validación compara con la respuesta. Este archivo no contiene problemas ni claves: los bancos
 * concretos viven en privado/maraton/<banco>/ (excluido de git), como el resto de las claves del aula.
 */

/**
 * 1–6: niveles ordinarios. 7–9: progresión avanzada (migración 99), problemas de varias ETAPAS sucesivas:
 *  7 razonamiento encadenado · 8 integración de principios · 9 consistencia y generalización.
 */
export type Nivel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const NIVEL_MAX_ORDINARIO = 6;

/** Magnitudes admitidas en las partes de una respuesta (para la comprobación dimensional de la clave). */
export type Magnitud =
  | 'longitud' | 'tiempo' | 'masa' | 'velocidad' | 'aceleracion' | 'fuerza' | 'energia' | 'trabajo'
  | 'momento' | 'impulso' | 'constante_elastica' | 'frecuencia' | 'frecuencia_angular' | 'adimensional'
  | 'porcentaje' | 'entero' | 'aceleracion_angular';

export interface Parte {
  etiqueta: string;
  /** unidad en la que se escribe la clave y que se sugiere al estudiante ('' si es adimensional) */
  unidad: string;
  magnitud: Magnitud;
  /** valor de la respuesta en `unidad` */
  valor: number;
  relTol?: number;
  absTol?: number;
  /** errores típicos (en `unidad`): deben quedar FUERA de la tolerancia para que la respuesta no sea ambigua */
  errores?: { valor: number; mensaje: string }[];
}

export type Datos = Record<string, number>;

/** Etapa 2, 3, … de un problema avanzado: se muestra cuando el estudiante entrega la anterior (sin decirle si acertó). */
export interface Etapa {
  /**
   * Texto de la etapa. Debe poder resolverse con el enunciado inicial, los datos NUEVOS que aquí se dan y los resultados
   * físicos de etapas anteriores; nunca depende de lo que respondió el estudiante (un error suyo no vuelve imposible
   * la etapa: solo arrastra su propio resultado).
   */
  enunciado: string;
  partes: Parte[];
}

export interface Generado {
  /** datos que aparecen en el enunciado o en las etapas (en las unidades en que se escriben) */
  datos: Datos;
  /** enunciado inicial; en un problema por etapas, el contexto y la pregunta de la etapa 1 */
  enunciado: string;
  /** partes de la respuesta (en un problema por etapas, las de la etapa 1) */
  partes: Parte[];
  /** etapas 2…n (solo niveles 7–9; entre 2 y 4, es decir, de 3 a 5 etapas en total) */
  etapas?: Etapa[];
  /** solución desarrollada (Markdown + KaTeX), de todas las etapas */
  solucion: string;
}

/** todas las partes de una variante en orden: etapa 1 y después las demás */
export const partesTodas = (g: Generado): Parte[] => [...g.partes, ...(g.etapas ?? []).flatMap((e) => e.partes)];

/**
 * Datos que admiten la comprobación breve de razonamiento en problemas ordinarios: si solo ese dato se multiplica por
 * uno de los factores, ¿por qué factor queda multiplicado un resultado? El factor exacto lo calcula el verificador
 * independiente con el dato cambiado; se declaran solo datos y factores que mantienen el problema físicamente válido.
 */
export interface Escalable {
  /** descripción en el texto: «la masa del bloque», «la altura desde la que se suelta» */
  nombre: string;
  factores: number[];
}

export interface Plantilla {
  id: string;
  tema: string;
  subtema: string;
  nivel: Nivel;
  titulo: string;
  etiquetas: string[];
  /** fuente curricular (lección, clase, práctica o examen donde se trabajó) */
  fuente: string;
  /** método de verificación independiente, en palabras */
  metodo: string;
  t_min_s: number;
  t_max_s: number;
  /** validada (se puede presentar) o pendiente_revision (construida pero sin evidencia suficiente de haberse impartido) */
  estado?: 'validada' | 'pendiente_revision';
  /** devuelve null si el sorteo no cumple las condiciones físicas (se descarta y se sortea otra vez) */
  generar(r: Rng): Generado | null;
  /** cálculo independiente de cada parte (de TODAS las etapas, en orden) a partir SOLO de los datos (mismas unidades que las partes) */
  verificar(d: Datos): number[];
  /** variantes que se construyen de esta plantilla (por defecto, las del banco: 30) */
  variantes?: number;
  /** datos que admiten la comprobación de razonamiento (solo niveles 1–6; clave = nombre del dato en `datos`) */
  escalables?: Record<string, Escalable>;
  /** tolerancia relativa del verificador (por defecto 0.5 %) */
  tolVerificacion?: number;
}

export interface Tema {
  codigo: string;
  nombre: string;
  unidad: string;
  fuente: string;
  practicas: string;
  examenes: string;
  cobertura: 'alta' | 'media' | 'baja' | 'sin_evidencia';
  estado: 'verificado' | 'pendiente' | 'excluido';
}

export interface Banco {
  id: string;
  nombre: string;
  descripcion: string;
  /** códigos de asignatura (courses.code) que pueden usarlo */
  cursos: string[];
  version: string;
  temas: Tema[];
  plantillas: Plantilla[];
}

// ---------------------------------------------------------------------------
// Azar reproducible (solo en la construcción del banco; en el aula la selección la hace el servidor)
// ---------------------------------------------------------------------------
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

export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  private f: () => number;
  constructor(semilla: number) {
    this.f = mulberry32(semilla);
  }
  u(): number {
    return this.f();
  }
  /** valor de la rejilla min, min+paso, …, max (exacto en decimal) */
  v(min: number, max: number, paso: number): number {
    const n = Math.round((max - min) / paso);
    const k = Math.floor(this.f() * (n + 1));
    const dec = decimales(paso);
    return Number((min + k * paso).toFixed(dec));
  }
  entero(min: number, max: number): number {
    return min + Math.floor(this.f() * (max - min + 1));
  }
  elegir<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.f() * xs.length)];
  }
  signo(): 1 | -1 {
    return this.f() < 0.5 ? 1 : -1;
  }
}

export function decimales(paso: number): number {
  const s = String(paso);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
/** número con `dec` decimales, punto decimal y signo menos tipográfico normal */
export function f(x: number, dec: number): string {
  const s = x.toFixed(dec);
  return s === '-0' || /^-0\.0*$/.test(s) ? s.slice(1) : s;
}

/** número con `cifras` cifras significativas, sin notación exponencial para el rango habitual */
export function sig(x: number, cifras = 4): string {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const dec = Math.max(0, cifras - 1 - e);
  if (e >= 6 || e <= -5) return x.toExponential(cifras - 1);
  return Number(x.toFixed(dec)).toFixed(dec);
}

/** magnitud para la solución: «12.35 m/s» */
export function q(x: number, unidad: string, cifras = 4): string {
  if (!unidad) return sig(x, cifras);
  const u = unidad.replace(/%/g, '\\%').replace(/·/g, '\\cdot ').replace(/²/g, '^2');
  return `${sig(x, cifras)}\\ \\mathrm{${u}}`;
}

/** Problemas de LaTeX en un texto Markdown+KaTeX: delimitadores impares, comandos fuera de $…$ o % sin escapar dentro. */
export function problemasLatex(texto: string): string[] {
  const out: string[] = [];
  const trozos = texto.split(/(?<!\\)\$/);
  if (trozos.length % 2 === 0) out.push('número impar de delimitadores $');
  trozos.forEach((t, i) => {
    if (i % 2 === 0 && /\\(text|mathrm|dfrac|tfrac|sqrt|cdot|Rightarrow|sum|theta|mu|omega|left|right)\b|\\ /.test(t)) out.push(`LaTeX fuera de $…$: «${t.slice(0, 50)}»`);
    if (i % 2 === 1 && /(?<!\\)%/.test(t)) out.push('% sin escapar dentro de una fórmula');
    if (i % 2 === 1 && /[²³·]/.test(t)) out.push('carácter Unicode dentro de una fórmula');
  });
  return out;
}

export const G = 9.8;

// ---------------------------------------------------------------------------
// Verificación numérica independiente
// ---------------------------------------------------------------------------
export interface Estado1D {
  t: number;
  x: number;
  v: number;
}

/**
 * Integra x'' = a(t, x, v) con Runge-Kutta 4 hasta que `parar` se cumpla o se llegue a tMax; la última etapa se
 * refina por bisección del paso para localizar el evento con precisión.
 */
export function rk4(
  a: (t: number, x: number, v: number) => number,
  x0: number,
  v0: number,
  dt: number,
  tMax: number,
  parar?: (s: Estado1D, prev: Estado1D) => boolean,
): Estado1D {
  let s: Estado1D = { t: 0, x: x0, v: v0 };
  const paso = (e: Estado1D, h: number): Estado1D => {
    const k1x = e.v, k1v = a(e.t, e.x, e.v);
    const k2x = e.v + (h / 2) * k1v, k2v = a(e.t + h / 2, e.x + (h / 2) * k1x, e.v + (h / 2) * k1v);
    const k3x = e.v + (h / 2) * k2v, k3v = a(e.t + h / 2, e.x + (h / 2) * k2x, e.v + (h / 2) * k2v);
    const k4x = e.v + h * k3v, k4v = a(e.t + h, e.x + h * k3x, e.v + h * k3v);
    return { t: e.t + h, x: e.x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), v: e.v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v) };
  };
  while (s.t < tMax) {
    const n = paso(s, dt);
    if (parar && parar(n, s)) {
      // bisección del paso para ubicar el evento
      let lo = 0, hi = dt;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (parar(paso(s, mid), s)) hi = mid;
        else lo = mid;
      }
      return paso(s, hi);
    }
    s = n;
  }
  return s;
}

/** integra la aceleración a(t, x, v) con RK4 en exactamente n pasos hasta T (sin eventos) */
export function rk4Fijo(a: (t: number, x: number, v: number) => number, x0: number, v0: number, T: number, n = 4000): Estado1D {
  let s: Estado1D = { t: 0, x: x0, v: v0 };
  const h = T / n;
  for (let i = 0; i < n; i++) {
    const e = s;
    const k1x = e.v, k1v = a(e.t, e.x, e.v);
    const k2x = e.v + (h / 2) * k1v, k2v = a(e.t + h / 2, e.x + (h / 2) * k1x, e.v + (h / 2) * k1v);
    const k3x = e.v + (h / 2) * k2v, k3v = a(e.t + h / 2, e.x + (h / 2) * k2x, e.v + (h / 2) * k2v);
    const k4x = e.v + h * k3v, k4v = a(e.t + h, e.x + h * k3x, e.v + h * k3v);
    s = { t: (i + 1) * h, x: e.x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), v: e.v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v) };
  }
  return s;
}

/** raíz de g en [lo, hi] por bisección (g(lo) y g(hi) con signos opuestos) */
export function biseccion(g: (x: number) => number, lo: number, hi: number, iter = 200): number {
  let glo = g(lo);
  const ghi = g(hi);
  if (glo * ghi > 0) throw new Error(`biseccion: sin cambio de signo en [${lo}, ${hi}]`);
  for (let i = 0; i < iter; i++) {
    const mid = (lo + hi) / 2;
    const gm = g(mid);
    if (gm === 0) return mid;
    if (gm * glo < 0) hi = mid;
    else {
      lo = mid;
      glo = gm;
    }
  }
  return (lo + hi) / 2;
}

/** choque unidimensional resuelto como sistema lineal 2×2 (momento + restitución) por la regla de Cramer */
export function choqueSistema(m1: number, v1: number, m2: number, v2: number, e: number): [number, number] {
  // m1 x + m2 y = m1 v1 + m2 v2 ;  -x + y = e (v1 - v2)
  const a11 = m1, a12 = m2, b1 = m1 * v1 + m2 * v2;
  const a21 = -1, a22 = 1, b2 = e * (v1 - v2);
  const det = a11 * a22 - a12 * a21;
  return [(b1 * a22 - a12 * b2) / det, (a11 * b2 - b1 * a21) / det];
}

/** distancia de frenado simulada con rozamiento cinético constante (paso fino) */
export function frenadoSimulado(v0: number, mu: number, g = G): number {
  const s = rk4((_t, _x, v) => (v > 0 ? -mu * g : 0), 0, v0, 1e-3 * Math.max(0.05, v0 / (mu * g)), 1e4, (n) => n.v <= 0);
  return s.x;
}

// ---------------------------------------------------------------------------
// Dimensiones esperadas por magnitud (en exponentes de m, kg, s)
// ---------------------------------------------------------------------------
export const DIMENSIONES: Record<Magnitud, [number, number, number] | null> = {
  longitud: [1, 0, 0],
  tiempo: [0, 0, 1],
  masa: [0, 1, 0],
  velocidad: [1, 0, -1],
  aceleracion: [1, 0, -2],
  fuerza: [1, 1, -2],
  energia: [2, 1, -2],
  trabajo: [2, 1, -2],
  momento: [1, 1, -1],
  impulso: [1, 1, -1],
  constante_elastica: [0, 1, -2],
  frecuencia: [0, 0, -1],
  frecuencia_angular: [0, 0, -1],
  adimensional: [0, 0, 0],
  porcentaje: [0, 0, 0],
  entero: [0, 0, 0],
  aceleracion_angular: [0, 0, -2],
};
