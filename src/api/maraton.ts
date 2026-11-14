/**
 * Maratón adaptativo (migración 94): acceso a datos. Todas las decisiones (nivel, unidades, comodines, finalización,
 * fechas) las toma el servidor. El estudiante solo recibe el estado operativo y el enunciado del problema actual.
 */
import { invocar, rpc } from '@/lib/supabase';
import type { ConfigMaraton } from '@/lib/maraton/config';

// ---------------------------------------------------------------------------
// Estudiante
// ---------------------------------------------------------------------------
export interface HoyMaraton {
  fase: 'sin_fecha' | 'antes' | 'antes_de_apertura' | 'abierta' | 'cerrada_hoy' | 'sin_jornada_hoy' | 'finalizado';
  numero?: number;
  fecha?: string;
  abre?: string;
  cierra?: string;
  siguiente?: { numero: number; fecha: string; abre: string; cierra: string } | null;
}

export type EstadoJornada = 'sin_iniciar' | 'en_curso' | 'completada' | 'cerrada' | 'incompleta' | 'justificada';

export interface EstadoMaraton {
  maraton: {
    id: string; titulo: string; asignatura: string; descripcion: string; instrucciones: string; jornadas: number; fecha_inicio: string | null;
    zona: string; apertura: string; cierre: string; tiempo_orientativo: [number, number]; limite_minutos: number;
    comodines_total: number; comodines_por_jornada: number | null; no_puedo: boolean; estado: string;
  };
  prueba: boolean;
  hoy: HoyMaraton;
  finalizado: boolean;
  aceptado: boolean;
  jornada: { numero: number; fecha: string; estado: EstadoJornada; respondidos: number; minutos: number; segundos: number; reabierta_hasta: string | null; cierra: string | null } | null;
  comodines_disponibles: number;
  problema: { presentacion_id: string; enunciado: string; partes: { etiqueta: string; unidad: string }[]; presentada_at: string; numero: number } | null;
  aviso: 'ya_procesada' | 'ya_cerrada' | 'jornada_cerrada' | null;
  ultimo: { resultado: 'correcta' | 'incorrecta' } | null;
  informe_disponible: boolean;
}

/** Respuesta de la Edge Function cuando el envío no es un intento válido (no se registra nada). */
export interface RespuestaNoValida { valida: false; mensajes: string[] }

export interface ResumenMaratonEstudiante {
  id: string; titulo: string; descripcion: string; asignatura: string; jornadas: number; fecha_inicio: string | null;
  hoy: HoyMaraton; finalizado: boolean; aceptado: boolean; jornada_hoy: EstadoJornada | null; informe_disponible: boolean;
}

export interface FilaNivel { nivel: number; presentados: number; validos: number; correctas: number; no_puedo: number; cambios: number; segundos: number }
export interface FilaTema { tema: string; nombre: string | null; presentados: number; validos: number; correctas: number; no_puedo: number }
export interface FilaJornada {
  numero: number; fecha: string; estado: string; via: 'cuota' | 'alternativa' | null; revision?: boolean; motivo?: string | null;
  presentados: number; validos: number; correctas: number; incorrectas: number; no_puedo: number; cambios: number; anticipadas: number;
  segundos: number; unidades?: number; nivel_medio: number | null; nivel_maximo: number | null;
}
export interface ResumenInscripcion {
  jornadas_completadas: number; jornadas_iniciadas: number; jornadas_revision?: number; via_cuota?: number; via_alternativa?: number;
  presentados: number; intentos_validos: number; correctas: number; incorrectas: number; no_puedo: number; cambios: number; anticipadas: number;
  segundos: number; unidades?: number; nivel_maximo: number | null; nivel_maximo_correcto: number | null; extremos_resueltos: number;
  por_nivel: FilaNivel[]; por_tema: FilaTema[]; por_jornada: FilaJornada[];
}
export interface MiInforme { participo: boolean; titulo?: string; jornadas_total?: number; resumen?: ResumenInscripcion; aviso?: string }

export const API_MARATON = {
  misMaratones: () => rpc<ResumenMaratonEstudiante[]>('maraton_mis_maratones'),
  estado: (id: string) => rpc<EstadoMaraton>('maraton_estado', { p_maraton: id }),
  iniciar: (id: string) => rpc<EstadoMaraton>('maraton_iniciar', { p_maraton: id }),
  noPuedo: (presentacion: string, idem: string, segundos: number | null, procedimiento: string | null) =>
    rpc<EstadoMaraton>('maraton_no_puedo', { p_presentacion: presentacion, p_idem: idem, p_segundos_cliente: segundos, p_procedimiento: procedimiento }),
  cambiar: (presentacion: string, idem: string, segundos: number | null) =>
    rpc<EstadoMaraton>('maraton_cambiar', { p_presentacion: presentacion, p_idem: idem, p_segundos_cliente: segundos }),
  responder: (presentacion: string, idem: string, partes: string[], procedimiento: string | null, segundos: number | null) =>
    invocar<EstadoMaraton | RespuestaNoValida>('maraton', { action: 'responder', presentacion_id: presentacion, idem, partes, procedimiento, segundos_cliente: segundos }),
  miInforme: (id: string) => rpc<MiInforme>('maraton_mi_informe', { p_maraton: id }),
};
export type ApiMaraton = typeof API_MARATON;

export const esNoValida = (r: EstadoMaraton | RespuestaNoValida): r is RespuestaNoValida => (r as RespuestaNoValida).valida === false;

// ---------------------------------------------------------------------------
// Profesor
// ---------------------------------------------------------------------------
export type EstadoMaratonDocente = 'borrador' | 'publicado' | 'archivado';

export interface MaratonListaItem {
  id: string; titulo: string; estado: EstadoMaratonDocente; fecha_inicio: string | null; jornadas: number; banco_id: string; participantes: number; hoy: HoyMaraton; created_at: string;
}

export interface RevisionMaraton { errores: string[]; avisos: string[]; disponibles: Record<string, number> }

export interface MaratonDocente {
  id: string; class_id: string; group_id: string | null; banco_id: string; titulo: string; descripcion: string; instrucciones: string;
  responsable: string | null; responsable_nombre: string | null; estado: EstadoMaratonDocente; fecha_inicio: string | null; config: ConfigMaraton;
  calificacion_automatica: false; origen_id: string | null; publicado_at: string | null; created_at: string; updated_at: string;
  curso_id: string; seccion: string; banco: { id: string; nombre: string; version: string } | null; participantes: number;
  hoy: HoyMaraton; finalizado: boolean; revision: RevisionMaraton;
}

export interface TemaBanco {
  codigo: string; nombre: string; unidad: string; fuente: string; practicas: string; examenes: string;
  cobertura: 'alta' | 'media' | 'baja' | 'sin_evidencia'; estado: 'verificado' | 'pendiente' | 'excluido';
  por_nivel: Record<string, { plantillas: number; validadas: number; variantes: number }>;
}
export interface BancoDisponible { id: string; nombre: string; descripcion: string; version: string; temas: TemaBanco[] }

export interface PlantillaBanco {
  id: string; tema: string; subtema: string; nivel: number; titulo: string; metodo: string; t_min_s: number; t_max_s: number;
  etiquetas: string[]; fuente: string; estado: 'validada' | 'pendiente_revision' | 'rechazada'; nota_revision: string | null; revisado_at: string | null; variantes: number;
}
export interface ClaveParte { format: 'numeric'; value: string; relTol?: number; absTol?: number }
export interface MuestraVariante {
  id: string; n: number; enunciado: string; partes: { etiqueta: string; unidad: string }[]; datos: Record<string, number>;
  clave: { partes: ClaveParte[] } | null; solucion: string | null; verificacion: { independiente: number[]; analitica: number[]; desviacion_max: number } | null; estado: string;
}

export interface EstudianteResumen {
  user_id: string; nombre: string; login_id: string | null; matriculado: boolean; participa: boolean; nivel_actual: number | null;
  comodines_usados: number | null; aceptado_at: string | null; resumen: ResumenInscripcion | null;
}
export interface ResumenDocente {
  maraton: MaratonDocente;
  calendario: { numero: number; fecha: string; abre: string; cierra: string }[] | null;
  estudiantes: EstudianteResumen[];
}

export interface PresentacionHistorial {
  id: string; secuencia: number; jornada: number; variante_id: string; plantilla_id: string; tema: string; subtema: string; titulo: string; nivel: number;
  t_min_s: number; t_max_s: number; peso: number; presentada_at: string; cerrada_at: string | null;
  accion: 'respuesta' | 'no_puedo' | 'cambio' | 'cierre' | null; resultado: 'correcta' | 'incorrecta' | null;
  respuesta: { partes: string[] } | null; procedimiento: string | null; detalle: { partes: { correcta: boolean; codigo: string }[] } | null;
  segundos: number | null; segundos_cliente: number | null; anticipada: boolean | null; unidades: number | null; nivel_despues: number | null;
  comodines_antes: number | null; comodines_despues: number | null; enunciado: string; partes: { etiqueta: string; unidad: string }[]; clave: { partes: ClaveParte[] } | null;
}
export interface Historial {
  estudiante: { user_id: string; nombre: string; login_id: string | null };
  inscripcion: { nivel: number; comodines_usados: number; aceptado_at: string | null; prueba: boolean; resumen: ResumenInscripcion } | null;
  presentaciones: PresentacionHistorial[];
  eventos: { tipo: string; jornada: number | null; datos: Record<string, unknown>; actor: string | null; created_at: string }[];
  incidencias: { id: string; jornada: number; tipo: string; motivo: string; reabierta_hasta: string | null; creado_por: string | null; created_at: string }[];
}
export interface FilaExportacion {
  login_id: string | null; nombre: string; jornada: number; fecha: string; secuencia: number; variante_id: string; plantilla_id: string; tema: string; nivel: number;
  presentada_at: string; cerrada_at: string | null; accion: string | null; resultado: string | null; respuesta: string[] | null; segundos: number | null;
  anticipada: boolean | null; unidades: number | null; nivel_despues: number | null; comodines_despues: number | null;
}

export interface DatosMaraton {
  titulo?: string; descripcion?: string; instrucciones?: string; responsable?: string | null; group_id?: string | null; banco_id?: string;
  fecha_inicio?: string | null; config?: Partial<{ [K in keyof ConfigMaraton]: Partial<ConfigMaraton[K]> }>; informes?: Partial<ConfigMaraton['informes']>;
}

export const maratonLista = (classId: string) => rpc<MaratonListaItem[]>('maraton_lista_docente', { p_class: classId });
export const maratonDetalle = (id: string) => rpc<MaratonDocente>('maraton_detalle_docente', { p_maraton: id });
export const maratonCrear = (classId: string, datos: DatosMaraton) => rpc<string>('maraton_crear', { p_class: classId, p_datos: datos });
export const maratonGuardar = (id: string, datos: DatosMaraton) => rpc<MaratonDocente>('maraton_guardar', { p_maraton: id, p_datos: datos });
export const maratonCambiarEstado = (id: string, estado: EstadoMaratonDocente) => rpc<MaratonDocente>('maraton_cambiar_estado', { p_maraton: id, p_estado: estado });
export const maratonDuplicar = (id: string, classId: string, titulo: string | null) => rpc<string>('maraton_duplicar', { p_maraton: id, p_class: classId, p_titulo: titulo });
export const maratonReiniciarPrueba = (id: string) => rpc<void>('maraton_reiniciar_prueba', { p_maraton: id });
export const maratonBancos = (classId: string) => rpc<BancoDisponible[]>('maraton_bancos_disponibles', { p_class: classId });
export const maratonPlantillas = (banco: string) => rpc<PlantillaBanco[]>('maraton_banco_plantillas', { p_banco: banco });
export const maratonMuestra = (plantilla: string, cuantas = 3) => rpc<MuestraVariante[]>('maraton_banco_muestra', { p_plantilla: plantilla, p_cuantas: cuantas });
export const maratonRevisarPlantilla = (plantilla: string, estado: PlantillaBanco['estado'], nota: string) =>
  rpc<PlantillaBanco>('maraton_plantilla_revisar', { p_plantilla: plantilla, p_estado: estado, p_nota: nota });
export const maratonResumen = (id: string) => rpc<ResumenDocente>('maraton_resumen', { p_maraton: id });
export const maratonHistorial = (id: string, userId: string) => rpc<Historial>('maraton_historial', { p_maraton: id, p_user: userId });
export const maratonExportar = (id: string) => rpc<FilaExportacion[]>('maraton_exportar', { p_maraton: id });
export const maratonIncidencia = (id: string, userId: string, jornada: number, tipo: 'reapertura' | 'justificacion' | 'nota', motivo: string, hasta: string | null) =>
  rpc<Historial>('maraton_incidencia', { p_maraton: id, p_user: userId, p_jornada: jornada, p_tipo: tipo, p_motivo: motivo, p_hasta: hasta });
