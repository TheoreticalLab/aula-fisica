/**
 * Telemetría V2 · paquetes de intento a partir de las tablas del Centro de Datos (nombres de export_fuente).
 * Así la exportación masiva usa EXACTAMENTE la misma reconstrucción que la vista del profesor (reconstruirPaquete).
 * En modo investigación los identificadores de personas ya vienen seudonimizados: aquí no se tocan.
 */
import type { PaqueteIntento, PasoAsistido } from './fuente';

type Fila = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === 'object') return v as Record<string, unknown>;
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v); } catch { return null; } }
  return null;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === 'string' && v.startsWith('[') ? (() => { try { return JSON.parse(v) as unknown[]; } catch { return []; } })() : []);
function agrupar(filas: Fila[] | undefined, k: string) {
  const m = new Map<string, Fila[]>();
  for (const f of filas ?? []) { const v = s(f[k]); if (v === null) continue; const l = m.get(v); if (l) l.push(f); else m.set(v, [f]); }
  return m;
}

export function paquetesDesdeExportacion(d: Record<string, Fila[]>): { user_id: string | null; numero: number; paquete: PaqueteIntento }[] {
  const ej = new Map((d.ejercicios ?? []).map((e) => [s(e.id)!, e]));
  const itemsAct = agrupar(d.actividad_items, 'activity_id');
  const orden = agrupar(d.orden_items, 'attempt_id');
  const config = new Map((d.examen_config ?? []).map((c) => [s(c.activity_id)!, c]));
  const v1 = agrupar(d.telemetria, 'attempt_id'), v2 = agrupar(d.telemetria_v2, 'attempt_id');
  const tramos = agrupar(d.examen_tramos, 'attempt_id'), servidor = agrupar(d.examen_eventos, 'attempt_id');
  const revs = agrupar(d.revisiones_respuesta, 'attempt_id'), resp = agrupar(d.respuestas, 'attempt_id');
  const respPorId = new Map((d.respuestas ?? []).map((r) => [s(r.id)!, r]));
  const evalPorIntento = new Map<string, Fila[]>();
  for (const e of d.eventos_respuesta ?? []) {
    const r = respPorId.get(s(e.response_id) ?? '');
    if (!r) continue;
    const a = s(r.attempt_id)!;
    (evalPorIntento.get(a) ?? evalPorIntento.set(a, []).get(a)!).push({ ...e, exercise_id: r.exercise_id });
  }
  const inst = new Map((d.instantaneas_entrega ?? []).map((x) => [s(x.attempt_id)!, x]));
  const asis = agrupar(d.asistida_pasos, 'attempt_id');
  const item = (id: string, pos: number) => {
    const e = ej.get(id);
    return { exercise_id: id, slug: s(e?.slug) ?? id, dificultad: s(e?.difficulty) ?? '', formato: s(e?.format) ?? '', titulo: (s(e?.prompt) ?? '').replace(/\s+/g, ' ').slice(0, 80),
      conceptos: arr(e?.concepts).map(String), _pos: pos };
  };
  return (d.intentos ?? []).map((a) => {
    const id = s(a.id)!;
    const act = s(a.activity_id);
    const lista = orden.get(id)?.length ? orden.get(id)!.map((o) => item(s(o.exercise_id)!, n(o.position) ?? 0))
      : act ? (itemsAct.get(act) ?? []).map((o) => item(s(o.exercise_id)!, n(o.position) ?? 0))
        : (d.ejercicios ?? []).filter((e) => s(e.lesson_id) === s(a.lesson_id) && s(e.role) === 'practice').map((e) => item(s(e.id)!, n(e.position) ?? 0));
    const items = lista.sort((x, y) => x._pos - y._pos).map(({ _pos, ...x }) => { void _pos; return x; });
    const ins = inst.get(id);
    const paquete: PaqueteIntento = {
      intento: { id, inicio: s(a.started_at)!, entrega: s(a.submitted_at), estado: s(a.status) ?? '', modo: s(a.mode) ?? '', actividad: act, leccion: s(a.lesson_id),
        presentacion: act ? s(config.get(act)?.presentacion) : null },
      items,
      v1: (v1.get(id) ?? []).map((t) => ({ id: n(t.id) ?? s(t.id) ?? undefined, session_id: s(t.session_id)!, seq: n(t.seq) ?? 0, kind: s(t.kind)!, exercise_id: s(t.exercise_id),
        t_ms: n(t.t_ms) ?? 0, received_at: s(t.received_at)!, data: obj(t.data) })),
      v2: (v2.get(id) ?? []).map((t) => ({ id: n(t.id) ?? undefined, event_id: s(t.event_id) ?? undefined, session_id: s(t.session_id)!, tab_id: s(t.tab_id),
        client_seq: n(t.client_seq) ?? 0, event_type: s(t.event_type)!, question_id: s(t.question_id), t_mono: n(t.t_mono) ?? 0, received_at: s(t.received_at)!, payload: obj(t.payload) })),
      tramos: (tramos.get(id) ?? []).map((t) => ({ seq: n(t.seq) ?? 0, tipo: s(t.tipo) as PaqueteIntento['tramos'][number]['tipo'], exercise_id: s(t.exercise_id), inicio: s(t.inicio)!, fin: s(t.fin)!, sin_red: t.sin_red === true || t.sin_red === 'true' })),
      servidor: (servidor.get(id) ?? []).map((e) => ({ id: n(e.id) ?? 0, tipo: s(e.tipo) as PaqueteIntento['servidor'][number]['tipo'], exercise_id: s(e.exercise_id), t: s(e.t)! })),
      revisiones: (revs.get(id) ?? []).map((r) => ({ exercise_id: s(r.exercise_id)!, rev: n(r.rev) ?? 0, answer: obj(r.answer) ?? {}, answer_hash: s(r.answer_hash) ?? '', vacia: r.vacia === true || r.vacia === 'true',
        client_rev: n(r.client_rev), primero_at: s(r.primero_at)!, ultimo_at: s(r.ultimo_at)!, consolidados: n(r.consolidados) ?? 0 })),
      evaluaciones: (evalPorIntento.get(id) ?? []).map((e) => ({ exercise_id: s(e.exercise_id)!, kind: s(e.kind)!, answer: obj(e.answer), result: obj(e.result), at: s(e.created_at)! })),
      respuestas: (resp.get(id) ?? []).map((r) => ({ exercise_id: s(r.exercise_id)!, answer: obj(r.answer) ?? {}, status: s(r.status) ?? '', auto_credit: n(r.auto_credit), manual_credit: n(r.manual_credit),
        engine_code: s(r.engine_code), tries: n(r.tries) ?? 0, hints_used: n(r.hints_used) ?? 0, solution_revealed: r.solution_revealed === true, client_rev: n(r.client_rev), updated_at: s(r.updated_at) ?? '' })),
      instantanea: ins ? { attempt_id: id, submitted_at: s(ins.submitted_at), revisiones: arr(ins.revisiones) as NonNullable<PaqueteIntento['instantanea']>['revisiones'], created_at: s(ins.created_at) ?? '' } : null,
      asistida: (asis.get(id) ?? []).map((p): PasoAsistido => ({
        exercise_id: s(p.exercise_id)!, fase: s(p.fase) as PasoAsistido['fase'], version: n(p.version) ?? 1, answer: obj(p.answer), no_se: p.no_se === true || p.no_se === 'true',
        declaracion: s(p.declaracion), fuentes: arr(p.fuentes).map(String), explicacion_presentada: !!obj(p.reflexion) || !!s(p.explicacion)?.trim(),
        transfer_exercise_id: s(p.transfer_exercise_id), status: s(p.status), credit: n(p.credit), engine_code: s(p.engine_code), at: s(p.created_at)!,
      })),
    };
    return { user_id: s(a.user_id), numero: n(a.attempt_number) ?? 1, paquete };
  });
}
