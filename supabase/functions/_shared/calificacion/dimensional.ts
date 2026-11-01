/**
 * Evaluación de una expresión con DIMENSIONES (análisis dimensional), en unidades SI.
 * Misma gramática cerrada que las variantes (sin eval): números, variables, + − * / ^, paréntesis, la constante pi y
 * las funciones sqrt, abs, sin, cos, tan, asin, acos, atan, exp, ln, log10.
 *  - Sumar o restar exige las mismas dimensiones.
 *  - El exponente de ^ debe ser adimensional y constante; sqrt exige dimensiones pares.
 *  - Las funciones trigonométricas, exponenciales y logarítmicas exigen argumento adimensional (los ángulos en SI son
 *    radianes, adimensionales).
 * Sirve para rechazar fórmulas físicamente incoherentes antes de guardar una clave.
 */
import type { Dims } from './unidades.ts';

export interface Cantidad { v: number; d: Dims }
const CERO: Dims = [0, 0, 0, 0, 0, 0, 0];
const iguales = (a: Dims, b: Dims) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const adimensional = (d: Dims) => iguales(d, CERO);
const sumar = (a: Dims, b: Dims, s = 1) => a.map((x, i) => x + s * b[i]) as Dims;

export class ErrorDimensional extends Error {}

export function evaluarConDimensiones(expr: string, vars: Record<string, Cantidad>): Cantidad {
  const s = expr.replace(/\s+/g, '');
  let i = 0;
  const fallo = (m: string): never => { throw new ErrorDimensional(`«${expr}»: ${m}`); };
  const suma = (): Cantidad => {
    let a = producto();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++]; const b = producto();
      if (!iguales(a.d, b.d)) fallo('suma o resta de magnitudes con dimensiones distintas');
      a = { v: op === '+' ? a.v + b.v : a.v - b.v, d: a.d };
    }
    return a;
  };
  const producto = (): Cantidad => {
    let a = unario();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++]; const b = unario();
      a = op === '*' ? { v: a.v * b.v, d: sumar(a.d, b.d) } : { v: a.v / b.v, d: sumar(a.d, b.d, -1) };
    }
    return a;
  };
  const unario = (): Cantidad => {
    if (s[i] === '-') { i++; const a = unario(); return { v: -a.v, d: a.d }; }
    if (s[i] === '+') { i++; return unario(); }
    return potencia();
  };
  const potencia = (): Cantidad => {
    const b = atomo();
    if (s[i] !== '^') return b;
    i++;
    const e = unario();
    if (!adimensional(e.d)) fallo('el exponente debe ser adimensional');
    return { v: b.v ** e.v, d: b.d.map((x) => x * e.v) as Dims };
  };
  const atomo = (): Cantidad => {
    if (s[i] === '(') { i++; const v = suma(); if (s[i++] !== ')') fallo('falta «)»'); return v; }
    const num = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { i += num[0].length; return { v: Number(num[0]), d: CERO }; }
    const id = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
    if (!id) fallo(`símbolo inesperado en la posición ${i}`);
    i += id![0].length;
    const nombre = id![0];
    const FUN: Record<string, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, exp: Math.exp, ln: Math.log, log10: Math.log10 };
    // propiedad PROPIA: «constructor», «toString»… no son funciones admitidas
    if (nombre === 'sqrt' || nombre === 'abs' || Object.prototype.hasOwnProperty.call(FUN, nombre)) {
      if (s[i++] !== '(') fallo('falta «(»');
      const a = suma();
      if (s[i++] !== ')') fallo('falta «)»');
      if (nombre === 'abs') return { v: Math.abs(a.v), d: a.d };
      if (nombre === 'sqrt') {
        if (a.d.some((x) => Math.abs(x / 2 - Math.round(x / 2)) > 1e-9)) fallo('raíz de una magnitud con dimensiones impares');
        return { v: Math.sqrt(a.v), d: a.d.map((x) => x / 2) as Dims };
      }
      if (!adimensional(a.d)) fallo(`${nombre}() necesita un argumento adimensional`);
      return { v: FUN[nombre](a.v), d: CERO };
    }
    if (nombre === 'pi') return { v: Math.PI, d: CERO };
    if (!Object.prototype.hasOwnProperty.call(vars, nombre)) fallo(`variable desconocida «${nombre}»`);
    return vars[nombre];
  };
  const r = suma();
  if (i !== s.length) fallo(`sobra texto en la posición ${i}`);
  if (!Number.isFinite(r.v)) fallo('el resultado no es un número finito');
  return r;
}
