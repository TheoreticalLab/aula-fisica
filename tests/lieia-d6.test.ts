import { describe, expect, it } from 'vitest';
import { calibrarReferencia, d6, diagnosticoReferencia, type ReferenciaD6, type RespuestaD6 } from '../src/lib/lieia/d6';
import { bateriaD6, cohorteCalibracion, crearBanco, PARAMETROS_D6, simularEstudiante } from '../src/lib/lieia/d6Validacion';
import { crearAzar } from '../src/lib/lieia/azar';
import { wilson } from '../src/lib/lieia/estadistica';

// Referencia fija escrita a mano (externa, versionada) para las pruebas de lógica
const ref: ReferenciaD6 = {
  version: 'ref-prueba-1', creada: '2026-10-30T00:00:00Z', descripcion: 'prueba', fuente: 'calibrada', D_ref: 0,
  tau_alpha: 0.3, tau_beta: 0.1, pendiente_mu_D: 0.5, se_max: 0.18, z_rapida: 2,
  items: Object.fromEntries([1, 2, 3].flatMap((n) => [0, 1, 2, 3, 4, 5].map((k) => [`n${n}-${k}`,
    { mu: Math.log(60) + 0.5 * (n - 2), sigma: 0.4, D: n - 2, nivel: n as 1 | 2 | 3, fuente_D: 'empirica' as const, n: 100 }]))),
};
const resp = (ids: string[], t: (id: string) => number | null, correcta = true): RespuestaD6[] =>
  ids.map((id) => ({ exercise_id: id, respondida: true, correcta, tiempo_s: t(id) }));
const nivel = (id: string) => Number(id[1]);
const de = (...ns: number[]) => Object.keys(ref.items).filter((id) => ns.includes(nivel(id)));

describe('D6 v2 · identificación y cobertura', () => {
  it('un solo nivel → NO IDENTIFICABLE, sin pendiente ni p (nunca un valor por defecto)', () => {
    const { a } = d6(resp(de(1), () => 40), ref);
    expect(a.estado).toBe('no_identificable');
    expect([a.beta, a.se, a.p, a.z]).toEqual([null, null, null, null]);
    expect(a.advertencias.join(' ')).toMatch(/NO es identificable/);
  });
  it('dos niveles extremos con precisión suficiente → contraste parcial', () => {
    const { a } = d6(resp(de(1, 3), (id) => Math.exp(ref.items[id].mu)), ref);
    expect(a.estado).toBe('contraste_parcial');
    expect(a.beta).toBeCloseTo(0, 6);
    expect(a.p).toBeCloseTo(0.5, 6);
  });
  it('tres niveles; tiempo constante (insensible) → β ≈ −0,5 y p pequeña', () => {
    const { a } = d6(resp(de(1, 2, 3), () => 60), ref);
    expect(a.estado).toBe('identificable');
    expect(a.beta).toBeCloseTo(-0.5, 6);
    expect(a.p!).toBeLessThan(0.01);
    expect(a.ic95![1]).toBeLessThan(0);
  });
  it('precisión insuficiente → no contrasta (estado explícito)', () => {
    const ids = ['n1-0', 'n2-0', 'n3-0'];
    const { a } = d6(resp(ids, () => 60), ref);
    expect(a.estado).toBe('precision_insuficiente');
    expect(a.p).toBeNull();
    expect(a.beta).not.toBeNull();   // la estimación se informa con su SE, pero no se convierte en señal
  });
  it('omisiones y tiempos ausentes se excluyen y se cuentan; nunca se imputan como 0', () => {
    const r: RespuestaD6[] = [
      ...resp(de(1, 2, 3), () => 60),
      { exercise_id: 'n1-0', respondida: false, correcta: null, tiempo_s: null },
      { exercise_id: 'n2-0', respondida: true, correcta: true, tiempo_s: null },
      { exercise_id: 'n3-0', respondida: true, correcta: true, tiempo_s: 0 },
      { exercise_id: 'otro', respondida: true, correcta: true, tiempo_s: 30 },
    ];
    const { a } = d6(r, ref);
    expect([a.n_omitidas, a.n_sin_tiempo, a.n_sin_referencia, a.n_evaluables]).toEqual([1, 2, 1, 18]);
    expect(a.beta).toBeCloseTo(-0.5, 6);
  });
  it('tiempos parciales: excluidos por defecto; incluidos solo si se pide', () => {
    const r = resp(de(1, 2, 3), () => 60).map((x, i) => (i < 3 ? { ...x, calidad: 'parcial' as const } : x));
    expect(d6(r, ref).a.n_evaluables).toBe(15);
    expect(d6(r, ref, { parciales: 'usar' }).a.n_evaluables).toBe(18);
  });
  it('referencia provisional y referencia no informativa lo dicen', () => {
    expect(d6(resp(de(1, 2, 3), () => 60), { ...ref, fuente: 'provisional' }).a.advertencias.join(' ')).toMatch(/PROVISIONAL/);
    const plana = d6(resp(de(1, 2, 3), () => 60), { ...ref, se_max: 0 }).a;
    expect(plana.estado).toBe('referencia_no_informativa');
    expect(plana.p).toBeNull();
  });
  it('separa correctas e incorrectas (β solo con correctas)', () => {
    const r = [...resp(de(1, 2, 3), () => 60, true), ...resp(de(1, 2, 3), (id) => Math.exp(ref.items[id].mu), false)];
    const { a } = d6(r, ref);
    expect(a.beta_correctas).toBeCloseTo(-0.5, 6);
    expect(a.beta!).toBeGreaterThan(-0.5);
  });
});

describe('D6 v2 · invariancia frente al grupo', () => {
  it('el resultado de un estudiante no depende de quién más esté en la sección', () => {
    const az = crearAzar(5), banco = crearBanco(PARAMETROS_D6, az);
    const r0 = calibrarReferencia(cohorteCalibracion(200, banco, PARAMETROS_D6, az), banco.nivel, { version: 'v', dificultad: banco.D, ahora: 'x' });
    const items = banco.ids;
    const yo = simularEstudiante('honesto', items, banco, PARAMETROS_D6, az);
    const solo = d6(yo, r0);
    // dos cohortes muy distintas alrededor del mismo estudiante: la referencia externa no cambia, el resultado tampoco
    for (const otro of ['honesto', 'insensible'] as const) {
      const cohorte = [yo, ...Array.from({ length: 30 }, () => simularEstudiante(otro, items, banco, PARAMETROS_D6, az))];
      expect(d6(cohorte[0], r0)).toEqual(solo);
    }
  });
});

describe('D6 v2 · calibración de la referencia', () => {
  it('recupera los parámetros de la población simulada', () => {
    const az = crearAzar(11), banco = crearBanco(PARAMETROS_D6, az);
    const r = calibrarReferencia(cohorteCalibracion(400, banco, PARAMETROS_D6, az), banco.nivel, { version: 'v', dificultad: banco.D, ahora: 'x' });
    expect(r.fuente).toBe('calibrada');
    expect(r.pendiente_mu_D).toBeGreaterThan(0.4);
    expect(r.pendiente_mu_D).toBeLessThan(0.6);
    expect(r.tau_alpha).toBeGreaterThan(0.28);
    expect(r.tau_alpha).toBeLessThan(0.42);
    expect(r.tau_beta).toBeLessThan(0.16);
    expect(r.se_max).toBeGreaterThan(0);
  });
  it('sin dificultad empírica o con pocos datos la referencia queda como provisional', () => {
    const az = crearAzar(3), banco = crearBanco(PARAMETROS_D6, az);
    expect(calibrarReferencia(cohorteCalibracion(10, banco, PARAMETROS_D6, az), banco.nivel, { version: 'v', dificultad: banco.D, ahora: 'x' }).fuente).toBe('provisional');
    expect(calibrarReferencia(cohorteCalibracion(40, banco, PARAMETROS_D6, az), banco.nivel, { version: 'v', ahora: 'x' }).fuente).toBe('provisional');
  });
  it('diagnóstico de transporte: con pocos evaluables se abstiene', () => {
    expect(diagnosticoReferencia([], ref).estado).toBe('insuficiente');
  });
});

describe('D6 v2 · batería de validación por SIMULACIÓN (no es validación empírica)', () => {
  const { filas, aviso } = bateriaD6();
  const fila = (esc: string, det = 'D6-A', refe = 'externa') => filas.find((f) => f.escenario === esc && f.detector === det && f.referencia === refe)!;
  const cubre5 = (ic: [number, number]) => ic[0] <= 0.05 && ic[1] >= 0.05;

  it('se presenta como simulación', () => expect(aviso).toMatch(/SIMULACIÓN.*no son una validación empírica/));
  it('contaminación 0/20/50/80 %: la FPR con referencia externa es compatible con el 5 % nominal', () => {
    // cada honesto se evalúa igual sea cual sea la contaminación: la prueba principal es la FPR agregada
    // (por nivel, n = 240–1200 da intervalos anchos y con 4 comparaciones alguno puede no cubrir el 5 % por azar)
    const fs = [0, 20, 50, 80].map((c) => fila(`contaminación ${c} %`).fpr);
    const fp = fs.reduce((s, m) => s + m.exitos, 0), n = fs.reduce((s, m) => s + m.n, 0);
    expect(cubre5(wilson(fp, n))).toBe(true);
    for (const m of fs) expect(m.ic95[0]).toBeLessThan(0.065);
  });
  it('contaminación 20/50/80/100 %: la sensibilidad no se degrada (≥ 75 %) — no depende del grupo', () => {
    for (const c of [20, 50, 80, 100]) expect(fila(`contaminación ${c} %`).sensibilidad.tasa).toBeGreaterThan(0.75);
  });
  it('referencia calibrada con la propia cohorte (D6 v1): con contaminación la detección se pierde', () => {
    for (const c of [50, 80, 100]) {
      const f = fila(`contaminación ${c} %`, 'D6-A', 'propia_cohorte');
      expect(f.sensibilidad.n === 0 || f.sensibilidad.tasa < 0.5).toBe(true);
    }
  });
  it('cobertura extrema: un nivel → abstención total; dos niveles extremos → contraste con FPR nominal', () => {
    expect(fila('cobertura: solo nivel básico').abstencion_honestos.tasa).toBe(1);
    expect(fila('cobertura: solo nivel básico').abstencion_contaminados.tasa).toBe(1);
    const f = fila('cobertura: básico + desafiante (6 + 6)');
    expect(cubre5(f.fpr.ic95)).toBe(true);
    expect(f.sensibilidad.tasa).toBeGreaterThan(0.8);
  });
  it('telemetría imperfecta: con tiempos perdidos aumenta la abstención; pausas detectadas y excluidas mantienen la FPR', () => {
    expect(fila('telemetría: 30 % de tiempos perdidos').abstencion_honestos.tasa).toBeGreaterThan(0.3);
    expect(cubre5(fila('telemetría: 20 % de pausas detectadas (excluidas)').fpr.ic95)).toBe(true);
    // límite documentado: las pausas NO detectadas inflan la FPR
    expect(fila('telemetría: 20 % de pausas NO detectadas').fpr.tasa).toBeGreaterThan(0.06);
  });
  it('población distinta de la referencia: la FPR se dispara, y el diagnóstico de transporte lo avisa', () => {
    const f = fila('población distinta de la referencia (γ 0,3 frente a 0,5)');
    expect(f.fpr.tasa).toBeGreaterThan(0.15);
    expect(f.deriva!.tasa).toBeGreaterThan(0.9);
    expect(fila('contaminación 0 %').deriva!.exitos).toBe(0);
  });
  it('D6-B detecta la copia rápida y correcta sin castigar a quien es rápido en general', () => {
    const b = fila('rapidez: copia rápida y correcta (20 %)', 'D6-B');
    expect(b.sensibilidad.tasa).toBeGreaterThan(0.95);
    expect(b.fpr.ic95[0]).toBeLessThanOrEqual(0.05);
    expect(b.fpr.tasa).toBeLessThan(0.06);
    // D6-A no ve este patrón (es otra cosa): por eso son dos indicadores
    expect(fila('rapidez: copia rápida y correcta (20 %)').sensibilidad.tasa).toBeLessThan(0.2);
  });
});
