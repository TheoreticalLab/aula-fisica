/**
 * Medidor de tiempo efectivo con un reloj simulado: cálculos exactos de los casos del enunciado.
 */
import { describe, expect, it } from 'vitest';
import { aCsv, contextoDeRuta, etiquetaSeccion, formatoDuracion, histograma, MedidorTiempo, mediana } from '../src/lib/tiempo';

const S = 1000;
const MIN = 60 * S;

/** Simula actividad: una señal fuerte cada `cada` segundos durante `duracion` segundos desde `t0`. */
function actividad(m: MedidorTiempo, t0: number, duracion: number, cada = 10): number {
  let t = t0;
  for (; t <= t0 + duracion * S; t += cada * S) m.senal(t, 'fuerte');
  return t0 + duracion * S;
}

describe('tiempo efectivo', () => {
  it('10 minutos de actividad continua dan ~10 minutos efectivos', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    const fin = actividad(m, 0, 600, 20);
    const t = m.totales(fin);
    expect(t.effective).toBeGreaterThanOrEqual(595);
    expect(t.effective).toBeLessThanOrEqual(600);
    expect(t.visible).toBe(600);
  });

  it('una pestaña abierta una hora sin interacción no produce una hora efectiva', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    const t = m.totales(60 * MIN);
    expect(t.effective).toBe(30); // solo la cola de lectura tras abrir la página
    expect(t.visible).toBe(3600);
    expect(t.idle).toBe(3570);
  });

  it('cambiar de pestaña suspende la medición y volver la reanuda, conservando lo acumulado', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    actividad(m, 0, 120);
    m.visibilidad(120 * S, false);
    const fuera = m.totales(20 * MIN);
    expect(fuera.effective).toBe(120);
    expect(fuera.hidden).toBe(18 * 60);
    m.visibilidad(20 * MIN, true);
    const fin = actividad(m, 20 * MIN, 60);
    expect(m.totales(fin).effective).toBe(180);
  });

  it('perder el foco de la ventana también suspende', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    actividad(m, 0, 60);
    m.foco_(60 * S, false);
    const t = m.totales(10 * MIN);
    expect(t.effective).toBe(60);
    expect(t.visible).toBe(600);
  });

  it('lectura prolongada: pausas de hasta 2 min cuentan; una pausa mayor solo acredita la cola', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    m.senal(0, 'fuerte');
    m.senal(100 * S, 'fuerte'); // leyó 100 s sin tocar nada: cuenta
    expect(m.totales(100 * S).effective).toBe(100);
    m.senal(400 * S, 'fuerte'); // 300 s sin señal: solo 30 s de cola
    const t = m.totales(400 * S);
    expect(t.effective).toBe(130);
    expect(t.idle).toBe(270);
  });

  it('un cierre inesperado durante una pausa no acredita más que la cola', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    actividad(m, 0, 60);
    // 100 s después de la última señal el navegador se cierra: lo informado incluye solo 30 s de la pausa
    expect(m.totales(160 * S).effective).toBe(90);
  });

  it('visitas de menos de 15 s de actividad no suman tiempo efectivo', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    m.senal(5 * S, 'fuerte');
    m.visibilidad(10 * S, false);
    expect(m.totales(10 * S).effective).toBe(0);
    expect(m.totales(10 * S).visible).toBe(10);
  });

  it('navegación muy rápida entre secciones no produce incrementos', () => {
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const m = new MedidorTiempo(i * 3 * S, { visible: true, foco: true });
      total += m.totales(i * 3 * S + 3 * S).effective; // 3 s en cada sección
    }
    expect(total).toBe(0);
  });

  it('el movimiento del ratón por sí solo no sostiene el tiempo indefinidamente', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    m.senal(0, 'fuerte');
    for (let t = 1; t <= 3600; t += 2) m.senal(t * S, 'debil'); // «ratón automático» durante una hora
    const t = m.totales(3600 * S);
    // como mucho weakMax (180 s) tras la señal fuerte + la cola de lectura
    expect(t.effective).toBeLessThanOrEqual(180 + 30 + 2);
    expect(t.weak).toBeGreaterThan(0);
  });

  it('respuestas a ejercicios cuentan como actividad y se registran', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    m.senal(90 * S, 'respuesta');
    m.senal(180 * S, 'respuesta');
    const t = m.totales(180 * S);
    expect(t.answers).toBe(2);
    expect(t.effective).toBe(180);
  });

  it('una pestaña en segundo plano no acumula aunque reciba eventos', () => {
    const m = new MedidorTiempo(0, { visible: false, foco: false });
    for (let t = 0; t < 600; t += 5) m.senal(t * S, 'fuerte');
    const t = m.totales(600 * S);
    expect(t.effective).toBe(0);
    expect(t.hidden).toBe(600);
  });

  it('los totales son acumulados y no decrecen (idempotencia del latido)', () => {
    const m = new MedidorTiempo(0, { visible: true, foco: true });
    let previo = 0;
    for (let t = 0; t <= 900; t += 15) {
      if (t % 45 === 0) m.senal(t * S, 'fuerte');
      const e = m.totales(t * S).effective;
      expect(e).toBeGreaterThanOrEqual(previo);
      previo = e;
    }
  });
});

describe('contexto por ruta (medición automática de secciones nuevas)', () => {
  const c = '11111111-1111-4111-8111-111111111111';
  const l = '22222222-2222-4222-8222-222222222222';
  it('lección y subsección', () => {
    expect(contextoDeRuta(`/curso/${c}/leccion/${l}`, '?s=ejemplos')).toEqual({ kind: 'leccion', ref: l, section: 'ejemplos' });
    expect(contextoDeRuta(`/curso/${c}/leccion/${l}`, '')).toEqual({ kind: 'leccion', ref: l, section: 'teoria' });
    expect(contextoDeRuta(`/curso/${c}/leccion/${l}`, '?s=nueva-pestana')?.section).toBe('nueva-pestana');
  });
  it('asignatura, actividad, intento y páginas generales; el profesor no se mide', () => {
    expect(contextoDeRuta(`/curso/${c}`, '')).toEqual({ kind: 'curso', ref: c, section: 'inicio-curso' });
    expect(contextoDeRuta(`/actividad/${l}`, '')?.kind).toBe('actividad');
    expect(contextoDeRuta(`/intento/${l}`, '')?.kind).toBe('intento');
    expect(contextoDeRuta('/laboratorio/proyectiles', '')?.section).toBe('laboratorio:proyectiles');
    expect(contextoDeRuta('/docente', '')).toBeNull();
    expect(contextoDeRuta('/ingresar', '')).toBeNull();
  });
  it('una sección maliciosa se sanea', () => {
    expect(contextoDeRuta(`/curso/${c}/leccion/${l}`, '?s=<script>')?.section).toMatch(/^[a-z0-9][a-z0-9:_-]*$/);
  });
});

describe('utilidades del panel', () => {
  it('mediana y formato', () => {
    expect(mediana([])).toBe(0);
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(formatoDuracion(9300)).toBe('2 h 35 min');
    expect(formatoDuracion(480)).toBe('8 min');
    expect(formatoDuracion(45)).toBe('45 s');
  });
  it('histograma, CSV y etiquetas', () => {
    const h = histograma([0, 300, 600, 3600]);
    expect(h.reduce((s, b) => s + b.n, 0)).toBe(4);
    expect(h[0].desde).toBe(0);
    expect(aCsv([['a;b', 1], ['x"y', null]])).toBe('﻿"a;b";1\r\n"x""y";');
    expect(etiquetaSeccion('ejemplos')).toBe('Ejemplos resueltos');
    expect(etiquetaSeccion('laboratorio:proyectiles')).toBe('laboratorio proyectiles');
  });
});
