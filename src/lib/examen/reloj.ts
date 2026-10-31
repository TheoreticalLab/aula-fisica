/**
 * Motor de examen · reloj oficial. El tiempo que cuenta es el del SERVIDOR: el navegador solo estima su desfase
 * para mostrar la cuenta atrás y fechar los tramos. Un reloj local adelantado o atrasado no da ni quita tiempo.
 */

export interface MuestraReloj { envio_local: number; servidor: number; recibo_local: number } // ms

/** Desfase servidor − local con la muestra de menor ida y vuelta (estilo NTP). Incertidumbre = media ida y vuelta. */
export function estimarDesfase(muestras: MuestraReloj[]): { desfase: number; incertidumbre: number } | null {
  const val = muestras.filter((m) => m.recibo_local >= m.envio_local);
  if (!val.length) return null;
  const mejor = val.reduce((a, b) => (b.recibo_local - b.envio_local < a.recibo_local - a.envio_local ? b : a));
  const rtt = mejor.recibo_local - mejor.envio_local;
  return { desfase: mejor.servidor - (mejor.envio_local + mejor.recibo_local) / 2, incertidumbre: rtt / 2 };
}

export interface ParametrosLimite {
  inicio: number;                   // ms del servidor en que empezó el intento
  duracion_s: number | null;
  pausas_ms: number;                // pausa declarada acumulada (hasta el máximo permitido)
  pausa_en_curso_desde: number | null;
  detienen_reloj: boolean;
  max_pausa_ms: number;
  cierre_actividad: number | null;  // ms del servidor
}

/**
 * Hora límite oficial. Con «las pausas detienen el reloj», el límite se desplaza por la pausa usada, pero nunca más
 * allá del máximo de pausa ni del cierre de la actividad.
 */
export function horaLimite(p: ParametrosLimite, ahora: number): number | null {
  const cierre = p.cierre_actividad;
  if (p.duracion_s === null) return cierre;
  let pausa = 0;
  if (p.detienen_reloj) {
    const enCurso = p.pausa_en_curso_desde !== null ? Math.max(0, ahora - p.pausa_en_curso_desde) : 0;
    pausa = Math.min(p.max_pausa_ms, p.pausas_ms + enCurso);
  }
  const lim = p.inicio + p.duracion_s * 1000 + pausa;
  return cierre === null ? lim : Math.min(lim, cierre);
}

export function restante(limite: number | null, ahoraServidor: number): number | null {
  return limite === null ? null : Math.max(0, limite - ahoraServidor);
}

export function formatoCuenta(ms: number): string {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
