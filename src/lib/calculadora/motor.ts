/**
 * Motor de la calculadora científica integrada. Analizador propio (Pratt) con lista blanca de símbolos:
 * no usa eval ni new Function y no puede ejecutar código, solo números, operadores, funciones y constantes listadas.
 * Se ejecuta en el navegador; nunca consulta al servidor. Probado en tests/calculadora.test.ts.
 */

export type ModoAngulo = 'DEG' | 'RAD';
export type Resultado = { ok: true; valor: number; texto: string } | { ok: false; error: string };

export const LIMITES = { longitud: 200, simbolos: 160, profundidad: 32, factorial: 170 } as const;

class ErrorCalculo extends Error {}

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: ','; v: ',' };

// Funciones permitidas: nombre → número de argumentos. Cualquier otro identificador es un error.
const FUNCIONES: Record<string, number> = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  log: 1, ln: 1, exp: 1, sqrt: 1, cbrt: 1, abs: 1, root: 2,
};
const CONSTANTES = new Set(['pi', 'e', 'ans']);

/** Normaliza los símbolos de los botones a la sintaxis interna. */
export function normalizar(expr: string): string {
  return expr
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt')
    .replace(/sin⁻¹/g, 'asin').replace(/cos⁻¹/g, 'acos').replace(/tan⁻¹/g, 'atan')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/\s+/g, '');
}

function tokenizar(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[0-9.]/.test(c)) {
      // notación científica con «E» MAYÚSCULA (botón EXP): 3.0E8, 1.6E-19. La «e» minúscula es la constante de Euler.
      const m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/.exec(src.slice(i));
      if (!m || /^\./.test(src.slice(i + m[0].length))) throw new ErrorCalculo('Número mal escrito');
      const txt = m[0];
      const v = Number(txt);
      if (!Number.isFinite(v)) throw new ErrorCalculo('Número demasiado grande');
      out.push({ t: 'num', v });
      i += txt.length;
      continue;
    }
    if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(src.slice(i))!;
      if (m[0] === 'E') throw new ErrorCalculo('Escriba el exponente después de E (por ejemplo, 3E8)');
      out.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    if ('+-*/^%!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(', v: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')', v: ')' }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: ',', v: ',' }); i++; continue; }
    throw new ErrorCalculo(`Símbolo no permitido: «${c}»`);
  }
  return out;
}

/** Separa nombres pegados («sinpi», «2pi») en funciones y constantes conocidas; si sobra algo, error. */
function separarIdentificadores(tokens: Token[]): Token[] {
  const conocidos = [...Object.keys(FUNCIONES), ...CONSTANTES].sort((a, b) => b.length - a.length);
  const out: Token[] = [];
  for (const tk of tokens) {
    if (tk.t !== 'id') { out.push(tk); continue; }
    let resto = tk.v;
    while (resto) {
      const k = conocidos.find((n) => resto.startsWith(n));
      if (!k) throw new ErrorCalculo(`Función o constante desconocida: «${resto}»`);
      out.push({ t: 'id', v: k });
      resto = resto.slice(k.length);
    }
  }
  return out;
}

const empiezaFactor = (tk: Token | undefined) => !!tk && (tk.t === 'num' || tk.t === 'id' || tk.t === '(');
const terminaFactor = (tk: Token | undefined) => !!tk && (tk.t === 'num' || tk.t === ')' || (tk.t === 'id' && CONSTANTES.has(tk.v)) || (tk.t === 'op' && (tk.v === '!' || tk.v === '%')));

/** Multiplicación implícita: 2π, 2(3), (1)(2), 3sin(…), π e. */
function insertarImplicita(tokens: Token[]): Token[] {
  const out: Token[] = [];
  tokens.forEach((tk, i) => {
    if (i > 0 && terminaFactor(tokens[i - 1]) && empiezaFactor(tk)) out.push({ t: 'op', v: '*' });
    out.push(tk);
  });
  return out;
}

interface Ctx { modo: ModoAngulo; ans: number }

function aRad(x: number, modo: ModoAngulo) { return modo === 'DEG' ? (x * Math.PI) / 180 : x; }
function deRad(x: number, modo: ModoAngulo) { return modo === 'DEG' ? (x * 180) / Math.PI : x; }
const limpiar = (x: number) => (Math.abs(x) < 1e-13 ? 0 : x);

function trig(f: 'sin' | 'cos' | 'tan', x: number, modo: ModoAngulo): number {
  if (modo === 'DEG') {
    // ángulos notables exactos: evita 1.2e-16 en sin(180°) y el «infinito» falso de tan(90°)
    const r = ((x % 360) + 360) % 360;
    if (f === 'sin' && (r === 0 || r === 180)) return 0;
    if (f === 'cos' && (r === 90 || r === 270)) return 0;
    if (f === 'tan' && (r === 90 || r === 270)) throw new ErrorCalculo('Fuera de dominio: la tangente no está definida en ese ángulo');
    if (f === 'tan' && (r === 0 || r === 180)) return 0;
  }
  const a = aRad(x, modo);
  const v = f === 'sin' ? Math.sin(a) : f === 'cos' ? Math.cos(a) : Math.tan(a);
  if (f === 'tan' && Math.abs(v) > 1e15) throw new ErrorCalculo('Fuera de dominio: la tangente no está definida en ese ángulo');
  return limpiar(v);
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new ErrorCalculo('Fuera de dominio: el factorial solo se define para enteros no negativos');
  if (n > LIMITES.factorial) throw new ErrorCalculo(`El factorial admite hasta ${LIMITES.factorial}`);
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

function potencia(b: number, x: number): number {
  if (b === 0 && x < 0) throw new ErrorCalculo('División entre cero');
  if (b < 0 && !Number.isInteger(x)) {
    // raíz impar de un negativo (p. ej. (−8)^(1/3)): se admite si 1/x es un entero impar
    const n = 1 / x;
    if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) % 2 !== 0) return -Math.pow(-b, x);
    throw new ErrorCalculo('Fuera de dominio: potencia no real');
  }
  return Math.pow(b, x);
}

function aplicar(nombre: string, args: number[], ctx: Ctx): number {
  const [x, y] = args;
  switch (nombre) {
    case 'sin': case 'cos': case 'tan': return trig(nombre, x, ctx.modo);
    case 'asin': case 'acos':
      if (x < -1 || x > 1) throw new ErrorCalculo('Fuera de dominio: el argumento debe estar entre −1 y 1');
      return limpiar(deRad(nombre === 'asin' ? Math.asin(x) : Math.acos(x), ctx.modo));
    case 'atan': return deRad(Math.atan(x), ctx.modo);
    case 'log': case 'ln':
      if (x <= 0) throw new ErrorCalculo('Fuera de dominio: el logaritmo requiere un número positivo');
      return nombre === 'log' ? Math.log10(x) : Math.log(x);
    case 'exp': return Math.exp(x);
    case 'sqrt':
      if (x < 0) throw new ErrorCalculo('Fuera de dominio: raíz cuadrada de un número negativo');
      return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'abs': return Math.abs(x);
    case 'root': {
      // root(índice, radicando)
      if (!Number.isFinite(x) || x === 0) throw new ErrorCalculo('Fuera de dominio: índice de la raíz no válido');
      if (y < 0 && !(Number.isInteger(x) && Math.abs(x) % 2 === 1)) throw new ErrorCalculo('Fuera de dominio: raíz par de un número negativo');
      return y < 0 ? -Math.pow(-y, 1 / x) : Math.pow(y, 1 / x);
    }
  }
  throw new ErrorCalculo('Función no permitida');
}

/** Analizador de Pratt sobre la lista de tokens ya validada. */
class Analizador {
  private i = 0;
  private prof = 0;
  constructor(private tk: Token[], private ctx: Ctx) {}

  analizar(): number {
    if (!this.tk.length) throw new ErrorCalculo('Escriba una operación');
    const v = this.expr(0);
    if (this.i < this.tk.length) throw new ErrorCalculo('Error de sintaxis');
    return v;
  }

  private ver() { return this.tk[this.i]; }
  private tomar() { return this.tk[this.i++]; }
  private esperar(t: Token['t']) {
    const x = this.tomar();
    if (!x || x.t !== t) throw new ErrorCalculo(t === ')' ? 'Falta cerrar un paréntesis' : 'Error de sintaxis');
  }

  // precedencias: + − (10) · × ÷ (20) · signo (30) · ^ (40, derecha) · ! % (50, sufijos)
  private expr(minimo: number): number {
    if (++this.prof > LIMITES.profundidad) throw new ErrorCalculo('Operación demasiado anidada');
    let izq = this.prefijo();
    for (;;) {
      const op = this.ver();
      if (!op || op.t !== 'op') break;
      if (op.v === '!' || op.v === '%') {
        if (50 < minimo) break;
        this.tomar();
        izq = op.v === '!' ? factorial(izq) : izq / 100;
        continue;
      }
      const prec = op.v === '+' || op.v === '-' ? 10 : op.v === '*' || op.v === '/' ? 20 : 40;
      if (prec < minimo) break;
      this.tomar();
      const der = this.expr(op.v === '^' ? prec : prec + 1);
      if (op.v === '+') izq += der;
      else if (op.v === '-') izq -= der;
      else if (op.v === '*') izq *= der;
      else if (op.v === '/') { if (der === 0) throw new ErrorCalculo('División entre cero'); izq /= der; }
      else izq = potencia(izq, der);
    }
    this.prof--;
    return izq;
  }

  private prefijo(): number {
    const x = this.tomar();
    if (!x) throw new ErrorCalculo('La operación está incompleta');
    if (x.t === 'num') return x.v;
    if (x.t === 'op' && (x.v === '-' || x.v === '+')) {
      const v = this.expr(30);
      return x.v === '-' ? -v : v;
    }
    if (x.t === '(') {
      const v = this.expr(0);
      this.esperar(')');
      return v;
    }
    if (x.t === 'id') {
      if (x.v === 'pi') return Math.PI;
      if (x.v === 'e') return Math.E;
      if (x.v === 'ans') return this.ctx.ans;
      const n = FUNCIONES[x.v];
      if (n === undefined) throw new ErrorCalculo('Función no permitida');
      if (this.ver()?.t !== '(') throw new ErrorCalculo(`Escriba ${x.v}( … ) con paréntesis`);
      this.tomar();
      const args = [this.expr(0)];
      while (this.ver()?.t === ',') { this.tomar(); args.push(this.expr(0)); }
      this.esperar(')');
      if (args.length !== n) throw new ErrorCalculo(n === 2 ? `${x.v}(índice, número) lleva dos argumentos` : `${x.v} lleva un solo argumento`);
      return aplicar(x.v, args, this.ctx);
    }
    throw new ErrorCalculo('Error de sintaxis');
  }
}

/** Formato de salida: hasta 12 cifras significativas, notación científica para valores muy grandes o pequeños. */
export function formatear(x: number): string {
  if (Object.is(x, -0) || x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e12 || a < 1e-6) {
    const [m, e] = x.toExponential(10).split('e');
    return `${String(Number(m))}E${Number(e)}`;
  }
  return String(Number(x.toPrecision(12)));
}

export function evaluar(expr: string, opciones: { modo?: ModoAngulo; ans?: number } = {}): Resultado {
  try {
    if (expr.length > LIMITES.longitud) throw new ErrorCalculo(`La operación es demasiado larga (máximo ${LIMITES.longitud} caracteres)`);
    const tokens = insertarImplicita(separarIdentificadores(tokenizar(normalizar(expr))));
    if (tokens.length > LIMITES.simbolos) throw new ErrorCalculo('La operación es demasiado larga');
    const valor = new Analizador(tokens, { modo: opciones.modo ?? 'DEG', ans: opciones.ans ?? 0 }).analizar();
    if (!Number.isFinite(valor)) throw new ErrorCalculo('Resultado demasiado grande');
    return { ok: true, valor, texto: formatear(valor) };
  } catch (e) {
    if (e instanceof ErrorCalculo) return { ok: false, error: e.message };
    return { ok: false, error: 'Error de cálculo' };
  }
}
