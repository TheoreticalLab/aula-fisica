/**
 * Cola de mensajes emergentes del estudiante (lógica pura, probada en tests/mensajes.test.ts).
 * Garantiza: sin duplicados (por id), lo ya respondido en este navegador no reaparece aunque el servidor
 * todavía no lo sepa (p. ej. sin conexión), y los urgentes se muestran primero.
 */
export type TipoMensaje = 'informativo' | 'importante' | 'urgente';

export interface MensajeVivo {
  id: string;
  kind: TipoMensaje;
  body: string;
  /** nombre del profesor; null en los avisos del aula (migración 57) */
  sender_name: string | null;
  /** 'aula' = aviso neutro de la plataforma, sin «mensaje del profesor» (migración 57; antes no viene) */
  remitente?: 'profesor' | 'aula';
  created_at: string;
  expires_at: string | null;
  delivered_at: string | null;
  /** Lectura obligatoria (migración 70): espera en segundos y texto de la casilla. Sin «cerrar». */
  confirmacion?: { tipo: 'caja'; espera: number; caja?: string } | null;
}

const PRIORIDAD: Record<TipoMensaje, number> = { urgente: 0, importante: 1, informativo: 2 };

/** Aviso con lectura obligatoria: primero la espera, después la casilla y por último «Entendido». */
export function estadoConfirmacion(restante: number, marcada: boolean) {
  const esperando = restante > 0;
  return { esperando, cajaHabilitada: !esperando, botonHabilitado: !esperando && marcada };
}

/** Une la cola actual con lo que devuelve el servidor, sin duplicar y sin lo ya respondido localmente. */
export function fusionarCola(cola: MensajeVivo[], servidor: MensajeVivo[], respondidos: Set<string>, ahora = Date.now()): MensajeVivo[] {
  const porId = new Map<string, MensajeVivo>();
  for (const m of [...cola, ...servidor]) {
    if (respondidos.has(m.id)) continue;
    if (m.expires_at && new Date(m.expires_at).getTime() <= ahora) continue;
    if (!porId.has(m.id)) porId.set(m.id, m);
  }
  return [...porId.values()].sort(
    (a, b) => PRIORIDAD[a.kind] - PRIORIDAD[b.kind] || a.created_at.localeCompare(b.created_at),
  );
}

/** Ids recién llegados que aún no constan como recibidos en el servidor (para marcar la recepción técnica). */
export function porMarcarRecibidos(servidor: MensajeVivo[], yaMarcados: Set<string>): string[] {
  return servidor.filter((m) => !m.delivered_at && !yaMarcados.has(m.id)).map((m) => m.id);
}

export const ETIQUETA_TIPO: Record<TipoMensaje, string> = {
  informativo: 'Informativo',
  importante: 'Importante',
  urgente: 'Urgente',
};
