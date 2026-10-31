import { describe, expect, it } from 'vitest';
import {
  analizarCohorteD6, d6Individual, huellaProtocolo, precisionDiseno, PROTOCOLO_D6, reconstruirTiempo,
  type ContextoCohorte, type Intervalo, type ReferenciaD6, type RespuestaD6,
} from '../src/lib/lieia/d6';
import {
  AMBITO_SIM, CONTEXTO_SIM, crearBanco, cohorteCalibracion, d6bNormalizadoInterno, ejecutarValidacion, huellasActuales, HUELLAS_CONGELADAS,
  PARAMETROS_D6, resumir, simularEstudiante,
} from '../src/lib/lieia/d6Validacion';
import { calibrarReferencia } from '../src/lib/lieia/d6';
import { crearAzar } from '../src/lib/lieia/azar';
import { OBSOLETOS } from '../src/lib/lieia/validacion';

// Referencia fija escrita a mano (externa, versionada) para las pruebas de lógica
const ref: ReferenciaD6 = {
  version: 'ref-prueba-1', protocolo: PROTOCOLO_D6.version, creada: '2026-10-30T00:00:00Z', descripcion: 'prueba', ambito: AMBITO_SIM,
  fuente: 'calibrada', D_ref: 0, tau_alpha: 0.3, tau_beta: 0.1, pendiente_mu_D: 0.5, se_max: 0.18,
  items: Object.fromEntries([1, 2, 3].flatMap((n) => [0, 1, 2, 3, 4, 5].map((k) => [`n${n}-${k}`,
    { mu: Math.log(60) + 0.5 * (n - 2), se_mu: 0, sigma: 0.4, D: n - 2, nivel: n as 1 | 2 | 3, fuente_D: 'empirica' as const, n: 100 }]))),
};
const trabajo = (t: number): Intervalo[] => [{ inicio: 0, fin: t, tipo: 'trabajo' }];
const resp = (ids: string[], t: (id: string) => number | null, correcta = true): RespuestaD6[] =>
  ids.map((id) => { const x = t(id); return { exercise_id: id, respondida: true, correcta, intervalos: x === null ? [] : trabajo(x) }; });
const de = (...ns: number[]) => Object.keys(ref.items).filter((id) => ns.includes(Number(id[1])));
const tipico = (id: string) => Math.exp(ref.items[id].mu);

describe('D6 v1 · retirado por defectos metodológicos', () => {
  it('está marcado como obsoleto con sus defectos y un sustituto experimental', () => {
    expect(OBSOLETOS.d6?.defectos.length).toBeGreaterThanOrEqual(6);
    expect(OBSOLETOS.d6?.sustituto).toMatch(/EXPERIMENTAL/);
  });
});

describe('D6 v2 · reconstrucción del tiempo observable', () => {
  it('suma los intervalos de trabajo y descuenta pausas, pestaña oculta y desconexiones (no excluye la pregunta)', () => {
    const r = reconstruirTiempo([
      { inicio: 0, fin: 40, tipo: 'trabajo' }, { inicio: 40, fin: 160, tipo: 'pausa_declarada' },
      { inicio: 160, fin: 190, tipo: 'trabajo' }, { inicio: 190, fin: 250, tipo: 'oculta' }, { inicio: 250, fin: 260, tipo: 'trabajo' },
    ]);
    expect(r).toMatchObject({ estado: 'valido', t: 80, descontado: 180 });
  });
  it('la inactividad con la pregunta visible cuenta como trabajo hasta el límite; el exceso queda sin clasificar', () => {
    expect(reconstruirTiempo([{ inicio: 0, fin: 100, tipo: 'inactividad' }]).t).toBe(100);
    expect(reconstruirTiempo([{ inicio: 0, fin: 30, tipo: 'trabajo' }, { inicio: 30, fin: 30 + PROTOCOLO_D6.inactividad_max_s + 600, tipo: 'inactividad' }]).estado).toBe('no_reconstruible');
  });
  it('huecos sin registro: pequeños → aproximado; grandes → no reconstruible (se excluye solo entonces)', () => {
    const chico = reconstruirTiempo([{ inicio: 0, fin: 100, tipo: 'trabajo' }, { inicio: 102, fin: 150, tipo: 'trabajo' }]);
    expect(chico.estado).toBe('aproximado');
    expect(chico.t!).toBeGreaterThan(148);
    expect(chico.t!).toBeLessThan(150);
    expect(reconstruirTiempo([{ inicio: 0, fin: 50, tipo: 'trabajo' }, { inicio: 120, fin: 150, tipo: 'trabajo' }]).estado).toBe('no_reconstruible');
  });
  it('telemetría inconsistente o vacía', () => {
    expect(reconstruirTiempo([{ inicio: 0, fin: 50, tipo: 'trabajo' }, { inicio: 20, fin: 70, tipo: 'trabajo' }]).estado).toBe('no_reconstruible');
    expect(reconstruirTiempo([]).estado).toBe('sin_datos');
    expect(reconstruirTiempo([{ inicio: 0, fin: 90, tipo: 'pausa_declarada' }]).estado).toBe('sin_datos');
  });
  it('una pregunta con pausa entra en el análisis con su tiempo de trabajo', () => {
    const r = resp(de(1, 2, 3), tipico);
    r[0] = { ...r[0], intervalos: [{ inicio: 0, fin: 20, tipo: 'trabajo' }, { inicio: 20, fin: 500, tipo: 'oculta' }, { inicio: 500, fin: 500 + tipico(r[0].exercise_id) - 20, tipo: 'trabajo' }] };
    const { a } = d6Individual(r, ref);
    expect(a.n_validos).toBe(18);
    expect(a.beta).toBeCloseTo(0, 6);
  });
});

describe('D6 v2 · estados de identificación (sin valores de sustitución)', () => {
  it('sensibilidad no identificable: un solo nivel respondido', () => {
    const { a } = d6Individual(resp(de(1), () => 40), ref);
    expect(a.estado).toBe('no_identificable');
    expect([a.beta, a.se, a.p, a.z]).toEqual([null, null, null, null]);
  });
  it('datos temporales inválidos: se respondieron tres niveles, pero solo un nivel tiene tiempos válidos', () => {
    const { a } = d6Individual(resp(de(1, 2, 3), (id) => (id.startsWith('n1') ? 40 : null)), ref);
    expect(a.estado).toBe('datos_temporales_invalidos');
    expect(a.niveles_respondidos).toEqual([1, 2, 3]);
    expect([a.beta, a.p]).toEqual([null, null]);
    expect(a.n_sin_tiempo).toBe(12);
  });
  it('precisión insuficiente: hay niveles, pero la pendiente es incierta (se informa β y SE, sin p)', () => {
    const { a } = d6Individual(resp(['n1-0', 'n2-0', 'n3-0'], () => 60), ref);
    expect(a.estado).toBe('precision_insuficiente');
    expect(a.p).toBeNull();
    expect(a.beta).not.toBeNull();
  });
  it('contraste parcial (dos niveles) y sensibilidad identificable (tres niveles)', () => {
    expect(d6Individual(resp(de(1, 3), tipico), ref).a.estado).toBe('contraste_parcial');
    const { a } = d6Individual(resp(de(1, 2, 3), () => 60), ref);
    expect(a.estado).toBe('identificable');
    expect(a.beta).toBeCloseTo(-0.5, 6);
    expect(a.p!).toBeLessThan(0.01);
  });
  it('omisiones y tiempos ausentes se cuentan y nunca valen 0', () => {
    const r: RespuestaD6[] = [...resp(de(1, 2, 3), () => 60), { exercise_id: 'n1-0', respondida: false, correcta: null }, { exercise_id: 'otro', respondida: true, correcta: true, tiempo_s: 30 }];
    const { a } = d6Individual(r, ref);
    expect([a.n_omitidas, a.n_sin_referencia, a.n_validos]).toEqual([1, 1, 18]);
  });
  it('separa correctas e incorrectas', () => {
    const { a } = d6Individual([...resp(de(1, 2, 3), () => 60, true), ...resp(de(1, 2, 3), tipico, false)], ref);
    expect(a.beta_correctas).toBeCloseTo(-0.5, 6);
    expect(a.beta!).toBeGreaterThan(-0.5);
  });
});

describe('D6-B · sin normalización interna de la velocidad', () => {
  it('asistencia en TODO el examen (todo ×0,3): D6-B la ve; una normalización interna la borraría', () => {
    const r = resp(de(1, 2, 3), (id) => tipico(id) * 0.3);
    expect(d6Individual(r, ref).b.p!).toBeLessThan(0.001);
    expect(d6bNormalizadoInterno(r, ref)!).toBeGreaterThan(0.5);
  });
  it('un estudiante típico no es rápido', () => {
    expect(d6Individual(resp(de(1, 2, 3), tipico), ref).b.p!).toBeGreaterThan(0.5);
  });
});

describe('D6 v2 · aplicabilidad de la referencia (abstención colectiva)', () => {
  const az = crearAzar(3), banco = crearBanco(PARAMETROS_D6, az);
  const r0 = calibrarReferencia(cohorteCalibracion(300, banco, PARAMETROS_D6, az), banco.nivel, { version: 'v', ambito: AMBITO_SIM, dificultad: banco.D, ahora: 'x' });
  const items = [1, 2, 3].flatMap((n) => banco.ids.filter((j) => banco.nivel[j] === n).slice(0, 4));
  const cohorte = (o = {}) => Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, respuestas: simularEstudiante('honesto', items, banco, PARAMETROS_D6, az, o) }));

  it('contexto distinto (modalidad) o referencia provisional → todos se abstienen', () => {
    const c = cohorte();
    const ctx: ContextoCohorte = { ...CONTEXTO_SIM, modalidad: 'practica' };
    const out = analizarCohorteD6(c, r0, ctx);
    expect(out.aplicabilidad.a.aplicable).toBe(false);
    expect(out.estudiantes.every((e) => e.a.p === null && e.b.p === null)).toBe(true);
    expect(analizarCohorteD6(c, { ...r0, fuente: 'provisional' }, CONTEXTO_SIM).aplicabilidad.a.motivos.join(' ')).toMatch(/provisional/);
  });
  it('población distinta (sensibilidad 0,3 frente a 0,5) → la referencia no es aplicable; no se recalibra', () => {
    const copia = JSON.stringify(r0);
    const out = analizarCohorteD6(cohorte({ deltaGamma: -0.2 }), r0, CONTEXTO_SIM);
    expect(out.aplicabilidad.a.aplicable).toBe(false);
    expect(out.aplicabilidad.a.fpr_peor!).toBeGreaterThan(PROTOCOLO_D6.fpr_max_aplicabilidad);
    expect(out.estudiantes.every((e) => e.a.p === null)).toBe(true);
    expect(JSON.stringify(r0)).toBe(copia);
  });
  it('cohorte honesta compatible → aplicable, y el resultado individual no depende de los compañeros', () => {
    const c = cohorte();
    const out = analizarCohorteD6(c, r0, CONTEXTO_SIM);
    expect(out.aplicabilidad.a.aplicable).toBe(true);
    expect(out.estudiantes[0].a).toEqual(d6Individual(c[0].respuestas, r0).a);
  });
  it('cohorte de 2 estudiantes → no se puede comprobar la aplicabilidad → abstención', () => {
    expect(analizarCohorteD6(cohorte().slice(0, 2), r0, CONTEXTO_SIM).aplicabilidad.a.aplicable).toBe(false);
  });
});

describe('D6 v2 · diseño del examen frente a la calibración', () => {
  const r = { tau_beta: 0.1, pendiente_mu_D: 0.5, se_max: 0.18 };
  const q = (Ds: number[]) => Ds.map((D) => ({ D, sigma: 0.45 }));
  it('más preguntas o niveles más separados → más precisión', () => {
    expect(precisionDiseno(q([-1, -1, -1, 0, 0, 0, 1, 1, 1]), r).se!).toBeGreaterThan(precisionDiseno(q([-1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1]), r).se!);
    // 8 preguntas en los extremos dan más precisión que 9 repartidas en tres niveles
    expect(precisionDiseno(q([-1, -1, -1, -1, 1, 1, 1, 1]), r).se!).toBeLessThan(precisionDiseno(q([-1, -1, -1, 0, 0, 0, 1, 1, 1]), r).se!);
  });
  it('sin variación de dificultad no hay precisión', () => {
    expect(precisionDiseno(q([0, 0, 0]), r).suficiente).toBe(false);
  });
});

describe('D6 v2 · protocolo congelado', () => {
  it('el protocolo es inmutable y sus huellas coinciden con las fijadas antes de la evaluación final', () => {
    expect(Object.isFrozen(PROTOCOLO_D6)).toBe(true);
    expect(huellasActuales()).toEqual(HUELLAS_CONGELADAS);
    expect(huellaProtocolo({ a: 1 })).not.toBe(huellaProtocolo({ a: 2 }));
  });
  it('las semillas de desarrollo y de evaluación no se solapan', () => {
    const ev = PROTOCOLO_D6.semillas_evaluacion;
    expect(PROTOCOLO_D6.semillas_desarrollo.every((s) => s < ev.desde || s >= ev.desde + ev.cantidad)).toBe(true);
  });
});

describe('D6 v2 · validación por simulación (humo, semillas de DESARROLLO)', () => {
  const { porSemilla } = ejecutarValidacion({ semillas: [1, 3], replicas: 2, tam_cohorte: 60, tam_calibracion: 300,
    escenarios: ['c0', 'pob_gamma', 'pausas_reconstruir', 'pausas_reloj', 'pausas_excluir_pregunta', 'asistido20', 'cob_1'] });
  const filas = resumir(porSemilla);
  const f = (id: string, d: 'A' | 'B' = 'A') => filas.find((x) => x.escenario === id && x.detector === d)!;

  it('cohorte honesta: FPR entre evaluados ≤ 10 % y cobertura alta', () => {
    expect(f('c0').fpr_evaluados.agregada!).toBeLessThan(0.1);
    expect(f('c0').cobertura_h.agregada!).toBeGreaterThan(0.5);
  });
  it('población distinta: sin la puerta la FPR se dispara; con la puerta no se evalúa a nadie', () => {
    expect(f('pob_gamma').sin_puerta.fpr.agregada!).toBeGreaterThan(0.15);
    expect(f('pob_gamma').cobertura_h.agregada).toBe(0);
  });
  it('pausas más frecuentes en preguntas difíciles: la reconstrucción no sesga β; reloj y exclusión sí', () => {
    const rec = f('pausas_reconstruir').sesgo_beta!, rel = f('pausas_reloj').sesgo_beta!, exc = f('pausas_excluir_pregunta').sesgo_beta!;
    expect(Math.abs(rec.media)).toBeLessThan(3 * rec.se + 0.01);
    expect(rel.media).toBeGreaterThan(rec.media + 2 * rel.se);
    expect(exc.media).toBeLessThan(rec.media); // el tamaño del sesgo, con IC, lo da la evaluación final
  });
  it('asistencia en todo el examen: D6-B (referencia) la detecta; la normalización interna no', () => {
    const b = f('asistido20', 'B');
    expect(b.sin_puerta.sens.agregada!).toBeGreaterThan(0.6);
    expect(b.interno!.sens.agregada!).toBeLessThan(0.1);
  });
  it('un solo nivel: abstención total por no identificabilidad', () => {
    expect(Object.keys(f('cob_1').estados)).toEqual(['no_identificable']);
    expect(f('cob_1').cobertura_h.agregada).toBe(0);
  });
});
