import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ClaseAmpliada, DondeEstudiar } from '../src/components/clases/Presentacion';
import { casoCobertura, elegirEncabezado, fechaClase, filtrarClases, hoyAcademico, normApartado, urlEnlace, type EnlaceMin } from '../src/lib/clases';
import { planificarPizarra, PIZARRA_CALIDAD_MINIMA, PIZARRA_CORTO_MINIMO } from '../src/lib/imagen';
import type { Enlace } from '../src/lib/clases';

const C = 'curso-1';
const enlace = (p: Partial<Enlace>): Enlace => ({ id: Math.random().toString(), tipo: 'leccion', lesson_id: null, leccion_id: null, unit_id: null, exercise_id: null, sim_key: null,
  apartado: null, concepto: null, cobertura: 'completa', estado: 'confirmado', origen: 'ia', leccion: 'Trabajo y energía', course_id: C, unidad: null, ejercicio: null, ...p });

describe('Clases impartidas · presentación', () => {
  it('las ecuaciones se renderizan con KaTeX y el HTML del modelo no se ejecuta', () => {
    const html = renderToStaticMarkup(createElement(ClaseAmpliada, { contenido: { secciones: [
      { titulo: 'Desarrollo matemático', cuerpo: 'Teorema: $W = \\Delta K$\n\n$$\n\\frac{d}{dt}\\left(\\tfrac12 m v^2\\right) = F v\n$$\n\n<script>alert(1)</script>' },
      { titulo: 'Incertidumbres', cuerpo: 'Un exponente (dudoso).', clave: 'incertidumbres' },
    ] } }));
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('<script>');
  });
  it('sin aviso de IA; la nota sobre la lectura de las pizarras va primero; títulos vigentes también en versiones antiguas', () => {
    const html = renderToStaticMarkup(createElement(ClaseAmpliada, { contenido: { secciones: [
      { clave: 'reconstruccion', titulo: 'Reconstrucción de la pizarra', cuerpo: 'Pizarra 1: $v = 3{,}5$ m/s' },
      { clave: 'ampliaciones', titulo: 'Ampliaciones generadas por IA', cuerpo: 'Complemento.' },
      { clave: 'incertidumbres', titulo: 'Incertidumbres de la reconstrucción', cuerpo: 'En la pizarra 1 se observa 3,5 m/s; si fuera 3,8 m/s, el procedimiento es el mismo.' },
      { clave: 'errores', titulo: 'Errores frecuentes', cuerpo: '' },
    ] } }));
    expect(html).not.toMatch(/inteligencia artificial|generadas por IA/i);
    expect(html.indexOf('Nota sobre la lectura de las pizarras')).toBeLessThan(html.indexOf('Lo trabajado en la pizarra'));
    expect(html).toContain('>Ampliaciones<');
    expect(html).not.toContain('Errores frecuentes');      // secciones vacías no se muestran
  });
  it('enlaces internos solo con identificadores devueltos por la base; apartado exacto por parámetro', () => {
    expect(urlEnlace(enlace({ lesson_id: 'L1', apartado: 'Teorema trabajo-energía' }) as EnlaceMin, C)).toBe('/curso/curso-1/leccion/L1?s=teoria&a=Teorema%20trabajo-energ%C3%ADa');
    expect(urlEnlace(enlace({ tipo: 'ejercicio', exercise_id: 'E1', leccion_id: 'L1' }) as EnlaceMin, C)).toBe('/curso/curso-1/leccion/L1?s=practica');
    expect(urlEnlace(enlace({ tipo: 'simulador', lesson_id: 'L1', sim_key: 'plano' }) as EnlaceMin, C)).toBe('/curso/curso-1/leccion/L1?s=simulacion');
    expect(urlEnlace(enlace({ tipo: 'brecha', concepto: 'Potencia' }) as EnlaceMin, C)).toBeNull();
    expect(urlEnlace(enlace({ tipo: 'leccion', lesson_id: null }) as EnlaceMin, C)).toBeNull();
  });
  it('casos A (existe), B (parcial) y C (no existe en la teoría)', () => {
    expect(casoCobertura([enlace({ lesson_id: 'L1' })])).toBe('A');
    expect(casoCobertura([enlace({ lesson_id: 'L1', cobertura: 'parcial' })])).toBe('B');
    expect(casoCobertura([enlace({ lesson_id: 'L1' }), enlace({ tipo: 'brecha', concepto: 'x', cobertura: 'ninguna' })])).toBe('B');
    expect(casoCobertura([enlace({ tipo: 'brecha', concepto: 'x', cobertura: 'ninguna' })])).toBe('C');
    expect(casoCobertura([])).toBeNull();
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(DondeEstudiar, { enlaces: [enlace({ tipo: 'brecha', concepto: 'Potencia instantánea', cobertura: 'ninguna' })], courseId: C })));
    expect(html).toContain('todavía no está desarrollado en la teoría oficial');
    expect(html).toContain('Potencia instantánea');
  });
  it('el estudiante no ve los enlaces rechazados; el profesor ve cuáles son sugerencias de la IA', () => {
    const enl = [enlace({ lesson_id: 'L1', estado: 'sugerido' }), enlace({ lesson_id: 'L2', leccion: 'Rechazada', estado: 'rechazado' })];
    const prof = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(DondeEstudiar, { enlaces: enl, courseId: C, docente: true })));
    expect(prof).toContain('sugerido por IA');
    expect(prof).not.toContain('Rechazada');
  });
  it('búsqueda del apartado exacto en la teoría renderizada (tildes, LaTeX y símbolos no importan)', () => {
    const hs = [{ el: 'h1', texto: 'Introducción' }, { el: 'h2', texto: 'Teorema trabajo–energía: W=ΔK W = \\Delta K' }, { el: 'h3', texto: 'Fuerzas conservativas' }];
    expect(elegirEncabezado(hs, 'Fuerzas conservativas')).toBe('h3');
    expect(elegirEncabezado(hs, 'Teorema trabajo-energía')).toBe('h2');
    expect(elegirEncabezado(hs, 'Inexistente')).toBeNull();
    expect(normApartado('Energía $E_k$ **cinética**')).toBe('energia cinetica');
  });
  it('filtros por fecha, tema y unidad; fecha de la clase sin desplazamiento de zona horaria', () => {
    const xs = [
      { fecha: '2026-10-30', title: 'Cinemática', temas: ['MRUA'], unit_id: 'U1', unidad: 'Movimiento' },
      { fecha: '2026-11-02', title: 'Trabajo', temas: ['energía'], unit_id: 'U2', unidad: 'Energía' },
    ];
    expect(filtrarClases(xs, { desde: '2026-11-01' })).toHaveLength(1);
    expect(filtrarClases(xs, { texto: 'energia' })[0].title).toBe('Trabajo');
    expect(filtrarClases(xs, { unidad: 'U1' })[0].title).toBe('Cinemática');
    expect(fechaClase('2026-11-02')).toMatch(/2 de noviembre de 2026/);
    expect(hoyAcademico(new Date('2026-11-03T02:30:00Z'))).toBe('2026-11-02');   // 22:30 en Santo Domingo
  });
  it('las pizarras nunca se comprimen por debajo de la legibilidad mínima', () => {
    for (const [w, h] of [[4032, 3024], [3000, 4000], [1600, 1200], [8000, 6000]]) {
      for (const p of planificarPizarra(w, h)) {
        expect(p.calidad).toBeGreaterThanOrEqual(PIZARRA_CALIDAD_MINIMA);
        expect(Math.min(p.ancho, p.alto)).toBeGreaterThanOrEqual(Math.min(PIZARRA_CORTO_MINIMO, Math.min(w, h)) - 1);
      }
    }
  });
});
