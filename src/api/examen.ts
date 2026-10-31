/** Motor de examen (migración 35): sesión oficial, navegación, pausas, diario de tramos y guardado con revisiones. */
import { rpc } from '@/lib/supabase';
import type { ConfigExamen, Tramo } from '@/lib/examen/motor';

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

export const examOpen = (attemptId: string) => rpc<AperturaExamen>('exam_open', { p_attempt: attemptId });
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
export const examSettingsGet = (activityId: string) => rpc<ConfigExamenGuardada>('exam_settings_get', { p_activity: activityId });
export const examSettingsSave = (activityId: string, cfg: ConfigExamen) => rpc<ConfigExamenGuardada>('exam_settings_save', { p_activity: activityId, p_cfg: cfg });
