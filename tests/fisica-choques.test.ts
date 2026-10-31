import { describe, expect, it } from 'vitest';
import {
  caidaHorizontal, choque1D, choque2DAngulos, choque2DUnidos, compresionResorte, deslizar, energiaCinetica, frenadoHorizontal, fuerzaMedia,
  rebote, recorrerDistancia, restitucionPorAlturas, simularLaboratorio, subidaPlano,
} from '../src/lib/fisica/choques';

const cerca = (a: number, b: number, d = 9) => expect(a).toBeCloseTo(b, d);

describe('Caso de referencia obligatorio: choque totalmente inelástico + frenado por fricción (g = 10)', () => {
  const ch = choque1D(2, 6, 1, 0, 0);
  const f = frenadoHorizontal(3, ch.v1f, 0.25, 10);
  it('durante la colisión', () => {
    cerca(ch.p_inicial, 12); cerca(ch.v1f, 4); cerca(ch.v2f, 4);
    cerca(ch.K_inicial, 36); cerca(ch.K_final, 24); cerca(-ch.delta_K, 12);
    cerca(ch.p_final, ch.p_inicial);                       // se conserva en el choque
  });
  it('durante el deslizamiento', () => {
    cerca(f.Ff, 7.5); cerca(f.a, -2.5); cerca(f.t, 1.6); cerca(f.d, 3.2); cerca(f.W, -24);
    cerca(f.impulso, -12);                                  // impulso externo de la fricción: p NO se conserva al frenar
  });
  it('la simulación distingue los 12 J del choque de los 24 J del deslizamiento', () => {
    const s = simularLaboratorio({ m1: 2, m2: 1, v1: 6, v2: 0, e: 0, mu: 0.25, g: 10, separacion: 1.2 });
    cerca(s.transformada_choque, 12); cerca(s.transformada_deslizamiento, 24);
    cerca(s.t_choque!, 0.2);
    const fin = s.muestras[s.muestras.length - 1];
    expect(fin.v1).toBe(0);
    cerca(fin.x1 - (6 * 0.2), 3.2, 6);                       // se detiene a 3.2 m del punto de choque y NO sigue
    // p del sistema: constante en la etapa A, decrece en la B
    const A = s.muestras.filter((m) => m.etapa === 'A'), B = s.muestras.filter((m) => m.etapa === 'B');
    expect(A.every((m) => Math.abs(m.p1 + m.p2 - 12) < 1e-9)).toBe(true);
    expect(B[B.length - 1].p1 + B[B.length - 1].p2).toBe(0);
  });
});

describe('Caso 2: parcialmente inelástico (e = 0.5)', () => {
  it('v1f = 1, v2f = 3, P = 4, K: 8 → 5 (−3 J)', () => {
    const c = choque1D(1, 4, 1, 0, 0.5);
    cerca(c.v1f, 1); cerca(c.v2f, 3); cerca(c.p_inicial, 4); cerca(c.p_final, 4); cerca(c.K_inicial, 8); cerca(c.K_final, 5); cerca(c.delta_K, -3);
    expect(c.tipo).toBe('parcialmente_inelastico');
    cerca(c.J1, -c.J2);                                      // tercera ley
  });
});

describe('Caso 3: totalmente inelástico con sentidos opuestos', () => {
  it('v = +2.5, P = +10, K: 26 → 12.5 (−13.5 J)', () => {
    const c = choque1D(3, 4, 1, -2, 0);
    cerca(c.v1f, 2.5); cerca(c.v2f, 2.5); cerca(c.p_inicial, 10); cerca(c.K_inicial, 26); cerca(c.K_final, 12.5); cerca(c.delta_K, -13.5);
  });
});

describe('Más casos de validación', () => {
  it('masas iguales, elástico: intercambian velocidades; K se conserva', () => {
    const c = choque1D(2, 3, 2, -1, 1);
    cerca(c.v1f, -1); cerca(c.v2f, 3); cerca(c.delta_K, 0); expect(c.tipo).toBe('elastico');
  });
  it('velocidades opuestas con p total cero y quedan unidos: v final cero, toda la K se transforma', () => {
    const c = choque1D(2, 3, 3, -2, 0);
    cerca(c.v1f, 0); cerca(c.K_final, 0); cerca(-c.delta_K, energiaCinetica(2, 3) + energiaCinetica(3, 2));
  });
  it('elástico con masas distintas: fórmulas clásicas', () => {
    const c = choque1D(1, 6, 2, 0, 1);
    cerca(c.v1f, -2); cerca(c.v2f, 4); cerca(c.delta_K, 0);
  });
  it('restitución por velocidades relativas en cualquier convención', () => {
    for (const e of [0, 0.3, 0.8, 1]) {
      const c = choque1D(1.5, 2, 0.7, -3, e);
      cerca((c.v2f - c.v1f) / (2 - -3), e);                 // e = (v2f − v1f) / (v1 − v2)
      cerca(c.p_final, c.p_inicial);
      expect(c.delta_K).toBeLessThanOrEqual(1e-12);           // nunca aumenta la energía cinética
    }
  });
  it('rechaza parámetros imposibles', () => {
    expect(() => choque1D(0, 1, 1, 0, 0.5)).toThrow();
    expect(() => choque1D(1, 1, 1, 0, 1.2)).toThrow();
  });
});

describe('Movimiento posterior', () => {
  it('sin fricción no se detiene; con movimiento en sentido negativo la aceleración es positiva', () => {
    expect(frenadoHorizontal(1, 2, 0).d).toBe(Infinity);
    const f = frenadoHorizontal(1, -3, 0.5, 10);
    cerca(f.a, 5); cerca(f.d, 0.9); cerca(f.t, 0.6);
  });
  it('no se extrapola después de detenerse', () => {
    const d1 = deslizar(0, 4, 0.25, 10, 1.6), d2 = deslizar(0, 4, 0.25, 10, 10);
    expect(d2).toEqual(d1);                                   // misma posición y v = 0 a los 10 s
    cerca(d1.x, 3.2); expect(d1.v).toBe(0);
  });
  it('recorrer una distancia: llega (primer paso) o reconoce que se detiene antes', () => {
    const r = recorrerDistancia(4, 2.4, 0.25, 10);
    expect(r.llega).toBe(true);
    if (r.llega) { cerca(r.v, 2); cerca(r.t, 0.8); }
    const n = recorrerDistancia(4, 5, 0.25, 10);
    expect(n).toMatchObject({ llega: false });
    if (!n.llega) cerca(n.d_detencion, 3.2);
  });
  it('plano inclinado: distancia sobre el plano ≠ altura; con fricción sube menos', () => {
    const s = subidaPlano(4, 30, 0, 10);
    cerca(s.s, 1.6); cerca(s.h, 0.8); cerca(s.h, 16 / 20);    // sin fricción, h = v²/2g
    expect(subidaPlano(4, 30, 0.2, 10).s).toBeLessThan(s.s);
  });
  it('caída desde una plataforma', () => {
    const c = caidaHorizontal(3, 1.25, 10);
    cerca(c.t, 0.5); cerca(c.alcance, 1.5); cerca(c.vy, 5); cerca(c.v, Math.hypot(3, 5));
  });
  it('resorte: ½ M v² = ½ k x²', () => {
    cerca(compresionResorte(2, 3, 200), 0.3);
  });
});

describe('Rebote contra el suelo', () => {
  it('velocidades, altura, impulso y fuerza media neta frente a fuerza del suelo', () => {
    const r = rebote(0.5, 1.8, 0.5, 10, 0.01);
    cerca(r.v_antes, -6); cerca(r.v_despues, 3); cerca(r.h2, 0.45); cerca(r.J, 4.5);
    cerca(r.F_neta_media!, 450); cerca(r.F_suelo_media!, 455);   // N = F neta + m g
    cerca(restitucionPorAlturas(1.8, 0.45), 0.5);
  });
  it('fuerza media por cambio de velocidad', () => {
    cerca(fuerzaMedia(0.2, -10, 8, 0.02), 180);
  });
});

describe('Choques en dos dimensiones', () => {
  it('conservación por componentes con ángulos de salida', () => {
    const c = choque2DAngulos(1, 5, 1, 30, 60);
    cerca(c.px, 5); cerca(c.py, 0);
    cerca(c.u1, 5 * Math.cos(Math.PI / 6)); cerca(c.u2, 2.5);
    cerca(c.K_final, c.K_inicial);                            // masas iguales y 90° entre salidas: elástico
  });
  it('quedan unidos en un cruce perpendicular', () => {
    const c = choque2DUnidos(1000, 20, 0, 1500, 0, 10);
    cerca(c.vx, 8); cerca(c.vy, 6); cerca(c.v, 10); cerca(c.angulo, (Math.atan2(6, 8) * 180) / Math.PI);
  });
});
