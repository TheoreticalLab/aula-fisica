import { describe, expect, it } from 'vitest';
import { evaluarExpresion, gradeConArrastre, MENSAJE_ARRASTRE, valorRespuestaSI } from '../supabase/functions/_shared/calificacion/arrastre';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos';

describe('evaluarExpresion (gramática cerrada, sin eval)', () => {
  it('aritmética, potencias, funciones y precedencia', () => {
    expect(evaluarExpresion('x^2/(2*0.25*10)', 4)).toBeCloseTo(3.2);
    expect(evaluarExpresion('-x^2', 3)).toBe(-9);
    expect(evaluarExpresion('2^3^2', 0)).toBe(512);
    expect(evaluarExpresion('sqrt(2*9.8*x)', 0.45)).toBeCloseTo(Math.sqrt(8.82));
    expect(evaluarExpresion('abs(x) * 1.5e-1', -2)).toBeCloseTo(0.3);
    expect(evaluarExpresion(' ( x + 1 ) * ( x - 1 ) ', 3)).toBe(8);
  });
  it('rechaza cualquier otra cosa', () => {
    for (const mal of ['', 'x+', 'y', 'alert(1)', 'x)', '(x', 'process.exit()', 'x;1', 'constructor', '2**3']) {
      expect(() => evaluarExpresion(mal, 1)).toThrow();
    }
  });
});

describe('gradeConArrastre', () => {
  // etapa 6 del caso de referencia: distancia de frenado d = v²/(2 μk g) con μk = 0.25 y g = 10
  const clave: NumericKey = { format: 'numeric', value: '3.2 m', arrastre: { desde: 'mec-u9c-15-4', expresion: 'x^2/(2*0.25*10)' } };

  it('respuesta correcta: igual que sin arrastre', () => {
    expect(gradeConArrastre(clave, '3.2 m', '6 m/s').status).toBe('correct');
  });
  it('error en la etapa 4 (v = 6 m/s) aplicado bien en la 6 (d = 7.2 m): no se penaliza dos veces', () => {
    const r = gradeConArrastre(clave, '7.2 m', '6 m/s');
    expect(r.status).toBe('correct');
    expect(r.code).toBe('arrastre');
    expect(r.messages[0]).toBe(MENSAJE_ARRASTRE);
  });
  it('respeta las unidades del estudiante en ambas etapas (km/h en la 4, cm en la 6)', () => {
    expect(gradeConArrastre(clave, '720 cm', '21.6 km/h').status).toBe('correct');
  });
  it('sin coherencia con la etapa anterior: incorrecta como siempre', () => {
    expect(gradeConArrastre(clave, '5 m', '6 m/s').status).toBe('incorrect');
    expect(gradeConArrastre(clave, '7.2 m', null).status).toBe('incorrect');
    expect(gradeConArrastre(clave, '7.2 m', 'no sé').status).toBe('incorrect');
  });
  it('la falta de unidad sigue contando igual que en la calificación normal', () => {
    const normal = gradeConArrastre({ ...clave, arrastre: undefined }, '3.2', null);
    const arr = gradeConArrastre(clave, '7.2', '6 m/s');
    expect(arr.status).toBe(normal.status);
    expect(arr.credit).toBe(normal.credit);
  });
  it('no convierte en correcta una respuesta ilegible', () => {
    expect(gradeConArrastre(clave, 'abc', '6 m/s').status).toBe('invalid');
  });
  it('lectura SI de respuestas previas', () => {
    expect(valorRespuestaSI('36 km/h')).toBeCloseTo(10);
    expect(valorRespuestaSI('')).toBeNull();
  });
});
