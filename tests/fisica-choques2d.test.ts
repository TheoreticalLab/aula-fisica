/** Choque 2D entre discos: conservación, casos límite conocidos y ausencia de choque. */
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/tema', () => ({ useDark: () => false }));      // el entorno de pruebas no tiene document
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Choques2D from '../src/sims/Choques2D';
import { resolveParams } from '../src/sims/catalogo';
import { anguloGrados, choque2D, modulo } from '../src/lib/fisica/choques2d';
import { choque1D } from '../src/lib/fisica/choques';

const base = { m1: 2, m2: 1, v1: 4, v2: 0, ang2: 0, b: 0.2, e: 1, R: 0.2 };

describe('choque2D', () => {
  it('conserva la cantidad de movimiento en x y en y para cualquier e', () => {
    for (const e of [0, 0.3, 0.7, 1]) for (const b of [-0.35, 0, 0.1, 0.3]) {
      const c = choque2D({ ...base, e, b, v2: 1.5, ang2: 170 });   // 2 viene hacia 1: siempre chocan con |b| < 2R
      expect(c.choca).toBe(true);
      expect(c.pFin[0]).toBeCloseTo(c.pIni[0], 9);
      expect(c.pFin[1]).toBeCloseTo(c.pIni[1], 9);
      expect(c.Kfin).toBeLessThanOrEqual(c.Kini + 1e-9);
    }
  });
  it('elástico: conserva la energía cinética', () => {
    const c = choque2D({ ...base, b: 0.25 });
    expect(c.Kfin).toBeCloseTo(c.Kini, 9);
  });
  it('masas iguales, elástico y 2 en reposo: las velocidades finales forman 90°', () => {
    const c = choque2D({ ...base, m1: 1, m2: 1, b: 0.2 });
    expect(c.anguloEntreFinales).toBeCloseTo(90, 6);
  });
  it('choque frontal (b = 0) reproduce el modelo 1D', () => {
    for (const e of [0, 0.5, 1]) {
      const c = choque2D({ ...base, b: 0, e, v2: -1, ang2: 0 });
      const u = choque1D(2, 4, 1, -1, e);
      expect(c.v1f[0]).toBeCloseTo(u.v1f, 9);
      expect(c.v2f[0]).toBeCloseTo(u.v2f, 9);
      expect(Math.abs(c.v1f[1]) + Math.abs(c.v2f[1])).toBeLessThan(1e-12);
    }
  });
  it('totalmente inelástico (e = 0): igual velocidad normal después, la tangencial se conserva', () => {
    const c = choque2D({ ...base, e: 0, b: 0.15 });
    const n = c.n!;
    const vn1 = c.v1f[0] * n[0] + c.v1f[1] * n[1], vn2 = c.v2f[0] * n[0] + c.v2f[1] * n[1];
    expect(vn1).toBeCloseTo(vn2, 9);
    const t = [-n[1], n[0]];
    expect(c.v1f[0] * t[0] + c.v1f[1] * t[1]).toBeCloseTo(c.v1i[0] * t[0] + c.v1i[1] * t[1], 9);
  });
  it('sin choque si el parámetro de impacto supera 2R o si no se acercan', () => {
    expect(choque2D({ ...base, b: 0.41 }).choca).toBe(false);
    expect(choque2D({ ...base, v1: -2 }).choca).toBe(false);
  });
  it('el componente se dibuja con choque, sin choque y en vista compacta', () => {
    const html = renderToStaticMarkup(createElement(Choques2D, { params: resolveParams('choques-2d', {}), setParams: () => {} }));
    expect(html).toContain('Vista desde arriba');
    expect(html).toContain('Tipo de choque');
    expect(renderToStaticMarkup(createElement(Choques2D, { params: resolveParams('choques-2d', { b: 0.5 }) }))).toContain('no se tocan');
    expect(renderToStaticMarkup(createElement(Choques2D, { params: resolveParams('choques-2d', {}), compact: true }))).not.toContain('Diagrama de cantidad');
  });
  it('el disco 2 (en reposo) sale a lo largo de la línea de centros', () => {
    const c = choque2D({ ...base, b: 0.2 });
    expect(anguloGrados(c.v2f)).toBeCloseTo(anguloGrados(c.n!), 9);
    expect(modulo(c.v2f)).toBeGreaterThan(0);
  });
});
