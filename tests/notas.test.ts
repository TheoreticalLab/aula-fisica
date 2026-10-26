import { describe, expect, it } from 'vitest';
import { calcularNota, CATEGORIAS, leerCelda } from '../src/lib/notas';

describe('registro de calificaciones', () => {
  it('la distribución suma 100', () => {
    expect(CATEGORIAS.reduce((s, c) => s + c.max, 0)).toBe(100);
  });
  it('suma categorías y extras; la nota oficial no pasa de 100 y se conserva el bruto', () => {
    expect(calcularNota({ parcial1: 15, parcial2: 15, parcial3: 15, practica: 30, final: 25 }, 3)).toEqual({ bruto: 103, final: 100, pendientes: [] });
    expect(calcularNota({ parcial1: 10, parcial2: 12.5, parcial3: 9, practica: 25, final: 20 }, 2)).toEqual({ bruto: 78.5, final: 78.5, pendientes: [] });
  });
  it('distingue pendiente de cero', () => {
    const r = calcularNota({ parcial1: 0, parcial2: null, practica: 20 }, 0);
    expect(r.pendientes).toEqual(['parcial2', 'parcial3', 'final']);
    expect(r.final).toBe(20);
  });
  it('valida las celdas', () => {
    expect(leerCelda('', 15)).toEqual({ ok: true, valor: null });
    expect(leerCelda('12,5', 15)).toEqual({ ok: true, valor: 12.5 });
    expect(leerCelda('0', 25)).toEqual({ ok: true, valor: 0 });
    expect(leerCelda('16', 15).ok).toBe(false);
    expect(leerCelda('-1', 15).ok).toBe(false);
    expect(leerCelda('abc', 15).ok).toBe(false);
  });
});
