/**
 * Variantes por intento (claves generadas en el SERVIDOR).
 *
 * Una clave numérica puede declarar `variante: { plantilla, respuesta, unidad, errores? }`. Para cada intento y pregunta:
 *   semilla = hash(intento | pregunta)  →  parámetros válidos (generarVariante, motor de choques)  →  respuesta concreta.
 * El navegador solo recibe los PARÁMETROS (los números del enunciado, que no son secretos); la respuesta y los errores
 * típicos concretos se calculan aquí al calificar y nunca salen del servidor.
 * Los errores típicos son expresiones sobre los parámetros y los resultados de la plantilla (gramática cerrada, sin eval).
 * Un error típico que, con estos números, coincide con la respuesta correcta se descarta para no confundir.
 */
import { generarVariante, PLANTILLAS } from '../fisica/variantes.ts';
import type { NumericKey } from './tipos.ts';

export interface DefVariante { plantilla: string; respuesta: string; unidad: string; errores?: { expresion: string; message: string }[] }

/** FNV-1a de 32 bits: misma semilla para el mismo intento y pregunta, en cualquier entorno. */
export function semillaVariante(attemptId: string, exerciseId: string): number {
  const s = `${attemptId}|${exerciseId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function parametrosVariante(plantilla: string, attemptId: string, exerciseId: string) {
  const v = generarVariante(plantilla, semillaVariante(attemptId, exerciseId));
  return { parametros: v.parametros, respuestas: v.respuestas, semillaUsada: v.semillaUsada };
}

/** Evalúa una expresión con variables (gramática cerrada: números, identificadores, + − * / ^, paréntesis, sqrt, abs). */
export function evaluarVariables(expr: string, vars: Record<string, number>): number {
  const s = expr.replace(/\s+/g, '');
  let i = 0;
  const fallo = (m: string): never => { throw new Error(`Expresión inválida («${expr}»): ${m}`); };
  const suma = (): number => { let v = producto(); while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const w = producto(); v = op === '+' ? v + w : v - w; } return v; };
  const producto = (): number => { let v = unario(); while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const w = unario(); v = op === '*' ? v * w : v / w; } return v; };
  const unario = (): number => (s[i] === '-' ? (i++, -unario()) : s[i] === '+' ? (i++, unario()) : potencia());
  const potencia = (): number => { const b = atomo(); if (s[i] === '^') { i++; return b ** unario(); } return b; };
  const atomo = (): number => {
    if (s[i] === '(') { i++; const v = suma(); if (s[i++] !== ')') fallo('falta «)»'); return v; }
    const num = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    const id = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
    if (!id) fallo(`símbolo inesperado en la posición ${i}`);
    i += id![0].length;
    const nombre = id![0];
    if (nombre === 'sqrt' || nombre === 'abs') { if (s[i++] !== '(') fallo('falta «(»'); const v = suma(); if (s[i++] !== ')') fallo('falta «)»'); return nombre === 'sqrt' ? Math.sqrt(v) : Math.abs(v); }
    // propiedad propia y numérica: «constructor», «toString»… no son variables
    if (!Object.prototype.hasOwnProperty.call(vars, nombre) || typeof vars[nombre] !== 'number') fallo(`variable desconocida «${nombre}»`);
    return vars[nombre];
  };
  const v = suma();
  if (i !== s.length) fallo(`sobra texto en la posición ${i}`);
  return v;
}

/** Número con 3 cifras significativas, sin ceros sobrantes (como se escribiría en una respuesta). */
export const fmtVariante = (x: number) => String(Number(x.toPrecision(3)));

/** Clave concreta para este intento: valor, tolerancia y errores típicos calculados con sus números. */
export function claveConcreta(key: NumericKey, attemptId: string, exerciseId: string): NumericKey {
  const def = key.variante!;
  const { parametros, respuestas } = parametrosVariante(def.plantilla, attemptId, exerciseId);
  const correcta = respuestas[def.respuesta];
  if (!Number.isFinite(correcta)) throw new Error(`La plantilla «${def.plantilla}» no calcula «${def.respuesta}»`);
  const tol = key.relTol ?? 0.02;
  const vars = { ...parametros, ...respuestas, g: 9.8 };
  const commonErrors = (def.errores ?? []).map((e) => ({ v: evaluarVariables(e.expresion, vars), message: e.message }))
    .filter((e) => Number.isFinite(e.v) && Math.abs(e.v - correcta) > Math.max(tol * Math.abs(correcta), 1e-9) * 1.5)
    .map((e) => ({ value: `${fmtVariante(e.v)}${def.unidad ? ` ${def.unidad}` : ''}`, message: e.message }));
  // las alternativas y errores fijos de la clave se refieren a otra versión: no se usan
  return { ...key, value: `${fmtVariante(correcta)}${def.unidad ? ` ${def.unidad}` : ''}`, commonErrors, alternatives: undefined, variante: undefined };
}

/** Comprobaciones para la biblioteca: plantilla, respuesta, errores evaluables y marcadores del enunciado. */
export function validarVariante(def: DefVariante, prompt: string): string[] {
  const errores: string[] = [];
  const P = PLANTILLAS[def.plantilla];
  if (!P) return [`plantilla desconocida «${def.plantilla}»`];
  const v = generarVariante(def.plantilla, 1);
  if (!(def.respuesta in v.respuestas)) errores.push(`la plantilla «${def.plantilla}» no calcula «${def.respuesta}» (calcula: ${Object.keys(v.respuestas).join(', ')})`);
  const nombres = new Set(P.rangos.map((r) => r.nombre));
  for (const m of prompt.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if (!nombres.has(m[1])) errores.push(`el enunciado usa «{{${m[1]}}}», que no es un parámetro de la plantilla`);
  if (!/\{\{\s*\w+\s*\}\}/.test(prompt)) errores.push('el enunciado no tiene marcadores {{parámetro}}: todos verían los mismos números');
  for (const e of def.errores ?? []) {
    try { evaluarVariables(e.expresion, { ...v.parametros, ...v.respuestas, g: 9.8 }); } catch (x) { errores.push(x instanceof Error ? x.message : String(x)); }
  }
  return errores;
}

export { sustituirParametros, tieneParametros } from './marcadores.ts';
