/** Asistencia con código (migraciones 24 a 26). */
import { rpc } from '@/lib/supabase';
import { contextoAcceso } from '@/lib/instalacion';
import type { Ubicacion } from '@/lib/ubicacion';

export interface AsistenciaEnVivo {
  id: string; class_id: string; clase: string; asignatura: string; code: string; code_expires_at: string; opened_at: string; closed_at: string | null;
  abierta: boolean; server_now: string; rotate_seconds: number; code_changes_at: string | null; require_location: boolean; geo_radius_m: number;
  tiene_ubicacion: boolean; geo_accuracy: number | null;
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presente: boolean; marked_at: string | null; method: 'codigo' | 'profesor' | null;
    geo_status: string | null; distance_m: number | null; accuracy: number | null }[];
  rechazos: { full_name: string; student_code: string | null; motivo: string; distance_m: number | null; accuracy: number | null; fecha: string }[];
}
export interface InformeAsistencia {
  sesiones: { id: string; opened_at: string; closed_at: string | null; presentes: number }[];
  estudiantes: { user_id: string; full_name: string; student_code: string | null; presentes: number; sesiones: string[] | null }[];
}
export interface MiAsistencia { class_id: string; clase: string; asignatura: string; sesiones: number; presentes: number; ultimas: { fecha: string; presente: boolean; hora: string | null }[] }
export interface AsistenciaAbiertaMia { session_id: string; clase: string; asignatura: string; code_expires_at: string; presente: boolean }
export interface OpcionesAsistencia { minutos: number; rotar: number; ubicacion: Ubicacion | null; exigirUbicacion: boolean; radio: number }

export const iniciarAsistencia = (classId: string, o: OpcionesAsistencia) =>
  rpc<{ id: string; code_expires_at: string }>('attendance_start', {
    p_class: classId, p_minutes: o.minutos, p_rotate: o.rotar, p_lat: o.ubicacion?.lat ?? null, p_lng: o.ubicacion?.lng ?? null,
    p_accuracy: o.ubicacion?.accuracy ?? null, p_require_location: o.exigirUbicacion && !!o.ubicacion, p_radius: o.radio,
  });
export const nuevoCodigo = (id: string, minutos: number) => rpc<{ id: string; code: string; code_expires_at: string }>('attendance_new_code', { p_session: id, p_minutes: minutos });
export const cerrarAsistencia = (id: string) => rpc<void>('attendance_close', { p_session: id });
export const marcarManual = (id: string, user: string, presente: boolean) => rpc<void>('attendance_set', { p_session: id, p_user: user, p_present: presente });
export const asistenciaEnVivo = (id: string) => rpc<AsistenciaEnVivo>('attendance_live', { p_session: id });
export const informeAsistencia = (classId: string) => rpc<InformeAsistencia>('attendance_report', { p_class: classId });

export const misAsistenciasAbiertas = () => rpc<AsistenciaAbiertaMia[]>('my_open_attendance');
export const marcarPresente = (codigo: string, u: Ubicacion | null) =>
  rpc<{ ok: boolean; error?: string; clases?: string[]; nuevo?: boolean }>('attendance_check_in', {
    p_code: codigo, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null, p_accuracy: u?.accuracy ?? null, p_install: contextoAcceso().install_id,
  });
export const miAsistencia = () => rpc<MiAsistencia[]>('my_attendance');
