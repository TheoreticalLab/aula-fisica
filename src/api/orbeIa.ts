// Orbe IA · acceso a datos. Estudiante: orbe_ia_next / orbe_ia_cerrar / preferencias. Administrador: orbe_ia_admin_*
// y la Edge Function «orbe-ia» (generar). La clave de la API nunca pasa por aquí: vive en el servidor.
import { invocar, rpc } from '@/lib/supabase';
import type { EventoOrbe, RespuestaOrbe } from '@/lib/orbeIa';

export const MODELOS_ORBE = [
  { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5', entrada: 4, salida: 20 },
  { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5', entrada: 2, salida: 10 },
  { id: 'claude-haiku-5-5', nombre: 'Claude Haiku 5.5', entrada: 0.1, salida: 0.5 },
] as const;

export interface ConfigOrbe {
  enabled: boolean; students_enabled: boolean; api_real: boolean; auto_approve: boolean; auto_generate: boolean; events_enabled: boolean;
  interval_minutes: number; min_activity_seconds: number; model: string; max_output_tokens: number; jokes_per_batch: number;
  monthly_budget_usd: number; daily_max_calls: number; price_input_per_mtok: number; price_output_per_mtok: number;
  updated_at: string;
}
export interface CursoOrbe { course_id: string; titulo: string; archivada: boolean; enabled: boolean; all_lessons: boolean; lessons: string[]; pendientes: number; aprobados: number }
export interface ConsumoOrbe {
  id: number; created_at: string; trigger: 'profesor' | 'automatico'; model: string; simulated: boolean; status: 'reservado' | 'ok' | 'error';
  input_tokens: number; output_tokens: number; cost_usd: number; jokes_generated: number; jokes_rejected: number; error_code: string | null;
  section: string | null; apartado: string | null; evento: string | null; leccion: string | null;
}
export interface PanelOrbe {
  config: ConfigOrbe;
  cursos: CursoOrbe[];
  estadisticas: {
    chistes: Record<string, number>; mostrados: number; mostrados_7d: number; estudiantes_alcanzados: number; cerrados_al_instante: number;
    gasto_mes_usd: number; tokens_mes: { entrada: number; salida: number };
    llamadas_hoy: number; llamadas_reales_mes: number; errores_mes: number;
  };
  consumo: ConsumoOrbe[];
}
export interface LeccionOrbe { lesson_id: string; titulo: string; unidad: string; oculta: boolean; apartados: string[]; pendientes: number; aprobados: number }
export interface ChisteOrbe {
  id: string; lesson_id: string | null; leccion: string | null; section: string | null; apartado: string | null; evento: string | null;
  text: string; status: 'pendiente' | 'aprobado' | 'eliminado'; origin: 'ia' | 'simulador' | 'profesor'; model: string | null;
  times_shown: number; edited: boolean; created_at: string; reviewed_at: string | null;
}
export interface ResultadoGeneracion { ok: boolean; motivo?: string; simulado?: boolean; generados?: number; rechazados?: number; aprobados?: boolean }

// --- estudiante -----------------------------------------------------------------------------------------
export const orbeSiguiente = (lesson: string, section: string, apartado: string | null, evento: EventoOrbe | null = null) =>
  rpc<RespuestaOrbe>('orbe_ia_next', { p_lesson: lesson, p_section: section, p_apartado: apartado, p_evento: evento });
// El estudiante no activa ni desactiva Orbe IA: eso lo decide solo el panel del profesor (migración 32).
export const orbeCerrar = (joke: string, accion: 'cerrado' | 'caducado') => rpc<void>('orbe_ia_cerrar', { p_joke: joke, p_action: accion });
export const orbeReponer = (lesson: string, section: string | null, apartado: string | null, evento: EventoOrbe | null) =>
  invocar<ResultadoGeneracion>('orbe-ia', { action: 'reponer', lesson_id: lesson, section: evento ? null : section, apartado, evento });

// --- administrador --------------------------------------------------------------------------------------
export const orbePanel = () => rpc<PanelOrbe>('orbe_ia_admin_get');
export const orbeGuardarConfig = (p: Partial<ConfigOrbe>) => rpc<ConfigOrbe>('orbe_ia_admin_set_config', { p });
export const orbeGuardarCurso = (course: string, enabled: boolean, allLessons: boolean, lessons: string[]) =>
  rpc<void>('orbe_ia_admin_set_course', { p_course: course, p_enabled: enabled, p_all_lessons: allLessons, p_lessons: lessons });
export const orbeLecciones = (course: string) => rpc<LeccionOrbe[]>('orbe_ia_admin_lessons', { p_course: course });
export const orbeChistes = (course: string, lesson: string | null, status: string | null) =>
  rpc<ChisteOrbe[]>('orbe_ia_admin_jokes', { p_course: course, p_lesson: lesson, p_status: status });
export const orbeAccionChiste = (joke: string, accion: 'aprobado' | 'pendiente' | 'eliminado' | 'editar', texto?: string) =>
  rpc<void>('orbe_ia_admin_joke', { p_joke: joke, p_action: accion, p_text: texto ?? null });
export const orbeAgregarChiste = (lesson: string, section: string | null, texto: string) =>
  rpc<string>('orbe_ia_admin_add', { p_lesson: lesson, p_section: section ?? '', p_text: texto });
export const orbeGenerar = (lesson: string, section: string | null, apartado: string | null, evento: EventoOrbe | null = null) =>
  invocar<ResultadoGeneracion>('orbe-ia', { action: 'generar', lesson_id: lesson, section: evento ? null : section, apartado, evento });
export interface ResultadoCopia { revisados: number; copiados: number; duplicados: number; sin_leccion: number; sin_apartado: number; prueba: boolean }
/** Copia el banco de una asignatura a otra (lecciones emparejadas por slug). Con probar = true solo cuenta. */
export const orbeCopiarBanco = (origen: string, destino: string, pendientes: boolean, simulados: boolean, probar: boolean) =>
  rpc<ResultadoCopia>('orbe_ia_admin_copiar', { p_origen: origen, p_destino: destino, p_pendientes: pendientes, p_simulados: simulados, p_probar: probar });
export const orbeEstadoClave = () => invocar<{ clave_configurada: boolean }>('orbe-ia', { action: 'estado' });
