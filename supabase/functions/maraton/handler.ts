/**
 * Lógica de la Edge Function «maraton» (Maratón adaptativo), independiente de Deno para probarla con Vitest.
 *
 * Acción única:
 *  - responder { presentacion_id, idem, etapa?, partes: string[], procedimiento?, segundos_cliente? }
 *      1. pide la clave de la etapa ABIERTA del problema del usuario (svc_maraton_clave: comprueba dueño, acceso y
 *         estado; nunca entrega claves de etapas futuras);
 *      2. valida la forma de la respuesta: si no es un intento válido, contesta sin escribir nada (puede corregir y reenviar);
 *      3. califica con el motor existente y registra la etapa (svc_maraton_etapa: bloqueo, idempotencia, etapa en orden;
 *         en la última, acierto completo solo si todas las etapas son correctas, y la máquina de estados de siempre).
 *         Devuelve SOLO el estado operativo para el estudiante (sin decir si la etapa fue correcta).
 *    `etapa` es la que el estudiante tiene en pantalla: si ya no es la abierta (doble envío, otra pestaña), la base
 *    responde con el estado vigente sin escribir. Sin `etapa` (interfaz anterior) se toma la abierta.
 *
 * El resto de acciones (iniciar, «No puedo», cambiar ejercicio) no necesitan la clave y son funciones SQL directas.
 * Nunca se devuelven claves, soluciones, niveles, ponderaciones ni unidades de trabajo.
 */
import { evaluarRespuesta, MAX_PARTE, type ClaveMaraton } from './evaluar.ts';

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
    throw new HttpError(status, status === 500 ? 'Error interno del maratón' : error.message);
  }
  return data as T;
}

export interface RespuestaNoValida {
  valida: false;
  mensajes: string[];
}

export async function handle(body: unknown, userId: string, db: Db): Promise<unknown> {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Solicitud inválida');
  const b = body as Record<string, unknown>;
  if (b.action !== 'responder') throw new HttpError(400, 'Acción desconocida');
  const presentacion = uuid(b.presentacion_id, 'presentacion_id');
  const idem = uuid(b.idem, 'idem');
  if (!Array.isArray(b.partes) || b.partes.length < 1 || b.partes.length > 6) throw new HttpError(400, 'Respuesta inválida');
  const partes = b.partes.map((p) => (typeof p === 'string' ? p.slice(0, MAX_PARTE + 1) : ''));
  const procedimiento = typeof b.procedimiento === 'string' ? b.procedimiento.slice(0, 20000) : null;
  const seg = typeof b.segundos_cliente === 'number' && Number.isFinite(b.segundos_cliente) ? Math.max(0, Math.min(b.segundos_cliente, 86400)) : null;
  if (b.etapa !== undefined && b.etapa !== null && !(Number.isInteger(b.etapa) && (b.etapa as number) >= 1 && (b.etapa as number) <= 5)) {
    throw new HttpError(400, 'Etapa inválida');
  }

  const ctx = await call<{ abierta: boolean; clave: ClaveMaraton | null; etapa?: number }>(db, 'svc_maraton_clave', { p_user: userId, p_presentacion: presentacion });
  const abierta = ctx.etapa ?? 1;
  const etapa = typeof b.etapa === 'number' ? b.etapa : abierta;
  let correcta = false;
  let detalle: unknown = null;
  // solo se califica contra la clave de la etapa que el estudiante tiene en pantalla
  if (ctx.abierta && ctx.clave && etapa === abierta) {
    let ev;
    try {
      ev = evaluarRespuesta(ctx.clave, partes);
    } catch {
      throw new HttpError(500, 'Error interno del maratón');
    }
    if (!ev.valida) return { valida: false, mensajes: ev.mensajes } satisfies RespuestaNoValida;
    correcta = ev.correcta;
    detalle = { partes: ev.partes.map((p) => ({ correcta: p.correcta, codigo: p.codigo })) };
  }
  // problema ya cerrado o etapa ya entregada (doble envío, otra pestaña): la base responde con el estado vigente sin cambiar nada
  return await call(db, 'svc_maraton_etapa', {
    p_user: userId,
    p_presentacion: presentacion,
    p_idem: idem,
    p_etapa: etapa,
    p_respuesta: { partes },
    p_procedimiento: procedimiento,
    p_segundos_cliente: seg,
    p_correcta: correcta,
    p_detalle: detalle,
  });
}
