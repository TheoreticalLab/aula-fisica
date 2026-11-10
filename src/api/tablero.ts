/** Centro de mando del profesor (migración 92). Sin la migración, las funciones devuelven null y el panel usa lo anterior. */
import { rpc } from '@/lib/supabase';
import type { EstudianteBuscable, EventoTablero, Tablero } from '@/lib/tablero';
import type { ResumenSemanal } from '@/lib/resumenSemanal';

const sinFuncion = (e: unknown) => /Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e));

async function opcional<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await rpc<T>(fn, args);
  } catch (e) {
    if (sinFuncion(e)) return null;
    throw e;
  }
}

export const tableroDocente = async (): Promise<Tablero | null> => {
  const t = await opcional<Omit<Tablero, 'vivo'>>('tablero_docente');
  return t ? { ...t, vivo: true } : null;
};

export const tableroEventos = (dias = 7) => opcional<EventoTablero[]>('tablero_eventos', { p_dias: dias });

/** Resumen de la semana (migración 68): sus avisos entran en la bandeja del panel. */
export const resumenSemanal = () => opcional<ResumenSemanal>('resumen_semanal');

/** Estudiantes de las secciones activas del profesor (la misma lista de Comunicación), para el buscador. */
export const estudiantesBuscables = () =>
  rpc<(EstudianteBuscable & { course_id: string })[]>('my_messageable_students');
