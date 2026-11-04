/**
 * Recuperación supervisada de acceso para estudiantes (lógica pura, probada con Vitest).
 *
 * Acciones (sin sesión: el estudiante olvidó su contraseña):
 *  - config                          → qué está activado (passkeys, recuperación, monitores). No revela cuentas.
 *  - solicitar { id, destinatario, secreto }
 *        El dispositivo genera un secreto aleatorio (32 bytes en hex) y lo conserva; aquí solo se guarda su hash.
 *        Devuelve el id de la solicitud y un código corto para mostrar EN PERSONA al profesor o al monitor.
 *        Misma respuesta (y mismo tiempo mínimo) exista o no la cuenta.
 *  - estado { solicitud, secreto }   → pendiente | aprobada | rechazada | vencida | cancelada | revocada | completada | desconocida
 *  - completar { solicitud, secreto }
 *        Canje de un solo uso de una solicitud APROBADA. Supabase Auth emite un token de un solo uso
 *        (admin.generateLink, sin enviar correo) que solo recibe este dispositivo; el navegador lo verifica con
 *        auth.verifyOtp y es Supabase Auth quien crea la sesión. La cuenta queda con cambio de contraseña obligatorio.
 * Nunca se devuelven correos técnicos, contraseñas ni datos de la cuenta; los tokens solo al dispositivo que canjea.
 */

export interface Deps {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  /** Token de un solo uso de Supabase Auth para la cuenta (sin enviar correo). null si no se pudo emitir. */
  emitirToken(email: string): Promise<{ token_hash: string; tipo: string } | null>;
  sha256(texto: string): Promise<string>;
  esperar(ms: number): Promise<void>;
  ahora(): number;
}

export interface Respuesta {
  status: number;
  body: Record<string, unknown>;
}

export type MetaRecuperar = { device_hash?: string | null; browser?: string | null; device_type?: string | null };

export const MENSAJES = {
  noDisponible: 'La recuperación sin contraseña no está disponible. Hable con su profesor.',
  formato: 'Revise su ID: es el que usa para entrar (por ejemplo, su matrícula).',
  limitado: 'Demasiadas solicitudes. Espere un rato o hable con su profesor en clase.',
  noCanjeable: 'La solicitud no está aprobada, venció o ya se usó. Pida una nueva.',
  sinToken: 'No se pudo completar el acceso. Pida una nueva solicitud.',
  invalida: 'Solicitud inválida.',
} as const;

const TIEMPO_MINIMO_MS = 600;
const SECRETO = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ESTADOS = new Set(['pendiente', 'aprobada', 'rechazada', 'vencida', 'cancelada', 'revocada', 'completada', 'desconocida']);

async function rpc<T>(d: Deps, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const texto = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function recuperar(body: unknown, ipHash: string | null, d: Deps, meta: MetaRecuperar = {}): Promise<Respuesta> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const accion = texto(b.accion, 20);

  if (accion === 'config') {
    const c = await rpc<{ passkeys: boolean; recuperacion: boolean; monitores: boolean; minutos_solicitud: number; inactividad_dias?: number | null }>(d, 'svc_acceso_config', {});
    return { status: 200, body: { passkeys: !!c?.passkeys, recuperacion: !!c?.recuperacion, monitores: !!c?.monitores, minutos_solicitud: c?.minutos_solicitud ?? 30, inactividad_dias: c?.inactividad_dias ?? null } };
  }

  if (accion === 'solicitar') {
    const inicio = d.ahora();
    const igualar = async () => {
      const resto = TIEMPO_MINIMO_MS - (d.ahora() - inicio);
      if (resto > 0) await d.esperar(resto);
    };
    const id = texto(b.id, 60);
    const destinatario = texto(b.destinatario, 10);
    const secreto = texto(b.secreto, 64).toLowerCase();
    if (!id || !SECRETO.test(secreto) || (destinatario !== 'profesor' && destinatario !== 'monitor')) {
      await igualar();
      return { status: 400, body: { error: MENSAJES.formato } };
    }
    const r = await rpc<{ disponible: boolean; error?: string; limitado?: boolean; id?: string; codigo?: string; expira?: string }>(d, 'svc_acceso_solicitar', {
      p_login: id,
      p_destinatario: destinatario,
      p_secreto_hash: await d.sha256(secreto),
      p_ip_hash: ipHash,
      p_meta: { device_hash: meta.device_hash ?? null, browser: meta.browser ?? null, device_type: meta.device_type ?? null },
    });
    await igualar();
    if (!r?.disponible) return { status: 503, body: { error: MENSAJES.noDisponible } };
    if (r.error) return { status: 400, body: { error: MENSAJES.formato } };
    if (r.limitado) return { status: 429, body: { error: MENSAJES.limitado } };
    return { status: 200, body: { solicitud: r.id, codigo: r.codigo, expira: r.expira } };
  }

  if (accion === 'estado' || accion === 'completar') {
    const solicitud = texto(b.solicitud, 36).toLowerCase();
    const secreto = texto(b.secreto, 64).toLowerCase();
    if (!UUID.test(solicitud) || !SECRETO.test(secreto)) return { status: 400, body: { error: MENSAJES.invalida } };
    const hash = await d.sha256(secreto);
    if (accion === 'estado') {
      const r = await rpc<{ estado: string; expira?: string; aprobada_hasta?: string | null }>(d, 'svc_acceso_estado', { p_id: solicitud, p_secreto_hash: hash });
      const estado = ESTADOS.has(r?.estado) ? r.estado : 'desconocida';
      return { status: 200, body: { estado, expira: r?.expira ?? null, aprobada_hasta: r?.aprobada_hasta ?? null } };
    }
    const c = await rpc<{ ok: boolean; email?: string; estado?: string }>(d, 'svc_acceso_canjear', { p_id: solicitud, p_secreto_hash: hash, p_ip_hash: ipHash });
    if (!c?.ok || !c.email) return { status: 409, body: { error: MENSAJES.noCanjeable, estado: c?.estado ?? null } };
    let token: { token_hash: string; tipo: string } | null = null;
    try {
      token = await d.emitirToken(c.email);
    } catch {
      token = null;
    }
    if (!token?.token_hash || (token.tipo !== 'magiclink' && token.tipo !== 'email')) {
      await rpc(d, 'svc_acceso_canje_fallido', { p_id: solicitud, p_motivo: 'Supabase Auth no emitió el token' });
      return { status: 502, body: { error: MENSAJES.sinToken } };
    }
    return { status: 200, body: { token_hash: token.token_hash, tipo: token.tipo } };
  }

  return { status: 400, body: { error: MENSAJES.invalida } };
}
