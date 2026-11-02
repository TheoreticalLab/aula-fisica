/** Clases impartidas (migración 66): archivo de pizarras y clase ampliada con IA. Todo se valida en el servidor. */
import { invocar, rpc } from '@/lib/supabase';
import type { FotoPizarra } from '@/lib/imagen';
import type { Nivel } from '../../supabase/functions/_shared/clases/estimacion';

export type EstadoFotos = 'borrador' | 'pendiente' | 'aprobada' | 'rechazada' | 'retirada';
export interface ClaseResumen {
  id: string; class_id: string; fecha: string; title: string; temas: string[]; unit_id: string | null; unidad: string | null; descripcion: string;
  seccion: string; asignatura: string; course_id: string; fotos_estado: EstadoFotos; fotos_motivo: string | null; n_fotos: number;
  ampliada_publicada: boolean; subida_por: string | null; uploader_role: string; created_at: string; updated_at: string;
  // solo en la lista del profesor
  generaciones?: number; procesando?: boolean; borradores?: number; costo_usd?: number;
}
export type { Contenido, Enlace, Seccion } from '@/lib/clases';
import type { Contenido, Enlace } from '@/lib/clases';
export interface Version { id: string; numero: number; estado: 'borrador' | 'publicada' | 'retirada' | 'sustituida'; contenido: Contenido; generation_id: string | null; created_at: string; approved_at: string | null; autor: string | null }
export interface Generacion {
  id: string; model: string; nivel: Nivel; estado: 'procesando' | 'ok' | 'error'; simulated: boolean; estimado_usd: number; cost_usd: number;
  input_tokens: number; output_tokens: number; error_code: string | null; descartados: number; created_at: string; finished_at: string | null; fotos_cambiadas: boolean;
}
export interface ClaseDetalle extends Omit<ClaseResumen, 'generaciones'> {
  papel: 'docente' | 'autor' | 'estudiante';
  fotos_visibles: boolean; permitir_descarga: boolean;
  imagenes: { id: string; posicion: number; ancho: number; alto: number; bytes: number }[];
  publicada: { id: string; numero: number; contenido: Contenido; approved_at: string; modelo: string | null } | null;
  enlaces: Enlace[];
  versiones?: Version[]; generaciones?: Generacion[]; auditoria?: { accion: string; detalle: Record<string, unknown>; created_at: string; actor: string | null }[];
  modelo_preferido?: string;
}
export interface SeccionSubida { class_id: string; seccion: string; asignatura: string; course_id: string; papel: string; unidades: { id: string; title: string }[] }
export interface Permisos {
  monitores_suben: boolean; permitir_descarga: boolean; max_mb: number;
  monitores: { user_id: string; nombre: string }[];
  delegados: { id: string; user_id: string; nombre: string; expires_at: string | null; vigente: boolean; granted_at: string }[];
  estudiantes: { user_id: string; nombre: string }[];
}
export interface ModeloRegistro {
  model_id: string; familia: 'haiku' | 'sonnet' | 'opus'; nombre: string; acepta_imagenes: boolean; precio_entrada: number; precio_salida: number;
  umbral_largo: number | null; precio_entrada_largo: number | null; precio_salida_largo: number | null; vigente_desde: string; fuente: string; activo: boolean;
}

// --- consultas ---
export const clasesMias = () => rpc<ClaseResumen[]>('clases_mias');
export const clasesSeccion = (classId: string) => rpc<ClaseResumen[]>('clases_seccion', { p_class: classId });
export const claseDetalle = (id: string) => rpc<ClaseDetalle>('clase_detalle', { p_session: id });
export const clasesPuedoSubir = () => rpc<SeccionSubida[]>('clases_puedo_subir');
export const clasesBrechas = (classId: string) => rpc<{ concepto: string; estado: string; session_id: string; fecha: string; clase: string }[]>('clases_brechas', { p_class: classId });
export const fotosClase = (id: string) =>
  invocar<{ fotos: { id: string; posicion: number; url: string; miniatura: string | null; descarga: string | null }[] }>('entregas', { action: 'clase_fotos', session_id: id });

// --- registro y fotos (profesor, monitor habilitado o delegado) ---
export interface DatosClase { class_id: string; fecha: string; title: string; temas: string[]; unit_id: string | null; descripcion: string }
export const claseCrear = (d: DatosClase, clientId: string) => rpc<ClaseResumen>('clase_crear', { p: { ...d, client_id: clientId } });
export const claseEditar = (id: string, d: Partial<DatosClase>) => rpc<ClaseResumen>('clase_editar', { p_session: id, p: d });
export function subirFotoClase(sessionId: string, posicion: number, f: FotoPizarra) {
  const fd = new FormData();
  fd.append('modulo', 'clases');
  fd.append('session_id', sessionId);
  fd.append('posicion', String(posicion));
  if (f.shaOriginal) fd.append('sha_original', f.shaOriginal);
  fd.append('archivo', f.blob, `pizarra.${f.tipo === 'image/webp' ? 'webp' : 'jpg'}`);
  if (f.miniatura) fd.append('miniatura', f.miniatura, `miniatura.${f.miniatura.type === 'image/webp' ? 'webp' : 'jpg'}`);
  return invocar<{ ok: boolean; posicion: number; ancho: number; alto: number }>('entregas', fd);
}
export const quitarFotoClase = (imageId: string) => invocar<{ ok: boolean }>('entregas', { action: 'clase_foto_quitar', image_id: imageId });
export const eliminarClase = (id: string) => invocar<{ ok: boolean }>('entregas', { action: 'clase_eliminar', session_id: id });
export const reordenarFotos = (id: string, orden: string[]) => rpc<void>('clase_fotos_reordenar', { p_session: id, p_orden: orden });
export const enviarClase = (id: string, publicar = false) => rpc<ClaseResumen>('clase_enviar', { p_session: id, p_publicar: publicar });

// --- profesor: proceso A (fotos) ---
export const revisarFotos = (id: string, decision: 'aprobada' | 'rechazada' | 'retirada' | 'pendiente', motivo: string | null) =>
  rpc<ClaseResumen>('clase_fotos_revisar', { p_session: id, p_decision: decision, p_motivo: motivo });

// --- profesor: proceso B (IA y versiones) ---
export const modelosRegistro = () => rpc<ModeloRegistro[] | null>('orbe_ia_modelos_lista');
export const disponibilidadModelos = () =>
  invocar<{ comprobado: boolean; motivo?: string; modelos: Record<string, { disponible: boolean; imagenes: boolean } | null> }>('orbe-ia', { action: 'clase_disponibilidad' });
export const generarAmpliada = (sessionId: string, requestId: string, model: string, nivel: Nivel, instrucciones: string) =>
  invocar<{ ok?: boolean; motivo?: string; generation_id?: string; repetida?: boolean; simulado?: boolean; estado?: string }>('orbe-ia',
    { action: 'clase_generar', session_id: sessionId, request_id: requestId, model, nivel, instrucciones });
export const guardarModeloPreferido = (model: string) => rpc<void>('clase_modelo_preferido', { p_model: model });
export const guardarVersion = (id: string, base: string | null, contenido: Contenido) => rpc<Version>('clase_version_guardar', { p_session: id, p_base: base, p_contenido: contenido });
export const publicarVersion = (versionId: string, confirmarSugeridos: boolean) => rpc<Version>('clase_version_publicar', { p_version: versionId, p_confirmar_sugeridos: confirmarSugeridos });
export const retirarVersion = (id: string, motivo: string) => rpc<void>('clase_version_retirar', { p_session: id, p_motivo: motivo });
export const agregarEnlace = (id: string, e: Partial<Enlace>) => rpc<Enlace>('clase_enlace_agregar', { p_session: id, p: e });
export const estadoEnlace = (id: string, estado: Enlace['estado']) => rpc<void>('clase_enlace_estado', { p_id: id, p_estado: estado });

// --- profesor: permisos de la sección ---
export const permisosClases = (classId: string) => rpc<Permisos>('clase_permisos', { p_class: classId });
export const configurarPermisos = (classId: string, monitores: boolean, descarga: boolean) =>
  rpc<Permisos>('clase_permisos_config', { p_class: classId, p_monitores: monitores, p_descarga: descarga });
export const otorgarDelegado = (classId: string, userId: string, expira: string | null) =>
  rpc<Permisos>('clase_delegado_otorgar', { p_class: classId, p_user: userId, p_expira: expira });
export const revocarDelegado = (id: string) => rpc<Permisos>('clase_delegado_revocar', { p_id: id });
