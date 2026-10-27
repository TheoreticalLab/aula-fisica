/** Entregas en PDF con autorización del profesor (migración 23 + Edge Function «entregas»). */
import { invocar, rpc } from '@/lib/supabase';

export interface ArchivoEntrega { id: string; nombre: string; bytes: number; subido: string; estado: 'recibido' | 'aceptado' | 'rechazado'; nota: string | null; revisado?: string | null }
export interface Buzon {
  id: string; title: string; instructions: string; kind: 'practica' | 'examen' | 'otro'; opens_at: string | null; closes_at: string | null;
  requires_approval: boolean; max_files: number; max_mb: number; archived: boolean; created_at: string; estudiantes: number;
  solicitudes_pendientes: number; autorizados: number; con_entrega: number; archivos: number; sin_revisar: number;
}
export interface EstudianteBuzon {
  user_id: string; full_name: string; student_code: string | null; permiso: 'solicitado' | 'aprobado' | 'rechazado' | 'revocado' | null;
  request_note: string | null; requested_at: string | null; decided_at: string | null; decision_note: string | null; archivos: ArchivoEntrega[];
}
export interface MiBuzon {
  id: string; class_name: string; course_title: string; title: string; instructions: string; kind: Buzon['kind']; opens_at: string | null; closes_at: string | null;
  requires_approval: boolean; max_files: number; max_mb: number; permiso: EstudianteBuzon['permiso']; decision_note: string | null;
  puede_subir: boolean; motivo: string | null; archivos: ArchivoEntrega[];
}

export const TIPO_BUZON: Record<Buzon['kind'], string> = { practica: 'Práctica escrita', examen: 'Examen escrito', otro: 'Otro documento' };

export const buzonesDeSeccion = (classId: string) => rpc<Buzon[]>('upload_boxes_for_class', { p_class: classId });
export const estudiantesDeBuzon = (boxId: string) => rpc<EstudianteBuzon[]>('upload_box_students', { p_box: boxId });
export const guardarBuzon = (b: { id: string | null; class_id: string; title: string; instructions: string; kind: string; opens_at: string | null; closes_at: string | null; requires_approval: boolean; max_files: number; max_mb: number }) =>
  rpc<string>('upload_box_save', { p_id: b.id, p_class: b.class_id, p_title: b.title, p_instructions: b.instructions, p_kind: b.kind, p_opens: b.opens_at, p_closes: b.closes_at, p_requires_approval: b.requires_approval, p_max_files: b.max_files, p_max_mb: b.max_mb });
export const archivarBuzon = (id: string, archived: boolean) => rpc<void>('upload_box_archive', { p_id: id, p_archived: archived });
export const decidirPermiso = (box: string, user: string, status: 'aprobado' | 'rechazado' | 'revocado', note: string | null) =>
  rpc<void>('upload_permission_decide', { p_box: box, p_user: user, p_status: status, p_note: note });
export const autorizarATodos = (box: string) => rpc<number>('upload_permission_approve_all', { p_box: box });
export const revisarArchivo = (file: string, status: ArchivoEntrega['estado'], note: string | null) => rpc<void>('upload_file_review', { p_file: file, p_status: status, p_note: note });

export const misBuzones = () => rpc<MiBuzon[]>('my_upload_boxes');
export const solicitarPermiso = (box: string, note: string | null) => rpc<string>('upload_permission_request', { p_box: box, p_note: note });

export function subirPdf(box: string, archivo: File) {
  const f = new FormData();
  f.append('box_id', box);
  f.append('archivo', archivo, archivo.name);
  return invocar<{ id: string; estado: string }>('entregas', f);
}

/** Abre el PDF con un enlace temporal (2 minutos). */
export async function abrirPdf(fileId: string) {
  const ventana = window.open('', '_blank');
  try {
    const { url } = await invocar<{ url: string }>('entregas', { action: 'descargar', file_id: fileId });
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

export const tamano = (b: number) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
