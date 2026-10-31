/**
 * Motor de calificación automática. Función pura: (clave, respuesta) → resultado.
 * Se ejecuta en el servidor (Edge Function «calificar»); el frontend solo usa
 * `interpretNumeric` para mostrar cómo se leyó lo que el estudiante escribió.
 */
import { countSigFigs, formatSig, parseLeadingNumber } from './numeros.ts';
import { describeDims, formatDims, isDimensionless, normalizarMayusculas, parseUnit, sameDims, toSI, UnitError, type ParsedUnit } from './unidades.ts';
import type {
  AnswerKey,
  ChoiceKey,
  GradeResult,
  NumericKey,
  StudentAnswer,
  TextKey,
  TrueFalseKey,
} from './tipos.ts';
import { MAX_TEXT_LENGTH } from './tipos.ts';

export const DEFAULT_REL_TOL = 0.02;

// ---------------------------------------------------------------------------
// Cantidades con unidad
// ---------------------------------------------------------------------------

export interface Quantity {
  /** Número tal como se escribió (en la unidad escrita). */
  value: number;
  mantissa: string;
  unitText: string;
  unit: ParsedUnit;
}

export type QuantityParse = { ok: true; q: Quantity } | { ok: false; message: string };

/** Lee «v = 20 m/s», «2,5×10^3 kg», «-9.8 m/s²»… */
export function parseQuantity(raw: string): QuantityParse {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, message: 'Escriba un número.' };
  if (raw.length > 200) return { ok: false, message: 'La respuesta es demasiado larga para un valor numérico.' };
  // quitar un «símbolo =» inicial (v = 20 m/s, Δx= 5 m)
  const s = raw.replace(/^\s*[A-Za-zΔΘθαβγωλμρτφ_][\w\s{}^_'’,]{0,15}=\s*/u, '');
  const num = parseLeadingNumber(s);
  if (!num) return { ok: false, message: 'No encuentro un número al principio de la respuesta. Ejemplo de formato: 9.8 m/s^2' };
  let unit: ParsedUnit;
  try {
    unit = parseUnit(num.rest);
  } catch (e) {
    let msg = e instanceof UnitError ? e.message : 'No se pudo interpretar la unidad.';
    // pista sobre mayúsculas (los símbolos SI distinguen mayúsculas y minúsculas)
    const lower = num.rest.toLowerCase();
    if (lower !== num.rest) {
      try {
        parseUnit(lower);
        msg += ` ¿Quiso escribir «${lower}»? Los símbolos de las unidades distinguen mayúsculas y minúsculas.`;
      } catch {
        /* sin sugerencia */
      }
    }
    if (/^[x×]\s*10/.test(num.rest)) msg = 'Para la notación científica escriba, por ejemplo, 3.0×10^8 o 3.0e8.';
    return { ok: false, message: msg };
  }
  return { ok: true, q: { value: num.value, mantissa: num.mantissa, unitText: num.rest, unit } };
}

/** Descripción de cómo se interpretó una cantidad, sin juzgar si es correcta. */
export function interpretNumeric(raw: string): { ok: boolean; text: string } {
  const p = parseQuantity(raw);
  if (!p.ok) return { ok: false, text: p.message };
  const { q } = p;
  if (q.unit.empty) return { ok: true, text: `Número ${formatSig(q.value, 6)} sin unidad.` };
  const si = toSI(q.value, q.unit);
  const siUnit = formatDims(q.unit.dims);
  return {
    ok: true,
    text: `${formatSig(q.value, 6)} ${q.unitText} = ${formatSig(si, 6)} ${siUnit === '(adimensional)' ? '' : siUnit} en SI (${describeDims(q.unit.dims)}).`.replace(/\s+\(/, ' ('),
  };
}

function close(a: number, b: number, relTol: number, absTol: number): boolean {
  const tol = Math.max(relTol * Math.abs(b), absTol, 1e-12 * Math.max(1, Math.abs(b)));
  return Math.abs(a - b) <= tol;
}

function keyQuantity(text: string): Quantity {
  const p = parseQuantity(text);
  if (!p.ok) throw new Error(`Clave numérica inválida «${text}»: ${p.message}`);
  return p.q;
}

/** Comprueba que una clave numérica sea legible (lo usa el editor del profesor y las pruebas). */
export function validateNumericKey(key: NumericKey): string[] {
  const errors: string[] = [];
  const all = [key.value, ...(key.alternatives ?? []), ...(key.commonErrors ?? []).map((c) => c.value)];
  for (const v of all) {
    const p = parseQuantity(v);
    if (!p.ok) errors.push(`«${v}»: ${p.message}`);
  }
  if (errors.length === 0) {
    const main = keyQuantity(key.value);
    for (const v of [...(key.alternatives ?? []), ...(key.commonErrors ?? []).map((c) => c.value)]) {
      const q = keyQuantity(v);
      if (!q.unit.empty && !main.unit.empty && !sameDims(q.unit.dims, main.unit.dims)) {
        // permitido en errores comunes (p. ej. confundir unidades), pero se avisa para alternativas
        if ((key.alternatives ?? []).includes(v)) errors.push(`La alternativa «${v}» no tiene las mismas dimensiones que «${key.value}».`);
      }
    }
  }
  if (key.expectUnit !== undefined) {
    try {
      const want = parseUnit(key.expectUnit);
      const main = parseQuantity(key.value);
      if (main.ok && !main.q.unit.empty && !sameDims(want.dims, main.q.unit.dims)) {
        errors.push(`La unidad exigida «${key.expectUnit}» no tiene las dimensiones de «${key.value}».`);
      }
    } catch (e) {
      errors.push(`Unidad exigida «${key.expectUnit}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (key.relTol !== undefined && !(key.relTol >= 0 && key.relTol < 1)) errors.push('relTol debe estar entre 0 y 1.');
  if (key.sigFigs !== undefined && !(Number.isInteger(key.sigFigs) && key.sigFigs > 0)) errors.push('sigFigs debe ser un entero positivo.');
  return errors;
}

const ANGLE_OR_PERCENT = new Set(['°', 'º', 'grados', 'deg', '%', 'rad', 'u']);

function factorDiagnosis(student: number, expected: number): { code: string; message: string } | null {
  if (expected === 0 || student === 0) return null;
  const r = student / expected;
  const ar = Math.abs(r);
  const near = (x: number, t = 0.02) => Math.abs(ar - x) <= t * x;
  if (r < 0 && near(1)) {
    return { code: 'sign', message: 'El valor absoluto es correcto, pero el signo no. Revise qué sentido eligió como positivo.' };
  }
  if (r < 0) return null; // signo distinto y magnitud distinta: sin diagnóstico concreto
  if (near(3.6) || near(1 / 3.6)) {
    return { code: 'kmh', message: 'Su resultado difiere en un factor 3.6: revise la conversión entre km/h y m/s.' };
  }
  for (const f of [60, 3600]) {
    if (near(f) || near(1 / f)) {
      return { code: 'time_conversion', message: `Su resultado difiere en un factor ${f}: revise la conversión de unidades de tiempo.` };
    }
  }
  const lg = Math.log10(ar);
  const n = Math.round(lg);
  if (n !== 0 && Math.abs(lg - n) < 0.0043) {
    return {
      code: 'power_of_ten',
      message: `Su resultado difiere en un factor 10^${n}: revise los prefijos (k, c, m…), la conversión de unidades o la notación científica.`,
    };
  }
  if (near(2) || near(0.5)) {
    return { code: 'factor_two', message: 'Su resultado difiere en un factor 2: revise si falta o sobra un ½ o un 2 en la ecuación.' };
  }
  if (near(9.8) || near(1 / 9.8) || near(9.81) || near(1 / 9.81)) {
    return { code: 'mass_weight', message: 'Su resultado difiere en un factor g ≈ 9.8: ¿confundió masa con peso, o multiplicó/dividió por g de más?' };
  }
  return null;
}

export function gradeNumeric(key: NumericKey, raw: string): GradeResult {
  // 1) campo vacío: no es un error de formato
  if (typeof raw !== 'string' || raw.trim() === '') return { status: 'invalid', credit: 0, messages: ['Escriba una respuesta.'], code: 'empty' };
  const p = parseQuantity(raw);
  const k = keyQuantity(key.value);
  if (!p.ok) {
    // 2) formato: hay número pero la unidad no se reconoce → normalización pedagógica de mayúsculas, si la clave la
    //    permite (por defecto sí) y solo si la lectura es única y con las dimensiones de la pregunta
    const num = parseLeadingNumber(raw.replace(/^\s*[A-Za-zΔΘθαβγωλμρτφ_][\w\s{}^_'’,]{0,15}=\s*/u, ''));
    if (num && num.rest.trim() && !k.unit.empty) {
      const n = normalizarMayusculas(num.rest, k.unit.dims);
      if (n && 'texto' in n) {
        const escrito = num.rest.trim();
        if ((key.unitCase ?? 'pedagogica') === 'pedagogica') {
          // se cambia SOLO la unidad dentro de lo que escribió el estudiante (conserva signo, potencia de 10 y cifras)
          const original = raw.trimEnd();
          const pos = original.lastIndexOf(escrito);
          const corregido = pos >= 0 ? original.slice(0, pos) + n.texto + original.slice(pos + escrito.length) : `${num.value} ${n.texto}`;
          const r = gradeNumeric(key, corregido);
          return { ...r, messages: [`Se interpretó «${escrito}» como «${n.texto}». Ojo: el símbolo correcto en el SI es «${n.texto}»; «${escrito}» no es una unidad del SI.`, ...r.messages] };
        }
        return { status: 'invalid', credit: 0, messages: [`No reconozco «${escrito}» como unidad. ¿Quiso escribir «${n.texto}»? Los símbolos de las unidades distinguen mayúsculas y minúsculas.`], code: 'unit_format' };
      }
      if (n && 'ambigua' in n) {
        return { status: 'invalid', credit: 0, messages: [`La unidad «${num.rest.trim()}» es ambigua (podría ser ${n.ambigua.map((x) => `«${x}»`).join(' o ')}). Escríbala con las mayúsculas correctas.`], code: 'unit_format' };
      }
    }
    return { status: 'invalid', credit: 0, messages: [p.message], code: num && num.rest.trim() ? 'unit_format' : 'parse_error' };
  }
  const s = p.q;
  const relTol = key.relTol ?? DEFAULT_REL_TOL;
  const absTol = key.absTol ?? 0;
  const interval = !!key.temperatureInterval;
  const keyUnitText = k.unitText.trim();
  const unitRequired = key.unitRequired ?? (!k.unit.empty && !ANGLE_OR_PERCENT.has(keyUnitText));
  const kSI = toSI(k.value, k.unit, interval);
  const alternativesSI = (key.alternatives ?? []).map((a) => {
    const q = keyQuantity(a);
    return { q, si: toSI(q.value, q.unit, interval) };
  });

  const messages: string[] = [];
  let credit = 1;
  let code = 'ok';

  // --- unidad ausente -------------------------------------------------------
  if (s.unit.empty && !k.unit.empty) {
    // el número se interpreta en la unidad de la clave (o de la alternativa) y se compara con la MISMA tolerancia,
    // incluida la absoluta (p. ej. ángulos: «-53.13» frente a «-53.1 °» con absTol de 1°)
    const enUnidad = (u: ParsedUnit) => (u.empty ? s.value : toSI(s.value, u, interval));
    const sSI = enUnidad(k.unit);
    const matches = close(sSI, kSI, relTol, absTol) || alternativesSI.some((a) => close(enUnidad(a.q.unit.empty ? k.unit : a.q.unit), a.si, relTol, absTol));
    const pideUnidad = unitRequired ? 'Además, incluya la unidad en su respuesta.' : '';
    if (!matches) {
      for (const ce of key.commonErrors ?? []) {
        const q = keyQuantity(ce.value);
        const ceSI = q.unit.empty ? toSI(q.value, k.unit, interval) : toSI(q.value, q.unit, interval);
        if (close(sSI, ceSI, relTol, absTol)) {
          return { status: 'incorrect', credit: 0, messages: [ce.message, pideUnidad].filter(Boolean), code: 'common_error' };
        }
      }
      const diag = factorDiagnosis(s.value, k.value);
      return {
        status: 'incorrect',
        credit: 0,
        messages: [...(diag ? [diag.message] : []), pideUnidad].filter(Boolean),
        code: diag?.code ?? 'wrong_value',
      };
    }
    if (unitRequired) {
      return {
        status: 'partial',
        credit: 0.5,
        messages: ['El número es correcto, pero falta la unidad. Una magnitud física sin unidad está incompleta.'],
        code: 'missing_unit',
      };
    }
    // ángulos y porcentajes: se acepta sin unidad
  } else {
    // --- dimensiones ---------------------------------------------------------
    const keyDimsless = k.unit.empty || isDimensionless(k.unit.dims);
    const studentDimsless = s.unit.empty || isDimensionless(s.unit.dims);
    if (!(keyDimsless && studentDimsless) && !sameDims(s.unit.dims, k.unit.dims)) {
      return {
        status: 'incorrect',
        credit: 0,
        messages: [`Su unidad corresponde a ${describeDims(s.unit.dims)}, pero la pregunta pide ${describeDims(k.unit.dims)}.`],
        code: 'unit_mismatch',
      };
    }
    if (key.expectUnit) {
      const want = parseUnit(key.expectUnit);
      if (!s.unit.empty && (Math.abs(s.unit.factor - want.factor) > 1e-9 * Math.abs(want.factor) || s.unit.isAffineTemperature !== want.isAffineTemperature)) {
        return {
          status: 'incorrect',
          credit: 0,
          messages: [`Exprese el resultado en ${key.expectUnit}.`],
          code: 'expected_unit',
        };
      }
    }
    if (s.unit.isAffineTemperature !== k.unit.isAffineTemperature && !interval) {
      messages.push('Tenga en cuenta que °C y K tienen el mismo tamaño pero distinto cero.');
    }
    const sSI = s.unit.empty ? s.value * (k.unit.empty ? 1 : k.unit.factor) : toSI(s.value, s.unit, interval);
    const matches = close(sSI, kSI, relTol, absTol) || alternativesSI.some((a) => close(sSI, a.si, relTol, absTol));
    if (!matches) {
      for (const ce of key.commonErrors ?? []) {
        const q = keyQuantity(ce.value);
        const ceSI = q.unit.empty ? q.value * (k.unit.empty ? 1 : k.unit.factor) : toSI(q.value, q.unit, interval);
        const sameUnitKind = q.unit.empty || s.unit.empty || sameDims(q.unit.dims, s.unit.dims);
        if (sameUnitKind && close(sSI, ceSI, relTol, absTol)) {
          return { status: 'incorrect', credit: 0, messages: [ce.message], code: 'common_error' };
        }
      }
      const diag = factorDiagnosis(sSI, kSI);
      return {
        status: 'incorrect',
        credit: 0,
        messages: diag ? [diag.message] : ['El valor no es correcto. Revise el planteamiento y los cálculos.'],
        code: diag?.code ?? 'wrong_value',
      };
    }
  }

  // --- cifras significativas ---------------------------------------------------
  if (key.sigFigs) {
    const sf = countSigFigs(s.mantissa);
    if (key.sigFigs < sf.min || key.sigFigs > sf.max) {
      const has = sf.min === sf.max ? `${sf.min}` : `entre ${sf.min} y ${sf.max}`;
      if (key.strictSigFigs) {
        credit = 0.8;
        code = 'sig_figs';
        messages.push(`El valor es correcto, pero su respuesta tiene ${has} cifras significativas y se esperaban ${key.sigFigs}.`);
      } else {
        messages.push(`Valor correcto. Observación: su respuesta tiene ${has} cifras significativas; con los datos del problema corresponden ${key.sigFigs}.`);
      }
    }
  }
  return { status: credit === 1 ? 'correct' : 'partial', credit, messages, code };
}

// ---------------------------------------------------------------------------
// Selección, verdadero/falso, texto
// ---------------------------------------------------------------------------

export function gradeChoice(key: ChoiceKey, selected: number[] | undefined, optionCount?: number): GradeResult {
  const sel = [...new Set((selected ?? []).filter((i) => Number.isInteger(i) && i >= 0 && (optionCount === undefined || i < optionCount)))];
  if (sel.length === 0) return { status: 'invalid', credit: 0, messages: ['Seleccione una opción.'], code: 'empty' };
  const correct = new Set(key.correct);
  const tp = sel.filter((i) => correct.has(i)).length;
  const fp = sel.length - tp;
  const feedback = sel
    .filter((i) => !correct.has(i))
    .map((i) => key.optionFeedback?.[i])
    .filter((m): m is string => !!m);
  if (tp === correct.size && fp === 0) return { status: 'correct', credit: 1, messages: [], code: 'ok' };
  if (correct.size > 1) {
    const credit = Math.max(0, (tp - fp) / correct.size);
    const msgs = [...feedback];
    if (tp < correct.size) msgs.push('Le faltó marcar alguna opción correcta.');
    if (fp > 0 && feedback.length === 0) msgs.push('Marcó alguna opción incorrecta.');
    return { status: credit > 0 ? 'partial' : 'incorrect', credit: Math.round(credit * 100) / 100, messages: msgs, code: 'choice_partial' };
  }
  return { status: 'incorrect', credit: 0, messages: feedback.length ? feedback : ['Esa opción no es correcta.'], code: 'wrong_option' };
}

export function gradeTrueFalse(key: TrueFalseKey, answer: StudentAnswer): GradeResult {
  if (typeof answer.value !== 'boolean') return { status: 'invalid', credit: 0, messages: ['Indique verdadero o falso.'], code: 'empty' };
  const messages: string[] = [];
  if (!answer.justification || answer.justification.trim().length < 10) {
    messages.push('Recuerde justificar su respuesta: la justificación forma parte de la pregunta y el profesor puede revisarla.');
  }
  if (answer.value === key.value) return { status: 'correct', credit: 1, messages, code: 'ok' };
  return { status: 'incorrect', credit: 0, messages: ['La afirmación se clasificó al revés.', ...messages], code: 'wrong_option' };
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(el|la|los|las|un|una|unos|unas|lo)\s+/, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function gradeText(key: TextKey, text: string | undefined): GradeResult {
  const t = normalizeText(text ?? '');
  if (!t) return { status: 'invalid', credit: 0, messages: ['Escriba su respuesta.'], code: 'empty' };
  const accepted = key.accepted.map(normalizeText);
  if (accepted.includes(t)) return { status: 'correct', credit: 1, messages: [], code: 'ok' };
  const near = accepted.find((a) => a.length >= 5 && levenshtein(a, t) <= 1);
  if (near) return { status: 'correct', credit: 1, messages: ['Correcto. Revise la ortografía.'], code: 'typo' };
  return { status: 'incorrect', credit: 0, messages: ['La respuesta no coincide con la esperada.'], code: 'wrong_text' };
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

export function validateAnswerShape(answer: unknown): StudentAnswer | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const a = answer as Record<string, unknown>;
  const out: StudentAnswer = {};
  if (a.selected !== undefined) {
    if (!Array.isArray(a.selected) || a.selected.length > 20 || !a.selected.every((x) => Number.isInteger(x))) return null;
    out.selected = a.selected as number[];
  }
  if (a.value !== undefined) {
    if (typeof a.value !== 'boolean') return null;
    out.value = a.value;
  }
  for (const f of ['justification', 'text'] as const) {
    if (a[f] !== undefined) {
      if (typeof a[f] !== 'string' || (a[f] as string).length > MAX_TEXT_LENGTH) return null;
      out[f] = a[f] as string;
    }
  }
  return out;
}

export function grade(key: AnswerKey, answer: StudentAnswer, optionCount?: number): GradeResult {
  switch (key.format) {
    case 'choice':
      return gradeChoice(key, answer.selected, optionCount);
    case 'truefalse':
      return gradeTrueFalse(key, answer);
    case 'numeric':
      return gradeNumeric(key, answer.text ?? '');
    case 'text':
      return gradeText(key, answer.text);
    case 'open':
      if (!answer.text || !answer.text.trim()) return { status: 'invalid', credit: 0, messages: ['Escriba su respuesta.'], code: 'empty' };
      return { status: 'pending_review', credit: 0, messages: ['Respuesta registrada. El profesor la revisará.'], code: 'manual' };
  }
}

/** Respuesta correcta en forma presentable (solo se envía al estudiante cuando la política lo permite). */
export function describeKey(key: AnswerKey, options?: string[]): string {
  switch (key.format) {
    case 'choice':
      return key.correct.map((i) => (options?.[i] !== undefined ? `(${String.fromCharCode(97 + i)}) ${options[i]}` : `opción ${i + 1}`)).join('; ');
    case 'truefalse':
      return `${key.value ? 'Verdadero' : 'Falso'}. ${key.modelJustification}`;
    case 'numeric':
      return key.value + (key.alternatives?.length ? ` (también se acepta: ${key.alternatives.join(', ')})` : '');
    case 'text':
      return key.accepted[0] ?? '';
    case 'open':
      return 'Respuesta de desarrollo: vea la explicación.';
  }
}
