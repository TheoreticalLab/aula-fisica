import { describe, expect, it } from 'vitest';
import { analizarIntentos, descriptivos, histograma, porGrupo, porIntento, porPregunta, resumen } from '../src/lib/telemetria/v2/estadistica';
import { procesoAsistido, reconstruirPaquete, type PaqueteIntento, type PasoAsistido } from '../src/lib/telemetria/v2/fuente';

const T0 = Date.parse('2026-11-02T20:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const items = [
  { exercise_id: 'P1', slug: 'p1', dificultad: 'basico', formato: 'numeric', titulo: 'Uno', conceptos: ['c-impulso'] },
  { exercise_id: 'P2', slug: 'p2', dificultad: 'desafiante', formato: 'choice', titulo: 'Dos', conceptos: ['c-impulso', 'c-energia'] },
];
/** Paquete V2: P1 activa `a` segundos y P2 `b` segundos, con interacciones cada 10 s (atribución por control). */
function paqueteV2(id: string, a: number, b: number, correctaP1 = true): PaqueteIntento {
  const v2: PaqueteIntento['v2'] = [];
  let seq = 0;
  const ev = (event_type: string, t: number, question_id: string | null = null, payload: Record<string, unknown> = {}) =>
    v2.push({ session_id: `s-${id}`, client_seq: ++seq, event_type, question_id, t_mono: t, received_at: iso(T0 + t), payload, tab_id: null });
  ev('session_started', 0, null, { visible: true });
  ev('question_activated', 0, 'P1');
  for (let t = 10_000; t < a * 1000; t += 10_000) ev('question_exposure_started', t, 'P1');   // señales de vida (no cambian nada relevante)
  ev('question_activated', a * 1000, 'P2');
  for (let t = a * 1000 + 10_000; t < (a + b) * 1000; t += 10_000) ev('heartbeat', t);
  ev('session_ended', (a + b) * 1000);
  return {
    intento: { id, inicio: iso(T0), entrega: iso(T0 + (a + b) * 1000), estado: 'submitted', modo: 'practice', actividad: 'X', leccion: null, presentacion: null },
    items, v1: [], v2, tramos: [], servidor: [], revisiones: [], evaluaciones: [],
    respuestas: [
      { exercise_id: 'P1', answer: { text: '1' }, status: correctaP1 ? 'correct' : 'incorrect', auto_credit: null, manual_credit: null, engine_code: null, tries: 1, hints_used: 0, solution_revealed: false, client_rev: 0, updated_at: iso(T0) },
    ],
    instantanea: null,
  };
}
/** Paquete V1 (varias preguntas en pantalla sin pregunta activa): el foco no es identificable. */
function paqueteV1(id: string): PaqueteIntento {
  const v1 = [
    { id: 1, session_id: `v-${id}`, seq: 1, kind: 'sesion_inicio', exercise_id: null, t_ms: 0, received_at: iso(T0), data: {} },
    { id: 2, session_id: `v-${id}`, seq: 2, kind: 'primera_interaccion', exercise_id: 'P1', t_ms: 5000, received_at: iso(T0 + 5000), data: {} },
    { id: 3, session_id: `v-${id}`, seq: 3, kind: 'salida', exercise_id: null, t_ms: 50_000, received_at: iso(T0 + 50_000), data: {} },
  ];
  return { ...paqueteV2(id, 1, 1), v2: [], v1, intento: { ...paqueteV2(id, 1, 1).intento, entrega: iso(T0 + 50_000) } };
}
const est = (n: number) => ({ user_id: `u${n}`, full_name: `Estudiante ${n}`, student_code: null });

describe('descriptivos', () => {
  it('mediana, cuartiles, media, desviación y faltantes', () => {
    const d = descriptivos([1, 2, 3, 4, 5, 6, 7, 8, 9, null, undefined]);
    expect(d).toMatchObject({ n: 9, faltantes: 2, media: 5, mediana: 5, p25: 3, p75: 7, min: 1, max: 9, estable: true });
    expect(d.de).toBeCloseTo(2.7386, 3);
    expect(d.ic95_mediana![0]).toBeLessThanOrEqual(5);
    expect(d.ic95_mediana![1]).toBeGreaterThanOrEqual(5);
  });
  it('reproducible (bootstrap con semilla fija) y sin IC con pocos datos', () => {
    expect(descriptivos([3, 1, 4, 1, 5, 9, 2, 6])).toEqual(descriptivos([3, 1, 4, 1, 5, 9, 2, 6]));
    expect(descriptivos([1, 2, 3])).toMatchObject({ n: 3, estable: false, ic95_mediana: null });
    expect(descriptivos([])).toMatchObject({ n: 0, mediana: null, media: null });
  });
  it('histograma: las clases suman n', () => {
    const h = histograma([1, 2, 2, 3, 5, 8, 13, 21, 34]);
    expect(h.reduce((s, c) => s + c.n, 0)).toBe(9);
    expect(histograma([4, 4, 4])).toEqual([{ desde: 4, hasta: 4, n: 3 }]);
  });
});

describe('análisis entre intentos', () => {
  const datos = [
    { estudiante: est(1), numero: 1, paquete: paqueteV2('a1', 60, 120, true) },
    { estudiante: est(2), numero: 1, paquete: paqueteV2('a2', 90, 60, false) },
    { estudiante: est(3), numero: 1, paquete: paqueteV2('a3', 30, 30, true) },
    { estudiante: est(4), numero: 1, paquete: paqueteV1('a4') },
  ];
  const intentos = analizarIntentos(datos);
  it('usa la misma reconstrucción que la vista individual', () => {
    expect(intentos[0].rec).toEqual(reconstruirPaquete(datos[0].paquete).reconstruccion);
  });
  it('por pregunta: solo valores identificables; el intento V1 cuenta como faltante, no como cero', () => {
    const p1 = porPregunta(intentos).find((f) => f.exercise_id === 'P1')!;
    expect(p1.intentos).toBe(4);
    expect(p1.metricas.T_focus).toMatchObject({ n: 3, faltantes: 1, mediana: 60_000, min: 30_000, max: 90_000 });
    expect(p1.acierto).toMatchObject({ n: 4, correctas: 3 });
    expect(p1.metricas.T_interaction.n).toBeGreaterThan(0);
  });
  it('por grupo: una pregunta cuenta en cada uno de sus conceptos; se informan los formatos', () => {
    const g = porGrupo(intentos, 'concepto', 'T_focus');
    expect(g.find((x) => x.grupo === 'c-impulso')).toMatchObject({ preguntas: 2, formatos: ['choice', 'numeric'] });
    expect(g.find((x) => x.grupo === 'c-energia')!.d.n).toBe(3);
    expect(porGrupo(intentos, 'dificultad', 'T_focus').map((x) => x.grupo)).toEqual(['basico', 'desafiante']);
  });
  it('por intento: el foco total solo existe si todas las preguntas son identificables', () => {
    const f = porIntento(intentos);
    expect(f[0].foco_total).toBe(180_000);
    expect(f[3].foco_total).toBeNull();
    expect(f.every((x) => x.invariantes === 0)).toBe(true);
  });
  it('resumen de la actividad', () => {
    const r = resumen(intentos);
    expect(r).toMatchObject({ intentos: 4, estudiantes: 4, fuentes: { v2: 3, v1: 1, diario_examen: 0, ninguna: 0 }, formatos: ['choice', 'numeric'] });
    expect(r.duracion.n).toBe(4);
  });
});

describe('práctica asistida en la reconstrucción', () => {
  const paso = (fase: PasoAsistido['fase'], t: number, extra: Partial<PasoAsistido> = {}): PasoAsistido => ({
    exercise_id: 'P1', fase, version: 1, answer: { text: 'x' }, no_se: false, declaracion: null, fuentes: null, explicacion_presentada: false,
    transfer_exercise_id: null, status: null, credit: null, engine_code: null, at: iso(T0 + t), ...extra,
  });
  const pasos = [
    paso('inicial', 10_000, { declaracion: 'consulto_ayuda', status: 'incorrect' }),
    paso('corregida', 70_000, { status: 'partial' }),
    paso('corregida', 100_000, { version: 2, status: 'correct' }),
    paso('reflexion', 160_000, { explicacion_presentada: true, fuentes: ['ia', 'libro'] }),
    paso('transferencia', 220_000, { status: 'correct', transfer_exercise_id: 'T1' }),
  ];
  it('proceso: primer intento declarado, correcciones, explicación, transferencia y tiempos entre fases', () => {
    const p = procesoAsistido(pasos)!;
    expect(p.inicial).toMatchObject({ declaracion: 'consulto_ayuda', status: 'incorrect' });
    expect(p.correcciones).toBe(2);
    expect(p.final!.status).toBe('correct');
    expect(p.explicacion).toMatchObject({ presentada: true, fuentes: ['ia', 'libro'] });
    expect(p.transferencia).toMatchObject({ exercise_id: 'T1', status: 'correct' });
    expect(p.tiempos).toEqual({ inicial_a_primera_correccion: 60_000, inicial_a_explicacion: 150_000, explicacion_a_transferencia: 60_000 });
    expect(p.cambio).toBe('mejoro');
    expect(procesoAsistido([])).toBeNull();
  });
  it('los pasos aparecen en la cronología como hechos del servidor y no alteran la partición', () => {
    const base = paqueteV2('as', 120, 120);
    const sin = reconstruirPaquete(base).reconstruccion!;
    const con = reconstruirPaquete({ ...base, asistida: pasos }).reconstruccion!;
    expect(con.eventos.filter((e) => e.tipo === 'fase_asistida')).toHaveLength(5);
    expect(con.eventos.find((e) => e.tipo === 'fase_asistida')!.fuente).toBe('servidor');
    expect(con.totales).toEqual(sin.totales);
    expect(con.invariantes).toEqual([]);
    const a = analizarIntentos([{ estudiante: est(1), numero: 1, paquete: { ...base, asistida: pasos } }]);
    expect(porPregunta(a)[0].asistida).toMatchObject({ n: 1, inicial_correcta: 0, final_correcta: 1, transferencias: 1, transferencia_correcta: 1 });
  });
});
