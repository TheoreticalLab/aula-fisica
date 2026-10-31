import { describe, expect, it } from 'vitest';
import { gradeNumeric } from '../supabase/functions/_shared/calificacion/calificar';
import { normalizarMayusculas, parseUnit } from '../supabase/functions/_shared/calificacion/unidades';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos';

const energia: NumericKey = { format: 'numeric', value: '10290 J' };

describe('Calificación · categorías de error numérico', () => {
  it('1. campo vacío ≠ error de formato', () => {
    expect(gradeNumeric(energia, '')).toMatchObject({ status: 'invalid', code: 'empty' });
    expect(gradeNumeric(energia, '   ')).toMatchObject({ code: 'empty' });
  });
  it('2. formato: sin número, o unidad que no existe con ninguna escritura', () => {
    expect(gradeNumeric(energia, 'no sé')).toMatchObject({ status: 'invalid', code: 'parse_error' });
    expect(gradeNumeric(energia, '10290 zorks')).toMatchObject({ status: 'invalid', code: 'unit_format' });
  });
  it('3. error numérico con la unidad correcta', () => {
    expect(gradeNumeric(energia, '9000 J')).toMatchObject({ status: 'incorrect', code: 'wrong_value' });
  });
  it('4. error dimensional: nunca se acepta un número correcto en unidades de otra magnitud', () => {
    expect(gradeNumeric(energia, '10290 N')).toMatchObject({ status: 'incorrect', code: 'unit_mismatch' });
    expect(gradeNumeric(energia, '10290 W')).toMatchObject({ status: 'incorrect', code: 'unit_mismatch' });
  });
  it('5. unidad convencional distinta de la pedida', () => {
    expect(gradeNumeric({ format: 'numeric', value: '10.29 kJ', expectUnit: 'kJ' }, '10290 J')).toMatchObject({ status: 'incorrect', code: 'expected_unit' });
  });
  it('6 y 7. correcta, equivalente en otra unidad compatible, y parcial (sin unidad)', () => {
    expect(gradeNumeric(energia, '10290 J')).toMatchObject({ status: 'correct', code: 'ok' });
    expect(gradeNumeric(energia, '10.29 kJ')).toMatchObject({ status: 'correct' });
    expect(gradeNumeric(energia, '10290')).toMatchObject({ status: 'partial', code: 'missing_unit' });
  });
});

describe('Calificación · política de mayúsculas en las unidades («10290j»)', () => {
  it('pedagógica (por defecto): «10290j» se califica como julios, avisando de que el símbolo SI es «J»', () => {
    const r = gradeNumeric(energia, '10290j');
    expect(r).toMatchObject({ status: 'correct', credit: 1, code: 'ok' });
    expect(r.messages[0]).toMatch(/Se interpretó «j» como «J».*no es una unidad del SI/);
    expect(gradeNumeric(energia, '10.29 kj')).toMatchObject({ status: 'correct' });
    expect(gradeNumeric(energia, '9000 j')).toMatchObject({ status: 'incorrect', code: 'wrong_value' });   // la normalización no regala el valor
  });
  it('conserva signo, potencia de 10 y cifras significativas de lo escrito', () => {
    expect(gradeNumeric({ format: 'numeric', value: '-1.029e4 J' }, '-1.029×10^4 j')).toMatchObject({ status: 'correct' });
    expect(gradeNumeric({ format: 'numeric', value: '1.029e4 J' }, '1.029e4 j')).toMatchObject({ status: 'correct' });
    expect(gradeNumeric({ format: 'numeric', value: '1.029e4 J', sigFigs: 4, strictSigFigs: true }, '1.03e4 j')).toMatchObject({ status: 'partial', code: 'sig_figs' });
  });
  it('estricta: se rechaza como formato, sugiriendo la escritura correcta (sin decir si el número es correcto)', () => {
    const r = gradeNumeric({ ...energia, unitCase: 'estricta' }, '10290j');
    expect(r).toMatchObject({ status: 'invalid', code: 'unit_format', credit: 0 });
    expect(r.messages[0]).toMatch(/¿Quiso escribir «J»\?/);
    expect(r.messages.join(' ')).not.toMatch(/correct/i);
  });
  it('ambigüedad: «mj» podría ser mJ o MJ (10⁹ de diferencia) → no se acepta', () => {
    expect(normalizarMayusculas('mj', parseUnit('J').dims)).toEqual({ ambigua: expect.arrayContaining(['mJ', 'MJ']) });
    expect(gradeNumeric(energia, '10290000 mj')).toMatchObject({ status: 'invalid', code: 'unit_format' });
  });
  it('nunca convierte una unidad VÁLIDA en otra, ni acepta otras dimensiones', () => {
    // «m» (metro) es válida: no se reinterpreta como «M»; da error dimensional
    expect(gradeNumeric(energia, '10290 m')).toMatchObject({ code: 'unit_mismatch' });
    // «n» no es unidad; con dimensiones de fuerza sería «N», pero la pregunta pide energía → no hay lectura con esas dimensiones
    expect(gradeNumeric(energia, '10290 n')).toMatchObject({ status: 'invalid', code: 'unit_format' });
    expect(gradeNumeric({ format: 'numeric', value: '40 N' }, '40 n')).toMatchObject({ status: 'correct' });
  });
  it('otros casos frecuentes: «S» por segundos, «KG» por kilogramos', () => {
    expect(gradeNumeric({ format: 'numeric', value: '12 s' }, '12 S')).toMatchObject({ status: 'correct' });
    expect(gradeNumeric({ format: 'numeric', value: '3 kg' }, '3 KG')).toMatchObject({ status: 'correct' });
  });
});
