import { describe, expect, it } from 'vitest';
import { claveBorrador, confirmarCopia, decidir, esperaReintento, guardarCopia, leerCopia, mismaRespuesta, type Almacen } from '../src/lib/borradores';
import { preguntaVisible } from '../src/lib/telemetria/visibilidad';

describe('criterio de pregunta en pantalla (corrige el observador V1)', () => {
  const caso = (visibleAlto: number, alto: number, pantalla = 800) => preguntaVisible({ isIntersecting: visibleAlto > 0, intersectionRect: { height: visibleAlto }, boundingClientRect: { height: alto }, rootBounds: { height: pantalla } }, pantalla);
  it('pregunta corta: vista solo si se ve al menos la mitad', () => {
    expect(caso(200, 300)).toBe(true);
    expect(caso(10, 300)).toBe(false);          // antes quedaba «vista» con un borde en pantalla
  });
  it('pregunta más alta que dos pantallas: vista si ocupa media pantalla o más', () => {
    expect(caso(800, 2400)).toBe(true);         // antes nunca llegaba al 50 % y no se marcaba nunca
    expect(caso(300, 2400)).toBe(false);
  });
  it('fuera de pantalla', () => expect(caso(0, 300)).toBe(false));
});

const memoria = (): Almacen & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, leer: (k) => m.get(k) ?? null, escribir: (k, v) => void m.set(k, v), borrar: (k) => void m.delete(k) };
};

describe('borradores en el dispositivo (práctica clásica)', () => {
  it('igualdad de respuestas sin depender del orden ni de espacios', () => {
    expect(mismaRespuesta({ selected: [2, 0] }, { selected: [0, 2] })).toBe(true);
    expect(mismaRespuesta({ text: ' 4 m/s ' }, { text: '4 m/s' })).toBe(true);
    expect(mismaRespuesta({ text: '' }, {})).toBe(true);
    expect(mismaRespuesta({ text: '4 m/s' }, { text: '4.0 m/s' })).toBe(false);
  });
  it('se guarda una copia y solo se borra cuando el servidor confirma ESA respuesta', () => {
    const a = memoria();
    guardarCopia(a, 'A', 'E', { answer: { text: '4.0 m/s' }, base: null, t: 1 });
    confirmarCopia(a, 'A', 'E', { text: '4 m/s' });                 // confirmó una anterior: la copia más nueva se conserva
    expect(leerCopia(a, 'A', 'E')?.answer).toEqual({ text: '4.0 m/s' });
    confirmarCopia(a, 'A', 'E', { text: '4.0 m/s' });
    expect(a.m.has(claveBorrador('A', 'E'))).toBe(false);
  });
  it('salir antes de que se guarde: al volver se recupera (el servidor no cambió)', () => {
    const copia = { answer: { text: '9.8 m/s^2' }, base: '2026-10-31T10:00:00Z', t: 5 };
    expect(decidir(copia, { answer: { text: '' }, updated_at: '2026-10-31T10:00:00Z' })).toEqual({ accion: 'recuperar', answer: { text: '9.8 m/s^2' } });
    expect(decidir({ ...copia, base: null }, null)).toMatchObject({ accion: 'recuperar' });
  });
  it('después de guardados propios (base obsoleta): si el servidor tiene lo último que confirmó este dispositivo, se recupera', () => {
    const copia = { answer: { text: '4.00 m/s' }, base: '2026-10-31T10:00:00Z', confirmada: { text: '4.0 m/s' }, t: 9 };
    expect(decidir(copia, { answer: { text: '4.0 m/s' }, updated_at: '2026-10-31T10:03:00Z' })).toMatchObject({ accion: 'recuperar' });
    expect(decidir(copia, { answer: { text: 'otra cosa' }, updated_at: '2026-10-31T10:04:00Z' })).toMatchObject({ accion: 'conflicto' });
  });

  it('otro dispositivo guardó después: conflicto, nunca se sobrescribe solo', () => {
    const copia = { answer: { text: 'del teléfono' }, base: '2026-10-31T10:00:00Z', t: 5 };
    expect(decidir(copia, { answer: { text: 'del portátil' }, updated_at: '2026-10-31T10:05:00Z' })).toMatchObject({ accion: 'conflicto' });
  });
  it('copia igual a lo guardado o inexistente: nada que hacer', () => {
    expect(decidir(null, { answer: { text: 'x' }, updated_at: null })).toEqual({ accion: 'nada' });
    expect(decidir({ answer: { text: 'x' }, base: 'b', t: 1 }, { answer: { text: 'x' }, updated_at: 'otro' })).toEqual({ accion: 'nada' });
  });
  it('almacén roto o datos corruptos no rompen nada', () => {
    const roto: Almacen = { leer: () => { throw new Error('bloqueado'); }, escribir: () => { throw new Error('lleno'); }, borrar: () => { throw new Error('x'); } };
    expect(() => guardarCopia(roto, 'A', 'E', { answer: {}, base: null, t: 0 })).not.toThrow();
    expect(leerCopia(roto, 'A', 'E')).toBeNull();
    const a = memoria(); a.escribir(claveBorrador('A', 'E'), '{no es json');
    expect(leerCopia(a, 'A', 'E')).toBeNull();
  });
  it('reintentos con espera creciente y acotada', () => {
    expect([1, 2, 3, 4, 10].map(esperaReintento)).toEqual([2000, 5000, 15000, 30000, 30000]);
  });
});
