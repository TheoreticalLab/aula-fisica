/** Asistencia con código (migración 24). */
import { rpc } from '@/lib/supabase';

export interface AsistenciaEnVivo {
  id: string; class_id: string; clase: string; asignatura: string; code: string; code_expires_at: string; opened_at: string; closed_at: string | null;
  abierta: boolean; server_now: string;
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presente: boolean; marked_at: string | null; method: 'codigo' | 'profesor' | null }[];
}
export interface InformeAsistencia {
  sesiones: { id: string; opened_at: string; closed_at: string | null; presentes: number }[];
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presentes: number; sesiones: string[] | null }[];
}
export interface MiAsistencia { class_id: string; clase: string; asignatura: string; sesiones: number; presentes: number; ultimas: { fecha: string; presente: boolean; hora: string | null }[] }

export const abrirAsistencia = (classId: string, minutos: number) => rpc<{ id: string; code: string; code_expires_at: string }>('attendance_open', { p_class: classId, p_minutes: minutos });
export const nuevoCodigo = (id: string, minutos: number) => rpc<{ id: string; code: string; code_expires_at: string }>('attendance_new_code', { p_session: id, p_minutes: minutos });
export const cerrarAsistencia = (id: string) => rpc<void>('attendance_close', { p_session: id });
export const marcarManual = (id: string, user: string, presente: boolean) => rpc<void>('attendance_set', { p_session: id, p_user: user, p_present: presente });
export const asistenciaEnVivo = (id: string) => rpc<AsistenciaEnVivo>('attendance_live', { p_session: id });
export const asistenciasAbiertas = () => rpc<{ id: string; class_id: string; clase: string; code_expires_at: string; opened_at: string; presentes: number }[]>('attendance_open_sessions');
export const informeAsistencia = (classId: string) => rpc<InformeAsistencia>('attendance_report', { p_class: classId });

export const marcarPresente = (codigo: string) => rpc<{ ok: boolean; error?: string; clases?: string[]; nuevo?: boolean }>('attendance_mark', { p_code: codigo });
export const miAsistencia = () => rpc<MiAsistencia[]>('my_attendance');
