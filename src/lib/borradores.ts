/**
 * Copia local de los borradores de la práctica clásica (lógica pura; el almacén se inyecta).
 *
 * Fallo que corrige (auditoría de Telemetría V2): el guardado automático esperaba 1.2 s y se cancelaba si el
 * estudiante salía antes; un guardado fallido no se reintentaba; y nada quedaba en el dispositivo. Ahora cada cambio
 * se copia en el dispositivo hasta que el servidor lo confirma.
 *
 * Para decidir si una copia se recupera NO se usa la hora del dispositivo: la copia recuerda en qué versión del
 * servidor se basó (`base` = updated_at de la respuesta al empezar a escribir). Si el servidor sigue en esa versión,
 * la copia es posterior y se recupera sola; si cambió (otro dispositivo u otra pestaña guardó después), hay conflicto
 * y se ofrece recuperarla a mano, sin sobrescribir nada.
 */

export interface Almacen { leer(clave: string): string | null; escribir(clave: string, valor: string): void; borrar(clave: string): void }
export interface CopiaBorrador {
  answer: Record<string, unknown>;
  /** updated_at de la respuesta en el servidor cuando se abrió la pregunta */
  base: string | null;
  /** última respuesta que ESTE dispositivo vio confirmada por el servidor (o la que había al abrir) */
  confirmada?: Record<string, unknown> | null;
  t: number;
}

export const PREFIJO = 'aula-borrador:';
export const claveBorrador = (attemptId: string, exerciseId: string) => `${PREFIJO}${attemptId}:${exerciseId}`;

/** Igualdad estructural de respuestas (orden de claves y de opciones irrelevante; espacios en los extremos tampoco). */
export function mismaRespuesta(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined): boolean {
  const norm = (x: Record<string, unknown> | null | undefined) => {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(x ?? {}).sort()) {
      const v = (x as Record<string, unknown>)[k];
      if (v === undefined || v === null || v === '') continue;
      o[k] = Array.isArray(v) ? [...v].sort() : typeof v === 'string' ? v.trim() : v;
    }
    return JSON.stringify(o);
  };
  return norm(a) === norm(b);
}

export function guardarCopia(alm: Almacen | null, attemptId: string, exerciseId: string, copia: CopiaBorrador) {
  try { alm?.escribir(claveBorrador(attemptId, exerciseId), JSON.stringify(copia)); } catch { /* almacenamiento lleno o bloqueado */ }
}

export function leerCopia(alm: Almacen | null, attemptId: string, exerciseId: string): CopiaBorrador | null {
  try {
    const s = alm?.leer(claveBorrador(attemptId, exerciseId));
    if (!s) return null;
    const c = JSON.parse(s) as CopiaBorrador;
    return c && typeof c === 'object' && c.answer && typeof c.answer === 'object' ? c : null;
  } catch { return null; }
}

/** Borra la copia SOLO si coincide con lo que el servidor acaba de confirmar (una copia más nueva se conserva). */
export function confirmarCopia(alm: Almacen | null, attemptId: string, exerciseId: string, confirmada: Record<string, unknown>) {
  const c = leerCopia(alm, attemptId, exerciseId);
  if (c && mismaRespuesta(c.answer, confirmada)) { try { alm?.borrar(claveBorrador(attemptId, exerciseId)); } catch { /* nada */ } }
}

export type Decision = { accion: 'nada' } | { accion: 'recuperar'; answer: Record<string, unknown> } | { accion: 'conflicto'; answer: Record<string, unknown> };

/**
 * Qué hacer al abrir una pregunta con una copia local.
 *  - sin copia, o copia igual a lo del servidor → nada (y la copia sobra);
 *  - el servidor no cambió desde que se hizo la copia → recuperar automáticamente;
 *  - el servidor cambió después → conflicto: no se sobrescribe; se ofrece recuperar a mano.
 */
export function decidir(copia: CopiaBorrador | null, servidor: { answer: Record<string, unknown> | null; updated_at: string | null } | null): Decision {
  if (!copia) return { accion: 'nada' };
  if (mismaRespuesta(copia.answer, servidor?.answer ?? null)) return { accion: 'nada' };
  // el servidor sigue en la versión que conocía este dispositivo: nadie más escribió → la copia es posterior
  if ((servidor?.updated_at ?? null) === copia.base) return { accion: 'recuperar', answer: copia.answer };
  if (copia.confirmada !== undefined && mismaRespuesta(servidor?.answer ?? null, copia.confirmada)) return { accion: 'recuperar', answer: copia.answer };
  return { accion: 'conflicto', answer: copia.answer };
}

/** Espera antes del reintento n (1, 2, 3…) de un guardado fallido: 2 s, 5 s, 15 s y después cada 30 s. */
export const esperaReintento = (n: number) => [2000, 5000, 15000][n - 1] ?? 30000;
