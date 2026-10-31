import { describe, expect, it } from 'vitest';
import { choque1D, frenadoHorizontal } from '../src/lib/fisica/choques';
import { generarVariante, mulberry32, PLANTILLAS } from '../src/lib/fisica/variantes';

describe('generador reproducible de versiones', () => {
  it('misma semilla → misma versión (reconstrucción exacta para auditoría)', () => {
    for (const p of Object.keys(PLANTILLAS)) {
      expect(generarVariante(p, 12345)).toEqual(generarVariante(p, 12345));
    }
    expect(mulberry32(7)()).toBe(mulberry32(7)());
  });
  it('semillas distintas dan versiones distintas', () => {
    const vs = new Set(Array.from({ length: 50 }, (_, s) => JSON.stringify(generarVariante('A', s).parametros)));
    expect(vs.size).toBeGreaterThan(40);
  });

  for (const [nombre, P] of Object.entries(PLANTILLAS)) {
    it(`plantilla ${nombre}: 300 semillas, parámetros en rango y en la rejilla, respuestas finitas y válidas`, () => {
      for (let s = 0; s < 300; s++) {
        const v = generarVariante(nombre, s * 7919);
        for (const r of P.rangos) {
          const x = v.parametros[r.nombre];
          expect(x).toBeGreaterThanOrEqual(r.min - 1e-9);
          expect(x).toBeLessThanOrEqual(r.max + 1e-9);
          expect(Math.abs((x - r.min) / r.paso - Math.round((x - r.min) / r.paso))).toBeLessThan(1e-6);
        }
        expect(Object.values(v.respuestas).every(Number.isFinite)).toBe(true);
        expect(P.valida(v.parametros, v.respuestas)).toBe(true);
      }
    });
  }

  it('A: las respuestas son las del motor con los parámetros redondeados, y cumplen los balances', () => {
    for (let s = 0; s < 200; s++) {
      const { parametros: p, respuestas: r } = generarVariante('A', s);
      const c = choque1D(p.m1, p.v1, p.m2, 0, 0), f = frenadoHorizontal(p.m1 + p.m2, c.v1f, p.mu, 9.8);
      expect(r.d).toBeCloseTo(f.d, 10);
      expect(r.P).toBeCloseTo((p.m1 + p.m2) * r.v, 10);                    // p se conserva en el choque
      expect(r.Kf).toBeLessThanOrEqual(r.Ki);                               // K no aumenta
      expect(r.W).toBeCloseTo(-r.Kf, 9);                                    // W fricción = −K posterior
      expect(r.dK_choque + r.Kf).toBeCloseTo(r.Ki, 9);
    }
  });
  it('B: o llega con velocidad apreciable o se detiene claramente antes (no se extrapola)', () => {
    let llegan = 0, noLlegan = 0;
    for (let s = 0; s < 300; s++) {
      const { parametros: p, respuestas: r } = generarVariante('B', s);
      if (r.llega) { llegan++; expect(r.v_llegada).toBeGreaterThan(0.3); expect(r.v_llegada).toBeLessThan(r.v); }
      else { noLlegan++; expect(r.d_detencion).toBeLessThan(p.D - 0.2); }
    }
    expect(llegan).toBeGreaterThan(20);
    expect(noLlegan).toBeGreaterThan(20);
  });
  it('C: distancia sobre el plano ≥ altura; sin fricción la altura es v²/2g', () => {
    for (let s = 0; s < 200; s++) {
      const { parametros: p, respuestas: r } = generarVariante('C', s);
      expect(r.s).toBeGreaterThan(r.h);
      if (p.mu === 0) expect(r.h).toBeCloseTo((r.v * r.v) / (2 * 9.8), 9);
    }
  });
  it('E: aparecen P positiva, negativa (y K nunca aumenta)', () => {
    const signos = new Set<number>();
    for (let s = 0; s < 300; s++) {
      const { respuestas: r } = generarVariante('E', s);
      signos.add(Math.sign(Math.round(r.P * 100)));
      expect(r.Kf).toBeLessThanOrEqual(r.Ki + 1e-12);
    }
    expect(signos.has(1) && signos.has(-1)).toBe(true);
  });
  it('G: fuerza del suelo = fuerza neta + peso', () => {
    for (let s = 0; s < 100; s++) {
      const { parametros: p, respuestas: r } = generarVariante('G', s);
      expect(r.F_suelo - r.F_neta).toBeCloseTo(p.m * 9.8, 9);
      expect(r.h2).toBeLessThan(p.h1);
    }
  });
  it('rechaza una plantilla inexistente', () => {
    expect(() => generarVariante('Z', 1)).toThrow();
  });
});
