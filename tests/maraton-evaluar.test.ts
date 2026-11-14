/** Maratón adaptativo: validez de intentos y corrección (supabase/functions/maraton/evaluar.ts). */
import { describe, expect, it } from 'vitest';
import { evaluarParte, evaluarRespuesta } from '../supabase/functions/maraton/evaluar';
import type { NumericKey } from '../supabase/functions/_shared/calificacion/tipos';

const v: NumericKey = { format: 'numeric', value: '3.250 m/s', relTol: 0.02 };
const e: NumericKey = { format: 'numeric', value: '0.4704', relTol: 0.02, unitRequired: false };
const pct: NumericKey = { format: 'numeric', value: '53.81 %', relTol: 0.02 };
const n: NumericKey = { format: 'numeric', value: '5', relTol: 0, absTol: 0.4, unitRequired: false };

describe('validez del intento (solo por la forma, nunca por la clave)', () => {
  it('vacío, texto arbitrario o número sin la unidad pedida: NO es un intento válido', () => {
    for (const x of ['', '   ', 'no sé', 'abc', '3.25']) expect(evaluarParte(v, x).valida, x).toBe(false);
    expect(evaluarParte(v, '3.25').codigo).toBe('sin_unidad');
    // la falta de unidad es inválida AUNQUE el número sea incorrecto: no revela nada sobre la clave
    expect(evaluarParte(v, '9.99').codigo).toBe('sin_unidad');
  });
  it('una magnitud legible es válida aunque sea incorrecta o de otra dimensión', () => {
    expect(evaluarParte(v, '9.9 m/s')).toMatchObject({ valida: true, correcta: false });
    expect(evaluarParte(v, '3.25 m')).toMatchObject({ valida: true, correcta: false });
  });
  it('correcta dentro de la tolerancia y con unidades equivalentes', () => {
    expect(evaluarParte(v, '3.25 m/s')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(v, '3.3 m/s')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(v, '11.7 km/h')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(v, '3.40 m/s').correcta).toBe(false);
  });
  it('adimensionales, porcentajes y enteros', () => {
    expect(evaluarParte(e, '0.47')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(pct, '53.8')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(pct, '53.8 %')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(n, '5')).toMatchObject({ valida: true, correcta: true });
    expect(evaluarParte(n, '4')).toMatchObject({ valida: true, correcta: false });
    expect(evaluarParte(n, '5.5').correcta).toBe(false);
  });
  it('respuestas largas o no textuales no cuentan', () => {
    expect(evaluarParte(v, 'x'.repeat(300)).valida).toBe(false);
    expect(evaluarParte(v, 42 as unknown as string).valida).toBe(false);
  });
});

describe('respuestas estructuradas (varias partes)', () => {
  const clave = { partes: [v, e] };
  it('todas las partes correctas → correcta', () => {
    expect(evaluarRespuesta(clave, ['3.25 m/s', '0.47'])).toMatchObject({ valida: true, correcta: true });
  });
  it('una parte incorrecta → intento válido e incorrecto', () => {
    expect(evaluarRespuesta(clave, ['3.25 m/s', '0.60'])).toMatchObject({ valida: true, correcta: false });
  });
  it('una parte vacía o sin unidad → no válido (no cuenta), con mensaje por casilla', () => {
    const r = evaluarRespuesta(clave, ['3.25', '0.47']);
    expect(r.valida).toBe(false);
    expect(r.mensajes[0]).toMatch(/Casilla 1/);
    expect(evaluarRespuesta(clave, ['3.25 m/s']).valida).toBe(false);
    expect(evaluarRespuesta(clave, 'texto').valida).toBe(false);
  });
  it('los mensajes de una respuesta no válida no contienen la clave', () => {
    const r = evaluarRespuesta(clave, ['3.250', '']);
    expect(JSON.stringify(r)).not.toMatch(/3\.250 m\/s|0\.4704/);
  });
});
