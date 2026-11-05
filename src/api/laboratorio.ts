// Asignaturas de laboratorio (migración 84): controles fotográficos. Las imágenes viajan por la Edge Function «entregas»
// (módulo «laboratorio»), que las guarda en almacenamiento privado; la autorización la deciden las funciones SQL.
import { invocar, rpc } from '@/lib/supabase';
import type { EstadoControl } from '@/lib/laboratorio';

export interface EntregaControl {
  id: string; subido: string; estado: 'recibido' | 'aceptado' | 'rechazado'; nota: string | null; revisado: string | null;
  bytes: number; mime: string | null; ancho: number | null; alto: number | null;
  revisiones: { de: string; a: string; nota: string | null; en: string }[];
}
export interface ControlLab {
  box_id: string; numero: number; titulo: string; instrucciones: string; abre: string | null; cierra: string | null; fecha_individual: boolean;
  estado: EstadoControl; historial: EntregaControl[]; puede_subir: boolean; motivo: string | null;
}
export interface MisControles {
  controles: number;
  secciones: { class_id: string; seccion: string; archivada: boolean; controles: ControlLab[] }[];
}
export interface FilaLab {
  user_id: string; nombre: string; matricula: string | null; login: string | null; estados: EstadoControl[];
  entregados: number; aprobados: number; por_corregir: number; sin_revisar: number;
}
export interface PanelLab {
  controles: number; curso: string; seccion: string;
  cajas: { box_id: string; numero: number; abre: string | null; cierra: string | null; archivado: boolean }[];
  estudiantes: FilaLab[];
}
export interface DetalleLab {
  estudiante: { user_id: string; nombre: string; matricula: string | null; login: string | null };
  controles: ControlLab[];
}

// --- estudiante -----------------------------------------------------------------------------------------------
export const misControles = (courseId: string) => rpc<MisControles>('lab_mis_controles', { p_course: courseId });
export function subirControl(boxId: string, imagen: Blob, tipo: string) {
  const f = new FormData();
  f.append('modulo', 'laboratorio');
  f.append('box_id', boxId);
  f.append('archivo', imagen, `control.${tipo === 'image/webp' ? 'webp' : tipo === 'image/png' ? 'png' : 'jpg'}`);
  return invocar<{ id: string; estado: string; subido: string; bytes: number; ancho: number; alto: number }>('entregas', f);
}
/** Enlace temporal (5 min) a la imagen: autor, profesorado de la sección o administrador. */
export const urlControl = (fileId: string) => invocar<{ url: string }>('entregas', { action: 'control_ver', file_id: fileId });

// --- profesorado ----------------------------------------------------------------------------------------------
export const panelLab = (classId: string) => rpc<PanelLab>('lab_controles_seccion', { p_class: classId });
export const detalleLab = (classId: string, userId: string) => rpc<DetalleLab>('lab_controles_estudiante', { p_class: classId, p_user: userId });
export const revisarControl = (fileId: string, estado: 'aprobado' | 'requiere_correccion' | 'entregado', nota: string | null) =>
  rpc<ControlLab>('lab_control_revisar', { p_file: fileId, p_estado: estado, p_nota: nota });
/** numero null = los N controles; userId null = fechas generales; con estudiante y ambas fechas null, quita las individuales. */
export const fechasLab = (classId: string, numero: number | null, userId: string | null, abre: string | null, cierra: string | null) =>
  rpc<number>('lab_controles_fechas', { p_class: classId, p_numero: numero, p_user: userId, p_abre: abre, p_cierra: cierra });
