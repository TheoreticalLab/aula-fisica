/**
 * Inicio de sesión con ID y contraseña (lógica pura, probada con Vitest).
 *
 * 1. Valida el formato y consulta límites de intentos (por ID y por IP) → svc_login_check.
 * 2. Si el ID existe y está activo, verifica la contraseña contra Supabase Auth (grant password) usando el
 *    correo técnico de la cuenta, que el navegador nunca conoce.
 * 3. Registra el intento (sin contraseña; IP solo como hash) → svc_login_record.
 * 4. Respuesta UNIFORME para ID inexistente, cuenta suspendida o contraseña incorrecta (no revela qué IDs existen),
 *    con un tiempo mínimo de respuesta para que la duración tampoco lo revele.
 */

export interface Deps {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  passwordGrant(email: string, password: string): Promise<{ ok: boolean; session?: Record<string, unknown> }>;
  esperar(ms: number): Promise<void>;
  ahora(): number;
}

export interface Respuesta {
  status: number;
  body: Record<string, unknown>;
}

export const MENSAJE_GENERICO = 'ID o contraseña incorrectos.';
export const MENSAJE_BLOQUEO = 'Demasiados intentos fallidos. Espere 15 minutos y vuelva a intentarlo.';
const TIEMPO_MINIMO_MS = 700;

async function rpc<T>(d: Deps, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/**
 * Metadatos forenses del intento (los prepara index.ts): request_id, user_agent/navegador/sistema (declarados por
 * el navegador), country (cabecera de red), client_tz, client_lang, app_version, device_hash (instalación cifrada).
 * Nunca incluyen la contraseña ni tokens.
 */
export type MetaAcceso = Record<string, string | number | null>;

/** Navegador, sistema y tipo de dispositivo a partir del user-agent (declarado por el navegador: falsificable). */
export function describirUA(ua: string): { browser: string | null; os: string | null; device_type: string | null } {
  if (!ua) return { browser: null, os: null, device_type: null };
  const v = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0];
  const browser = /Edg\//.test(ua) ? `Edge ${v(/Edg\/([\d.]+)/) ?? ''}`
    : /OPR\//.test(ua) ? `Opera ${v(/OPR\/([\d.]+)/) ?? ''}`
    : /SamsungBrowser\//.test(ua) ? `Samsung Internet ${v(/SamsungBrowser\/([\d.]+)/) ?? ''}`
    : /Firefox\//.test(ua) ? `Firefox ${v(/Firefox\/([\d.]+)/) ?? ''}`
    : /(Chrome|CriOS)\//.test(ua) ? `Chrome ${v(/(?:Chrome|CriOS)\/([\d.]+)/) ?? ''}`
    : /Safari\//.test(ua) ? `Safari ${v(/Version\/([\d.]+)/) ?? ''}`
    : 'Otro';
  const os = /Android ([\d.]+)/.test(ua) ? `Android ${v(/Android ([\d.]+)/)}`
    : /(iPhone|iPad|iPod)/.test(ua) ? `iOS ${(ua.match(/OS (\d+)_/) ?? [])[1] ?? ''}`
    : /Windows NT 10/.test(ua) ? 'Windows 10/11'
    : /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Otro';
  const device_type = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tableta' : /Mobile|iPhone|Android/.test(ua) ? 'teléfono' : 'computadora';
  return { browser: browser.trim(), os: os.trim(), device_type };
}

export async function acceder(body: unknown, ipHash: string | null, d: Deps, meta: MetaAcceso = {}): Promise<Respuesta> {
  const inicio = d.ahora();
  const igualarTiempo = async () => {
    const resto = TIEMPO_MINIMO_MS - (d.ahora() - inicio);
    if (resto > 0) await d.esperar(resto);
  };
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const id = typeof b.id === 'string' ? b.id.slice(0, 80) : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!id || !password || password.length > 200) {
    await igualarTiempo();
    return { status: 400, body: { error: 'Escriba su ID y su contraseña.' } };
  }

  const chk = await rpc<{ allowed: boolean; reason?: string; rule?: string; login: string; user_id?: string | null; email?: string | null; active?: boolean }>(
    d,
    'svc_login_check',
    { p_login: id, p_ip_hash: ipHash },
  );
  const conMeta = (extra: MetaAcceso) => ({ ...meta, ...extra, duration_ms: d.ahora() - inicio });
  if (!chk.allowed) {
    const reason = chk.reason ?? 'locked';
    await rpc(d, 'svc_login_record', {
      p_login: chk.login || id, p_user: null, p_ip_hash: ipHash, p_success: false, p_reason: reason, p_meta: conMeta({ rule: chk.rule ?? null }),
    });
    await igualarTiempo();
    if (reason === 'invalid_format') return { status: 401, body: { error: MENSAJE_GENERICO } };
    return { status: 429, body: { error: MENSAJE_BLOQUEO } };
  }

  let ok = false;
  let session: Record<string, unknown> | undefined;
  let reason = 'unknown_id';
  if (chk.user_id && chk.email && chk.active) {
    const r = await d.passwordGrant(chk.email, password);
    ok = r.ok;
    session = r.session;
    reason = ok ? 'ok' : 'bad_password';
  } else if (chk.user_id) {
    reason = 'suspended';
  }
  const rec = await rpc<{ must_change_password: boolean }>(d, 'svc_login_record', {
    p_login: chk.login,
    p_user: chk.user_id ?? null,
    p_ip_hash: ipHash,
    p_success: ok,
    p_reason: reason,
    p_meta: conMeta({}),
  });
  await igualarTiempo();
  if (!ok || !session) return { status: 401, body: { error: MENSAJE_GENERICO } };
  return {
    status: 200,
    body: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      must_change_password: !!rec.must_change_password,
    },
  };
}
