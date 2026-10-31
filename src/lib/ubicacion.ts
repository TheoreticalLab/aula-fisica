/**
 * Ubicación del navegador para la asistencia (la usan el aula y Orbe Control). Solo se pide al marcar o al abrir
 * la asistencia, nunca en segundo plano. Devuelve null si el navegador no la da (permiso negado, sin GPS, etc.).
 */
export interface Ubicacion { lat: number; lng: number; accuracy: number; /** instante (ms, reloj del dispositivo) en que se tomó la medición */ tomada?: number }

export function ubicacionActual(tiempoMax = 12000): Promise<{ ubicacion: Ubicacion | null; motivo: string | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ubicacion: null, motivo: 'Este navegador no permite obtener la ubicación.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ubicacion: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, tomada: p.timestamp }, motivo: null }),
      (e) => resolve({
        ubicacion: null,
        motivo: e.code === e.PERMISSION_DENIED
          ? 'No se dio permiso para usar la ubicación. Actívelo en el candado de la barra de direcciones (o en Ajustes del teléfono) e inténtelo de nuevo.'
          : e.code === e.TIMEOUT ? 'La ubicación tardó demasiado. Active el GPS o la ubicación precisa e inténtelo de nuevo.' : 'No se pudo obtener la ubicación.',
      }),
      { enableHighAccuracy: true, timeout: tiempoMax, maximumAge: 0 },
    );
  });
}

/** Texto corto de la verificación de un presente (para el profesor). */
export function textoVerificacion(geo: string | null, distancia: number | null, precision: number | null): string {
  if (geo === 'verificado') return `📍 a ${distancia ?? '?'} m`;
  if (geo === 'impreciso') return `⚠ ubicación imprecisa (±${precision ?? '?'} m, a ${distancia ?? '?'} m)`;
  if (geo === 'sin_ubicacion') return '⚠ sin ubicación';
  if (geo === 'sin_referencia') return 'sin verificar ubicación';
  return '';
}

/** Con una referencia peor que esta (en metros) se advierte al profesor antes de abrir. */
export const PRECISION_PROFESOR = 150;
export const avisoPrecision = (precision: number) =>
  `La ubicación de este dispositivo es imprecisa (±${Math.round(precision)} m). Si la usa como referencia, podría rechazar a estudiantes que sí están en el aula.\n\n` +
  'Recomendación: abra la asistencia desde su teléfono con el GPS activado (Orbe Control), o elija un radio mayor.\n\n¿Abrir de todos modos con esta ubicación?';

export const MOTIVO_RECHAZO: Record<string, string> = {
  lejos: 'fuera del aula', sin_ubicacion: 'no compartió su ubicación', dispositivo_compartido: 'mismo dispositivo que otro estudiante',
};
