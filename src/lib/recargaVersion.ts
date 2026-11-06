/**
 * Recuperación tras publicar una versión nueva del aula.
 *
 * Cada página se descarga aparte (import dinámico) con un nombre que cambia en cada publicación. Quien tenía el aula
 * abierta —o la copia de index.html que GitHub Pages deja en caché hasta 10 minutos— pide archivos que ya no existen:
 * sin esto, la página se quedaba «Cargando…» o en blanco. Ahora, si una parte no carga, se recarga UNA vez para tomar
 * la versión nueva; si vuelve a fallar enseguida (sin red, servidor caído), no se entra en un bucle: se muestra el error.
 */
import { lazy, type ComponentType } from 'react';

const CLAVE = 'aula.recarga-version';
/** Ventana anti-bucle: no se recarga dos veces en menos de este tiempo. */
export const VENTANA_MS = 30_000;

/** ¿Toca recargar? (lógica pura, probada en tests/recarga-version.test.ts) */
export function debeRecargar(ultima: number | null, ahora: number): boolean {
  return ultima === null || !Number.isFinite(ultima) || ahora - ultima > VENTANA_MS || ahora < ultima;
}

/** Recarga la página si no se hizo hace poco. Devuelve true si va a recargar. */
export function recargarUnaVez(): boolean {
  let ultima: number | null = null;
  try { const v = sessionStorage.getItem(CLAVE); ultima = v ? Number(v) : null; } catch { /* sin almacenamiento */ }
  const ahora = Date.now();
  if (!debeRecargar(ultima, ahora)) return false;
  try { sessionStorage.setItem(CLAVE, String(ahora)); } catch { /* sin almacenamiento: igual se recarga una vez */ }
  window.location.reload();
  return true;
}

/** Vite avisa con «vite:preloadError» cuando falla la precarga de una parte: se recarga en vez de quedarse colgado. */
export function instalarRecargaPorVersion() {
  window.addEventListener('vite:preloadError', (e) => {
    if (recargarUnaVez()) e.preventDefault();
  });
}

/** React.lazy que, si el archivo de la página ya no existe (versión nueva publicada), recarga una vez. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyConRecarga<T extends ComponentType<any>>(cargar: () => Promise<{ default: T }>) {
  return lazy(() => cargar().catch((e: unknown) => {
    if (recargarUnaVez()) return new Promise<{ default: T }>(() => undefined);   // la recarga ya está en marcha
    throw e;
  }));
}
