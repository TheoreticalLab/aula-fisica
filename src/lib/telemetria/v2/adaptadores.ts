/**
 * Telemetría V2 · adaptadores de fuentes existentes al evento normalizado. No modifican los datos originales; cada
 * evento conserva la referencia a su registro (`ref`). Las garantías de cada fuente se declaran en `Entrada.origen`.
 */
import { conciliar, type EventoServidor } from '../../examen/intervalos';
import type { Tramo } from '../../examen/motor';
import type { EventoNorm } from './modelo';

/** Fila de `telemetry_events` (V1). */
export interface FilaV1 {
  id?: number | string;
  session_id: string;
  seq: number;
  kind: string;
  exercise_id: string | null;
  t_ms: number | string;
  received_at: string;
  data: Record<string, unknown> | null;
}

/** V1 → normalizado. La vista de pregunta V1 es poco fiable (ver auditoría) y se marca en `datos.v1`. */
export function desdeV1(filas: FilaV1[]): EventoNorm[] {
  const out: EventoNorm[] = [];
  for (const f of filas) {
    const d = f.data ?? {};
    const base = {
      sesion: f.session_id, seq: Number(f.seq), fuente: 'cliente' as const, tau: Number(f.t_ms), recibido: Date.parse(f.received_at),
      pregunta: f.exercise_id, ...(f.id !== undefined ? { ref: `telemetry_events:${f.id}` } : {}),
    };
    const ev = (tipo: EventoNorm['tipo'], datos?: Record<string, unknown>) => out.push({ ...base, tipo, ...(datos ? { datos } : {}) });
    switch (f.kind) {
      case 'sesion_inicio': ev('sesion_inicio', { navegacion: d.navegacion, pestana: d.pestana }); break;
      case 'salida': ev('sesion_fin'); break;
      case 'pregunta_vista': ev(d.visible ? 'exposicion_inicio' : 'exposicion_fin', { v1: true }); break;
      case 'primera_interaccion': ev('interaccion'); break;
      case 'respuesta_cambio': {
        // el evento se emite al CERRAR la ráfaga (2 s después del último cambio): su fin real es inicio + duración
        const ini = typeof d.inicio_ms === 'number' ? d.inicio_ms : null;
        const fin = ini !== null && typeof d.rafaga_ms === 'number' ? ini + d.rafaga_ms : null;
        ev('edicion', { inicio_tau: ini, fin_tau: fin, vacia: d.vacia === true, primera: d.primera === true, borrado: d.borrado === true, huella: d.h ?? null, longitud: d.len ?? null });
        break;
      }
      case 'borrador_guardado': ev(d.ok ? 'guardado_confirmado' : 'guardado_fallido'); break;
      case 'comprobacion': ev('comprobacion', { fase: d.fase }); break;
      case 'envio': ev('entrega_solicitada', { fase: d.fase }); break;
      case 'visibilidad': ev(d.visible ? 'visible' : 'oculta'); break;
      case 'foco': ev(d.visible ? 'foco_ganado' : 'foco_perdido'); break;
      case 'inactividad': ev(d.estado === 'inicio' ? 'inactividad_inicio' : 'inactividad_fin', d.estado === 'inicio' ? { desde_tau: d.desde_ms } : undefined); break;
      case 'conexion': ev(d.en_linea ? 'conexion_restaurada' : 'conexion_perdida'); break;
      default: break;
    }
  }
  return out;
}

/** Fila de `telemetry_v2_events` (tal como la devuelve telemetria_v2_intento). */
export interface FilaV2 {
  id?: number | string;
  event_id?: string;
  session_id: string;
  tab_id?: string | null;
  client_seq: number;
  event_type: string;
  question_id: string | null;
  t_mono: number | string;
  received_at: string;
  payload: Record<string, unknown> | null;
}

const TIPOS_V2: Record<string, EventoNorm['tipo']> = {
  session_started: 'sesion_inicio', session_resumed: 'sesion_inicio', session_ended: 'sesion_fin', clock_sync: 'sincronizacion', heartbeat: 'latido',
  page_visible: 'visible', page_hidden: 'oculta', focus_gained: 'foco_ganado', focus_lost: 'foco_perdido',
  idle_started: 'inactividad_inicio', idle_ended: 'inactividad_fin', connection_lost: 'conexion_perdida', connection_restored: 'conexion_restaurada',
  question_exposure_started: 'exposicion_inicio', question_exposure_ended: 'exposicion_fin', question_activated: 'pregunta_activada', question_deactivated: 'pregunta_desactivada',
  answer_draft_changed: 'edicion', answer_save_requested: 'guardado_solicitado', answer_save_confirmed: 'guardado_confirmado', answer_save_failed: 'guardado_fallido',
  answer_checked: 'comprobacion', attempt_submit_requested: 'entrega_solicitada', answer_draft_restored: 'interaccion', simulation_event: 'interaccion',
};

/** V2 → normalizado (sin pérdidas de información temporal: las muestras de reloj anclan la sesión). */
export function desdeV2(filas: FilaV2[]): EventoNorm[] {
  const out: EventoNorm[] = [];
  for (const f of filas) {
    const tipo = TIPOS_V2[f.event_type];
    if (!tipo) continue;
    const p = f.payload ?? {};
    const datos: Record<string, unknown> = { ...p, tipo_v2: f.event_type };
    if (tipo === 'sesion_inicio') Object.assign(datos, { pestana: f.tab_id ?? null, visible: p.visible });
    if (tipo === 'sincronizacion') Object.assign(datos, { envio_tau: p.envio_tau, servidor: p.servidor_ms, recibo_tau: p.recibo_tau });
    out.push({
      sesion: f.session_id, seq: Number(f.client_seq), tipo, fuente: 'cliente', tau: Number(f.t_mono), recibido: Date.parse(f.received_at),
      pregunta: f.question_id, datos, ...(f.id !== undefined ? { ref: `telemetry_v2_events:${f.id}` } : {}),
    });
  }
  return out;
}

/**
 * Diario de tramos del motor de examen + hechos del servidor → normalizado. Se concilia primero (lo que contradice al
 * servidor pasa a «desconocido»); los tramos «desconexion» (aplicación cerrada) son intervalos sin observación.
 */
export function desdeDiarioExamen(diario: Tramo[], servidor: (EventoServidor & { id?: string | number })[]): { eventos: EventoNorm[]; discrepancias: string[] } {
  const { tramos, discrepancias } = conciliar(diario, servidor);
  const out: EventoNorm[] = [];
  let run = 0, seq = 0, finPrevio: number | null = null;
  const ordenados = [...tramos].sort((a, b) => a.inicio - b.inicio);
  for (const tr of ordenados) {
    const nueva = finPrevio === null || tr.inicio > finPrevio + 1000;
    if (tr.tipo === 'desconexion') {
      if (finPrevio !== null) { out.push({ sesion: `diario-${run}`, seq: ++seq, tipo: 'sesion_fin', fuente: 'diario', t: Math.min(tr.inicio, finPrevio) }); }
      finPrevio = null;
      continue;
    }
    if (nueva) {
      if (finPrevio !== null) out.push({ sesion: `diario-${run}`, seq: ++seq, tipo: 'sesion_fin', fuente: 'diario', t: finPrevio });
      run++; seq = 0;
      out.push({ sesion: `diario-${run}`, seq: ++seq, tipo: 'sesion_inicio', fuente: 'diario', t: tr.inicio, datos: { visible: tr.tipo !== 'oculta' } });
    }
    out.push({
      sesion: `diario-${run}`, seq: ++seq, tipo: 'estado', fuente: 'diario', t: tr.inicio,
      datos: {
        vis: tr.tipo === 'oculta' ? 'oculta' : 'visible', inact: tr.tipo === 'inactividad', pausa: tr.tipo === 'pausa_declarada',
        desconocido: tr.tipo === 'desconocido', activa: tr.tipo === 'fuera_de_pregunta' ? null : tr.exercise_id, sin_red: !!tr.sin_red,
      },
    });
    finPrevio = Math.max(finPrevio ?? tr.fin, tr.fin);
  }
  if (finPrevio !== null) out.push({ sesion: `diario-${run}`, seq: ++seq, tipo: 'sesion_fin', fuente: 'diario', t: finPrevio });
  const tipos: Record<EventoServidor['tipo'], EventoNorm['tipo']> = { apertura: 'apertura', ir_a: 'pregunta_activada', pausa: 'pausa_inicio', reanudacion: 'pausa_fin', entrega: 'entrega' };
  [...servidor].sort((a, b) => a.t - b.t).forEach((e, i) => out.push({
    sesion: 'servidor', seq: i + 1, tipo: tipos[e.tipo], fuente: 'servidor', t: e.t, pregunta: e.exercise_id ?? null, ...(e.id !== undefined ? { ref: `exam_events:${e.id}` } : {}),
  }));
  return { eventos: out, discrepancias: discrepancias.map((x) => `${x.motivo} (${new Date(x.tramo.inicio).toISOString()}, ${x.tramo.tipo})`) };
}
