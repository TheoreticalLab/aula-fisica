/** Estado en vivo de un intento para el seguimiento del profesor (lógica pura). */
export const SIN_CONTACTO_MS = 45_000;

export interface FilaMonitor { en_pausa: boolean; ultimo_contacto_ms: number; limite_ms: number | null }

export function estadoEnVivo(e: FilaMonitor, ahora: number): { etiqueta: string; tono: 'green' | 'blue' | 'amber' | 'gray' | 'red' } {
  if (e.limite_ms !== null && ahora >= e.limite_ms) return { etiqueta: 'Tiempo vencido', tono: 'red' };
  if (e.en_pausa) return { etiqueta: 'En pausa', tono: 'blue' };
  if (ahora - e.ultimo_contacto_ms > SIN_CONTACTO_MS) return { etiqueta: 'Sin conexión', tono: 'amber' };
  return { etiqueta: 'Respondiendo', tono: 'green' };
}
