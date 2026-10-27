import { describe, expect, it } from 'vitest';
import { porcentajeAsistencia, textoAsistencia, tonoAsistencia } from '../src/lib/asistencia';
import { textoVerificacion } from '../src/lib/ubicacion';

describe('verificación de ubicación en la asistencia', () => {
  it('texto para el profesor', () => {
    expect(textoVerificacion('verificado', 25, 12)).toBe('📍 a 25 m');
    expect(textoVerificacion('impreciso', 400, 800)).toBe('⚠ ubicación imprecisa (±800 m, a 400 m)');
    expect(textoVerificacion('sin_ubicacion', null, null)).toBe('⚠ sin ubicación');
    expect(textoVerificacion(null, null, null)).toBe('');
  });
});

describe('métrica de asistencia', () => {
  it('porcentaje, nivel y texto', () => {
    expect(porcentajeAsistencia(8, 10)).toBe(80);
    expect(porcentajeAsistencia(0, 0)).toBeNull();
    expect([tonoAsistencia(null), tonoAsistencia(60), tonoAsistencia(80), tonoAsistencia(95)]).toEqual(['gray', 'red', 'amber', 'green']);
    expect(textoAsistencia(7, 9)).toBe('7/9 · 78 %');
    expect(textoAsistencia(0, 0)).toBe('sin clases registradas');
  });
});
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
