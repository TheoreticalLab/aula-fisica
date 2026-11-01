/** Asistente de actividades con IA (migración 56, acciones «asistente_actividad» y «asistente_revisar» de orbe-ia). */
import { invocar, supabase } from '@/lib/supabase';
import type { BorradorIA, EjercicioBanco, Nivel } from '@/lib/asistenteActividad';

export interface Mensaje { rol: 'profesor' | 'asistente'; texto: string }
export interface ContextoAsistente {
  ahora: string;
  secciones: { id: string; nombre: string; asignatura: string; course_id: string }[];
  asignaturas: { id: string; titulo: string; lecciones: { id: string; titulo: string; unidad: string; publicadas: Record<Nivel, number> }[] }[];
}
export interface RespuestaAsistente {
  ok: boolean; motivo?: string; simulado?: boolean; mensaje?: string; pregunta?: string;
  borrador?: BorradorIA; faltan?: string[]; avisos?: string[]; listo?: boolean; contexto?: ContextoAsistente;
}

export const asistenteTurno = (mensajes: Mensaje[], borrador: BorradorIA) =>
  invocar<RespuestaAsistente>('orbe-ia', { action: 'asistente_actividad', mensajes, borrador });
/** Sin IA y sin coste: valida el borrador editado a mano y devuelve las secciones y lecciones del profesor. */
export const asistenteRevisar = (borrador: BorradorIA) => invocar<RespuestaAsistente>('orbe-ia', { action: 'asistente_revisar', borrador });

/** Preguntas PUBLICADAS de esas lecciones (sin enunciados ni claves: solo lo necesario para elegir). */
export async function bancoDeLecciones(lecciones: string[]): Promise<EjercicioBanco[]> {
  if (!lecciones.length) return [];
  const { data, error } = await supabase.from('exercises').select('id, lesson_id, difficulty, format, published').in('lesson_id', lecciones).eq('published', true).limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as EjercicioBanco[];
}
