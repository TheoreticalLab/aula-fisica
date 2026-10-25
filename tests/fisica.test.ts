/**
 * Validación física de los modelos de los simuladores: resultados analíticos conocidos,
 * casos límite, conservación de la energía y coherencia entre ecuaciones.
 */
import { describe, expect, it } from 'vitest';
import {
  direccionGrados,
  estadoBloque,
  estadoMcu,
  estadoProyectil,
  estadoVertical,
  fuerzasEnReposo,
  lanzamientoVertical,
  magnitud,
  mcu,
  mrua,
  proyectil,
  restar,
  sumar,
  tiempoVelocidadCero,
  tramosBloque,
  vectorPolar,
} from '@/fisica/modelos';
import { resolveParams, SIMULATIONS } from '@/sims/catalogo';

const g = 9.8;

describe('vectores', () => {
  it('componentes de un vector 3-4-5', () => {
    const v = vectorPolar(5, 53.130102354);
    expect(v.x).toBeCloseTo(3, 6);
    expect(v.y).toBeCloseTo(4, 6);
  });
  it('la suma por componentes coincide con la ley del coseno', () => {
    const A = vectorPolar(5, 30);
    const B = vectorPolar(4, 120);
    const R = sumar(A, B);
    const ang = (120 - 30) * (Math.PI / 180);
    expect(magnitud(R)).toBeCloseTo(Math.sqrt(25 + 16 + 2 * 5 * 4 * Math.cos(ang)), 10);
  });
  it('A − A = 0 y la dirección está en (−180, 180]', () => {
    const A = vectorPolar(7, -135);
    expect(magnitud(restar(A, A))).toBeCloseTo(0, 12);
    expect(direccionGrados(A)).toBeCloseTo(-135, 10);
    expect(direccionGrados({ x: -1, y: 0 })).toBeCloseTo(180, 10);
  });
});

describe('movimiento rectilíneo', () => {
  it('MRU: x = x0 + v t', () => {
    const s = mrua(-20, 4, 0, 5);
    expect(s.x).toBe(0);
    expect(s.v).toBe(4);
  });
  it('MRUA: v² = v0² + 2aΔx en todo instante', () => {
    for (const t of [0.5, 1, 3.7, 8]) {
      const s = mrua(2, 3, -1.2, t);
      expect(s.v * s.v).toBeCloseTo(9 + 2 * -1.2 * (s.x - 2), 9);
    }
  });
  it('velocidad media = (v0 + v)/2 con aceleración constante', () => {
    const t = 6;
    const s = mrua(0, 2, 1.5, t);
    expect(s.x / t).toBeCloseTo((2 + s.v) / 2, 12);
  });
  it('instante en que se detiene', () => {
    expect(tiempoVelocidadCero(10, -2)).toBe(5);
    expect(tiempoVelocidadCero(10, 2)).toBeNull();
    expect(tiempoVelocidadCero(10, 0)).toBeNull();
  });
});

describe('caída libre y lanzamiento vertical', () => {
  it('soltar desde 20 m: t = √(2h/g)', () => {
    const r = lanzamientoVertical(20, 0, g);
    expect(r.tiempoVuelo).toBeCloseTo(Math.sqrt((2 * 20) / g), 12);
    expect(r.velocidadImpacto).toBeCloseTo(-Math.sqrt(2 * g * 20), 12);
    expect(r.alturaMaxima).toBe(20);
  });
  it('lanzamiento desde el suelo: simetría subida/bajada', () => {
    const r = lanzamientoVertical(0, 19.6, g);
    expect(r.tiempoSubida).toBeCloseTo(2, 12);
    expect(r.tiempoVuelo).toBeCloseTo(4, 12);
    expect(r.alturaMaxima).toBeCloseTo(19.6, 12);
    expect(r.velocidadImpacto).toBeCloseTo(-19.6, 12);
  });
  it('en la altura máxima v = 0 pero a = −g', () => {
    const r = lanzamientoVertical(5, 10, g);
    const s = estadoVertical(5, 10, g, r.tiempoSubida);
    expect(s.v).toBeCloseTo(0, 12);
    expect(s.y).toBeCloseTo(r.alturaMaxima, 12);
  });
  it('conservación de la energía mecánica por unidad de masa', () => {
    const E0 = 0.5 * 12 * 12 + g * 30;
    for (const t of [0.3, 1.1, 2.4, 3.9]) {
      const s = estadoVertical(30, 12, g, t);
      expect(0.5 * s.v * s.v + g * s.y).toBeCloseTo(E0, 9);
    }
  });
  it('el resultado no depende de la masa (no aparece en el modelo)', () => {
    expect(lanzamientoVertical.length).toBe(3);
  });
});

describe('proyectiles', () => {
  it('alcance en terreno horizontal: R = v0² sin(2θ)/g', () => {
    for (const th of [15, 30, 45, 60, 75]) {
      const r = proyectil(20, th, 0, g);
      expect(r.alcance).toBeCloseTo((400 * Math.sin((2 * th * Math.PI) / 180)) / g, 9);
    }
  });
  it('ángulos complementarios dan el mismo alcance y 45° es el máximo', () => {
    expect(proyectil(25, 30, 0, g).alcance).toBeCloseTo(proyectil(25, 60, 0, g).alcance, 9);
    const r45 = proyectil(25, 45, 0, g).alcance;
    for (const th of [40, 44, 46, 50]) expect(proyectil(25, th, 0, g).alcance).toBeLessThan(r45);
  });
  it('altura máxima H = (v0 sinθ)²/(2g) y t_vuelo = 2 v0 sinθ / g', () => {
    const r = proyectil(30, 50, 0, g);
    const vy = 30 * Math.sin((50 * Math.PI) / 180);
    expect(r.alturaMaxima).toBeCloseTo((vy * vy) / (2 * g), 9);
    expect(r.tiempoVuelo).toBeCloseTo((2 * vy) / g, 9);
  });
  it('lanzamiento horizontal desde una altura', () => {
    const r = proyectil(10, 0, 45, g);
    expect(r.tiempoVuelo).toBeCloseTo(Math.sqrt((2 * 45) / g), 9);
    expect(r.alcance).toBeCloseTo(10 * Math.sqrt((2 * 45) / g), 9);
  });
  it('vx constante y energía conservada a lo largo de la trayectoria', () => {
    const E0 = 0.5 * 20 * 20 + g * 10;
    for (const t of [0.2, 1, 2, 2.5]) {
      const s = estadoProyectil(20, 35, 10, g, t);
      expect(s.vx).toBeCloseTo(20 * Math.cos((35 * Math.PI) / 180), 12);
      expect(0.5 * (s.vx * s.vx + s.vy * s.vy) + g * s.y).toBeCloseTo(E0, 9);
    }
  });
  it('la rapidez de impacto en terreno horizontal es igual a v0', () => {
    const r = proyectil(18, 40, 0, g);
    expect(r.rapidezImpacto).toBeCloseTo(18, 9);
    expect(r.anguloImpactoGrados).toBeCloseTo(40, 9);
  });
});

describe('movimiento circular uniforme', () => {
  it('v = 2πr/T y a_c = v²/r = ω² r', () => {
    const m = mcu(2, 4);
    expect(m.v).toBeCloseTo(Math.PI, 12);
    expect(m.ac).toBeCloseTo((Math.PI * Math.PI) / 2, 12);
    expect(m.ac).toBeCloseTo(m.omega * m.omega * 2, 12);
    expect(m.f).toBe(0.25);
  });
  it('la velocidad es tangente y la aceleración apunta al centro', () => {
    for (const t of [0.3, 1.7, 3.1]) {
      const s = estadoMcu(2, 4, t);
      expect(s.x * s.vx + s.y * s.vy).toBeCloseTo(0, 10); // r ⟂ v
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(2, 12);
      // a = −ω² r (antiparalela a la posición)
      const w2 = (2 * Math.PI / 4) ** 2;
      expect(s.ax).toBeCloseTo(-w2 * s.x, 10);
      expect(s.ay).toBeCloseTo(-w2 * s.y, 10);
    }
  });
});

describe('fuerzas, fricción y plano inclinado', () => {
  const base = { m: 2, F: 0, theta: 0, muS: 0.4, muK: 0.3, g };
  it('horizontal sin fuerza: reposo, N = mg y sin fricción', () => {
    const r = fuerzasEnReposo(base);
    expect(r.permaneceEnReposo).toBe(true);
    expect(r.normal).toBeCloseTo(19.6, 12);
    expect(r.friccion).toBeCloseTo(0, 12);
  });
  it('la fricción estática se ajusta mientras F ≤ μs N', () => {
    const r = fuerzasEnReposo({ ...base, F: 7 });
    expect(r.permaneceEnReposo).toBe(true);
    expect(r.friccion).toBeCloseTo(-7, 12);
    expect(r.tipoFriccion).toBe('estatica');
    expect(fuerzasEnReposo({ ...base, F: 0.4 * 19.6 }).permaneceEnReposo).toBe(true);
  });
  it('si F > μs N el bloque desliza con a = (F − μk N)/m', () => {
    const r = fuerzasEnReposo({ ...base, F: 20 });
    expect(r.permaneceEnReposo).toBe(false);
    expect(r.aceleracion).toBeCloseTo((20 - 0.3 * 19.6) / 2, 12);
  });
  it('plano sin fricción: a = −g sinθ', () => {
    const r = fuerzasEnReposo({ ...base, theta: 30, muS: 0, muK: 0 });
    expect(r.aceleracion).toBeCloseTo(-g * 0.5, 12);
    expect(r.normal).toBeCloseTo(2 * g * Math.cos(Math.PI / 6), 12);
  });
  it('ángulo crítico: tanθ = μs', () => {
    const crit = (Math.atan(0.4) * 180) / Math.PI; // ≈ 21.8°
    expect(fuerzasEnReposo({ ...base, theta: crit - 0.5 }).permaneceEnReposo).toBe(true);
    expect(fuerzasEnReposo({ ...base, theta: crit + 0.5 }).permaneceEnReposo).toBe(false);
  });
  it('baja por el plano con fricción: a = −g (sinθ − μk cosθ)', () => {
    const th = (40 * Math.PI) / 180;
    const r = fuerzasEnReposo({ ...base, theta: 40 });
    expect(r.aceleracion).toBeCloseTo(-g * (Math.sin(th) - 0.3 * Math.cos(th)), 12);
  });
  it('subir con fuerza aplicada', () => {
    const th = (30 * Math.PI) / 180;
    const r = fuerzasEnReposo({ ...base, theta: 30, F: 30 });
    expect(r.aceleracion).toBeCloseTo((30 - 2 * g * Math.sin(th) - 0.3 * 2 * g * Math.cos(th)) / 2, 12);
  });
  it('segunda ley: F_neta = m a', () => {
    const r = fuerzasEnReposo({ ...base, F: 50, m: 5 });
    expect(r.fuerzaNeta).toBeCloseTo(5 * r.aceleracion, 12);
  });
  it('μk > μs (atípico) no produce movimiento contra la fuerza', () => {
    const r = fuerzasEnReposo({ ...base, F: 9, muS: 0.4, muK: 0.6 });
    expect(r.permaneceEnReposo).toBe(true);
  });
  it('evolución temporal: MRUA desde el reposo', () => {
    const p = { ...base, F: 20 };
    const tr = tramosBloque(p, 10);
    const a = (20 - 0.3 * 19.6) / 2;
    const s = estadoBloque(tr, 4);
    expect(s.x).toBeCloseTo(0.5 * a * 16, 10);
    expect(s.v).toBeCloseTo(a * 4, 10);
  });
});

describe('catálogo de simuladores', () => {
  it('valores por defecto dentro de rango y claves únicas', () => {
    const keys = new Set<string>();
    for (const s of SIMULATIONS) {
      expect(keys.has(s.key)).toBe(false);
      keys.add(s.key);
      for (const p of s.params) {
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
        expect(p.step).toBeGreaterThan(0);
      }
      expect(s.simplifications.length).toBeGreaterThan(0);
    }
  });
  it('resolveParams recorta valores fuera de rango', () => {
    expect(resolveParams('caida-libre', { y0: 500 }).y0).toBe(100);
    expect(resolveParams('caida-libre', {}).g).toBe(9.8);
  });
});
