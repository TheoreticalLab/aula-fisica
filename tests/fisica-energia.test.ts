/**
 * Validación física de los simuladores de trabajo-energía, conservación de la energía, oscilador y colisiones
 * frente a soluciones analíticas, casos límite y leyes de conservación.
 */
import { describe, expect, it } from 'vitest';
import { colision1D, energiasVertical, oscilador, simularPista, trabajoEnergia, verletOscilador } from '@/fisica/energia';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe('trabajo y energía cinética', () => {
  it('teorema trabajo-energía: el trabajo neto es igual al cambio de energía cinética', () => {
    const r = trabajoEnergia({ m: 2, F: 20, phi: 30, muK: 0.2, d: 5, v0: 1, g: 9.8 });
    expect(r.valido).toBe(true);
    expect(rel(r.W.neto, r.K1 - r.K0)).toBeLessThan(1e-12);
    expect(rel(r.W.neto, r.W.F + r.W.friccion + r.W.normal + r.W.peso)).toBeLessThan(1e-12);
    // N = mg − F sen φ y fricción μk N
    expect(r.N).toBeCloseTo(2 * 9.8 - 20 * 0.5, 10);
    expect(r.f).toBeCloseTo(0.2 * r.N, 10);
  });

  it('sin fricción y fuerza horizontal: v² = v0² + 2Fd/m (caso analítico)', () => {
    const r = trabajoEnergia({ m: 4, F: 12, phi: 0, muK: 0, d: 6, v0: 0, g: 9.8 });
    expect(r.v1).toBeCloseTo(Math.sqrt((2 * 12 * 6) / 4), 10);
    expect(r.W.normal).toBe(0);
    expect(r.W.peso).toBe(0);
  });

  it('si la fricción gana, el bloque se detiene antes de recorrer d y K final es cero', () => {
    const r = trabajoEnergia({ m: 2, F: 0, phi: 0, muK: 0.5, d: 20, v0: 4, g: 9.8 });
    expect(r.seDetiene).toBe(true);
    expect(r.s).toBeCloseTo(16 / (2 * 0.5 * 9.8), 10); // v0²/(2μg)
    expect(r.K1).toBeCloseTo(0, 10);
  });

  it('una fuerza que levantaría el bloque se rechaza (N < 0)', () => {
    expect(trabajoEnergia({ m: 1, F: 100, phi: 60, muK: 0.2, d: 5, v0: 0, g: 9.8 }).valido).toBe(false);
  });
});

describe('pista: conservación de la energía', () => {
  const base = { m: 1, h0: 5, v0: 0, theta1: 40, theta2: 30, L: 4, muK: 0, g: 9.8 };

  it('sin fricción la energía mecánica se conserva y el bloque sube hasta la altura inicial', () => {
    const sim = simularPista(base, 30);
    for (let t = 0; t <= 30; t += 0.37) {
      const e = sim.estado(t);
      expect(rel(e.Emec, sim.E0)).toBeLessThan(1e-9);
    }
    const alturas = Array.from({ length: 3000 }, (_, i) => sim.estado(i * 0.01).y);
    expect(Math.max(...alturas)).toBeCloseTo(5, 3);
  });

  it('con rapidez inicial sube más: h_max = h0 + v0²/(2g)', () => {
    const sim = simularPista({ ...base, v0: 3 }, 20);
    const alturas = Array.from({ length: 4000 }, (_, i) => sim.estado(i * 0.005).y);
    expect(Math.max(...alturas)).toBeCloseTo(5 + 9 / (2 * 9.8), 3);
  });

  it('el tiempo de bajada por la rampa coincide con el MRUA (a = g sen θ)', () => {
    const sim = simularPista(base, 10);
    const s1 = 5 / Math.sin((40 * Math.PI) / 180);
    const tBajada = Math.sqrt((2 * s1) / (9.8 * Math.sin((40 * Math.PI) / 180)));
    expect(sim.tramos[0].dur).toBeCloseTo(tBajada, 9);
  });

  it('con fricción, la energía mecánica disminuye pero la total (mecánica + térmica) se conserva', () => {
    const sim = simularPista({ ...base, muK: 0.1 }, 60);
    let anterior = Infinity;
    for (let t = 0; t <= sim.tFin; t += 0.05) {
      const e = sim.estado(t);
      expect(rel(e.Etotal, sim.E0)).toBeLessThan(1e-9);
      expect(e.Emec).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = e.Emec;
    }
    expect(sim.detenido).toBe(true);
  });
});

describe('oscilador masa-resorte', () => {
  it('caso A: se suelta desde el extremo en reposo → x = A cos(ωt), fase cero', () => {
    const o = oscilador({ m: 1, k: 40, x0: 0.2, v0: 0 });
    expect(o.A).toBeCloseTo(0.2, 12);
    expect(o.phi).toBeCloseTo(0, 12);
    expect(o.estado(0).x).toBeCloseTo(0.2, 12);
  });

  it('caso B: parte del equilibrio con velocidad → x = A sen(ωt) (fase −π/2)', () => {
    const o = oscilador({ m: 1, k: 40, x0: 0, v0: 1.5 });
    expect(o.phi).toBeCloseTo(-Math.PI / 2, 12);
    expect(o.A).toBeCloseTo(1.5 / Math.sqrt(40), 12);
    for (const t of [0.1, 0.37, 1.2]) expect(o.estado(t).x).toBeCloseTo(o.A * Math.sin(o.omega * t), 12);
  });

  it('solución general: reproduce x0 y v0, y A² = x0² + (v0/ω)²', () => {
    const o = oscilador({ m: 0.5, k: 80, x0: -0.1, v0: 0.9 });
    expect(o.estado(0).x).toBeCloseTo(-0.1, 12);
    expect(o.estado(0).v).toBeCloseTo(0.9, 12);
    expect(o.A ** 2).toBeCloseTo(0.01 + (0.9 / o.omega) ** 2, 12);
  });

  it('la energía se conserva, la velocidad es máxima en el equilibrio y la aceleración máxima en los extremos', () => {
    const o = oscilador({ m: 2, k: 50, x0: 0.3, v0: 0 });
    for (let t = 0; t < 3 * o.T; t += o.T / 37) {
      const e = o.estado(t);
      expect(rel(e.K + e.U, o.E)).toBeLessThan(1e-12);
    }
    expect(o.vMax).toBeCloseTo(0.3 * o.omega, 12);
    expect(Math.abs(o.estado(o.T / 4).v)).toBeCloseTo(o.vMax, 10); // en x = 0
    expect(Math.abs(o.estado(0).a)).toBeCloseTo(o.aMax, 10); // en el extremo
  });

  it('el período depende de m y k, no de la amplitud', () => {
    const a = oscilador({ m: 1, k: 40, x0: 0.05, v0: 0 });
    const b = oscilador({ m: 1, k: 40, x0: 0.45, v0: 0 });
    expect(a.T).toBeCloseTo(b.T, 12);
    expect(a.T).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 40), 12);
  });

  it('el integrador numérico (Verlet) conserva la energía y sigue a la solución exacta', () => {
    const m = 1, k = 40, x0 = 0.2, v0 = 0.5;
    const o = oscilador({ m, k, x0, v0 });
    const pasosPorPeriodo = 400;
    const dt = o.T / pasosPorPeriodo;
    const r = verletOscilador(m, k, x0, v0, dt, 50 * pasosPorPeriodo);
    const E0 = r.energia[0];
    const deriva = Math.max(...r.energia.map((E) => Math.abs(E - E0))) / E0;
    expect(deriva).toBeLessThan(1e-4);
    const i = 10 * pasosPorPeriodo;
    expect(Math.abs(r.xs[i] - o.estado(i * dt).x)).toBeLessThan(1e-3 * o.A);
  });

  it('resorte vertical: la gravedad desplaza el equilibrio, pero la energía relativa a él es ½kx² + constante', () => {
    const m = 0.5, k = 25, g = 9.8;
    const o = oscilador({ m, k, x0: 0.1, v0: 0, vertical: 1, g });
    expect(o.estiramientoEquilibrio).toBeCloseTo((m * g) / k, 12);
    expect(o.omega).toBeCloseTo(Math.sqrt(k / m), 12); // misma frecuencia que en horizontal
    for (const x of [-0.1, -0.03, 0, 0.07, 0.1]) {
      const e = energiasVertical(m, k, g, x, 0);
      expect(e.suma).toBeCloseTo(e.equivalente, 12);
    }
  });
});

describe('colisiones en una dimensión', () => {
  it('la cantidad de movimiento se conserva para cualquier coeficiente de restitución', () => {
    for (const e of [0, 0.3, 0.7, 1]) {
      const c = colision1D(1.5, 2.5, 3, -1, e);
      expect(rel(c.p1, c.p0)).toBeLessThan(1e-12);
    }
  });

  it('elástica (e = 1): la energía cinética se conserva', () => {
    const c = colision1D(1.5, 2.5, 3, -1, 1);
    expect(rel(c.K1, c.K0)).toBeLessThan(1e-12);
  });

  it('masas iguales y choque elástico: intercambian velocidades', () => {
    const c = colision1D(2, 2, 3, 0, 1);
    expect(c.v1f).toBeCloseTo(0, 12);
    expect(c.v2f).toBeCloseTo(3, 12);
  });

  it('perfectamente inelástica (e = 0): salen juntos con la velocidad del centro de masa y se pierde K', () => {
    const c = colision1D(1, 3, 4, 0, 0);
    expect(c.v1f).toBeCloseTo(1, 12);
    expect(c.v2f).toBeCloseTo(1, 12);
    expect(c.perdidaK).toBeCloseTo(0.5 * 1 * 16 - 0.5 * 4 * 1, 12);
  });

  it('caso límite m2 ≫ m1 elástico: la partícula ligera rebota con la misma rapidez', () => {
    const c = colision1D(0.1, 1e6, 2, 0, 1);
    expect(c.v1f).toBeCloseTo(-2, 4);
  });

  it('si no se acercan, no hay choque', () => {
    const c = colision1D(1, 1, -1, 2, 1);
    expect(c.seAcercan).toBe(false);
    expect(c.v1f).toBe(-1);
  });
});
