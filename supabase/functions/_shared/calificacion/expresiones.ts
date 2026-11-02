/**
 * Equivalencia de expresiones algebraicas (Prácticas de Control, migración 62).
 *
 * Seguridad: la expresión del estudiante NUNCA se ejecuta como código. Se analiza con un analizador descendente propio
 * (números, variables declaradas, + − · / ^, paréntesis y una lista cerrada de funciones) y se evalúa sobre un árbol.
 * Equivalencia: dos expresiones son equivalentes si coinciden numéricamente en N puntos aleatorios reproducibles del
 * dominio (prueba de identidad polinómica de Schwartz–Zippel, extendida a funciones elementales). No es una prueba
 * simbólica: una coincidencia accidental en todos los puntos es improbable pero no imposible; por eso se usan 8 puntos
 * y una tolerancia relativa estricta.
 * Escritura que se acepta: multiplicación implícita (2t, m g, (a+b)(a−b)), «·» y «×», «−», superíndices ², ³,
 * «√», «π», un prefijo «v =» y nombres pegados de variables declaradas («mgh» con m, g, h).
 */

export interface ExpresionClave {
  /** Expresión de referencia, en la misma sintaxis. */
  esperada: string;
  /** Variables que puede usar el estudiante (p. ej. ["m", "g", "h"]). */
  variables: string[];
  /** Intervalo de muestreo por variable; por defecto [0,5; 3] (positivo: evita raíces de negativos). */
  dominio?: Record<string, [number, number]>;
  /** Tolerancia relativa de la comparación; por defecto 1e-6. */
  tolerancia?: number;
}

type Nodo =
  | { t: 'num'; v: number }
  | { t: 'var'; n: string }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^'; a: Nodo; b: Nodo }
  | { t: 'neg'; a: Nodo }
  | { t: 'fn'; f: string; a: Nodo };

const FUNCIONES: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, sen: Math.sin,
};
const CONSTANTES: Record<string, number> = { pi: Math.PI };
const MAX_LONGITUD = 300;
const MAX_NODOS = 200;

export class ErrorExpresion extends Error {}

function normalizar(s: string): string {
  return s
    .replace(/[−–]/g, '-').replace(/[·×∙⋅]/g, '*').replace(/÷/g, '/')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/π/g, 'pi').replace(/√/g, 'sqrt')
    .replace(/\*\*/g, '^').replace(/,/g, '.')
    .trim()
    // prefijo «v =», «E_p =»… (una sola igualdad al principio)
    .replace(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?=[^=]+$)/, '');
}

type Token = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'sym'; v: string };

function tokenizar(s: string, variables: readonly string[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { out.push({ k: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) { out.push(...separarIdentificador(id[0], variables)); i += id[0].length; continue; }
    if ('+-*/^()'.includes(c)) { out.push({ k: 'sym', v: c }); i++; continue; }
    throw new ErrorExpresion(`Símbolo no permitido: «${c}».`);
  }
  return out;
}

/** «mgh» con variables m, g, h → m·g·h (la variable más larga primero). Funciones y constantes se respetan. */
function separarIdentificador(id: string, variables: readonly string[]): Token[] {
  const propio = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  if (variables.includes(id) || propio(FUNCIONES, id) || propio(CONSTANTES, id)) return [{ k: 'id', v: id }];
  const ordenadas = [...variables, ...Object.keys(CONSTANTES)].sort((a, b) => b.length - a.length);
  const partes: Token[] = [];
  let resto = id;
  while (resto) {
    const v = ordenadas.find((x) => resto.startsWith(x));
    if (!v) throw new ErrorExpresion(`No reconozco «${id}». Variables permitidas: ${variables.join(', ')}.`);
    partes.push({ k: 'id', v });
    resto = resto.slice(v.length);
    const n = /^\d+(\.\d+)?/.exec(resto);           // «t2» no se interpreta: los números pegados a una variable son ambiguos
    if (n) throw new ErrorExpresion(`No reconozco «${id}». Escriba la multiplicación explícitamente.`);
  }
  return partes;
}

function analizar(tokens: Token[], variables: readonly string[]): Nodo {
  let p = 0;
  let nodos = 0;
  const nuevo = <T extends Nodo>(n: T): T => { if (++nodos > MAX_NODOS) throw new ErrorExpresion('Expresión demasiado larga.'); return n; };
  const ver = () => tokens[p];
  const esSym = (v: string) => ver()?.k === 'sym' && ver()!.v === v;
  // ¿puede empezar un factor aquí? (para la multiplicación implícita)
  const empiezaFactor = () => { const t = ver(); return !!t && (t.k === 'num' || t.k === 'id' || (t.k === 'sym' && t.v === '(')); };

  function suma(): Nodo {
    let a = producto();
    while (esSym('+') || esSym('-')) { const op = (tokens[p++] as { v: '+' | '-' }).v; a = nuevo({ t: 'op', op, a, b: producto() }); }
    return a;
  }
  function producto(): Nodo {
    let a = unario();
    for (;;) {
      if (esSym('*') || esSym('/')) { const op = (tokens[p++] as { v: '*' | '/' }).v; a = nuevo({ t: 'op', op, a, b: unario() }); }
      else if (empiezaFactor()) a = nuevo({ t: 'op', op: '*', a, b: potencia() });   // implícita
      else return a;
    }
  }
  function unario(): Nodo {
    if (esSym('-')) { p++; return nuevo({ t: 'neg', a: unario() }); }
    if (esSym('+')) { p++; return unario(); }
    return potencia();
  }
  function potencia(): Nodo {
    const base = primario();
    if (esSym('^')) { p++; return nuevo({ t: 'op', op: '^', a: base, b: unario() }); }   // asociativa por la derecha
    return base;
  }
  function primario(): Nodo {
    const t = tokens[p++];
    if (!t) throw new ErrorExpresion('La expresión está incompleta.');
    if (t.k === 'num') return nuevo({ t: 'num', v: t.v });
    if (t.k === 'id') {
      if (Object.prototype.hasOwnProperty.call(FUNCIONES, t.v)) {
        if (!esSym('(')) throw new ErrorExpresion(`Use paréntesis con ${t.v}(…).`);
        p++;
        const a = suma();
        if (!esSym(')')) throw new ErrorExpresion('Falta cerrar un paréntesis.');
        p++;
        return nuevo({ t: 'fn', f: t.v, a });
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTES, t.v)) return nuevo({ t: 'num', v: CONSTANTES[t.v] });
      if (!variables.includes(t.v)) throw new ErrorExpresion(`No reconozco «${t.v}». Variables permitidas: ${variables.join(', ')}.`);
      return nuevo({ t: 'var', n: t.v });
    }
    if (t.v === '(') {
      const a = suma();
      if (!esSym(')')) throw new ErrorExpresion('Falta cerrar un paréntesis.');
      p++;
      return a;
    }
    throw new ErrorExpresion(`Signo «${t.v}» fuera de lugar.`);
  }
  const raiz = suma();
  if (p < tokens.length) throw new ErrorExpresion('Sobra algo al final de la expresión.');
  return raiz;
}

/** Analiza una expresión con las variables permitidas. Lanza ErrorExpresion con un mensaje para el estudiante. */
export function analizarExpresion(texto: string, variables: readonly string[]): Nodo {
  if (texto.length > MAX_LONGITUD) throw new ErrorExpresion('Expresión demasiado larga.');
  const s = normalizar(texto);
  if (!s) throw new ErrorExpresion('Escriba su expresión.');
  if (/[=<>]/.test(s)) throw new ErrorExpresion('Escriba solo la expresión (sin ecuaciones ni desigualdades).');
  return analizar(tokenizar(s, variables), variables);
}

export function evaluarNodo(n: Nodo, vars: Record<string, number>): number {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return Object.prototype.hasOwnProperty.call(vars, n.n) ? vars[n.n] : NaN;
    case 'neg': return -evaluarNodo(n.a, vars);
    case 'fn': return FUNCIONES[n.f](evaluarNodo(n.a, vars));
    case 'op': {
      const a = evaluarNodo(n.a, vars), b = evaluarNodo(n.b, vars);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
    }
  }
}

/** Generador reproducible (mulberry32): la misma clave y la misma respuesta dan siempre el mismo veredicto. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ResultadoEquivalencia { equivalente: boolean; puntos: number; motivo?: string }

/** Compara dos árboles en puntos aleatorios del dominio. */
export function equivalentes(a: Nodo, b: Nodo, clave: Pick<ExpresionClave, 'variables' | 'dominio' | 'tolerancia'>, semilla = 20261102): ResultadoEquivalencia {
  const rnd = aleatorio(semilla);
  const tol = clave.tolerancia ?? 1e-6;
  let validos = 0;
  for (let intento = 0; intento < 64 && validos < 8; intento++) {
    const vars: Record<string, number> = {};
    for (const v of clave.variables) {
      const [lo, hi] = clave.dominio?.[v] ?? [0.5, 3];
      vars[v] = lo + (hi - lo) * rnd();
    }
    const x = evaluarNodo(a, vars), y = evaluarNodo(b, vars);
    if (!Number.isFinite(y)) continue;                       // punto fuera del dominio de la referencia
    if (!Number.isFinite(x)) return { equivalente: false, puntos: validos, motivo: 'no_definida' };
    if (Math.abs(x - y) > tol * Math.max(1, Math.abs(y))) return { equivalente: false, puntos: validos, motivo: 'distinta' };
    validos++;
  }
  if (validos < 4) return { equivalente: false, puntos: validos, motivo: 'dominio' };
  return { equivalente: true, puntos: validos };
}

export interface ResultadoExpresion { status: 'correct' | 'incorrect' | 'invalid'; credit: number; messages: string[]; code: string }

/** Califica una expresión del estudiante contra la clave. Un error de escritura es «invalid» (no un cero). */
export function calificarExpresion(clave: ExpresionClave, texto: string | undefined): ResultadoExpresion {
  let ref: Nodo;
  try { ref = analizarExpresion(clave.esperada, clave.variables); }
  catch { throw new Error('Clave de expresión mal escrita'); }   // safeGrade la envía a revisión manual
  let alumno: Nodo;
  try { alumno = analizarExpresion(texto ?? '', clave.variables); }
  catch (e) { return { status: 'invalid', credit: 0, messages: [e instanceof ErrorExpresion ? e.message : 'No pude leer la expresión.'], code: 'expr_invalid' }; }
  const r = equivalentes(alumno, ref, clave);
  if (r.equivalente) return { status: 'correct', credit: 1, messages: [], code: 'expr_ok' };
  if (r.motivo === 'dominio') throw new Error('Dominio de muestreo inadecuado para la clave');
  // ¿equivalente salvo el signo?
  if (equivalentes({ t: 'neg', a: alumno }, ref, clave).equivalente) {
    return { status: 'incorrect', credit: 0, messages: ['La expresión tiene el signo contrario al esperado.'], code: 'expr_sign' };
  }
  return { status: 'incorrect', credit: 0, messages: ['La expresión no es equivalente a la esperada.'], code: 'expr_wrong' };
}
