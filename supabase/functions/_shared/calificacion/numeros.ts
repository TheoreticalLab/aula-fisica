/**
 * Lectura de números escritos por estudiantes.
 *
 * Acepta: 25, -4.9, −4.9 (signo menos tipográfico), +3, 3.0e8, 3,0E8 (coma decimal),
 * 1.5×10^3, 1.5x10^3, 1.5*10^3, 1.5·10^3, 1.5×10³, 1.5 × 10^-3, 10^5, .5
 * Si aparecen punto y coma a la vez, el último separador es el decimal (1.234,5 o 1,234.5).
 * No acepta separadores de miles con espacio (ambiguo con la unidad).
 */

export interface ParsedNumber {
  value: number;
  /** Mantisa tal como se escribió (solo dígitos y separador decimal), para contar cifras significativas. */
  mantissa: string;
  /** Texto que sobra después del número (la unidad, normalmente). */
  rest: string;
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

export function normalizeSuperscripts(s: string): string {
  return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPTS[c]).join(''));
}

/** Normaliza signos y espacios sin tocar la estructura. */
export function normalizeInput(raw: string): string {
  return raw
    .replace(/[−‒–—]/g, '-') // signos menos tipográficos
    .replace(/ | | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDecimal(m: string): string | null {
  const hasDot = m.includes('.');
  const hasComma = m.includes(',');
  if (hasDot && hasComma) {
    const last = Math.max(m.lastIndexOf('.'), m.lastIndexOf(','));
    const dec = m[last];
    const thousands = dec === '.' ? ',' : '.';
    const intPart = m.slice(0, last);
    // los separadores de miles deben agrupar de 3 en 3
    if (!/^\d{1,3}([.,]\d{3})*$/.test(intPart) || intPart.includes(dec)) return null;
    return intPart.split(thousands).join('') + '.' + m.slice(last + 1);
  }
  if (hasComma) {
    if ((m.match(/,/g) || []).length > 1) return null;
    return m.replace(',', '.');
  }
  if ((m.match(/\./g) || []).length > 1) return null;
  return m;
}

const NUMBER_RE =
  /^([+-])?\s*(\d+(?:[.,]\d+)*(?:[.,]\d*)?|[.,]\d+)?(?:\s*(?:[eE]\s*([+-]?\d+)|\s*[×xX*·]\s*10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?))?/;

/** Interpreta el número inicial de `raw`. Devuelve null si no hay número. */
export function parseLeadingNumber(raw: string): ParsedNumber | null {
  const s = normalizeSuperscripts(normalizeInput(raw));
  // caso «10^5» sin mantisa
  const pow = /^([+-])?\s*10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?/.exec(s);
  if (pow) {
    const sign = pow[1] === '-' ? -1 : 1;
    return { value: sign * Math.pow(10, Number(pow[2])), mantissa: '1', rest: s.slice(pow[0].length).trim() };
  }
  const m = NUMBER_RE.exec(s);
  if (!m || !m[2]) return null;
  const mant = normalizeDecimal(m[2]);
  if (mant === null) return null;
  const exp = m[3] ?? m[4];
  const sign = m[1] === '-' ? -1 : 1;
  const base = Number(mant.startsWith('.') ? '0' + mant : mant);
  if (!Number.isFinite(base)) return null;
  const value = sign * base * (exp !== undefined ? Math.pow(10, Number(exp)) : 1);
  if (!Number.isFinite(value)) return null;
  // Si la «x» de ×10^n no llegó a casar, el resto podría empezar por «x10»: no es unidad válida, se detecta después.
  return { value, mantissa: mant, rest: s.slice(m[0].length).trim() };
}

/**
 * Cifras significativas de una mantisa decimal.
 * Devuelve un intervalo porque los ceros finales de un entero sin punto son ambiguos (1500 → 2 a 4).
 */
export function countSigFigs(mantissa: string): { min: number; max: number } {
  let m = mantissa.replace(',', '.');
  if (m.startsWith('.')) m = '0' + m;
  const [intPart, fracPart = undefined] = m.split('.') as [string, string | undefined];
  const digits = (intPart + (fracPart ?? '')).replace(/^0+/, '');
  if (digits === '') {
    // el número es cero: cuentan los ceros tras el punto (0.00 → 2), como mínimo 1
    const n = Math.max(1, fracPart?.length ?? 1);
    return { min: n, max: n };
  }
  if (fracPart !== undefined) {
    return { min: digits.length, max: digits.length };
  }
  const trailingZeros = (intPart.match(/0+$/) || [''])[0].length;
  const significantInt = intPart.replace(/^0+/, '');
  return { min: significantInt.length - trailingZeros, max: significantInt.length };
}

/** Redondea a n cifras significativas (para mostrar resultados). */
export function roundSig(x: number, n: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const d = Math.ceil(Math.log10(Math.abs(x)));
  const p = n - d;
  const f = Math.pow(10, p);
  return Math.round(x * f) / f;
}

/** Formato legible con n cifras significativas, en notación científica si conviene. */
export function formatSig(x: number, n = 3): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = x.toExponential(n - 1).split('e');
    return `${m}×10^${Number(e)}`;
  }
  return String(Number(x.toPrecision(n)));
}
