/** Generación de preguntas con IA para el banco (migración 55 y acción «generar_preguntas» de orbe-ia). */
import { invocar, rpc } from '@/lib/supabase';
import type { DatosEstimacion, Especificacion } from '@/lib/generacion';

export interface LeccionTema { id: string; titulo: string; oculta: boolean; conceptos: { slug: string; nombre: string }[]; banco: { basico: number; intermedio: number; desafiante: number } }
export interface TemasAsignatura { asignatura: string; unidades: { id: string; titulo: string; lecciones: LeccionTema[] }[] }
export interface ResultadoLote {
  ok: boolean; motivo?: string; simulado?: boolean; creadas?: number; ids?: string[]; verificadas?: number; costo_usd?: number;
  rechazadas?: { pregunta: number; motivo: string }[];
}
export interface ResumenGeneracion {
  solicitadas: number; creadas: number; rechazadas: number; costo_usd: number;
  items: { id: string; slug: string; formato: string; dificultad: string; leccion: string | null; enunciado: string; verificacion: 'calculo_comprobado' | 'revisar' }[];
}

export const generarTemas = (courseId: string) => rpc<TemasAsignatura>('generar_temas', { p_course: courseId });
export const generarEstimacion = (courseId: string) => rpc<DatosEstimacion>('generar_estimacion', { p_course: courseId });
export const generarIniciar = (courseId: string, spec: object, n: number) => rpc<string>('generar_iniciar', { p_course: courseId, p_spec: spec, p_solicitadas: n });
export const generarLote = (runId: string, especificaciones: Especificacion[]) =>
  invocar<ResultadoLote>('orbe-ia', { action: 'generar_preguntas', run_id: runId, especificaciones });
export const generarResumen = (runId: string) => rpc<ResumenGeneracion>('generar_resumen', { p_run: runId });

/** Generación desde una clase impartida (migración 68). */
export interface ClaseParaGenerar {
  session_id: string; course_id: string; titulo: string; fecha: string; temas: string[]; seccion: string; lecciones: string[];
  ampliada: 'publicada' | 'borrador' | null; ya_generadas: number;
}
export const generarClaseInfo = (sessionId: string) => rpc<ClaseParaGenerar>('generar_clase_info', { p_session: sessionId });
export const generarIniciarClase = (sessionId: string, spec: object, n: number) =>
  rpc<string>('generar_iniciar_clase', { p_session: sessionId, p_spec: spec, p_solicitadas: n });
