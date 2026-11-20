/**
 * Lógica de la Edge Function «entrenador», independiente de Deno para probarla con Vitest.
 *
 * Acción única:
 *  - responder { ejercicio_id, idem, partes: string[], segundos_cliente? }
 *      1. pide la clave del ejercicio ABIERTO del usuario (svc_entrenador_clave: comprueba dueño y acceso);
 *      2. corrige con el motor de siempre; un intento no válido (casilla vacía o ilegible) se devuelve sin escribir nada;
 *      3. registra la respuesta (svc_entrenador_responder: bloqueo, idempotencia, intentos, cierre). Con el ejercicio
 *         cerrado (acierto o intentos agotados) la base devuelve también la solución desarrollada.
 * El resto («siguiente ejercicio», «ver la solución») no necesita la clave: son funciones SQL directas.
 */
import { corregir, MAX_PARTE, type ClaveEntrenador } from './evaluar.ts';

export interface Db {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, `Parámetro ${name} inválido`);
  return v;
}

async function call<T>(db: Db, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'P0001' || error.code === '22023' ? 409 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno del Entrenador' : error.message);
  }
  return data as T;
}

export async function handle(body: unknown, userId: string, db: Db): Promise<unknown> {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Solicitud inválida');
  const b = body as Record<string, unknown>;
  if (b.action !== 'responder') throw new HttpError(400, 'Acción desconocida');
  const ejercicio = uuid(b.ejercicio_id, 'ejercicio_id');
  const idem = uuid(b.idem, 'idem');
  if (!Array.isArray(b.partes) || b.partes.length < 1 || b.partes.length > 6) throw new HttpError(400, 'Respuesta inválida');
  const partes = b.partes.map((p) => (typeof p === 'string' ? p.slice(0, MAX_PARTE + 1) : ''));
  const seg = typeof b.segundos_cliente === 'number' && Number.isFinite(b.segundos_cliente) ? Math.max(0, Math.min(b.segundos_cliente, 86400)) : null;

  const ctx = await call<{ abierto: boolean; clave: ClaveEntrenador | null }>(db, 'svc_entrenador_clave', { p_user: userId, p_ejercicio: ejercicio });
  let correcta = false;
  let detalle: unknown = null;
  if (ctx.abierto && ctx.clave) {
    let c;
    try {
      c = corregir(ctx.clave, partes);
    } catch {
      throw new HttpError(500, 'Error interno del Entrenador');
    }
    if (!c.valida) return { valida: false, mensajes: c.mensajes };
    correcta = c.correcta;
    detalle = { partes: c.partes };
  }
  // ejercicio ya cerrado (doble envío, otra pestaña): la base devuelve el estado vigente sin cambiar nada
  return await call(db, 'svc_entrenador_responder', {
    p_user: userId,
    p_ejercicio: ejercicio,
    p_idem: idem,
    p_partes: partes,
    p_correcta: correcta,
    p_detalle: detalle,
    p_segundos_cliente: seg,
  });
}
