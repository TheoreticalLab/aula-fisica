/** Prácticas anteriores · sin envío por correo (migración 47 + Edge Function «entregas», destino «libre»). */
import { invocar, rpc } from '@/lib/supabase';
import type { CapturaOptimizada } from '@/lib/imagen';
import type { EstudianteSeccion, Modalidad, RegistroLibre } from '@/lib/practicasLibres';

export interface AvisoOmision { id: string; grupo: string; total_oficial: number | null; nota: string | null; estado: 'pendiente' | 'registrada' | 'no_realizada' | 'otro_nombre'; enviado_at: string }
export interface MiSeccionLibre {
  class_id: string; class_name: string; course_title: string; habilitado: boolean; nuevos: boolean; correcciones: boolean; sin_foto_permitido: boolean;
  nombres_libres: boolean; max_registros: number; max_ejercicios: number; max_mb_captura: number; version: string;
  correo_abierto: boolean; terminado_at: string | null;
  registros: RegistroLibre[]; grupos: { id: string; nombre: string }[]; avisos: AvisoOmision[];
  correo: { tema: string | null; practica: string | null; numero: number }[];
}
export interface DatosLibre {
  id: string; class_id: string; nombre: string; total: number; realizados: number; modalidades: Modalidad[]; modalidad_otra: string;
  sin_foto: boolean; explicacion: string; observaciones: string; grupo: string | null;
}

export const misLibres = () => rpc<MiSeccionLibre[]>('hist_libre_mias');
export const guardarLibre = (d: DatosLibre, version: string) => rpc<{ id: string; estado: string; falta_foto: boolean }>('hist_libre_guardar', {
  p_id: d.id, p_class: d.class_id, p_nombre: d.nombre, p_total: d.total, p_realizados: d.realizados, p_modalidades: d.modalidades,
  p_modalidad_otra: d.modalidad_otra, p_sin_foto: d.sin_foto, p_explicacion: d.explicacion, p_observaciones: d.observaciones, p_grupo: d.grupo,
  p_acepto: true, p_version: version,
});
export const responderSolicitud = (id: string, respuesta: string, noDisponible: boolean) =>
  rpc<void>('hist_libre_responder', { p_id: id, p_respuesta: respuesta, p_no_disponible: noDisponible });
export const responderAviso = (aviso: string, estado: 'registrada' | 'no_realizada' | 'otro_nombre', libre: string | null, respuesta: string) =>
  rpc<void>('hist_libre_aviso_responder', { p_aviso: aviso, p_estado: estado, p_libre: libre, p_respuesta: respuesta });

export function subirFoto(libreId: string, posicion: number, c: CapturaOptimizada) {
  const f = new FormData();
  f.append('modulo', 'regularizacion');
  f.append('destino', 'libre');
  f.append('libre_id', libreId);
  f.append('posicion', String(posicion));
  if (c.shaOriginal) f.append('sha_original', c.shaOriginal);
  if (c.dhash) f.append('dhash', c.dhash);
  f.append('bytes_original', String(c.bytesOriginal));
  f.append('archivo', c.blob, `foto.${c.tipo === 'image/webp' ? 'webp' : 'jpg'}`);
  return invocar<{ id: string; bytes: number; ancho: number; alto: number }>('entregas', f);
}
export const quitarFoto = (fotoId: string) => invocar<{ ok: boolean }>('entregas', { action: 'captura_quitar', capture_id: fotoId, destino: 'libre' });

// --- profesorado -----------------------------------------------------------------------------------------------------
export interface ConfigLibre {
  habilitado: boolean; nuevos: boolean; correcciones: boolean; sin_foto: boolean; nombres_libres: boolean; max_registros: number; max_ejercicios: number;
  sugerencias: boolean; solicitudes: boolean; max_mb_captura: number; cuota_mb: number; bytes_seccion: number;
}
export interface GrupoLibre { id: string; nombre_oficial: string; total_oficial: number | null; descripcion: string; created_at: string }
export interface AvisoDocente { id: string; grupo_id: string; user_id: string; estado: AvisoOmision['estado']; respuesta: string | null; libre_id: string | null; enviado_at: string; respondido_at: string | null }
export interface DatosSeccionLibre {
  config: ConfigLibre; estudiantes: EstudianteSeccion[]; registros: RegistroLibre[]; grupos: GrupoLibre[]; avisos: AvisoDocente[];
  correo: { user_id: string; tema: string | null; practica: string | null; numero: number }[];
}
export type AccionLibre = 'en_revision' | 'solicitar_evidencia' | 'solicitar_correccion' | 'presencial' | 'validar' | 'reabrir' | 'total_oficial';
export interface EventoLibre { at: string; papel: string; actor_name: string | null; accion: string; estado_antes: string | null; estado_despues: string | null; nota: string | null; detalle: Record<string, unknown> }

export const datosLibre = (classId: string) => rpc<DatosSeccionLibre>('hist_libre_datos', { p_class: classId });
export const configurarLibre = (classId: string, c: Partial<Omit<ConfigLibre, 'max_mb_captura' | 'cuota_mb' | 'bytes_seccion'>>) => rpc<void>('hist_libre_configurar', {
  p_class: classId, p_habilitado: c.habilitado ?? null, p_nuevos: c.nuevos ?? null, p_correcciones: c.correcciones ?? null, p_sin_foto: c.sin_foto ?? null,
  p_nombres_libres: c.nombres_libres ?? null, p_max_registros: c.max_registros ?? null, p_max_ejercicios: c.max_ejercicios ?? null,
  p_sugerencias: c.sugerencias ?? null, p_solicitudes: c.solicitudes ?? null,
});
export const revisarLibre = (ids: string[], accion: AccionLibre, o: { nota?: string | null; tipo?: string | null; verificados?: number | null; totalOficial?: number | null } = {}) =>
  rpc<{ aplicadas: number; errores: { id: string; motivo: string }[] }>('hist_libre_revisar', {
    p_ids: ids, p_accion: accion, p_nota: o.nota ?? null, p_tipo: o.tipo ?? null, p_verificados: o.verificados ?? null, p_total_oficial: o.totalOficial ?? null,
  });
export const historialLibre = (id: string) => rpc<EventoLibre[]>('hist_libre_historial', { p_id: id });
export const guardarGrupo = (g: { id: string | null; class_id: string; nombre: string; total_oficial: number | null; descripcion: string }) =>
  rpc<string>('hist_libre_grupo_guardar', { p_id: g.id, p_class: g.class_id, p_nombre: g.nombre, p_total_oficial: g.total_oficial, p_descripcion: g.descripcion });
export const agrupar = (grupo: string | null, ids: string[]) => rpc<number>('hist_libre_agrupar', { p_grupo: grupo, p_ids: ids });
export const avisarOmision = (grupo: string, users: string[], nota: string) => rpc<number>('hist_libre_avisar', { p_grupo: grupo, p_users: users, p_nota: nota });
