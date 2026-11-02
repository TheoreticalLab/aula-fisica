/** Prácticas de Control y VTA (migración 62). Todo se valida en el servidor (control_*, vta_*). */
import { rpc } from '@/lib/supabase';
import type { EstadoControl } from '@/lib/control';

export interface Politica { id: string; activity_id: string; version: number; w: number; duracion_min: number; condiciones: string; politica_ayudas: string; activa: boolean; announced_at: string }
export interface AvisoControl {
  version: number; w: number; duracion_min: number; condiciones: string; politica_ayudas: string; announced_at: string;
  aplicable_a_mi: Politica | null;
}
export const controlAviso = (activityId: string) => rpc<AvisoControl | null>('control_aviso', { p_activity: activityId });
export const controlPoliticaGuardar = (activityId: string, w: number, duracion: number, condiciones: string, politicaAyudas: string) =>
  rpc<Politica & { entregas_previas: number }>('control_politica_guardar', { p_activity: activityId, p_w: w, p_duracion: duracion, p_condiciones: condiciones, p_politica_ayudas: politicaAyudas });
export const controlPoliticaRetirar = (activityId: string) => rpc<void>('control_politica_retirar', { p_activity: activityId });

export interface ItemCatalogo {
  id: string; exercise_id: string; origen_exercise_id: string | null; tipo: string; competencia: string; competencias_secundarias: string[]; minutos: number;
  hipotesis: string | null; justificacion: string; rubrica: { criterio: string; peso: number }[]; generador: string; estado: 'propuesto' | 'aprobado' | 'rechazado';
  slug: string; prompt: string; format: string; published: boolean;
}
export interface Catalogo {
  conceptos: string[];
  originales: { exercise_id: string; slug: string; prompt: string; concepts: string[]; difficulty: string; format: string }[];
  catalogo: ItemCatalogo[];
  sugerencias: { exercise_id: string; slug: string; prompt: string; concepts: string[]; difficulty: string; format: string; minutos: number }[];
}
export const controlCatalogo = (practiceId: string) => rpc<Catalogo>('control_catalogo', { p_practice: practiceId });
export const controlItemGuardar = (item: Partial<ItemCatalogo> & { exercise_id: string }) => rpc<ItemCatalogo>('control_item_guardar', { p_item: item });

export interface AjusteNota { user_id: string; nombre: string; original: number | null; control: number | null; politica: { version: number; w: number } | null; factor: number; final: number | null }
export const controlAjustes = (practiceId: string) => rpc<AjusteNota[]>('control_ajustes', { p_practice: practiceId });

export interface ControlPendiente { activity_id: string; attempt_id: string | null; practica: string; competencia: string | null; duracion_min: number; extra_min: number; cierra: string; server_now: string }
export const miControlPendiente = () => rpc<ControlPendiente | null>('my_control_pendiente');

export interface SesionControl { id: string; practica: string; practice_activity_id: string; estado: string; recuperacion: boolean; duracion_min: number; preparado_at: string; asignados: number; entregados: number; confirmados: number }
export const controlSesiones = (classId: string) => rpc<SesionControl[]>('control_sesiones', { p_class: classId });

export interface VtaFila {
  user_id: string; nombre: string; controles: number; practica: number | null; supervisado: number | null; brecha: number | null; brecha_ee: number | null;
  competencias_verificadas: number; competencias_pendientes: number; senal: string;
}
export const vtaSeccion = (classId: string) => rpc<{ estudiantes: VtaFila[]; aviso: string }>('vta_seccion', { p_class: classId });
export interface VtaHistorial {
  session_id: string; practica: string; fecha: string; competencia: string | null; tipo: string | null; recuperacion: boolean;
  practica_pct: number | null; control_pct: number | null; dif_practica: number | null; dif_control: number | null;
}
export const vtaEstudiante = (classId: string, userId: string) =>
  rpc<{ historial: VtaHistorial[]; pendientes_de_confirmar: number; aviso: string }>('vta_estudiante', { p_class: classId, p_user: userId });

export type { EstadoControl };
