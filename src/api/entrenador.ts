/**
 * Entrenador (migración 107): práctica libre con ejercicios de un banco, corrección inmediata y solución al cerrar.
 * No califica. La clave nunca llega al navegador: la corrección la hace la Edge Function «entrenador».
 */
import { invocar, rpc } from '@/lib/supabase';

export type EstadoEjercicio = 'abierto' | 'correcto' | 'agotado' | 'solucion';

export interface ParteCorregida { correcta: boolean; codigo: string; mensaje: string | null }

export interface EjercicioEntrenador {
  id: string;
  tema: string;
  estado: EstadoEjercicio;
  intentos: number;
  intentos_max: number;
  enunciado: string;
  partes: { etiqueta: string; unidad: string }[];
  respuestas: { n: number; partes: string[]; correcta: boolean; detalle: { partes: ParteCorregida[] } | null }[];
  /** solo con el ejercicio cerrado */
  solucion: string | null;
  valores: string[] | null;
}

export interface ResumenEntrenador { ejercicios: number; correctos: number; primer_intento: number; sin_resolver: number; hoy: number; minutos: number }

export interface EstadoEntrenador {
  entrenador: { id: string; titulo: string; descripcion: string; intentos: number; activo: boolean };
  prueba: boolean;
  temas: { codigo: string; nombre: string }[];
  resumen: ResumenEntrenador;
  actual: EjercicioEntrenador | null;
}

export interface EntrenadorEstudiante { id: string; titulo: string; descripcion: string; class_id: string; seccion: string; resumen: ResumenEntrenador }

export interface RespuestaRegistrada { registrada: boolean; correcta?: boolean; ejercicio: EjercicioEntrenador; resumen: ResumenEntrenador }
export interface RespuestaNoValida { valida: false; mensajes: string[] }
export const esNoValida = (r: RespuestaRegistrada | RespuestaNoValida): r is RespuestaNoValida => (r as RespuestaNoValida).valida === false;

export const API_ENTRENADOR = {
  mis: () => rpc<EntrenadorEstudiante[]>('entrenador_mis'),
  estado: (id: string) => rpc<EstadoEntrenador>('entrenador_estado', { p_ent: id }),
  siguiente: (id: string, tema: string | null) => rpc<EstadoEntrenador>('entrenador_siguiente', { p_ent: id, p_tema: tema }),
  verSolucion: (ejercicio: string, segundos: number | null) => rpc<EjercicioEntrenador>('entrenador_ver_solucion', { p_ejercicio: ejercicio, p_segundos_cliente: segundos }),
  responder: (ejercicio: string, idem: string, partes: string[], segundos: number | null) =>
    invocar<RespuestaRegistrada | RespuestaNoValida>('entrenador', { action: 'responder', ejercicio_id: ejercicio, idem, partes, segundos_cliente: segundos }),
};

// ---------------------------------------------------------------------------
// Profesorado de la sección
// ---------------------------------------------------------------------------
export interface EntrenadorDeClase { id: string; titulo: string; activo: boolean; intentos: number }
export interface InformeEntrenador {
  entrenador: { id: string; titulo: string; activo: boolean; intentos: number };
  estudiantes: { user_id: string; nombre: string; resumen: ResumenEntrenador; ultimo: string | null }[];
  temas: { codigo: string; nombre: string; ejercicios: number; correctos: number }[];
}
export type EjercicioDetalle = EjercicioEntrenador & { presentado_at: string; cerrado_at: string | null; segundos: number | null; plantilla: string };

export const API_ENTRENADOR_DOCENTE = {
  deClase: (classId: string) => rpc<EntrenadorDeClase[]>('entrenador_de_clase', { p_class: classId }),
  activar: (id: string, activo: boolean) => rpc<null>('entrenador_activar', { p_ent: id, p_activo: activo }),
  informe: (id: string) => rpc<InformeEntrenador>('entrenador_informe', { p_ent: id }),
  detalle: (id: string, userId: string) => rpc<EjercicioDetalle[]>('entrenador_detalle', { p_ent: id, p_user: userId, p_limite: 100 }),
};
