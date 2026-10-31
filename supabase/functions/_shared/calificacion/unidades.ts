/**
 * Unidades físicas: lectura de expresiones como «m/s^2», «kg·m/s», «J/(kg·K)» o «km/h»,
 * conversión al SI y comprobación de dimensiones.
 *
 * Dimensiones: vector de exponentes de las 7 magnitudes básicas del SI
 * [masa (kg), longitud (m), tiempo (s), corriente (A), temperatura (K), cantidad (mol), intensidad luminosa (cd)].
 *
 * Reglas de escritura:
 *  - Multiplicación con «·», «*», «.» entre letras o espacio; división con «/».
 *  - Todo lo que va después de la primera «/» pertenece al denominador: «J/kg·K» = J/(kg·K).
 *  - Exponentes con ^n, ^-n, superíndices o dígitos pegados (m2 = m²).
 *  - Los paréntesis solo agrupan y se ignoran (bajo la regla anterior no cambian el resultado).
 */
import { normalizeSuperscripts } from './numeros.ts';

export type Dims = [number, number, number, number, number, number, number];

export const DIM_NAMES = ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'] as const;

const D = (kg = 0, m = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0): Dims => [kg, m, s, A, K, mol, cd];

export interface UnitDef {
  factor: number; // valor en SI de 1 unidad
  dims: Dims;
  offset?: number; // solo temperaturas absolutas: T(K) = factor·valor + offset
  prefixable: boolean;
}

// Nota: el gramo es la unidad con prefijos de masa; «kg» se obtiene como k + g.
export const UNITS: Record<string, UnitDef> = {
  m: { factor: 1, dims: D(0, 1), prefixable: true },
  g: { factor: 1e-3, dims: D(1), prefixable: true },
  s: { factor: 1, dims: D(0, 0, 1), prefixable: true },
  A: { factor: 1, dims: D(0, 0, 0, 1), prefixable: true },
  K: { factor: 1, dims: D(0, 0, 0, 0, 1), prefixable: true },
  mol: { factor: 1, dims: D(0, 0, 0, 0, 0, 1), prefixable: true },
  cd: { factor: 1, dims: D(0, 0, 0, 0, 0, 0, 1), prefixable: false },
  min: { factor: 60, dims: D(0, 0, 1), prefixable: false },
  h: { factor: 3600, dims: D(0, 0, 1), prefixable: false },
  N: { factor: 1, dims: D(1, 1, -2), prefixable: true },
  J: { factor: 1, dims: D(1, 2, -2), prefixable: true },
  W: { factor: 1, dims: D(1, 2, -3), prefixable: true },
  Pa: { factor: 1, dims: D(1, -1, -2), prefixable: true },
  Hz: { factor: 1, dims: D(0, 0, -1), prefixable: true },
  C: { factor: 1, dims: D(0, 0, 1, 1), prefixable: true },
  V: { factor: 1, dims: D(1, 2, -3, -1), prefixable: true },
  L: { factor: 1e-3, dims: D(0, 3), prefixable: true },
  l: { factor: 1e-3, dims: D(0, 3), prefixable: true },
  t: { factor: 1000, dims: D(1), prefixable: false }, // tonelada métrica
  atm: { factor: 101325, dims: D(1, -1, -2), prefixable: false },
  bar: { factor: 1e5, dims: D(1, -1, -2), prefixable: true },
  mmHg: { factor: 133.322387415, dims: D(1, -1, -2), prefixable: false },
  cal: { factor: 4.184, dims: D(1, 2, -2), prefixable: true },
  eV: { factor: 1.602176634e-19, dims: D(1, 2, -2), prefixable: true },
  rad: { factor: 1, dims: D(), prefixable: true },
  '°': { factor: Math.PI / 180, dims: D(), prefixable: false },
  rev: { factor: 2 * Math.PI, dims: D(), prefixable: false },
  rpm: { factor: (2 * Math.PI) / 60, dims: D(0, 0, -1), prefixable: false },
  '%': { factor: 0.01, dims: D(), prefixable: false },
  u: { factor: 1, dims: D(), prefixable: false }, // unidad genérica de los vectores del simulador
  ft: { factor: 0.3048, dims: D(0, 1), prefixable: false },
  in: { factor: 0.0254, dims: D(0, 1), prefixable: false },
  yd: { factor: 0.9144, dims: D(0, 1), prefixable: false },
  mi: { factor: 1609.344, dims: D(0, 1), prefixable: false },
  mph: { factor: 0.44704, dims: D(0, 1, -1), prefixable: false },
  lb: { factor: 0.45359237, dims: D(1), prefixable: false },
  '°C': { factor: 1, dims: D(0, 0, 0, 0, 1), offset: 273.15, prefixable: false },
  '°F': { factor: 5 / 9, dims: D(0, 0, 0, 0, 1), offset: 273.15 - (32 * 5) / 9, prefixable: false },
};

/** Sinónimos frecuentes que se reescriben antes de leer. */
const ALIASES: Record<string, string> = {
  seg: 's', segs: 's', sec: 's', segundo: 's', segundos: 's',
  metro: 'm', metros: 'm', mts: 'm', mt: 'm',
  kilogramo: 'kg', kilogramos: 'kg', kgs: 'kg', gramos: 'g', gramo: 'g',
  newton: 'N', newtons: 'N', julio: 'J', julios: 'J', joule: 'J', joules: 'J', watt: 'W', vatio: 'W', vatios: 'W', watts: 'W',
  hora: 'h', horas: 'h', hr: 'h', hrs: 'h', minuto: 'min', minutos: 'min', mins: 'min',
  grado: '°', grados: '°', deg: '°', 'º': '°',
  kph: 'km/h', kmh: 'km/h', 'k/h': 'km/h', lt: 'L', litro: 'L', litros: 'L',
  '°K': 'K', 'ºC': '°C', 'ºF': '°F',
};

const PREFIXES: Record<string, number> = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
};

export interface ParsedUnit {
  factor: number;
  dims: Dims;
  /** Desplazamiento (solo si la unidad completa es °C o °F sin exponente). */
  offset: number;
  /** true si la expresión es una sola unidad de temperatura con desplazamiento (°C, °F). */
  isAffineTemperature: boolean;
  /** true si no hay unidad (número puro). */
  empty: boolean;
}

export class UnitError extends Error {}

function lookupSymbol(sym: string): { factor: number; def: UnitDef } | null {
  const direct = UNITS[sym];
  if (direct) return { factor: direct.factor, def: direct };
  // prefijo + unidad (el prefijo de 2 letras «da» primero)
  for (const plen of [2, 1]) {
    const p = sym.slice(0, plen);
    const u = sym.slice(plen);
    if (u && PREFIXES[p] !== undefined && UNITS[u]?.prefixable) {
      return { factor: PREFIXES[p] * UNITS[u].factor, def: UNITS[u] };
    }
  }
  return null;
}

function addDims(a: Dims, b: Dims, k: number): Dims {
  return a.map((x, i) => x + k * b[i]) as Dims;
}

/** Lee una expresión de unidades. Lanza UnitError con un mensaje en español si no se entiende. */
export function parseUnit(raw: string): ParsedUnit {
  let s = normalizeSuperscripts(raw.trim());
  s = s.replace(/[−]/g, '-').replace(/[⋅•∙]/g, '·').replace(/º/g, '°');
  if (s === '') return { factor: 1, dims: D(), offset: 0, isAffineTemperature: false, empty: true };
  const whole = ALIASES[s] ?? ALIASES[s.toLowerCase()];
  if (whole) s = whole;
  // temperatura con desplazamiento: solo como unidad aislada
  if (s === '°C' || s === '°F') {
    const u = UNITS[s];
    return { factor: u.factor, dims: [...u.dims] as Dims, offset: u.offset ?? 0, isAffineTemperature: true, empty: false };
  }
  // paréntesis: se eliminan (regla «todo tras / va al denominador»)
  s = s.replace(/[()[\]]/g, ' ');
  const slash = s.indexOf('/');
  const parts = slash >= 0 ? [s.slice(0, slash), s.slice(slash + 1).replace(/\//g, ' ')] : [s];
  let factor = 1;
  let dims = D();
  parts.forEach((part, idx) => {
    const sign = idx === 0 ? 1 : -1;
    const tokens = part
      .split(/[·*\s]+|(?<=[a-zA-Z°%])\.(?=[a-zA-Z°])/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (idx === 0 && tokens.length === 1 && tokens[0] === '1') return; // «1/s»
    if (tokens.length === 0) throw new UnitError(idx === 0 ? 'Falta la unidad antes de «/».' : 'Falta la unidad después de «/».');
    for (const tok of tokens) {
      const m = /^([A-Za-zµμ°%Ω]+?)(?:\^?\s*([+-]?\d+))?$/.exec(tok);
      if (!m) throw new UnitError(`No reconozco «${tok}» como unidad.`);
      let sym = m[1];
      const exp = m[2] !== undefined ? Number(m[2]) : 1;
      if (ALIASES[sym]) sym = ALIASES[sym];
      if (sym === 'km/h') {
        factor *= Math.pow(1000 / 3600, sign * exp);
        dims = addDims(dims, D(0, 1, -1), sign * exp);
        continue;
      }
      const found = lookupSymbol(sym);
      if (!found) throw new UnitError(`No reconozco «${sym}» como unidad.`);
      factor *= Math.pow(found.factor, sign * exp);
      dims = addDims(dims, found.def.dims, sign * exp);
    }
  });
  return { factor, dims, offset: 0, isAffineTemperature: false, empty: false };
}

/**
 * Normalización PEDAGÓGICA de mayúsculas/minúsculas (p. ej. «j» → «J»). No es una equivalencia del SI: «j» no es
 * el símbolo del julio. Solo se aplica cuando la unidad escrita NO tiene lectura propia (parseUnit falla), y solo si
 * todas las formas de escribirla cambiando mayúsculas que tienen las dimensiones esperadas dan EXACTAMENTE la misma
 * unidad (mismo factor). Si hay más de una lectura posible (p. ej. «mj»: mJ o MJ, que difieren 10⁹), es ambigua y no
 * se acepta. Devuelve la escritura correcta o null.
 */
export function normalizarMayusculas(raw: string, esperadas: Dims): { texto: string; unidad: ParsedUnit } | { ambigua: string[] } | null {
  const s = raw.trim();
  const letras = [...s].map((c, i) => (/[a-zA-Z]/.test(c) ? i : -1)).filter((i) => i >= 0);
  if (!letras.length || letras.length > 10) return null;
  const vistas = new Map<string, { texto: string; unidad: ParsedUnit }>();
  for (let mask = 0; mask < 1 << letras.length; mask++) {
    const cs = [...s];
    letras.forEach((pos, b) => { cs[pos] = mask & (1 << b) ? cs[pos].toUpperCase() : cs[pos].toLowerCase(); });
    const texto = cs.join('');
    if (texto === s) continue;
    try {
      const u = parseUnit(texto);
      if (u.empty || !sameDims(u.dims, esperadas)) continue;
      const clave = `${u.factor.toPrecision(12)}|${u.isAffineTemperature}`;
      if (!vistas.has(clave)) vistas.set(clave, { texto, unidad: u });
    } catch {
      /* esta variante no es una unidad */
    }
  }
  if (vistas.size === 1) return [...vistas.values()][0];
  if (vistas.size > 1) return { ambigua: [...vistas.values()].map((v) => v.texto) };
  return null;
}

export function sameDims(a: Dims, b: Dims): boolean {
  return a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
}

export function isDimensionless(d: Dims): boolean {
  return d.every((x) => Math.abs(x) < 1e-9);
}

const NAMED_DIMS: { dims: Dims; name: string }[] = [
  { dims: D(), name: 'una cantidad adimensional (o un ángulo)' },
  { dims: D(0, 1), name: 'una longitud' },
  { dims: D(0, 2), name: 'un área' },
  { dims: D(0, 3), name: 'un volumen' },
  { dims: D(1), name: 'una masa' },
  { dims: D(0, 0, 1), name: 'un tiempo' },
  { dims: D(0, 0, -1), name: 'una frecuencia (o velocidad angular)' },
  { dims: D(0, 1, -1), name: 'una velocidad' },
  { dims: D(0, 1, -2), name: 'una aceleración' },
  { dims: D(1, 1, -2), name: 'una fuerza' },
  { dims: D(1, 2, -2), name: 'una energía (o trabajo)' },
  { dims: D(1, 2, -3), name: 'una potencia' },
  { dims: D(1, 1, -1), name: 'una cantidad de movimiento (o impulso)' },
  { dims: D(1, -1, -2), name: 'una presión' },
  { dims: D(1, -3), name: 'una densidad' },
  { dims: D(1, 0, -2), name: 'una constante elástica (N/m)' },
  { dims: D(0, 0, 0, 0, 1), name: 'una temperatura' },
  { dims: D(0, 2, -2, 0, -1), name: 'un calor específico' },
  { dims: D(1, 2, -2, 0, -1), name: 'una capacidad calorífica' },
  { dims: D(0, 0, 0, 0, 0, 1), name: 'una cantidad de sustancia' },
];

export function describeDims(d: Dims): string {
  const named = NAMED_DIMS.find((n) => sameDims(n.dims, d));
  if (named) return named.name;
  return `una magnitud con unidades SI ${formatDims(d)}`;
}

/** Unidad SI equivalente, p. ej. «kg·m/s^2». */
export function formatDims(d: Dims): string {
  const num: string[] = [];
  const den: string[] = [];
  d.forEach((e, i) => {
    if (Math.abs(e) < 1e-9) return;
    const abs = Math.abs(e);
    const t = DIM_NAMES[i] + (abs === 1 ? '' : `^${abs}`);
    (e > 0 ? num : den).push(t);
  });
  if (!num.length && !den.length) return '(adimensional)';
  return (num.length ? num.join('·') : '1') + (den.length ? '/' + den.join('·') : '');
}

/** Convierte un valor expresado en la unidad dada al SI. */
export function toSI(value: number, unit: ParsedUnit, interval = false): number {
  if (unit.isAffineTemperature && !interval) return value * unit.factor + unit.offset;
  return value * unit.factor;
}
