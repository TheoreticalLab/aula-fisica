/**
 * Pregunta relámpago · reglas del aula del estudiante (lógica pura, probada en tests/orbe-control-ia.test.ts).
 * Lo que cuenta lo decide el servidor (poll_answer, poll_left y presence_ping); aquí solo se decide cuándo avisar.
 */

export interface PreguntaAbierta {
  id: string;
  question: string;
  options: string[];
  lock_on_leave: boolean;
  closes_at: string;
  sender_name: string;
  server_now: string;
}

/** Tiempo sin foco (otra ventana encima, sin ocultar la pestaña) que cuenta como salir de la plataforma. */
export const ESPERA_SIN_FOCO_MS = 5_000;

/** ¿Hay que avisar al servidor de que salió? Solo con bloqueo activado, la pregunta en pantalla y sin responder. */
export function debeBloquearAlSalir(p: Pick<PreguntaAbierta, 'lock_on_leave'> | null, respondida: boolean): boolean {
  return !!p && p.lock_on_leave && !respondida;
}

/** Segundos que quedan, con el reloj del servidor (offset = servidor − local). */
export function segundosQuedan(cierraIso: string, offsetMs: number, ahoraLocal = Date.now()): number {
  return Math.max(0, Math.round((new Date(cierraIso).getTime() - (ahoraLocal + offsetMs)) / 1000));
}

export const LETRAS = 'ABCDEF';
