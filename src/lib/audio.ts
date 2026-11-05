/**
 * Respuesta oral (migración 86): reglas puras del grabador, probadas en tests/respuesta-oral.test.ts.
 * El servidor vuelve a comprobar duración, número de grabaciones y formato (por su firma).
 */
export interface ConfigAudio { min_s: number; max_s: number; max_grabaciones: number; reproducir_previa: boolean; transcripcion: boolean; ia: boolean }
/** Valores por defecto de una pregunta oral: de 1 a 2 minutos, 2 grabaciones, escucha previa. */
export const CONFIG_AUDIO_POR_DEFECTO: ConfigAudio = { min_s: 60, max_s: 120, max_grabaciones: 2, reproducir_previa: true, transcripcion: false, ia: false };

/** Formatos que se piden a MediaRecorder, en orden de preferencia (Chrome/Firefox/Edge: WebM-Opus; Safari: MP4). */
export const MIME_PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'] as const;

export function elegirMime(soporta: (m: string) => boolean): string | null {
  for (const m of MIME_PREFERIDOS) if (soporta(m)) return m;
  return null;
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** ¿Se puede enviar una grabación de esta duración? Margen igual al del servidor (1,5 s por debajo). */
export function motivoDuracion(ms: number, c: ConfigAudio): string | null {
  if (ms < c.min_s * 1000 - 1500) return `La respuesta debe durar al menos ${mmss(c.min_s * 1000)} (grabó ${mmss(ms)}). Grabe de nuevo.`;
  if (ms > c.max_s * 1000 + 3000) return `La respuesta no puede pasar de ${mmss(c.max_s * 1000)}.`;
  return null;
}

/** Mensaje claro según el error del navegador al pedir el micrófono, y el motivo que se anota como incidencia. */
export function motivoMicrofono(nombre: string | undefined): { texto: string; incidencia: 'microfono_denegado' | 'microfono_error' } {
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return { incidencia: 'microfono_denegado', texto: 'El navegador no tiene permiso para usar el micrófono. Permítalo en la barra de direcciones (icono del candado o del micrófono) y pulse de nuevo «Comenzar grabación». Si no puede, avise al profesor.' };
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return { incidencia: 'microfono_error', texto: 'No se encontró ningún micrófono en este dispositivo. Conecte uno o use otro dispositivo, y avise al profesor.' };
  }
  if (nombre === 'NotReadableError') {
    return { incidencia: 'microfono_error', texto: 'Otra aplicación está usando el micrófono. Ciérrela y pulse de nuevo «Comenzar grabación».' };
  }
  return { incidencia: 'microfono_error', texto: 'No se pudo usar el micrófono en este navegador. Pruebe con Chrome, Edge, Firefox o Safari actualizados, y avise al profesor.' };
}

/** Grabaciones que quedan (el servidor tiene la última palabra). */
export const restantes = (c: ConfigAudio, usadas: number) => Math.max(0, c.max_grabaciones - usadas);
