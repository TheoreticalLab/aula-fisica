/** Regularización de prácticas anteriores (migración 45 + Edge Function «entregas», capturas.ts). */
import { invocar, rpc } from '@/lib/supabase';
import type { CapturaOptimizada } from '@/lib/imagen';
import type { AccionDocente, Estado, Medio, Registro, Tipo } from '@/lib/regularizacion';

// --- estudiante ----------------------------------------------------------------------------------------------------
export interface PracticaCatalogo { id: string; numero: number; titulo: string; descripcion: string; provisional: boolean }
export interface CapturaMeta { id: string; posicion: number; bytes: number; ancho: number; alto: number }
export interface MiRegistro {
  id: string; practice_id: string; tipo: Tipo; tema: string; descripcion: string; fecha_declarada: string | null; fecha_desconocida: boolean;
  medio: Medio | null; correo_remitente: string | null; otra_via: string | null; contacto: string | null; motivo_incidencia: string | null;
  estado: Estado; editable: boolean; faltantes: string[]; enviado_at: string | null; nota_docente: string | null; respuesta_estudiante: string | null;
  updated_at: string; capturas: CapturaMeta[];
}
export interface MiSugerencia { id: string; tema: string | null; descripcion: string; fecha_aprox: string | null; comentarios: string; total_estimado: number | null; estado: string; created_at: string }
export interface MiSeccion {
  class_id: string; class_name: string; course_title: string; abierto: boolean; mensaje: string; max_mb_captura: number; max_registros: number;
  practicas: PracticaCatalogo[]; registros: MiRegistro[]; sugerencias: MiSugerencia[];
}
export interface DatosRegistro {
  id: string; class_id: string; practice_id: string; tipo: Tipo; tema: string; descripcion: string; fecha_declarada: string | null; fecha_desconocida: boolean;
  medio: Medio | null; correo_remitente: string; otra_via: string; contacto: string; motivo_incidencia: string;
}

export const misSecciones = () => rpc<MiSeccion[]>('hist_mis_secciones');
export const guardarRegistro = (d: DatosRegistro) => rpc<{ id: string; estado: Estado; faltantes: string[] }>('hist_guardar', {
  p_id: d.id, p_class: d.class_id, p_practice: d.practice_id, p_tipo: d.tipo, p_tema: d.tema, p_descripcion: d.descripcion,
  p_fecha: d.fecha_desconocida ? null : d.fecha_declarada || null, p_fecha_desconocida: d.fecha_desconocida, p_medio: d.medio,
  p_correo: d.medio === 'correo' ? d.correo_remitente : null, p_otra_via: d.medio === 'otra' ? d.otra_via : null, p_contacto: d.contacto,
  p_motivo: d.tipo === 'incidencia' ? d.motivo_incidencia : null,
});
export const registrar = (ids: string[], acepto: boolean, respuesta: string | null = null) =>
  rpc<{ registradas: number; errores: { id: string; motivo: string }[] }>('hist_enviar', { p_ids: ids, p_acepto: acepto, p_respuesta: respuesta });
export const sugerir = (s: { class_id: string; tema: string; descripcion: string; fecha: string | null; comentarios: string; total: number | null }) =>
  rpc<string>('hist_sugerir', { p_class: s.class_id, p_tema: s.tema || null, p_descripcion: s.descripcion, p_fecha: s.fecha, p_comentarios: s.comentarios, p_total: s.total });

export function subirCaptura(declId: string, posicion: number, c: CapturaOptimizada) {
  const f = new FormData();
  f.append('modulo', 'regularizacion');
  f.append('declaration_id', declId);
  f.append('posicion', String(posicion));
  if (c.shaOriginal) f.append('sha_original', c.shaOriginal);
  f.append('bytes_original', String(c.bytesOriginal));
  f.append('archivo', c.blob, `captura.${c.tipo === 'image/webp' ? 'webp' : 'jpg'}`);
  return invocar<{ id: string; bytes: number; ancho: number; alto: number; reutilizada: boolean }>('entregas', f);
}
export const urlCaptura = (captureId: string) => invocar<{ url: string }>('entregas', { action: 'captura_ver', capture_id: captureId });
export const quitarCaptura = (captureId: string) => invocar<{ ok: boolean }>('entregas', { action: 'captura_quitar', capture_id: captureId });
export const eliminarBorrador = (declId: string) => invocar<{ ok: boolean }>('entregas', { action: 'borrador_eliminar', declaration_id: declId });

// --- profesorado ---------------------------------------------------------------------------------------------------
export interface PracticaDocente extends PracticaCatalogo {
  origen: 'provisional' | 'docente' | 'sugerencia'; archivada: boolean; unida_a: string | null; activity_id: string | null; actividad: string | null;
  declaraciones: number; borradores: number;
}
export interface ConfigSeccion {
  configurado: boolean; abierto: boolean; mensaje: string; margen_dias: number; max_mb_captura: number; cuota_mb: number; max_registros: number;
  practicas: PracticaDocente[]; actividades: { id: string; title: string }[];
  almacenamiento: { bytes_seccion: number; archivos_seccion: number; bytes_modulo: number; archivos_modulo: number };
}
export interface FilaResumen {
  user_id: string; full_name: string; student_code: string | null; group_name: string | null; borradores: number; registradas: number; incidencias: number;
  pendientes: number; localizadas: number; verificadas: number; convalidadas: number; no_localizadas: number; observadas: number; aclaraciones: number; sugerencias: number;
}
export interface SugerenciaDocente {
  id: string; user_id: string; full_name: string; tema: string | null; descripcion: string; fecha_aprox: string | null; comentarios: string;
  total_estimado: number | null; estado: 'pendiente' | 'confirmada' | 'relacionada' | 'descartada'; practice_id: string | null; numero: number | null;
  nota_revision: string | null; created_at: string;
}
export interface Evento { at: string; papel: string; actor_name: string | null; accion: string; estado_antes: string | null; estado_despues: string | null; nota: string | null; detalle: Record<string, unknown> }

export const configSeccion = (classId: string) => rpc<ConfigSeccion>('hist_config', { p_class: classId });
export const configurar = (classId: string, c: { abierto?: boolean; mensaje?: string; margen_dias?: number; max_mb_captura?: number; cuota_mb?: number; max_registros?: number; espacios?: number }) =>
  rpc<{ creadas: number; archivadas: number; conservadas: number; activas: number }>('hist_configurar', {
    p_class: classId, p_abierto: c.abierto ?? null, p_mensaje: c.mensaje ?? null, p_margen: c.margen_dias ?? null, p_max_mb: c.max_mb_captura ?? null,
    p_cuota_mb: c.cuota_mb ?? null, p_max_registros: c.max_registros ?? null, p_espacios: c.espacios ?? null,
  });
export const guardarPractica = (p: { id: string | null; class_id: string; numero: number; titulo: string; descripcion: string }) =>
  rpc<string>('hist_practica_guardar', { p_id: p.id, p_class: p.class_id, p_numero: p.numero, p_titulo: p.titulo, p_descripcion: p.descripcion });
export const archivarPractica = (id: string, archivar: boolean) => rpc<void>('hist_practica_archivar', { p_id: id, p_archivar: archivar });
export const unirPracticas = (origen: string, destino: string, nota: string) => rpc<number>('hist_practica_unir', { p_origen: origen, p_destino: destino, p_nota: nota });
export const vincularActividad = (id: string, activityId: string | null) => rpc<void>('hist_practica_vincular', { p_id: id, p_activity: activityId });
export const registros = (classId: string | null) => rpc<Registro[]>('hist_registros', { p_class: classId });
export const resumen = (classId: string) => rpc<FilaResumen[]>('hist_resumen', { p_class: classId });
export const historial = (declId: string) => rpc<Evento[]>('hist_historial', { p_decl: declId });
export const revisar = (ids: string[], accion: AccionDocente, nota: string | null) =>
  rpc<{ aplicadas: number; errores: { id: string; motivo: string }[] }>('hist_revisar', { p_ids: ids, p_accion: accion, p_nota: nota });
export const sugerencias = (classId: string) => rpc<SugerenciaDocente[]>('hist_sugerencias', { p_class: classId });
export const decidirSugerencias = (ids: string[], decision: 'confirmada' | 'relacionada' | 'descartada' | 'pendiente', practiceId: string | null, titulo: string | null, nota: string | null) =>
  rpc<string | null>('hist_sugerencias_decidir', { p_ids: ids, p_decision: decision, p_practice: practiceId, p_titulo: titulo, p_nota: nota });
