/** Práctica con aprendizaje asistido (migración 38 + acción «asistida» de la Edge Function calificar). */
import { calificar, rpc } from '@/lib/supabase';
import type { GradeResult, StudentAnswer } from '@/api/tipos';
import type { Declaracion, EstadoItem, Fuente, Pesos } from '@/lib/asistida';

export interface EstadoAsistida {
  asistida: boolean;
  config?: { transferencia: boolean; max_correcciones: number; pesos: Pesos; verificacion: { tipo: string | null; fecha: string | null; nota: string | null } };
  items?: EstadoItem[];
}

export const asistidaEstado = (attemptId: string) => rpc<EstadoAsistida>('asistida_estado', { p_attempt: attemptId });

export interface RespuestaPaso { guardado: boolean; repetido?: boolean; mensajes?: string[]; resultado?: GradeResult; estado?: EstadoItem }

export const asistidaPaso = (p: {
  fase: 'inicial' | 'corregida' | 'transferencia'; attempt_id: string; exercise_id: string; client_id: string;
  answer?: StudentAnswer; procedimiento?: string; explicacion?: string; no_se?: boolean; declaracion?: Declaracion;
}) => calificar<RespuestaPaso>({ action: 'asistida', ...p });

export const asistidaReflexion = (attemptId: string, exerciseId: string, reflexion: Record<string, string>, fuentes: Fuente[],
  referencias: { fuente: string; enlace?: string; concepto?: string; idea?: string }[], clientId: string) =>
  rpc<EstadoItem>('asistida_reflexion', { p_attempt: attemptId, p_exercise: exerciseId, p_reflexion: reflexion, p_fuentes: fuentes, p_referencias: referencias, p_client_id: clientId });

export interface ConfigAsistida {
  transferencia: boolean; peso_inicial: number; peso_correccion: number; peso_justificacion: number; peso_transferencia: number;
  verificacion_tipo: string | null; verificacion_fecha: string | null; verificacion_actividad: string | null; verificacion_nota: string | null;
}
export const assistedSettingsGet = (activityId: string) =>
  rpc<{ config: ConfigAsistida | null; transferencias: Record<string, string>; con_pasos: boolean }>('assisted_settings_get', { p_activity: activityId });
export const assistedSettingsSave = (activityId: string, cfg: Partial<ConfigAsistida>, transferencias: Record<string, string> | null) =>
  rpc<{ config: ConfigAsistida | null; transferencias: Record<string, string>; con_pasos: boolean }>('assisted_settings_save', { p_activity: activityId, p_cfg: cfg, p_transferencias: transferencias });

export const assistedSettingsDisable = (activityId: string) =>
  rpc<{ config: ConfigAsistida | null; transferencias: Record<string, string>; con_pasos: boolean }>('assisted_settings_disable', { p_activity: activityId });

export interface ProcesoAsistida {
  asistida: boolean;
  config: ConfigAsistida;
  inscritos: number;
  ejercicios: { exercise_id: string; slug: string; concepts: string[]; format: string; transfer_exercise_id: string | null }[];
  intentos: { attempt_id: string; user_id: string; nombre: string; status: string; items: EstadoItem[]; retencion: number | null }[];
}
export const asistidaProceso = (activityId: string) => rpc<ProcesoAsistida>('asistida_proceso', { p_activity: activityId });
