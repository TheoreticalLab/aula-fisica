import { describe, expect, it } from 'vitest';
import {
  BETA, choqueBarra, conservacionL, ejesParalelos, evolucionPlataforma, inerciaBarraCentro, inerciaBarraExtremo, inerciaDisco,
  inerciaParticulas, omega, omegaDesplazamiento, poleaMasiva, precesion, rodadura, rpmARad, theta, torque,
} from '@/lib/fisica/rotacion';

describe('momentos de inercia', () => {
  it('ejes paralelos: barra del centro al extremo', () => {
    expect(ejesParalelos(inerciaBarraCentro(2, 1.2), 2, 0.6)).toBeCloseTo(inerciaBarraExtremo(2, 1.2), 12);
  });
  it('partículas', () => {
    expect(inerciaParticulas([1, 2], [0.5, 1])).toBeCloseTo(0.25 + 2, 12);
  });
});

describe('cinemática con α constante', () => {
  it('coherencia entre θ(t), ω(t) y ω² = ω0² + 2αΔθ', () => {
    const w0 = 2, a = 1.5, t = 3;
    const dth = theta(0, w0, a, t);
    expect(omegaDesplazamiento(w0, a, dth)).toBeCloseTo(omega(w0, a, t), 10);
    expect(rpmARad(60)).toBeCloseTo(2 * Math.PI, 12);
  });
});

describe('rodadura', () => {
  it('a = g sen θ / (1 + β) y orden de llegada', () => {
    const th = Math.PI / 6;
    const r = (f: keyof typeof BETA) => rodadura(f, th, 2).t;
    expect(rodadura('cilindro', th, 2).a).toBeCloseTo((9.8 * 0.5) / 1.5, 12);
    expect(r('bloque')).toBeLessThan(r('esfera'));
    expect(r('esfera')).toBeLessThan(r('cilindro'));
    expect(r('cilindro')).toBeLessThan(r('esfera-hueca'));
    expect(r('esfera-hueca')).toBeLessThan(r('aro'));
  });
  it('conservación de la energía: Mgh = Ktras + Krot', () => {
    const R = rodadura('esfera', 0.4, 3, 9.8, 2, 0.1);
    expect(R.Ktras + R.Krot).toBeCloseTo(2 * 9.8 * R.h, 10);
    expect(R.fraccionRot).toBeCloseTo(0.4 / 1.4, 12);
  });
  it('fricción necesaria y μ mínimo', () => {
    const R = rodadura('cilindro', Math.PI / 6, 1, 9.8, 1);
    expect(R.friccion / R.normal).toBeCloseTo(R.muMin, 12);
    expect(R.muMin).toBeCloseTo(Math.tan(Math.PI / 6) / 3, 12);
  });
});

describe('polea con masa', () => {
  it('se reduce a Atwood ideal con M = 0 y el torque neto es Iα', () => {
    const ideal = poleaMasiva(2, 3, 0, 0.1);
    expect(ideal.a).toBeCloseTo(9.8 / 5, 12);
    expect(ideal.T1).toBeCloseTo(ideal.T2, 10);
    const p = poleaMasiva(2, 3, 2, 0.1);
    expect(p.a).toBeCloseTo(9.8 / 6, 12);
    expect(p.torqueNeto).toBeCloseTo(p.I * p.alfa, 10);
    expect(p.T2).toBeGreaterThan(p.T1);
  });
});

describe('momento angular', () => {
  it('conservación al cambiar I y trabajo interno', () => {
    const c = conservacionL(4, 2, 2);
    expect(c.w2).toBeCloseTo(4, 12);
    expect(c.trabajoInterno).toBeCloseTo(0.5 * 2 * 16 - 0.5 * 4 * 4, 12);
  });
  it('plataforma: L constante durante el cambio de radio', () => {
    const a = evolucionPlataforma(1, 2, 0.8, 0.2, 3, 2, 0);
    const b = evolucionPlataforma(1, 2, 0.8, 0.2, 3, 2, 1.3);
    expect(b.L).toBeCloseTo(a.L, 10);
    expect(b.w).toBeGreaterThan(a.w);
  });
  it('choque con barra: L se conserva y K disminuye', () => {
    const c = choqueBarra(0.05, 20, 1, 1, 1);
    expect(c.I * c.w).toBeCloseTo(0.05 * 20 * 1, 12);
    expect(c.Kf).toBeLessThan(c.Ki);
  });
  it('torque y precesión', () => {
    expect(torque(0.5, 10, Math.PI / 2)).toBeCloseTo(5, 12);
    expect(precesion(0.2, 0.05, inerciaDisco(0.2, 0.04), 200)).toBeCloseTo((0.2 * 9.8 * 0.05) / (0.5 * 0.2 * 0.0016 * 200), 10);
  });
});
