/**
 * Centro de Datos · Telemetría V2: la exportación masiva (tablas originales → paquetes → reconstrucción) coincide con
 * la vista del profesor (paquete del servidor → reconstrucción). Mismo motor, mismos números.
 */
import { describe, expect, it } from 'vitest';
import { calcularDerivados, COLUMNAS_DERIVADAS } from '../src/lib/exportacion/metricas';
import { DERIVADAS, FUENTES } from '../src/lib/exportacion/catalogo';
import { paquetesDesdeExportacion } from '../src/lib/telemetria/v2/paquetes';
import { reconstruirPaquete } from '../src/lib/telemetria/v2/fuente';

const T0 = Date.parse('2026-11-02T20:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const v2 = (attempt: string, seq: number, event_type: string, t: number, question_id: string | null = null, payload: Record<string, unknown> = {}) =>
  ({ id: seq, attempt_id: attempt, user_id: 'E-1', session_id: `s-${attempt}`, tab_id: null, client_seq: seq, event_type, question_id, t_mono: t, received_at: iso(T0 + t), payload });

const datos: Record<string, Record<string, unknown>[]> = {
  intentos: [{ id: 'A1', user_id: 'E-1', activity_id: 'ACT', lesson_id: null, mode: 'practice', status: 'submitted', attempt_number: 1, started_at: iso(T0), submitted_at: iso(T0 + 120_000) }],
  actividad_items: [{ activity_id: 'ACT', exercise_id: 'P1', position: 1 }, { activity_id: 'ACT', exercise_id: 'P2', position: 2 }],
  ejercicios: [
    { id: 'P1', slug: 'p1', difficulty: 'basico', format: 'numeric', prompt: 'Uno', concepts: ['c1'], lesson_id: null, role: 'bank', position: 1 },
    { id: 'P2', slug: 'p2', difficulty: 'intermedio', format: 'choice', prompt: 'Dos', concepts: '["c2"]', lesson_id: null, role: 'bank', position: 2 },
  ],
  telemetria_v2: [
    v2('A1', 1, 'session_started', 0, null, { visible: true }), v2('A1', 2, 'question_activated', 0, 'P1'),
    v2('A1', 3, 'heartbeat', 30_000), v2('A1', 4, 'question_activated', 50_000, 'P2'), v2('A1', 5, 'heartbeat', 80_000), v2('A1', 6, 'session_ended', 110_000),
  ],
  respuestas: [{ id: 'R1', attempt_id: 'A1', exercise_id: 'P1', user_id: 'E-1', answer: { text: '4 m/s' }, status: 'correct', tries: 1 }],
  revisiones_respuesta: [{ id: 1, attempt_id: 'A1', exercise_id: 'P1', user_id: 'E-1', rev: 1, answer: '{"text":"4 m/s"}', answer_hash: 'h', vacia: false, primero_at: iso(T0 + 20_000), ultimo_at: iso(T0 + 20_000), consolidados: 0 }],
  asistida_pasos: [],
};

describe('Centro de Datos · Telemetría V2', () => {
  it('las fuentes nuevas están en el catálogo y las derivadas tienen columnas fijas', () => {
    for (const f of ['telemetria_v2', 'revisiones_respuesta', 'instantaneas_entrega', 'asistencia_horarios', 'asistencia_quorum_eventos']) expect(FUENTES.some((x) => x.nombre === f), f).toBe(true);
    for (const d of ['telemetria_v2_intentos', 'telemetria_v2_preguntas']) {
      expect(DERIVADAS.some((x) => x.nombre === d)).toBe(true);
      expect(COLUMNAS_DERIVADAS[d]).toContain('user_id');
      expect(COLUMNAS_DERIVADAS[d]).toContain('motor');
    }
  });
  it('paquetes desde las tablas exportadas: orden de preguntas, conceptos y revisiones', () => {
    const [p] = paquetesDesdeExportacion(datos);
    expect(p.user_id).toBe('E-1');
    expect(p.paquete.items.map((i) => i.exercise_id)).toEqual(['P1', 'P2']);
    expect(p.paquete.items[1].conceptos).toEqual(['c2']);
    expect(p.paquete.revisiones[0].answer).toEqual({ text: '4 m/s' });
  });
  it('la tabla derivada coincide con la reconstrucción de la vista del profesor', () => {
    const der = calcularDerivados(datos);
    const fila = der.telemetria_v2_preguntas.find((f) => f.exercise_id === 'P1')!;
    const rec = reconstruirPaquete(paquetesDesdeExportacion(datos)[0].paquete).reconstruccion!;
    const q = rec.preguntas.find((x) => x.pregunta === 'P1')!;
    expect(fila.T_focus_ms).toBe(q.T_focus.valor);
    expect(fila.T_focus_ms).toBe(50_000);
    expect(fila.user_id).toBe('E-1');
    expect(fila.diagnostico_respuesta).toBe('guardada');
    expect(der.telemetria_v2_intentos[0].T_wall_ms).toBe(rec.T_wall);
    expect(Object.keys(fila)).toEqual(COLUMNAS_DERIVADAS.telemetria_v2_preguntas);
  });
  it('sin telemetría de un intento, no inventa filas', () => {
    const der = calcularDerivados({ ...datos, telemetria_v2: [] });
    expect(der.telemetria_v2_preguntas).toEqual([]);
  });
});
