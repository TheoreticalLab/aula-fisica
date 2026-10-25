import { describe, expect, it } from 'vitest';
import { countSigFigs, parseLeadingNumber, roundSig } from '@calif/numeros.ts';
import { describeDims, parseUnit, sameDims, toSI } from '@calif/unidades.ts';
import {
  grade,
  gradeChoice,
  gradeNumeric,
  gradeText,
  gradeTrueFalse,
  interpretNumeric,
  normalizeText,
  parseQuantity,
  validateAnswerShape,
  validateNumericKey,
} from '@calif/calificar.ts';

describe('lectura de números', () => {
  const cases: [string, number][] = [
    ['25', 25],
    ['-4.9', -4.9],
    ['−4.9', -4.9],
    ['+3', 3],
    ['3.0e8', 3e8],
    ['3,0E8', 3e8],
    ['1.5×10^3', 1500],
    ['1.5x10^3', 1500],
    ['1.5 * 10^-3', 0.0015],
    ['1.5·10³', 1500],
    ['6.02×10²³', 6.02e23],
    ['10^5', 1e5],
    ['.5', 0.5],
    ['0,25', 0.25],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
  ];
  for (const [txt, v] of cases) {
    it(`«${txt}» = ${v}`, () => {
      const p = parseLeadingNumber(txt);
      expect(p).not.toBeNull();
      expect(p!.value).toBeCloseTo(v, 10 - Math.max(0, Math.round(Math.log10(Math.abs(v)))));
    });
  }
  it('rechaza textos sin número', () => {
    expect(parseLeadingNumber('m/s')).toBeNull();
    expect(parseLeadingNumber('')).toBeNull();
    expect(parseLeadingNumber('1.2.3')).toBeNull();
  });
  it('separa el número de la unidad', () => {
    expect(parseLeadingNumber('20 m/s')!.rest).toBe('m/s');
    expect(parseLeadingNumber('9.8m/s^2')!.rest).toBe('m/s^2');
    expect(parseLeadingNumber('3.0e8 m/s')!.rest).toBe('m/s');
  });
});

describe('cifras significativas', () => {
  const cases: [string, number, number][] = [
    ['2.50', 3, 3],
    ['0.0025', 2, 2],
    ['1500', 2, 4],
    ['1500.', 4, 4],
    ['3.00', 3, 3],
    ['105', 3, 3],
    ['0.00', 2, 2],
    ['7', 1, 1],
  ];
  for (const [m, min, max] of cases) {
    it(`${m} → [${min}, ${max}]`, () => expect(countSigFigs(m)).toEqual({ min, max }));
  }
  it('redondeo', () => {
    expect(roundSig(9.8765, 3)).toBeCloseTo(9.88, 10);
    expect(roundSig(0.0012345, 2)).toBeCloseTo(0.0012, 12);
  });
});

describe('unidades', () => {
  it('unidades básicas y derivadas', () => {
    expect(parseUnit('N').dims).toEqual([1, 1, -2, 0, 0, 0, 0]);
    expect(sameDims(parseUnit('kg·m/s^2').dims, parseUnit('N').dims)).toBe(true);
    expect(sameDims(parseUnit('J').dims, parseUnit('N·m').dims)).toBe(true);
    expect(sameDims(parseUnit('W').dims, parseUnit('J/s').dims)).toBe(true);
    expect(sameDims(parseUnit('Pa').dims, parseUnit('N/m^2').dims)).toBe(true);
  });
  it('prefijos', () => {
    expect(parseUnit('km').factor).toBeCloseTo(1000);
    expect(parseUnit('cm').factor).toBeCloseTo(0.01);
    expect(parseUnit('mm').factor).toBeCloseTo(0.001);
    expect(parseUnit('kg').factor).toBeCloseTo(1);
    expect(parseUnit('g').factor).toBeCloseTo(0.001);
    expect(parseUnit('ms').factor).toBeCloseTo(0.001);
    expect(parseUnit('µs').factor).toBeCloseTo(1e-6);
    expect(parseUnit('kN').factor).toBeCloseTo(1000);
    expect(parseUnit('mL').factor).toBeCloseTo(1e-6);
  });
  it('min y mi no se confunden con prefijos', () => {
    expect(parseUnit('min').factor).toBe(60);
    expect(parseUnit('mi').factor).toBeCloseTo(1609.344);
  });
  it('conversiones compuestas', () => {
    expect(parseUnit('km/h').factor).toBeCloseTo(1 / 3.6, 10);
    expect(parseUnit('kmh').factor).toBeCloseTo(1 / 3.6, 10);
    expect(parseUnit('g/cm^3').factor).toBeCloseTo(1000, 8);
    expect(parseUnit('g/cm³').factor).toBeCloseTo(1000, 8);
    expect(parseUnit('cm2').factor).toBeCloseTo(1e-4, 12);
    expect(parseUnit('m/s/s').dims).toEqual(parseUnit('m/s^2').dims);
    expect(parseUnit('1/s').dims).toEqual([0, 0, -1, 0, 0, 0, 0]);
    expect(parseUnit('s^-1').dims).toEqual([0, 0, -1, 0, 0, 0, 0]);
  });
  it('todo lo que sigue a «/» está en el denominador', () => {
    expect(sameDims(parseUnit('J/kg·K').dims, parseUnit('J/(kg·K)').dims)).toBe(true);
    expect(parseUnit('J/kg·K').dims).toEqual([0, 2, -2, 0, -1, 0, 0]);
  });
  it('temperaturas', () => {
    const c = parseUnit('°C');
    expect(toSI(25, c)).toBeCloseTo(298.15);
    expect(toSI(25, c, true)).toBeCloseTo(25);
    expect(toSI(212, parseUnit('°F'))).toBeCloseTo(373.15, 6);
    expect(toSI(32, parseUnit('ºF'))).toBeCloseTo(273.15, 6);
  });
  it('ángulos y porcentajes son adimensionales', () => {
    expect(parseUnit('°').factor).toBeCloseTo(Math.PI / 180);
    expect(parseUnit('rad').dims).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(parseUnit('%').factor).toBe(0.01);
    expect(parseUnit('grados').factor).toBeCloseTo(Math.PI / 180);
  });
  it('errores con mensaje', () => {
    expect(() => parseUnit('xyz')).toThrow(/No reconozco/);
    expect(() => parseUnit('m/')).toThrow();
  });
  it('nombres de dimensiones', () => {
    expect(describeDims(parseUnit('m/s').dims)).toBe('una velocidad');
    expect(describeDims(parseUnit('N').dims)).toBe('una fuerza');
    expect(describeDims(parseUnit('kg·m/s').dims)).toMatch(/cantidad de movimiento/);
  });
});

describe('cantidades', () => {
  it('quita «v =» inicial', () => {
    const p = parseQuantity('v = 20 m/s');
    expect(p.ok && p.q.value).toBe(20);
  });
  it('sugiere minúsculas', () => {
    const p = parseQuantity('20 KM/H');
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(/km\/h/);
  });
  it('interpretación para el estudiante', () => {
    expect(interpretNumeric('72 km/h').text).toMatch(/20 m\/s/);
    expect(interpretNumeric('hola').ok).toBe(false);
  });
});

describe('calificación numérica', () => {
  const key = { format: 'numeric' as const, value: '20 m/s' };
  it('acepta unidades equivalentes', () => {
    expect(gradeNumeric(key, '20 m/s').status).toBe('correct');
    expect(gradeNumeric(key, '72 km/h').status).toBe('correct');
    expect(gradeNumeric(key, '2.0e1 m/s').status).toBe('correct');
    expect(gradeNumeric(key, '2000 cm/s').status).toBe('correct');
    expect(gradeNumeric(key, '0.02 km/s').status).toBe('correct');
  });
  it('tolerancia relativa del 2 %', () => {
    expect(gradeNumeric(key, '20.3 m/s').status).toBe('correct');
    expect(gradeNumeric(key, '20.5 m/s').status).toBe('incorrect');
    expect(gradeNumeric({ ...key, relTol: 0.05 }, '20.9 m/s').status).toBe('correct');
  });
  it('dimensiones incorrectas', () => {
    const r = gradeNumeric(key, '20 m');
    expect(r.status).toBe('incorrect');
    expect(r.code).toBe('unit_mismatch');
    expect(r.messages[0]).toMatch(/longitud.*velocidad/);
  });
  it('unidad ausente: crédito parcial', () => {
    const r = gradeNumeric(key, '20');
    expect(r.status).toBe('partial');
    expect(r.credit).toBe(0.5);
    expect(gradeNumeric({ ...key, unitRequired: false }, '20').status).toBe('correct');
    expect(gradeNumeric(key, '25').status).toBe('incorrect');
  });
  it('diagnósticos de errores típicos', () => {
    expect(gradeNumeric(key, '-20 m/s').code).toBe('sign');
    expect(gradeNumeric(key, '5.556 m/s').code).toBe('kmh');
    expect(gradeNumeric(key, '200 m/s').code).toBe('power_of_ten');
    expect(gradeNumeric(key, '40 m/s').code).toBe('factor_two');
    expect(gradeNumeric({ format: 'numeric', value: '49 N' }, '5 N').code).toBe('mass_weight');
  });
  it('errores comunes definidos por el profesor', () => {
    const k = { format: 'numeric' as const, value: '1000 m', commonErrors: [{ value: '1.6 m', message: 'Dividió.' }] };
    const r = gradeNumeric(k, '1.6 m');
    expect(r.code).toBe('common_error');
    expect(r.messages).toEqual(['Dividió.']);
  });
  it('respuestas alternativas', () => {
    const k = { format: 'numeric' as const, value: '5 m', alternatives: ['-5 m'] };
    expect(gradeNumeric(k, '-5 m').status).toBe('correct');
  });
  it('valor esperado cero con tolerancia absoluta', () => {
    const k = { format: 'numeric' as const, value: '0 m/s', absTol: 0.01 };
    expect(gradeNumeric(k, '0 m/s').status).toBe('correct');
    expect(gradeNumeric(k, '0.005 m/s').status).toBe('correct');
    expect(gradeNumeric(k, '0.5 m/s').status).toBe('incorrect');
  });
  it('cifras significativas', () => {
    const k = { format: 'numeric' as const, value: '2.50 m', sigFigs: 3 };
    expect(gradeNumeric(k, '2.50 m')).toMatchObject({ status: 'correct', messages: [] });
    const lax = gradeNumeric(k, '2.5 m');
    expect(lax.status).toBe('correct');
    expect(lax.messages[0]).toMatch(/cifras significativas/);
    const strict = gradeNumeric({ ...k, strictSigFigs: true }, '2.5 m');
    expect(strict.status).toBe('partial');
    expect(strict.credit).toBe(0.8);
    expect(gradeNumeric({ ...k, strictSigFigs: true }, '2.50×10^0 m').status).toBe('correct');
  });
  it('magnitudes adimensionales y ángulos', () => {
    expect(gradeNumeric({ format: 'numeric', value: '0.25' }, '0.25').status).toBe('correct');
    expect(gradeNumeric({ format: 'numeric', value: '0.25' }, '25 %').status).toBe('correct');
    expect(gradeNumeric({ format: 'numeric', value: '0.25' }, '0.25 N').code).toBe('unit_mismatch');
    expect(gradeNumeric({ format: 'numeric', value: '30 °' }, '30').status).toBe('correct');
    expect(gradeNumeric({ format: 'numeric', value: '30 °' }, '0.5236 rad').status).toBe('correct');
  });
  it('temperaturas absolutas y diferencias', () => {
    expect(gradeNumeric({ format: 'numeric', value: '298.15 K' }, '25 °C').status).toBe('correct');
    expect(gradeNumeric({ format: 'numeric', value: '20 K', temperatureInterval: true }, '20 °C').status).toBe('correct');
  });
  it('unidad exigida en preguntas de conversión', () => {
    const k = { format: 'numeric' as const, value: '20 m/s', expectUnit: 'm/s' };
    expect(gradeNumeric(k, '20 m/s').status).toBe('correct');
    const r = gradeNumeric(k, '72 km/h');
    expect(r.code).toBe('expected_unit');
    expect(r.messages[0]).toMatch(/m\/s/);
    expect(validateNumericKey({ format: 'numeric', value: '20 m/s', expectUnit: 'kg' }).length).toBe(1);
  });
  it('respuesta ilegible no consume intento', () => {
    expect(gradeNumeric(key, 'no sé').status).toBe('invalid');
    expect(gradeNumeric(key, '20 metros por segundo').status).toBe('invalid');
  });
  it('validación de claves', () => {
    expect(validateNumericKey({ format: 'numeric', value: '9.8 m/s^2' })).toEqual([]);
    expect(validateNumericKey({ format: 'numeric', value: 'nueve' }).length).toBeGreaterThan(0);
    expect(validateNumericKey({ format: 'numeric', value: '5 m', alternatives: ['5 s'] }).length).toBeGreaterThan(0);
  });
});

describe('otros formatos', () => {
  it('selección simple', () => {
    const k = { format: 'choice' as const, correct: [1], optionFeedback: { 0: 'No: la ordenada es x0.' } };
    expect(gradeChoice(k, [1]).status).toBe('correct');
    const r = gradeChoice(k, [0]);
    expect(r.status).toBe('incorrect');
    expect(r.messages).toEqual(['No: la ordenada es x0.']);
    expect(gradeChoice(k, []).status).toBe('invalid');
    expect(gradeChoice(k, [7], 4).status).toBe('invalid');
  });
  it('selección múltiple con crédito parcial', () => {
    const k = { format: 'choice' as const, correct: [0, 2] };
    expect(gradeChoice(k, [0, 2]).status).toBe('correct');
    expect(gradeChoice(k, [0])).toMatchObject({ status: 'partial', credit: 0.5 });
    expect(gradeChoice(k, [0, 1])).toMatchObject({ status: 'incorrect', credit: 0 });
  });
  it('verdadero o falso', () => {
    const k = { format: 'truefalse' as const, value: false, modelJustification: '...' };
    expect(gradeTrueFalse(k, { value: false, justification: 'porque la pendiente es cero' }).status).toBe('correct');
    expect(gradeTrueFalse(k, { value: true }).status).toBe('incorrect');
    expect(gradeTrueFalse(k, {}).status).toBe('invalid');
    expect(gradeTrueFalse(k, { value: false }).messages[0]).toMatch(/justificar/);
  });
  it('texto con equivalencias', () => {
    const k = { format: 'text' as const, accepted: ['inercia'] };
    expect(gradeText(k, 'Inercia').status).toBe('correct');
    expect(gradeText(k, 'la inercia.').status).toBe('correct');
    expect(gradeText(k, 'inrcia').status).toBe('correct');
    expect(gradeText(k, 'fuerza').status).toBe('incorrect');
    expect(normalizeText('  Aceleración  Centrípeta! ')).toBe('aceleracion centripeta');
  });
  it('desarrollo queda para revisión manual', () => {
    expect(grade({ format: 'open', rubric: 'r' }, { text: 'mi solución' }).status).toBe('pending_review');
    expect(grade({ format: 'open', rubric: 'r' }, { text: '  ' }).status).toBe('invalid');
  });
  it('forma de la respuesta', () => {
    expect(validateAnswerShape({ selected: [1] })).toEqual({ selected: [1] });
    expect(validateAnswerShape({ selected: ['1'] })).toBeNull();
    expect(validateAnswerShape({ text: 'x'.repeat(6000) })).toBeNull();
    expect(validateAnswerShape([1])).toBeNull();
    expect(validateAnswerShape(null)).toBeNull();
    expect(validateAnswerShape({ value: 'true' })).toBeNull();
  });
});
