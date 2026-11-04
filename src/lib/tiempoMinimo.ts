/**
 * Tiempo mínimo de realización en prácticas (migración 78): lógica pura del cliente.
 * El servidor cuenta el tiempo activo y decide si se puede entregar; esto solo muestra y decide CUÁNDO latir.
 */

export interface EstadoTiempo {
  aplica: boolean;
  minimo_s?: number;
  segundos?: number;
  cumplido?: boolean;
  contando?: boolean;
  cierra?: string | null;
  cerrada?: boolean;
}

/** Intervalo entre latidos (el servidor solo suma huecos ≤ 25 s). */
export const LATIDO_MS = 10_000;
/** Sin tocar la página durante este tiempo, el estudiante se considera inactivo. */
export const INACTIVIDAD_MS = 120_000;

/** ¿Cuenta este momento como trabajo activo? Página visible y alguna interacción reciente. */
export function estaActivo(visible: boolean, ultimaInteraccionMs: number, ahoraMs: number): boolean {
  return visible && ahoraMs - ultimaInteraccionMs < INACTIVIDAD_MS;
}

/** «1 h 05 min», «12 min», «45 s». */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** Porcentaje del mínimo cumplido (0–100). */
export function avance(e: EstadoTiempo): number {
  if (!e.aplica || !e.minimo_s) return 100;
  return Math.min(100, Math.floor((100 * (e.segundos ?? 0)) / e.minimo_s));
}

/** Factor de la nota si se entrega sin cumplir el mínimo (al cierre o por el profesor). */
export function factorNota(segundos: number, minimo_s: number): number {
  if (minimo_s <= 0) return 1;
  return Math.min(1, Math.max(0, segundos / minimo_s));
}

/** ¿Puede el estudiante pulsar «Entregar»? (el servidor lo vuelve a comprobar) */
export function puedeEntregar(e: EstadoTiempo | null | undefined): boolean {
  return !e || !e.aplica || !!e.cumplido || !!e.cerrada;
}
