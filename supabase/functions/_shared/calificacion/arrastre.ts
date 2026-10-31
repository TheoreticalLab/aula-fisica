/**
 * Arrastre de errores en problemas por etapas (sin dependencias: Deno y navegador).
 *
 * Si un estudiante se equivoca en la etapa 4 (p. ej. la velocidad tras el choque) y después aplica bien la física en
 * la etapa 6 con SU valor, la etapa 6 no debe contarse como otro error. La clave numérica de la etapa 6 lleva
 * `arrastre: { desde: <slug de la etapa 4>, expresion: 'x^2/(2*0.25*10)' }`; aquí se evalúa la expresión con el
 * valor SI que el estudiante dio en la etapa 4 y, si su respuesta coincide (con la misma tolerancia), se acepta.
 */
import { gradeNumeric, parseQuantity } from './calificar.ts';
import { toSI } from './unidades.ts';
import type { GradeResult, NumericKey } from './tipos.ts';

const FUNCIONES: Record<string, (v: number) => number> = { sqrt: Math.sqrt, abs: Math.abs };

/**
 * Evalúa una expresión aritmética en la variable x. Gramática cerrada (no usa eval): números, x, + − * / ^,
 * paréntesis, sqrt() y abs(). Lanza un error ante cualquier otro símbolo.
 */
export function evaluarExpresion(expr: string, x: number): number {
  const s = expr.replace(/\s+/g, '');
  let i = 0;
  const fallo = (m: string): never => { throw new Error(`Expresión de arrastre inválida («${expr}»): ${m}`); };
  const suma = (): number => {
    let v = producto();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const w = producto(); v = op === '+' ? v + w : v - w; }
    return v;
  };
  const producto = (): number => {
    let v = unario();
    while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const w = unario(); v = op === '*' ? v * w : v / w; }
    return v;
  };
  const unario = (): number => {
    if (s[i] === '-') { i++; return -unario(); }
    if (s[i] === '+') { i++; return unario(); }
    return potencia();
  };
  const potencia = (): number => {
    const b = atomo();
    if (s[i] === '^') { i++; return Math.pow(b, unario()); }   // asociativa por la derecha; -x^2 = -(x^2)
    return b;
  };
  const atomo = (): number => {
    if (s[i] === '(') { i++; const v = suma(); if (s[i++] !== ')') fallo('falta «)»'); return v; }
    if (s[i] === 'x') { i++; return x; }
    const f = /^[a-z]+/.exec(s.slice(i));
    if (f) {
      const fn = FUNCIONES[f[0]];
      if (!fn) fallo(`función desconocida «${f[0]}»`);
      i += f[0].length;
      if (s[i++] !== '(') fallo('falta «(»');
      const v = suma();
      if (s[i++] !== ')') fallo('falta «)»');
      return fn(v);
    }
    const n = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (!n) fallo(`símbolo inesperado en la posición ${i + 1}`);
    i += n![0].length;
    return Number(n![0]);
  };
  if (!s) fallo('vacía');
  const v = suma();
  if (i !== s.length) fallo(`sobra «${s.slice(i)}»`);
  return v;
}

/** Valor SI de una respuesta numérica escrita por el estudiante (null si no se puede leer). */
export function valorRespuestaSI(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const p = parseQuantity(texto);
  if (!p.ok) return null;
  const v = toSI(p.q.value, p.q.unit);
  return Number.isFinite(v) ? v : null;
}

export const MENSAJE_ARRASTRE =
  'Su resultado es coherente con el valor que obtuvo en la etapa anterior: no se penaliza dos veces el mismo error. Revise aquella etapa.';

/**
 * Califica una respuesta numérica considerando el arrastre. `previo` es lo que el estudiante respondió en la etapa
 * `key.arrastre.desde` (texto con unidad), o null si no respondió. Si no hay arrastre, equivale a gradeNumeric.
 */
export function gradeConArrastre(key: NumericKey, raw: string, previo: string | null | undefined): GradeResult {
  const r = gradeNumeric(key, raw);
  if (!key.arrastre || r.status === 'correct' || r.status === 'invalid') return r;
  const x = valorRespuestaSI(previo);
  if (x === null) return r;
  let esperadoSI: number;
  try { esperadoSI = evaluarExpresion(key.arrastre.expresion, x); } catch { return r; }
  if (!Number.isFinite(esperadoSI)) return r;
  // la clave alternativa se escribe en la MISMA unidad que la clave original (misma tolerancia, mismas exigencias)
  const k = parseQuantity(key.value);
  if (!k.ok) return r;
  const unoSI = toSI(1, k.q.unit);
  const valor = `${esperadoSI / unoSI} ${k.q.unitText}`.trim();
  const alternativa: NumericKey = { ...key, value: valor, alternatives: undefined, commonErrors: undefined, arrastre: undefined };
  const r2 = gradeNumeric(alternativa, raw);
  if (r2.status !== 'correct' && r2.status !== 'partial') return r;
  return { ...r2, code: 'arrastre', messages: [MENSAJE_ARRASTRE, ...r2.messages] };
}
