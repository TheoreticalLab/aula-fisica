import { describe, expect, it } from 'vitest';
import { avisoRapidez, ordenPractica, posicionActual, umbralDe, type ConfigSecuencial } from '@/lib/practicaSecuencial';

const cfg: ConfigSecuencial = { aleatorio: true, umbrales: { basico: 120, intermedio: 300, desafiante: 480 }, aviso: 'Aviso' };

describe('práctica secuencial: orden', () => {
  it('es una permutación completa y estable para el mismo intento', () => {
    const a = ordenPractica(20, 'intento-1');
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(ordenPractica(20, 'intento-1')).toEqual(a);
  });
  it('cambia de un intento a otro y no deja el orden original', () => {
    const a = ordenPractica(20, 'intento-1');
    const b = ordenPractica(20, 'intento-2');
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
  it('sin aleatorio conserva el orden', () => {
    expect(ordenPractica(5, 'x', false)).toEqual([0, 1, 2, 3, 4]);
  });
  it('reparte las posiciones (cada ejercicio aparece primero alguna vez)', () => {
    const primeros = new Set(Array.from({ length: 400 }, (_, k) => ordenPractica(20, `s${k}`)[0]));
    expect(primeros.size).toBe(20);
  });
});

describe('práctica secuencial: ejercicio actual', () => {
  it('es el primero abierto en el orden del intento', () => {
    const orden = [2, 0, 1];
    expect(posicionActual([false, false, false], orden)).toBe(0);
    expect(posicionActual([false, false, true], orden)).toBe(1);
    expect(posicionActual([true, false, true], orden)).toBe(2);
    expect(posicionActual([true, true, true], orden)).toBe(3);
  });
});

describe('práctica secuencial: aviso de rapidez', () => {
  it('usa el umbral de cada dificultad', () => {
    expect(umbralDe(cfg, 'basico')).toBe(120);
    expect(umbralDe(cfg, 'intermedio')).toBe(300);
    expect(umbralDe(cfg, 'desafiante')).toBe(480);
  });
  it('avisa solo al pasar a correcto antes del umbral', () => {
    expect(avisoRapidez(cfg, 'basico', 90, 'draft', 'correct')).toBe(true);
    expect(avisoRapidez(cfg, 'basico', 130, undefined, 'correct')).toBe(false);
    expect(avisoRapidez(cfg, 'intermedio', 299, 'incorrect', 'correct')).toBe(true);
    expect(avisoRapidez(cfg, 'desafiante', 479, undefined, 'correct')).toBe(true);
    expect(avisoRapidez(cfg, 'desafiante', 480, undefined, 'correct')).toBe(false);
  });
  it('no avisa con respuestas incorrectas ni dos veces por el mismo ejercicio', () => {
    expect(avisoRapidez(cfg, 'basico', 10, undefined, 'incorrect')).toBe(false);
    expect(avisoRapidez(cfg, 'basico', 10, 'correct', 'correct')).toBe(false);
  });
  it('un umbral 0 desactiva el aviso', () => {
    expect(avisoRapidez({ ...cfg, umbrales: { ...cfg.umbrales, basico: 0 } }, 'basico', 5, undefined, 'correct')).toBe(false);
  });
});
