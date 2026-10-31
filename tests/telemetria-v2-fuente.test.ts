import { describe, expect, it } from 'vitest';
import { armarEntrada, auditarRespuestas, paraLieia, reconstruirPaquete, type PaqueteIntento } from '../src/lib/telemetria/v2/fuente';
import { aCsv, filas, investigacion } from '../src/lib/telemetria/v2/exportar';

const T0 = Date.parse('2026-11-01T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const base = (over: Partial<PaqueteIntento> = {}): PaqueteIntento => ({
  intento: { id: 'A', inicio: iso(T0), entrega: iso(T0 + 120_000), estado: 'submitted', modo: 'practice', actividad: 'X', leccion: null, presentacion: null },
  items: [{ exercise_id: 'P1', slug: 'p1', dificultad: 'basico', formato: 'numeric', titulo: 'Uno' }, { exercise_id: 'P2', slug: 'p2', dificultad: 'basico', formato: 'numeric', titulo: '=HYPERLINK("x")' }],
  v1: [], v2: [], tramos: [], servidor: [], revisiones: [], evaluaciones: [], respuestas: [], instantanea: null, ...over,
});
const v1 = (seq: number, kind: string, t: number, exercise_id: string | null = null, data: Record<string, unknown> = {}) =>
  ({ id: seq, session_id: 's', seq, kind, exercise_id, t_ms: t, received_at: iso(T0 + t), data });

describe('fuente de la reconstrucción', () => {
  it('prioridad: diario del examen > V2 > V1; sin datos, nada', () => {
    expect(armarEntrada(base()).fuente).toBe('ninguna');
    expect(armarEntrada(base({ v1: [v1(1, 'sesion_inicio', 0)] })).entrada!.atribucion).toBe('ambigua');
    const v2 = [{ session_id: 's2', client_seq: 1, event_type: 'session_started', question_id: null, t_mono: 0, received_at: iso(T0), payload: {} }];
    expect(armarEntrada(base({ v1: [v1(1, 'sesion_inicio', 0)], v2 })).fuente).toBe('v2');
    const tramos = [{ seq: 1, tipo: 'trabajo' as const, exercise_id: 'P1', inicio: iso(T0), fin: iso(T0 + 60_000), sin_red: false }];
    const servidor = [{ id: 1, tipo: 'apertura' as const, exercise_id: 'P1', t: iso(T0) }];
    const e = armarEntrada(base({ v2, tramos, servidor }));
    expect(e.fuente).toBe('diario_examen');
    expect(e.entrada!.atribucion).toBe('servidor');
  });
});

describe('auditoría de respuestas (¿por qué apareció vacía?)', () => {
  it('distingue escrita sin guardar, guardada, guardada y vaciada, sin historial y nunca escrita', () => {
    const p = base({
      v1: [v1(1, 'sesion_inicio', 0), v1(2, 'respuesta_cambio', 9000, 'P1', { inicio_ms: 4000, rafaga_ms: 3000, vacia: false })],
      respuestas: [{ exercise_id: 'P2', answer: { text: '3 m/s' }, status: 'draft', auto_credit: null, manual_credit: null, engine_code: null, tries: 0, hints_used: 0, solution_revealed: false, client_rev: 0, updated_at: iso(T0) }],
    });
    const rec = reconstruirPaquete(p).reconstruccion;
    const a = auditarRespuestas(p, rec);
    expect(a.find((x) => x.exercise_id === 'P1')!.diagnostico).toBe('escrita_sin_guardar');
    expect(a.find((x) => x.exercise_id === 'P2')!.diagnostico).toBe('sin_historial');
    const rev = (r: number, vacia: boolean) => ({ exercise_id: 'P1', rev: r, answer: vacia ? {} : { text: `v${r}` }, answer_hash: `h${r}`, vacia, client_rev: null, primero_at: iso(T0 + r), ultimo_at: iso(T0 + r), consolidados: 0 });
    const g = auditarRespuestas(base({ revisiones: [rev(1, false), rev(2, false)], instantanea: { attempt_id: 'A', submitted_at: iso(T0), revisiones: [{ exercise_id: 'P1', rev: 2, status: 'correct', vacia: false, answer_hash: 'h2' }], created_at: iso(T0) } }), null);
    expect(g[0]).toMatchObject({ diagnostico: 'guardada', entregada: { rev: 2 } });
    expect(g[0].primera!.answer).toEqual({ text: 'v1' });                    // la primera respuesta se conserva
    expect(auditarRespuestas(base({ revisiones: [rev(1, false), rev(2, true)] }), null)[0].diagnostico).toBe('guardada_y_vaciada');
    expect(auditarRespuestas(base(), null)[1].diagnostico).toBe('nunca_escrita');
  });
});

describe('interfaz para LIEIA (versionada, no conectada)', () => {
  it('un tiempo no identificable sale null con su estado, nunca 0', () => {
    const rec = reconstruirPaquete(base({ v1: [v1(1, 'sesion_inicio', 0), v1(2, 'primera_interaccion', 1000, 'P1')] })).reconstruccion!;
    const l = paraLieia(rec);
    expect(l[0].tiempo_reconstruido).toEqual({ valor: null, estado: 'no_identificable' });
    expect(l[0].interfaz).toBe('telemetria-v2/lieia@1');
    expect(l[0].parametros_hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('exportación', () => {
  const p = base({ v1: [v1(1, 'sesion_inicio', 0), v1(2, 'primera_interaccion', 1000, 'P1'), v1(3, 'salida', 60_000)] });
  const { reconstruccion: rec, fuente } = reconstruirPaquete(p);
  const ctx = { attempt_id: 'A', fuente, titulos: Object.fromEntries(p.items.map((i) => [i.exercise_id, i.titulo])) };
  it('el resumen exportado coincide con la reconstrucción (mismo cálculo)', () => {
    const a = filas('A', rec!, ctx)[0];
    expect(a.T_wall_ms).toBe(rec!.T_wall);
    expect(a.T_observable_activo_ms).toBe(rec!.totales.observable_activo);
    const b = filas('B', rec!, ctx);
    expect(b[0].T_focus_ms).toBeNull();                                      // no identificable → vacío…
    expect(b[0].T_focus_estado).toBe('no_identificable');                    // …con su estado
    expect(filas('C', rec!, ctx).reduce((s, f) => s + (f.duracion_ms as number), 0)).toBe(rec!.T_wall);
  });
  it('CSV: neutraliza fórmulas y escapa comillas y saltos', () => {
    const csv = aCsv(filas('B', rec!, ctx));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(aCsv([{ a: 'x\ny', b: -3 }])).toBe('a,b\n"x\ny",-3\n');
  });
  it('nivel E reproducible: mismos eventos y versión → mismo JSON', () => {
    const r2 = reconstruirPaquete(p).reconstruccion!;
    expect(JSON.stringify(investigacion(r2, ctx, [], 'x'))).toBe(JSON.stringify(investigacion(rec!, ctx, [], 'x')));
  });
});
