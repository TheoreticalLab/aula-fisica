/**
 * Contexto DECLARADO del navegador para el registro de seguridad del inicio de sesión. Nada invasivo: ni canvas,
 * ni fuentes, ni hardware. El identificador de instalación es un número aleatorio guardado en este navegador
 * (puede borrarse o copiarse: el servidor lo trata como indicio, no como prueba, y solo guarda su versión cifrada).
 */
export const APP_VERSION = '2026.10.27';
const CLAVE = 'aula-instalacion';

export function contextoAcceso(): { install_id: string | null; tz: string | null; lang: string | null; app_version: string } {
  let id: string | null = null;
  try {
    id = localStorage.getItem(CLAVE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE, id);
    }
  } catch {
    id = null; // almacenamiento bloqueado: se registra sin instalación
  }
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    tz = null;
  }
  return { install_id: id, tz, lang: navigator.language ?? null, app_version: APP_VERSION };
}
