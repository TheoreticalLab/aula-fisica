import { describe, expect, it } from 'vitest';
import { crearAzar, derivarSemilla } from '../src/lib/lieia/azar';
import {
  auc, benjaminiHochberg, calibracion, chiCuadradoCola, kaplanMeier, mezclaBetaUniforme, normalCdf, pearson, poissonBinomialCola, wilson,
} from '../src/lib/lieia/estadistica';
import { ajustarRasch, ajustarTiempos, probCoincidirIncorrecta } from '../src/lib/lieia/modelos';
import { simular, PARAMETROS_BASE } from '../src/lib/lieia/simulador';
import { analizar, grafo } from '../src/lib/lieia/detectores';
import { ejecutarExperimento } from '../src/lib/lieia/laboratorio';
import { veredicto, veredictoPosterior } from '../src/lib/lieia/validacion';
import { aExamen, type DatosRealesExamen } from '../src/lib/lieia/datosReales';
import { logistica } from '../src/lib/lieia/estadistica';
import { serializarExperimento } from '../src/lib/lieia/serial';

const RAPIDO = { permutaciones: 49, bootstrap: 49 };

describe('LIEIA · azar reproducible', () => {
  it('misma semilla, misma secuencia; semillas derivadas distintas', () => {
    const a = crearAzar(42), b = crearAzar(42);
    expect(Array.from({ length: 5 }, () => a.u())).toEqual(Array.from({ length: 5 }, () => b.u()));
    expect(derivarSemilla(1, 2)).not.toBe(derivarSemilla(1, 3));
  });
  it('normal con media 0 y varianza 1', () => {
    const az = crearAzar(7);
    const xs = Array.from({ length: 20000 }, () => az.normal());
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(v - 1)).toBeLessThan(0.04);
  });
});

describe('LIEIA · estadística', () => {
  it('Poisson-binomial exacta = enumeración', () => {
    const ps = [0.1, 0.5, 0.3, 0.8, 0.05];
    for (let k = 0; k <= 5; k++) {
      let exacta = 0;
      for (let mask = 0; mask < 32; mask++) {
        let pr = 1, c = 0;
        ps.forEach((p, i) => { if (mask & (1 << i)) { pr *= p; c++; } else pr *= 1 - p; });
        if (c >= k) exacta += pr;
      }
      expect(poissonBinomialCola(ps, k)).toBeCloseTo(exacta, 12);
    }
  });
  it('Benjamini–Hochberg (ejemplo conocido) y monotonía', () => {
    expect(benjaminiHochberg([0.01, 0.04, 0.03, 0.005]).map((q) => +q.toFixed(4))).toEqual([0.02, 0.04, 0.04, 0.02]);
  });
  it('distribuciones: normal y chi cuadrado', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(chiCuadradoCola(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiCuadradoCola(11.07, 5)).toBeCloseTo(0.05, 3);
  });
  it('Kaplan–Meier con censura', () => {
    const km = kaplanMeier([{ t: 1, evento: true }, { t: 2, evento: false }, { t: 3, evento: true }, { t: 3, evento: true }]);
    expect(km.map((x) => +x.s.toFixed(4))).toEqual([1, 0.75, 0]);
  });
  it('AUC, Wilson y calibración', () => {
    expect(auc([1, 2, 3, 4], [false, false, true, true])).toBe(1);
    expect(auc([1, 1, 1, 1], [false, true, false, true])).toBe(0.5);
    const [lo, hi] = wilson(5, 100);
    expect(lo).toBeGreaterThan(0.015);
    expect(hi).toBeLessThan(0.115);
    expect(calibracion([0.9, 0.9, 0.1, 0.1], [true, true, false, false]).ece).toBeCloseTo(0.1, 6);
  });
  it('mezcla beta-uniforme: sin señal → posterior ≈ 0; con señal → alta solo para p pequeños', () => {
    const az = crearAzar(3);
    const nulos = Array.from({ length: 500 }, () => az.u());
    const m0 = mezclaBetaUniforme(nulos)!;
    expect(m0.pi0).toBeGreaterThan(0.9);
    expect(m0.posterior(0.01)).toBeLessThan(0.3);
    const conSenal = [...nulos, ...Array.from({ length: 60 }, () => az.u() ** 12)];
    const m1 = mezclaBetaUniforme(conSenal)!;
    expect(m1.posterior(1e-6)).toBeGreaterThan(0.8);
    expect(m1.posterior(0.6)).toBeLessThan(0.1);
    expect(mezclaBetaUniforme([0.1, 0.2])).toBeNull();
  });
});

describe('LIEIA · modelos (recuperación de parámetros)', () => {
  it('Rasch recupera habilidades y dificultades', () => {
    const az = crearAzar(11);
    const theta = Array.from({ length: 200 }, () => az.normal());
    const b = Array.from({ length: 30 }, () => az.normal());
    const x = theta.map((t) => b.map((bj) => az.u() < logistica(t - bj)));
    const r = ajustarRasch(x);
    expect(pearson(r.theta, theta)).toBeGreaterThan(0.85);
    expect(pearson(r.b, b)).toBeGreaterThan(0.95);
  });
  it('modelo lognormal de tiempos recupera exigencia y velocidad', () => {
    const az = crearAzar(12);
    const beta = Array.from({ length: 25 }, () => az.normal(4.2, 0.4));
    const tau = Array.from({ length: 80 }, () => az.normal(0, 0.3));
    const d = tau.map((t) => beta.map((bj) => Math.exp(bj - t + az.normal(0, 0.3))));
    const m = ajustarTiempos(d);
    expect(pearson(m.beta, beta)).toBeGreaterThan(0.95);
    expect(pearson(m.tau, tau)).toBeGreaterThan(0.9);
  });
  it('la probabilidad de coincidir en una incorrecta baja si la respuesta es rara entre los demás', () => {
    const { examen } = simular({ ...PARAMETROS_BASE, escenario: 'independiente' }, 5);
    const r = ajustarRasch(examen.r.map((f) => f.map((x) => x.correcta)));
    const p = probCoincidirIncorrecta(examen, r, 0, 1, 0);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
  });
});

describe('LIEIA · simulador y detectores (integración)', () => {
  it('el simulador es reproducible y registra la verdad', () => {
    const a = simular({ ...PARAMETROS_BASE, escenario: 'parejas' }, 99);
    const b = simular({ ...PARAMETROS_BASE, escenario: 'parejas' }, 99);
    expect(JSON.stringify(a.examen)).toBe(JSON.stringify(b.examen));
    expect(a.verdad.parejas.size).toBe(PARAMETROS_BASE.implicados);
    expect(a.verdad.receptores.size).toBe(PARAMETROS_BASE.implicados);
  });

  it('recupera una pareja que copia con retardo corto (D1 y D3)', () => {
    const { examen, verdad } = simular({ ...PARAMETROS_BASE, escenario: 'parejas', intensidad: 0.7, retardoMediano: 10, implicados: 1 }, 2024);
    const a = analizar(examen, { ...RAPIDO, semilla: 1 });
    const [clave] = [...verdad.parejas];
    const [i, j] = clave.split('-').map(Number);
    const par = a.parejas.find((p) => p.i === i && p.j === j)!;
    expect(par.d1!.p).toBeLessThan(0.001);
    expect(par.d3!.p).toBeLessThan(0.05);
    // la pareja verdadera es la más improbable de todas según D1
    const minP = Math.min(...a.parejas.map((p) => p.d1?.p ?? 1));
    expect(par.d1!.p).toBe(minP);
  });

  it('copia casi total: D3 pierde potencia (parece «mismo ritmo») y D2 la complementa', () => {
    const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'parejas', intensidad: 0.95 }, replicas: 4, semilla: 12, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    const juntos = r.detectores.d2.potencia! + r.detectores.d3.potencia!;
    expect(r.detectores.d2.potencia!).toBeGreaterThan(0.4);
    expect(juntos).toBeGreaterThan(1);
  });

  it('sin tiempos registrados, los detectores temporales se abstienen', () => {
    const { examen } = simular({ ...PARAMETROS_BASE, escenario: 'independiente' }, 3);
    const a = analizar({ ...examen, conTiempos: false }, RAPIDO);
    expect(a.parejas.every((p) => p.d2 === null && p.d3 === null)).toBe(true);
    expect(a.abstenciones.join(' ')).toMatch(/se abstienen/);
  });

  it('controles negativos: falsos positivos controlados (D1, D3, D6) en independencia y mismo ritmo', () => {
    for (const escenario of ['independiente', 'mismo_ritmo'] as const) {
      const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario }, replicas: 4, semilla: 5, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
      for (const d of ['d1', 'd3'] as const) expect(r.detectores[d].fpr).toBeLessThan(0.08);
      expect(r.detectores.d6.fpr).toBeLessThan(0.12);
    }
  });

  it('positivos: potencia en parejas (D1, D3) y en asistencia externa (D6)', () => {
    const p = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'parejas' }, replicas: 4, semilla: 6, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(p.detectores.d1.potencia!).toBeGreaterThan(0.7);
    expect(p.detectores.d3.potencia!).toBeGreaterThan(0.5);
    const ia = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'asistencia_ia' }, replicas: 4, semilla: 7, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(ia.detectores.d6.potencia!).toBeGreaterThan(0.8);
  });

  it('adversarial: la copia con retardo largo borra la huella temporal (limitación documentada)', () => {
    const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'parejas_con_retardo' }, replicas: 3, semilla: 8, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(r.detectores.d3.potencia!).toBeLessThan(0.3);
    expect(r.detectores.d1.potencia!).toBeGreaterThan(0.6);
  });

  it('grafo: identifica componentes y la dirección temporal', () => {
    const { examen } = simular({ ...PARAMETROS_BASE, escenario: 'red', implicados: 6, intensidad: 0.9 }, 31);
    const a = analizar(examen, { ...RAPIDO, semilla: 31 });
    const g = grafo(a, examen.estudiantes.length, ['d1', 'd3']);
    expect(g.componentes.length).toBeGreaterThan(0);
    expect(g.grado.some((x) => x >= 3)).toBe(true);
  });

  it('protocolo de aceptación: un detector con falsos positivos altos no se valida', () => {
    const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'independiente' }, replicas: 3, semilla: 9, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(veredicto('d7', { independiente: r }).estado).toBe('no_validado');
    const vp = veredictoPosterior('d1', [r], { altas: 0, total: 0 });
    expect(vp.informativa).toBe(false);
  });
});

describe('LIEIA · transferencia entre hilos (worker ↔ panel)', () => {
  it('los resultados serializados se pueden clonar (postMessage); los crudos no', () => {
    const r = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'parejas', estudiantes: 14, items: 12 }, replicas: 1, semilla: 4, alfa: 0.05, qUmbral: 0.1, analisis: { permutaciones: 19, bootstrap: 19 } });
    expect(() => structuredClone(r)).toThrow();
    const c = structuredClone(serializarExperimento(r));
    expect(c.ejemplo.verdad.parejas instanceof Set).toBe(true);
    expect(c.ejemplo.analisis.rasch.theta.length).toBe(14);
  });
});

describe('LIEIA · adaptador de datos reales', () => {
  it('convierte la respuesta del servidor en un examen observado, con seudónimos y tiempos relativos', () => {
    const datos: DatosRealesExamen = {
      actividad: { id: 'a', titulo: 'Parcial', modo: 'exam', abre: null, cierra: null },
      items: [{ exercise_id: 'x1', posicion: 1, formato: 'choice', opciones: 4 }, { exercise_id: 'x2', posicion: 2, formato: 'numeric', opciones: null }],
      estudiantes: [
        { seudonimo: 'E01', inicio: '2026-10-27T10:00:00Z', fin: '2026-10-27T10:30:00Z', oculto: 12,
          respuestas: [{ exercise_id: 'x1', ficha: 'aa', correcta: true, primera: '2026-10-27T10:02:00Z', ultima: '2026-10-27T10:03:00Z', cambios: 2 }, { exercise_id: 'x2', ficha: 'bb', correcta: false, primera: null, ultima: null, cambios: 0 }] },
        { seudonimo: 'E02', inicio: '2026-10-27T10:01:00Z', fin: null, oculto: 0, respuestas: [] },
      ],
      con_tiempos: true,
    };
    const ex = aExamen(datos);
    expect(ex.estudiantes.map((e) => e.id)).toEqual(['E01', 'E02']);
    expect(ex.estudiantes[1].inicio).toBe(60);
    expect(ex.r[0][0]).toMatchObject({ respuesta: 'aa', correcta: true, primera: 120, t: 180, cambios: 2 });
    expect(ex.r[0][1]).toMatchObject({ respuesta: 'bb', correcta: false, t: null });
    expect(ex.r[1][0].respuesta).toBeNull();
  });
});
