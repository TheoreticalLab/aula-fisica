import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { crearAzar } from '../src/lib/lieia/azar';
import {
  aPriori, calibrar2PL, curvaInformacion, equivalencia, estadoDe, informacionEsperada, informacionItem, seleccionOptima, tiempoExamen,
  type Calibracion, type DatosCalibracion, type ItemBanco,
} from '../src/lib/lieia/diseno';
import { logistica, pearson } from '../src/lib/lieia/estadistica';
import { construirDiseno, contrastar, disenoDesdeCalibracion, type FilaComparacion } from '../src/lib/lieia/experimentosDiseno';
import { ejecutarExperimento } from '../src/lib/lieia/laboratorio';
import { posiciones } from '../src/lib/lieia/modelos';
import { PARAMETROS_BASE, simular, type Escenario } from '../src/lib/lieia/simulador';
import { prepararCalibracion } from '../src/lib/lieia/calibracionDatos';

const RAPIDO = { permutaciones: 49, bootstrap: 49 };
const cal = (b: number, a = 1, extra: Partial<Calibracion> = {}): Calibracion => ({ a, b, se_a: 0.1, se_b: 0.1, beta_t: Math.log(60), sigma_t: 0.3, n_resp: 200, n_tiempos: 200, estado: 'calibrado', ...extra });

describe('LIEIA · regresión del simulador', () => {
  it('los escenarios originales generan exactamente los mismos datos que antes de la extensión', () => {
    const originales: Escenario[] = ['independiente', 'facil', 'misma_confusion', 'mismo_ritmo', 'inicio_escalonado', 'orden_aleatorio',
      'parejas', 'red', 'asistencia_ia', 'parejas_con_retardo', 'parejas_disfrazadas', 'ia_mimetica'];
    const h = createHash('sha256');
    for (const e of originales) h.update(JSON.stringify(simular({ ...PARAMETROS_BASE, escenario: e }, 12345).examen));
    expect(h.digest('hex')).toBe('4eadc631fe4245149a39dbb15a71088d440afafbdab5abd78a078b6b13895ddf');
  });
});

describe('LIEIA · calibración 2PL (máxima verosimilitud marginal)', () => {
  it('recupera dificultad y discriminación, con intervalos de cobertura razonable', () => {
    let cubiertos = 0, total = 0;
    const corrs: number[] = [];
    for (let rep = 0; rep < 3; rep++) {
      const az = crearAzar(100 + rep);
      const m = 20, n = 300;
      const a = Array.from({ length: m }, () => 0.6 + az.u() * 1.4), b = Array.from({ length: m }, () => az.normal());
      const d: DatosCalibracion = { estudiantes: n, items: m, respuestas: [], duraciones: [] };
      for (let s = 0; s < n; s++) { const th = az.normal(); for (let e = 0; e < m; e++) d.respuestas.push({ s, e, x: az.u() < logistica(a[e] * (th - b[e])) }); }
      const c = calibrar2PL(d);
      corrs.push(pearson(c.items.map((x) => x.b), b));
      c.items.forEach((x, e) => { total++; if (Math.abs(x.b - b[e]) <= 1.96 * x.se_b) cubiertos++; });
    }
    expect(Math.min(...corrs)).toBeGreaterThan(0.95);
    expect(cubiertos / total).toBeGreaterThan(0.85);
  });
  it('estados: mismas reglas que el servidor (calibration_state)', () => {
    expect(estadoDe(150, 0.2, 0.3)).toBe('calibrado');
    expect(estadoDe(150, 0.4, 0.3)).toBe('provisional');
    expect(estadoDe(30, 0.5, 0.9)).toBe('provisional');
    expect(estadoDe(10, 0.2, 0.2)).toBe('no_calibrado');
    expect(aPriori({ dificultad: 'desafiante', formato: 'numeric' }).estado).toBe('no_calibrado');
  });
});

describe('LIEIA · información, tiempo y equidad', () => {
  it('la información de un ítem es máxima en θ = b y vale a²/4', () => {
    expect(informacionItem(cal(0.5, 2), 0.5)).toBeCloseTo(1, 10);
    expect(informacionItem(cal(0.5, 2), 2)).toBeLessThan(1);
  });
  it('la banda de incertidumbre contiene la curva nominal', () => {
    const c = curvaInformacion([cal(-1), cal(0), cal(1, 1.5)]);
    const centro = c.find((p) => p.theta === 0)!;
    expect(centro.p10).toBeLessThanOrEqual(centro.info + 1e-9);
    expect(centro.p90).toBeGreaterThanOrEqual(centro.info - 1e-9);
  });
  it('tiempo total: mediana coherente y riesgo de no terminar decreciente con el límite', () => {
    const cs = Array.from({ length: 10 }, () => cal(0));
    const t1 = tiempoExamen(cs, 0.3, 8), t2 = tiempoExamen(cs, 0.3, 15);
    expect(t1.mediana).toBeGreaterThan(9); expect(t1.mediana).toBeLessThan(12);
    expect(t1.superaLimite!).toBeGreaterThan(t2.superaLimite!);
    expect(t1.superaLimiteLentos!).toBeGreaterThan(t1.superaLimite!);
  });
  it('equivalencia de versiones: detecta variantes desiguales y no afirma nada sin calibración', () => {
    const it = (id: string, c: Calibracion | null): ItemBanco => ({ exercise_id: id, titulo: id, dificultad: 'intermedio', formato: 'choice', categoria: 'x', conceptos: [], calibracion: c });
    const r = equivalencia([
      { grupo: 'A', items: [it('1', cal(0)), it('2', cal(0.2))] },
      { grupo: 'B', items: [it('3', cal(-1)), it('4', cal(0.5))] },
      { grupo: 'C', items: [it('5', null), it('6', cal(0))] },
    ]);
    expect(r.map((g) => g.equivalente)).toEqual([true, false, false]);
    expect(r[2].incierto).toBe(true);
  });
});

describe('LIEIA · selección óptima con restricciones pedagógicas', () => {
  const az = crearAzar(5);
  const banco: ItemBanco[] = Array.from({ length: 40 }, (_, k) => ({
    exercise_id: `e${k}`, titulo: `e${k}`, dificultad: 'intermedio', formato: 'choice', categoria: 'x', conceptos: [`c${k % 8}`],
    calibracion: cal(az.normal(0, 1.5), 0.5 + az.u() * 1.5, { estado: k % 5 === 0 ? 'no_calibrado' : 'calibrado' }),
  }));
  it('cubre los conceptos exigidos, incluye los obligatorios y respeta el tamaño', () => {
    const r = seleccionOptima(banco, { n: 10, conceptos: ['c0', 'c3', 'c7'], obligatorios: ['e1'], limiteMin: null, maxSinCalibrar: 0.2, poblacion: { mu: 0, sigma: 1 } });
    expect(r.elegidos).toHaveLength(10);
    expect(r.elegidos.some((x) => x.exercise_id === 'e1')).toBe(true);
    for (const c of ['c0', 'c3', 'c7']) expect(r.elegidos.some((x) => x.conceptos.includes(c))).toBe(true);
    expect(r.elegidos.filter((x) => x.calibracion?.estado === 'no_calibrado').length).toBeLessThanOrEqual(2);
  });
  it('aporta más información que una selección al azar del mismo tamaño', () => {
    const r = seleccionOptima(banco, { n: 10, conceptos: [], obligatorios: [], limiteMin: null, maxSinCalibrar: 1, poblacion: { mu: 0, sigma: 1 } });
    const azar = informacionEsperada(banco.slice(0, 10).map((b) => b.calibracion!));
    expect(r.informacion).toBeGreaterThan(azar);
  });
  it('respeta el límite de tiempo', () => {
    const r = seleccionOptima(banco, { n: 20, conceptos: [], obligatorios: [], limiteMin: 10, maxSinCalibrar: 1, poblacion: { mu: 0, sigma: 1 } });
    expect(r.tiempoMediano).toBeLessThanOrEqual(10 / 1.2 + 1e-9);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});

describe('LIEIA · simulación con diseño', () => {
  it('versiones: cada estudiante ve exactamente una variante de cada grupo, equilibradas', () => {
    const d = construirDiseno({ items: 12, fraccionAbiertas: 0.3, isomorfos: true, orden: 'aleatorio', versiones: true, fatiga: 0 });
    const { examen } = simular({ ...PARAMETROS_BASE, estudiantes: 10, items: 12, diseno: d }, 1);
    const grupos = new Map<string, number[]>();
    examen.items.forEach((it, j) => { if (it.grupo) grupos.set(it.grupo, [...(grupos.get(it.grupo) ?? []), j]); });
    for (const fila of examen.r) for (const js of grupos.values()) expect(js.filter((j) => fila[j].respuesta !== null).length).toBe(1);
    const primera = [...grupos.values()][0];
    const cuenta = primera.map((j) => examen.r.filter((f) => f[j].respuesta !== null).length);
    expect(Math.abs(cuenta[0] - cuenta[1])).toBeLessThanOrEqual(1);
  });
  it('anclas fijas y contrabalanceo producen los órdenes previstos; el orden aleatorio se detecta', () => {
    const base = { items: 9, fraccionAbiertas: 0, isomorfos: false, versiones: false, fatiga: 0 } as const;
    const ordenDe = (fila: { t: number | null }[]) => fila.map((r, j) => ({ j, t: r.t as number })).sort((a, b) => a.t - b.t).map((x) => x.j);
    const fijas = simular({ ...PARAMETROS_BASE, estudiantes: 6, items: 9, diseno: construirDiseno({ ...base, orden: 'anclas_fijas' }) }, 2).examen;
    for (const fila of fijas.r) { const o = ordenDe(fila); expect(o[0]).toBe(0); expect(o[1]).toBe(1); }
    const cb = simular({ ...PARAMETROS_BASE, estudiantes: 6, items: 9, diseno: construirDiseno({ ...base, orden: 'contrabalanceado' }) }, 3).examen;
    expect(ordenDe(cb.r[0])[0]).toBe(0);
    expect(ordenDe(cb.r[1])[0]).toBe(3);
    const al = simular({ ...PARAMETROS_BASE, estudiantes: 20, items: 9, diseno: construirDiseno({ ...base, orden: 'aleatorio' }) }, 4).examen;
    expect(posiciones(al).varia).toBe(true);
    expect(posiciones(fijas).varia).toBe(true);
    expect(posiciones(simular({ ...PARAMETROS_BASE, estudiantes: 20, items: 9, diseno: construirDiseno({ ...base, orden: 'fijo' }) }, 5).examen).varia).toBe(false);
  });
  it('la fatiga reduce los aciertos al final del examen', () => {
    const d = construirDiseno({ items: 30, fraccionAbiertas: 0, isomorfos: false, orden: 'aleatorio', versiones: false, fatiga: 1.5 });
    const { examen } = simular({ ...PARAMETROS_BASE, estudiantes: 120, items: 30, diseno: { ...d, propagarIncertidumbre: false } }, 6);
    const { pc } = posiciones(examen);
    let tempranos = 0, nt = 0, tardios = 0, nl = 0;
    examen.r.forEach((f, i) => f.forEach((r, j) => { const p = pc[i][j]; if (p === null) return; if (p < -0.25) { nt++; if (r.correcta) tempranos++; } if (p > 0.25) { nl++; if (r.correcta) tardios++; } }));
    expect(tempranos / nt - tardios / nl).toBeGreaterThan(0.08);
  });
  it('D8 detecta la filtración con pares isomorfos y controla falsos positivos sin ella', () => {
    const d = construirDiseno({ items: 24, fraccionAbiertas: 0.3, isomorfos: true, orden: 'fijo', versiones: false, fatiga: 0 });
    const f = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'filtracion', items: 24, diseno: d }, replicas: 4, semilla: 9, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(f.detectores.d8.potencia!).toBeGreaterThan(0.4);
    const n = ejecutarExperimento({ parametros: { ...PARAMETROS_BASE, escenario: 'independiente', items: 24, diseno: d }, replicas: 4, semilla: 10, alfa: 0.05, qUmbral: 0.1, analisis: RAPIDO });
    expect(n.detectores.d8.fpr).toBeLessThan(0.1);
    expect(n.detectores.d8.nulos).toBeGreaterThan(50);
  });
  it('diseño desde calibración real y conclusión automática de contrastes', () => {
    const d = disenoDesdeCalibracion([{ cal: cal(0), opciones: 4, rol: 'ancla', grupo: null, bloque: 0 }], 'aleatorio', false);
    expect(d.items[0]).toMatchObject({ b: 0, opciones: 4, rol: 'ancla' });
    const fila = (diseno: string, escenario: Escenario, fpr: number, fprSup: number, potencia: number | null) => ({ diseno, escenario, detectores: { d1: { fpr, fprSup, potencia } } }) as unknown as FilaComparacion;
    const filas = [fila('A', 'independiente', 0.03, 0.05, null), fila('B', 'independiente', 0.12, 0.15, null), fila('A', 'parejas', 0.03, 0.05, 0.5), fila('B', 'parejas', 0.03, 0.05, 0.9)];
    expect(contrastar(filas, 'A', 'B', ['independiente'], 'parejas', ['d1'])[0].veredicto).toBe('engañosa');
  });
});

describe('LIEIA · preparación de datos de calibración', () => {
  it('usa el primer intento de cada estudiante en cada pregunta y calcula duraciones dentro del intento', () => {
    const banco = [{ exercise_id: 'x', titulo: '', dificultad: 'basico', formato: 'choice', conceptos: [], leccion: null, calibracion: null },
      { exercise_id: 'y', titulo: '', dificultad: 'basico', formato: 'choice', conceptos: [], leccion: null, calibracion: null }];
    const resp = [
      { s: 7, a: 1, e: 'x', x: true, t0: 1000, t: 1060 }, { s: 7, a: 1, e: 'y', x: false, t0: 1000, t: 1150 },
      { s: 7, a: 2, e: 'x', x: false, t0: 5000, t: 5030 },  // segundo intento: no cuenta
      { s: 9, a: 3, e: 'x', x: false, t0: 2000, t: null }, { s: 9, a: 3, e: 'z', x: true, t0: 2000, t: 2100 }, // z no está en el banco
    ];
    const { datos } = prepararCalibracion(banco, resp);
    expect(datos.estudiantes).toBe(2);
    expect(datos.respuestas).toEqual([{ s: 0, e: 0, x: true }, { s: 0, e: 1, x: false }, { s: 1, e: 0, x: false }]);
    expect(datos.duraciones).toEqual([{ s: 0, e: 0, d: 60 }, { s: 0, e: 1, d: 90 }]);
  });
});
