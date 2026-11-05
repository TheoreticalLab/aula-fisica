/** Motor de examen (migración 35): sesión oficial, navegación, pausas, diario de tramos y guardado con revisiones. */
import { invocar, rpc } from '@/lib/supabase';
import type { ConfigExamen, Tramo } from '@/lib/examen/motor';
import { SIN_INTEGRIDAD, type EstadoIntegridad, type MotivoSalida, type TipoCopia } from '@/lib/examen/integridad';

export interface EstadoExamenServidor {
  modo: 'una_a_la_vez';
  ahora_ms: number; inicio_ms: number; limite_ms: number | null; cierre_ms: number | null;
  activa: string | null; orden: string[]; visitadas: string[];
  config: ConfigExamen;
  pausa: { n: number; ms: number; desde_ms: number | null };
  diario_seq: number; diario_fin_ms: number | null;
  estado: 'en_curso' | 'en_pausa' | 'vencido' | 'entregado';
}
export type AperturaExamen = EstadoExamenServidor | { modo: 'clasico' };

export interface ConfigExamenGuardada extends ConfigExamen { configurado: boolean; en_curso?: number }

/** La función no existe en el servidor (frontend publicado antes que la migración 35). */
export const funcionAusente = (e: unknown) => /Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e));

/** Abre el examen. Si el servidor aún no tiene el motor, interfaz clásica; cualquier otro error se propaga. */
export const examOpen = (attemptId: string) => unaVez(`open:${attemptId}`, () => rpc<AperturaExamen>('exam_open', { p_attempt: attemptId })
  .catch((e) => { if (funcionAusente(e)) return { modo: 'clasico' } as AperturaExamen; throw e; }));

/**
 * Abrir el examen cuenta como ENTRADA (migración 85: reabrir un examen protegido bloquea la pantalla). La misma página
 * no debe contarse dos veces: React en desarrollo ejecuta los efectos dos veces y un reintento inmediato no es salir.
 * Una recarga real empieza con esta tabla vacía, así que sí cuenta.
 */
const recientes = new Map<string, { t: number; p: Promise<unknown> }>();
function unaVez<T>(clave: string, f: () => Promise<T>, ms = 5000): Promise<T> {
  const r = recientes.get(clave);
  if (r && Date.now() - r.t < ms) return r.p as Promise<T>;
  const p = f();
  recientes.set(clave, { t: Date.now(), p });
  p.catch(() => recientes.delete(clave));
  return p;
}
export const examPing = (attemptId: string) => rpc<{ ahora_ms: number; limite_ms: number | null }>('exam_ping', { p_attempt: attemptId });
export const examGoto = (attemptId: string, exerciseId: string) => rpc<{ ahora_ms: number; activa: string }>('exam_goto', { p_attempt: attemptId, p_exercise: exerciseId });
export const examPause = (attemptId: string) => rpc<EstadoExamenServidor>('exam_pause', { p_attempt: attemptId });
export const examResume = (attemptId: string) => rpc<EstadoExamenServidor>('exam_resume', { p_attempt: attemptId });
export const examSave = (attemptId: string, exerciseId: string, answer: Record<string, unknown>, rev: number) =>
  rpc<{ rev: number; aplicada: boolean; ahora_ms: number }>('exam_save', { p_attempt: attemptId, p_exercise: exerciseId, p_answer: answer, p_rev: rev });
export const examJournal = (attemptId: string, tramos: (Tramo & { seq: number })[]) =>
  rpc<{ aceptados: number; rechazados: number; diario_seq: number }>('exam_journal', {
    p_attempt: attemptId,
    p_tramos: tramos.map((t) => ({ seq: t.seq, tipo: t.tipo, exercise_id: t.exercise_id, inicio_ms: Math.round(t.inicio), fin_ms: Math.round(t.fin), sin_red: !!t.sin_red })),
  });
export const examTimeline = (attemptId: string) => rpc<{
  sesion: Record<string, unknown> | null; limite_ms: number | null; orden: string[];
  eventos: { t: number; tipo: string; exercise_id: string | null; data: Record<string, unknown> }[];
  tramos: { seq: number; tipo: Tramo['tipo']; exercise_id: string | null; inicio: number; fin: number; sin_red: boolean }[];
}>('exam_timeline', { p_attempt: attemptId });
export interface MonitorExamenDatos {
  ahora_ms: number; inscritos: number; entregados: number;
  en_curso: { attempt_id: string; nombre: string | null; pregunta: number | null; total: number; respondidas: number; en_pausa: boolean; pausas: number;
    ultimo_contacto_ms: number; limite_ms: number | null; inicio_ms: number; extra_s?: number }[];
}
export const examExtend = (attemptId: string, minutos: number, motivo?: string) =>
  rpc<{ extra_s: number; limite_ms: number | null }>('exam_extend', { p_attempt: attemptId, p_minutos: minutos, p_motivo: motivo ?? null });
export const examMonitor =(activityId: string) => rpc<MonitorExamenDatos>('exam_monitor', { p_activity: activityId });
export const examRules =(activityId: string) => rpc<ConfigExamen>('exam_rules', { p_activity: activityId });
// Examen adaptativo (migración 53). Sin la migración, el intento se trata como no adaptativo.
export interface EstadoAdaptativo { activo: boolean; max_items?: number; administradas?: number; fin?: boolean; theta?: number; se?: number; dominio?: number | null }
export const adaptativoEstado = (attemptId: string) => rpc<EstadoAdaptativo>('exam_adaptive_estado', { p_attempt: attemptId })
  .catch((e) => { if (funcionAusente(e)) return { activo: false } as EstadoAdaptativo; throw e; });
export const adaptativoSiguiente = (attemptId: string, tras: string) =>
  invocar<{ siguiente: string | null; fin: boolean; administradas: number; max_items: number }>('calificar', { action: 'adaptativo', attempt_id: attemptId, tras });
export interface ConfigAdaptativa { activo: boolean; max_items: number; min_items: number; se_objetivo: number | null; exposicion: number; incluir_provisionales: boolean }
export interface InfoAdaptativa { config: ConfigAdaptativa | null; preguntas: number; calibradas: number; provisionales: number; intentos: number; minimo_banco: number }
export const adaptativoGet = (activityId: string) => rpc<InfoAdaptativa>('exam_adaptive_get', { p_activity: activityId });
export const adaptativoSave = (activityId: string, cfg: ConfigAdaptativa) => rpc<InfoAdaptativa>('exam_adaptive_save', { p_activity: activityId, p_cfg: cfg });
// Quiz y exámenes protegidos (migración 85): bloquear al salir e impedir copiar. Sin la migración, sin protecciones.
export const examIntegridad = (attemptId: string) => rpc<EstadoIntegridad>('exam_integridad', { p_attempt: attemptId })
  .catch((e) => { if (funcionAusente(e)) return SIN_INTEGRIDAD; throw e; });
export const examSalida = (attemptId: string, motivo: MotivoSalida) => rpc<{ bloqueado: boolean }>('exam_salida', { p_attempt: attemptId, p_motivo: motivo });
export const examEntrada = (attemptId: string) => unaVez(`entrada:${attemptId}`, () => rpc<{ bloqueado: boolean }>('exam_entrada', { p_attempt: attemptId }));
export const examEventoCopia = (attemptId: string, tipo: TipoCopia) => rpc<void>('exam_evento_copia', { p_attempt: attemptId, p_tipo: tipo });
export interface FilaIntegridad {
  user_id: string; nombre: string; matricula: string | null; attempt_id: string; estado: string; inicio: string;
  salidas: number; reingresos: number; pegados: number; arrastres: number; copias: number; ultima_salida: string | null; lock_id: string | null;
  detalle: { tipo: string; motivo: string | null; en: string }[];
}
export const examIntegridadResumen = (activityId: string) =>
  rpc<{ config: { bloquear_al_salir: boolean; impedir_copiar: boolean; codigo_configurado: boolean } | null; estudiantes: FilaIntegridad[] }>('exam_integridad_resumen', { p_activity: activityId });
export const examSettingsGet =(activityId: string) => rpc<ConfigExamenGuardada>('exam_settings_get', { p_activity: activityId });
export const examSettingsSave = (activityId: string, cfg: ConfigExamen) => rpc<ConfigExamenGuardada>('exam_settings_save', { p_activity: activityId, p_cfg: cfg });
