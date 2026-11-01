/** Orden aleatorio de opciones: solo presentación, determinista, sin tocar índices ni letras. */
import { describe, expect, it } from 'vitest';
import { dependeDePosicion, ordenOpciones } from '../src/lib/opciones';

const ops = ['La fuerza neta es cero', 'La aceleración es constante', 'La velocidad aumenta', 'La masa disminuye'];

describe('ordenOpciones', () => {
  it('devuelve una permutación de los índices originales, igual para la misma semilla', () => {
    const a = ordenOpciones(ops, 'intento1:q1', true);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(ordenOpciones(ops, 'intento1:q1', true)).toEqual(a);
  });
  it('apagado, con menos de 3 opciones o con opciones que dependen de la posición: no baraja', () => {
    expect(ordenOpciones(ops, 's', false)).toEqual([0, 1, 2, 3]);
    expect(ordenOpciones(['Sí', 'No'], 's', true)).toEqual([0, 1]);
    const conAnteriores = [...ops.slice(0, 3), 'Todas las anteriores'];
    expect(dependeDePosicion(conAnteriores)).toBe(true);
    expect(ordenOpciones(conAnteriores, 's', true)).toEqual([0, 1, 2, 3]);
    expect(dependeDePosicion(['a', 'b', 'a y b', 'ninguna'])).toBe(true);
    expect(dependeDePosicion(ops)).toBe(false);
  });
  it('reparte las posiciones de forma aproximadamente uniforme entre estudiantes', () => {
    const primera = [0, 0, 0, 0];
    for (let s = 0; s < 4000; s++) primera[ordenOpciones(ops, `intento${s}:q1`, true)[0]]++;
    for (const c of primera) expect(Math.abs(c / 4000 - 0.25)).toBeLessThan(0.03);
  });
});
