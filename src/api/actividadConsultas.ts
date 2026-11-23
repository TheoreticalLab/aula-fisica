/**
 * Preguntas de la plataforma en una práctica (migración 108): «Sí» / «No», una respuesta por estudiante.
 * Sin la migración, el estudiante no ve nada y el profesor ve la tarjeta vacía.
 */
import { funcionAusente } from '@/api/examen';
import { rpc } from '@/lib/supabase';

/** mensaje_si (migración 110): recordatorio que se muestra después de responder «Sí» (opcional). */
export interface ConsultaActividad { id: string; titulo: string; texto: string; mensaje_si?: string | null }

export interface ConsultaActividadDocente {
  id: string;
  titulo: string;
  texto: string;
  activa: boolean;
  created_at: string;
  cerrada_at: string | null;
  respuestas: { user_id: string; nombre: string; respuesta: boolean; created_at: string }[];
  pendientes: { user_id: string; nombre: string; empezo: boolean }[];
  excluidos: { user_id: string; nombre: string }[];
}

const sinMigracion = <T,>(vacio: T) => (e: unknown): T => { if (funcionAusente(e)) return vacio; throw e; };

export const API_CONSULTAS_ACTIVIDAD = {
  pendiente: (activityId: string) =>
    rpc<ConsultaActividad | null>('actividad_consulta_pendiente', { p_activity: activityId }).catch(sinMigracion<ConsultaActividad | null>(null)),
  /** devuelve la siguiente pregunta pendiente de la misma práctica, o null */
  declarar: (consulta: string, respuesta: boolean) =>
    rpc<ConsultaActividad | null>('actividad_declarar', { p_consulta: consulta, p_respuesta: respuesta }).then((x) => x ?? null),
  docente: (activityId: string) =>
    rpc<ConsultaActividadDocente[]>('actividad_consultas_docente', { p_activity: activityId }).catch(sinMigracion<ConsultaActividadDocente[]>([])),
  cerrar: (consulta: string) => rpc<ConsultaActividadDocente[]>('actividad_consulta_cerrar', { p_consulta: consulta }),
};
