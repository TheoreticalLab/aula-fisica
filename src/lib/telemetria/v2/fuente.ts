/**
 * Telemetría V2 · de los datos de un intento (telemetria_v2_intento) a la reconstrucción, la auditoría de respuestas
 * y la interfaz versionada para LIEIA. Puro: la página, la exportación y las pruebas usan exactamente esto.
 */
import { desdeDiarioExamen, desdeV1, desdeV2, type FilaV1, type FilaV2 } from './adaptadores';
import { reconstruir } from './reconstruir';
import type { Atribucion, Entrada, Metrica, Reconstruccion } from './modelo';
import type { TipoTramo } from '../../examen/motor';

export interface PaqueteIntento {
  intento: { id: string; inicio: string; entrega: string | null; estado: string; modo: string; actividad: string | null; leccion: string | null; presentacion: string | null };
  items: { exercise_id: string; slug: string; dificultad: string; formato: string; titulo: string }[];
  v1: FilaV1[];
  v2: FilaV2[];
  tramos: { seq: number; tipo: TipoTramo; exercise_id: string | null; inicio: string; fin: string; sin_red: boolean }[];
  servidor: { id: number; tipo: 'apertura' | 'ir_a' | 'pausa' | 'reanudacion' | 'entrega' | 'rechazo'; exercise_id: string | null; t: string }[];
  revisiones: { exercise_id: string; rev: number; answer: Record<string, unknown>; answer_hash: string; vacia: boolean; client_rev: number | null; primero_at: string; ultimo_at: string; consolidados: number }[];
  evaluaciones: { exercise_id: string; kind: string; answer: Record<string, unknown> | null; result: Record<string, unknown> | null; at: string }[];
  respuestas: { exercise_id: string; answer: Record<string, unknown>; status: string; auto_credit: number | null; manual_credit: number | null; engine_code: string | null; tries: number; hints_used: number; solution_revealed: boolean; client_rev: number | null; updated_at: string }[];
  instantanea: { attempt_id: string; submitted_at: string | null; revisiones: { exercise_id: string; rev: number | null; status: string; vacia: boolean; answer_hash: string }[]; created_at: string } | null;
}

export type FuenteElegida = 'diario_examen' | 'v2' | 'v1' | 'ninguna';

/** Elige la fuente con más garantías: diario del examen (servidor) > V2 (sincronizada, pregunta activa) > V1. */
export function armarEntrada(p: PaqueteIntento): { entrada: Entrada | null; fuente: FuenteElegida; discrepancias: string[] } {
  const preguntas = p.items.map((i) => i.exercise_id);
  const inicio = Date.parse(p.intento.inicio), fin = p.intento.entrega ? Date.parse(p.intento.entrega) : null;
  const unica: Atribucion | null = preguntas.length === 1 ? 'unica' : null;
  if (p.tramos.length) {
    const diario = p.tramos.map((t) => ({ tipo: t.tipo, exercise_id: t.exercise_id, inicio: Date.parse(t.inicio), fin: Date.parse(t.fin), sin_red: t.sin_red }));
    const servidor = p.servidor.filter((e) => e.tipo !== 'rechazo').map((e) => ({ id: e.id, tipo: e.tipo as 'apertura', exercise_id: e.exercise_id, t: Date.parse(e.t) }));
    const { eventos, discrepancias } = desdeDiarioExamen(diario, servidor);
    return { entrada: { intento: { inicio, fin }, preguntas, eventos, modalidad: 'examen', atribucion: 'servidor', origen: 'diario_examen' }, fuente: 'diario_examen', discrepancias };
  }
  if (p.v2.length) {
    return { entrada: { intento: { inicio, fin }, preguntas, eventos: desdeV2(p.v2), modalidad: 'practica', atribucion: unica ?? 'control', origen: 'v2' }, fuente: 'v2', discrepancias: [] };
  }
  if (p.v1.length) {
    return { entrada: { intento: { inicio, fin }, preguntas, eventos: desdeV1(p.v1), modalidad: p.intento.modo === 'exam' ? 'examen' : 'practica', atribucion: unica ?? 'ambigua', origen: 'v1' }, fuente: 'v1', discrepancias: [] };
  }
  return { entrada: null, fuente: 'ninguna', discrepancias: [] };
}

export function reconstruirPaquete(p: PaqueteIntento): { reconstruccion: Reconstruccion | null; fuente: FuenteElegida; discrepancias: string[] } {
  const { entrada, fuente, discrepancias } = armarEntrada(p);
  return { reconstruccion: entrada ? reconstruir(entrada) : null, fuente, discrepancias };
}

// ---- auditoría de respuestas (fase 6.4) ---------------------------------------------------------------------------

export type DiagnosticoRespuesta =
  | 'nunca_escrita'                 // ni revisiones ni ediciones observadas
  | 'escrita_sin_guardar'           // la telemetría vio texto, pero el servidor no tiene ninguna revisión no vacía
  | 'guardada_y_vaciada'            // hubo respuesta guardada y después se borró
  | 'guardada'                      // la última revisión guardada tiene contenido
  | 'sin_historial';                // intento anterior al historial de revisiones: solo la respuesta final

export interface AuditoriaPregunta {
  exercise_id: string;
  revisiones: PaqueteIntento['revisiones'];
  primera: PaqueteIntento['revisiones'][number] | null;
  final: PaqueteIntento['revisiones'][number] | null;
  entregada: { rev: number | null; status: string; vacia: boolean } | null;
  evaluaciones: PaqueteIntento['evaluaciones'];
  actual: PaqueteIntento['respuestas'][number] | null;
  diagnostico: DiagnosticoRespuesta;
  explicacion: string;
}

export function auditarRespuestas(p: PaqueteIntento, rec: Reconstruccion | null): AuditoriaPregunta[] {
  return p.items.map(({ exercise_id }) => {
    const revisiones = p.revisiones.filter((r) => r.exercise_id === exercise_id).sort((a, b) => a.rev - b.rev);
    const actual = p.respuestas.find((r) => r.exercise_id === exercise_id) ?? null;
    const ent = p.instantanea?.revisiones.find((r) => r.exercise_id === exercise_id) ?? null;
    const evals = p.evaluaciones.filter((e) => e.exercise_id === exercise_id);
    const q = rec?.preguntas.find((x) => x.pregunta === exercise_id);
    const final = revisiones[revisiones.length - 1] ?? null;
    const vioTexto = (q?.ediciones ?? 0) > 0 && q?.calidad.respuesta !== 'sin_respuesta';
    let diagnostico: DiagnosticoRespuesta, explicacion: string;
    const actualVacia = !actual || esVacia(actual.answer);
    if (!revisiones.length && actual && !actualVacia) {
      diagnostico = 'sin_historial'; explicacion = 'Hay respuesta guardada, pero el intento es anterior al historial de revisiones (o el historial no estaba activo): solo se conoce la versión final.';
    } else if (final && !final.vacia) {
      diagnostico = 'guardada'; explicacion = `Última versión guardada: revisión ${final.rev}${revisiones.length > 1 ? ` (de ${revisiones.length})` : ''}.`;
    } else if (final && final.vacia) {
      diagnostico = 'guardada_y_vaciada'; explicacion = `El estudiante guardó una respuesta (revisión 1) y después la dejó vacía (revisión ${final.rev}).`;
    } else if (vioTexto) {
      diagnostico = 'escrita_sin_guardar'; explicacion = 'La telemetría registró que se escribió algo, pero el servidor nunca confirmó un guardado: se quedó en el dispositivo (salida antes del guardado, sin red o error).';
    } else {
      diagnostico = 'nunca_escrita'; explicacion = 'No consta que se escribiera nada en esta pregunta.';
    }
    return { exercise_id, revisiones, primera: revisiones[0] ?? null, final, entregada: ent ? { rev: ent.rev, status: ent.status, vacia: ent.vacia } : null, evaluaciones: evals, actual, diagnostico, explicacion };
  });
}

function esVacia(a: Record<string, unknown>): boolean {
  const sel = Array.isArray(a.selected) ? a.selected.length : 0;
  return !String(a.text ?? '').trim() && !sel && typeof a.value !== 'boolean' && !String(a.justification ?? '').trim();
}

// ---- interfaz versionada para LIEIA (fase 13; NO conectada a ningún detector) -------------------------------------

export const VERSION_INTERFAZ_LIEIA = 'telemetria-v2/lieia@1';

/** Un valor numérico solo sale si es identificable; si no, `null` con su estado: nunca un cero sustituto. */
export interface ValorLieia { valor: number | null; estado: Metrica['estado'] }
export interface RegistroLieia {
  interfaz: string; motor: string; parametros_hash: string; exercise_id: string;
  tiempo_reconstruido: ValorLieia; tiempo_interaccion: ValorLieia; tiempo_edicion: ValorLieia; tiempo_pausa_intento: ValorLieia;
  calidad_temporal: string; cobertura: number | null; estado_respuesta: string; resultado: string | null;
}

export function paraLieia(rec: Reconstruccion, resultados: Record<string, string | null> = {}): RegistroLieia[] {
  const ph = hashParametros(rec.parametros);
  const v = (m: Metrica): ValorLieia => ({ valor: m.estado === 'no_identificable' || m.estado === 'informacion_insuficiente' || m.estado === 'dato_temporal_invalido' ? null : m.valor, estado: m.estado });
  return rec.preguntas.map((q) => ({
    interfaz: VERSION_INTERFAZ_LIEIA, motor: rec.version, parametros_hash: ph, exercise_id: q.pregunta,
    tiempo_reconstruido: v(q.T_focus), tiempo_interaccion: v(q.T_interaction), tiempo_edicion: v(q.T_edit),
    tiempo_pausa_intento: { valor: rec.totales.pausa_declarada, estado: 'reconstruido' },
    calidad_temporal: q.calidad.temporal, cobertura: q.calidad.cobertura, estado_respuesta: q.calidad.respuesta, resultado: resultados[q.pregunta] ?? null,
  }));
}

function hashParametros(p: object): string {
  const s = JSON.stringify(p, Object.keys(p).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
