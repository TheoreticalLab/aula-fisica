// Respuesta oral (migración 86): configuración de la pregunta, subida privada por la Edge Function «entregas» (módulo
// «audio») y enlaces temporales para escuchar. La autorización la deciden las funciones SQL.
import { invocar, rpc } from '@/lib/supabase';
import type { ConfigAudio } from '@/lib/audio';
export { CONFIG_AUDIO_POR_DEFECTO, type ConfigAudio } from '@/lib/audio';

export interface GrabacionAudio { id: string; subido: string; duracion_ms: number; bytes: number; eliminada: boolean; mime?: string; transcripcion?: string | null }


export const audioMiPregunta = (attemptId: string, exerciseId: string) =>
  rpc<{ config: ConfigAudio; grabaciones: GrabacionAudio[]; vigente: string | null }>('audio_mi_pregunta', { p_attempt: attemptId, p_exercise: exerciseId });
export const audioDeRespuesta = (responseId: string) =>
  rpc<{ vigente: string | null; grabaciones: GrabacionAudio[] }>('audio_de_respuesta', { p_response: responseId });
export function subirAudio(attemptId: string, exerciseId: string, grabacion: Blob, duracionMs: number) {
  const f = new FormData();
  f.append('modulo', 'audio');
  f.append('attempt_id', attemptId);
  f.append('exercise_id', exerciseId);
  f.append('duracion_ms', String(Math.round(duracionMs)));
  f.append('archivo', grabacion, 'respuesta');
  return invocar<{ id: string; subido: string; duracion_ms: number }>('entregas', f);
}
export const urlAudio = (audioId: string) => invocar<{ url: string }>('entregas', { action: 'audio_ver', audio_id: audioId });
