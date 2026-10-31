/** Estado de una actividad para el estudiante, en una palabra y con la acción que corresponde (lógica pura). */
import type { MyActivity } from '@/api/tipos';

export type Estado = 'en_curso' | 'disponible' | 'proxima' | 'entregada' | 'cerrada' | 'sin_intentos';

export interface EstadoActividad { estado: Estado; etiqueta: string; tono: 'blue' | 'green' | 'amber' | 'gray' | 'purple' | 'red'; accion: string | null; urgente: boolean }

export function estadoActividad(a: Pick<MyActivity, 'opens_at' | 'closes_at' | 'in_progress' | 'submitted' | 'attempts_used' | 'max_attempts' | 'mode'>, ahora = Date.now()): EstadoActividad {
  const abre = a.opens_at ? new Date(a.opens_at).getTime() : null, cierra = a.closes_at ? new Date(a.closes_at).getTime() : null;
  const urgente = cierra !== null && cierra > ahora && cierra - ahora < 48 * 3600_000;
  if (a.in_progress) return { estado: 'en_curso', etiqueta: 'En curso', tono: 'amber', accion: 'Continuar', urgente };
  if (cierra !== null && cierra <= ahora) return { estado: a.submitted ? 'entregada' : 'cerrada', etiqueta: a.submitted ? 'Entregada' : 'Cerrada', tono: a.submitted ? 'green' : 'gray', accion: a.submitted ? 'Ver' : null, urgente: false };
  if (abre !== null && abre > ahora) return { estado: 'proxima', etiqueta: 'Próximamente', tono: 'gray', accion: null, urgente: false };
  const quedan = a.max_attempts === null ? Infinity : a.max_attempts - a.attempts_used;
  if (quedan <= 0) return { estado: a.submitted ? 'entregada' : 'sin_intentos', etiqueta: a.submitted ? 'Entregada' : 'Sin intentos', tono: a.submitted ? 'green' : 'gray', accion: 'Ver', urgente: false };
  if (a.submitted) return { estado: 'entregada', etiqueta: 'Entregada', tono: 'green', accion: a.mode === 'practice' ? 'Practicar otra vez' : 'Nuevo intento', urgente: false };
  return { estado: 'disponible', etiqueta: 'Disponible', tono: 'blue', accion: a.mode === 'exam' ? 'Empezar' : 'Practicar', urgente };
}

/** Orden útil: en curso, urgentes, disponibles por cierre, próximas, entregadas, cerradas. */
export function ordenar<T extends Parameters<typeof estadoActividad>[0]>(xs: T[], ahora = Date.now()): T[] {
  const peso: Record<Estado, number> = { en_curso: 0, disponible: 1, proxima: 2, entregada: 3, sin_intentos: 4, cerrada: 5 };
  const t = (a: T) => (a.closes_at ? new Date(a.closes_at).getTime() : Infinity);
  return [...xs].sort((a, b) => peso[estadoActividad(a, ahora).estado] - peso[estadoActividad(b, ahora).estado] || t(a) - t(b));
}
