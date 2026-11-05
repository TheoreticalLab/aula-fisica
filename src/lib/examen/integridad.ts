/**
 * Quiz y exámenes protegidos (migración 85): reglas puras de «bloquear al salir» e «impedir copiar y pegar».
 * Probadas en tests/examen-integridad.test.ts. Lo que decide de verdad es el servidor (exam_salida, exam_open,
 * assert_attempt_writable); aquí solo se decide cuándo avisar y qué explicar.
 */
import { ESPERA_SIN_FOCO_MS } from '@/lib/pregunta';

export interface Integridad { bloquear_al_salir: boolean; impedir_copiar: boolean; codigo_configurado?: boolean }
export interface EstadoIntegridad { bloquear_al_salir: boolean; impedir_copiar: boolean; bloqueado: boolean }
export type MotivoSalida = 'oculta' | 'sin_foco' | 'cierre' | 'navegacion';
export type TipoCopia = 'pegado' | 'arrastre' | 'copia';

export const SIN_INTEGRIDAD: EstadoIntegridad = { bloquear_al_salir: false, impedir_copiar: false, bloqueado: false };
/** Tiempo fuera de foco antes de contar como salida (el mismo de la pregunta relámpago). */
export const ESPERA_SIN_FOCO = ESPERA_SIN_FOCO_MS;

/** Lo que el estudiante lee ANTES de empezar. */
export function reglasIntegridad(i: Integridad | undefined | null): string[] {
  if (!i) return [];
  const l: string[] = [];
  if (i.bloquear_al_salir) {
    l.push('No salga del examen hasta entregarlo. Si cambia de pestaña o de aplicación, minimiza, apaga la pantalla, recarga o cierra la página, o va a otra parte del aula, su pantalla se bloquea.');
    l.push('Para volver a entrar necesitará el código que le dará el profesor. Mientras esté bloqueado no puede responder y el reloj sigue corriendo.');
  }
  if (i.impedir_copiar) l.push('No se puede copiar el enunciado ni pegar o arrastrar texto en las respuestas. Los intentos quedan registrados.');
  return l;
}

/**
 * ¿La pérdida de foco cuenta como salida? No, si el foco pasó a un elemento de la propia página que lo retiene
 * (un vídeo o simulación incrustados en un iframe): la ventana pierde el foco sin que el estudiante salga.
 */
export function blurEsSalida(elementoActivo: { tagName?: string } | null | undefined): boolean {
  return (elementoActivo?.tagName ?? '').toUpperCase() !== 'IFRAME';
}

/** Evita una ráfaga de avisos iguales (p. ej. varios «pegar» seguidos): uno por tipo cada `ms`. */
export function crearLimitador(ms = 2000) {
  const ultimo = new Map<string, number>();
  return (clave: string, ahora = Date.now()) => {
    const t = ultimo.get(clave);
    if (t !== undefined && ahora - t < ms) return false;
    ultimo.set(clave, ahora);
    return true;
  };
}

// --- suspensión durante los diálogos propios (confirmar la entrega): el diálogo nativo quita el foco a la página -------
let suspendidoHasta = 0;
export const vigilanciaSuspendida = (ahora = Date.now()) => ahora < suspendidoHasta;
export function suspenderVigilancia(ms: number, ahora = Date.now()) { suspendidoHasta = Math.max(suspendidoHasta, ahora + ms); }
/** window.confirm sin que el diálogo cuente como salida del examen. */
export function confirmarSinSalida(mensaje: string): boolean {
  suspenderVigilancia(60_000);
  try { return window.confirm(mensaje); } finally { suspendidoHasta = Date.now() + 1500; }
}
