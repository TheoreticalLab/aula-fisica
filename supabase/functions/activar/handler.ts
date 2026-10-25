/**
 * Activación de cuenta con la clave de la sección (lógica pura, probada con Vitest).
 *
 * El estudiante envía { clave, id, nombre, password }. Si la clave corresponde a una sección con la matrícula
 * abierta y el ID está libre, se crea la cuenta en Supabase Auth (con un correo técnico aleatorio), se completa el
 * perfil, se matricula en ESA sección y se inicia la sesión. La contraseña la elige el estudiante y nunca se
 * guarda ni se registra fuera de Auth (que solo almacena su hash).
 */
import { correoTecnico, idValido, normalizarId, problemasContrasena } from '../_shared/cuentas.ts';

export interface ActivarDeps {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  crearUsuario(u: { email: string; password: string; app_metadata: Record<string, unknown> }): Promise<{ id?: string; error?: string }>;
  borrarUsuario(id: string): Promise<void>;
  passwordGrant(email: string, password: string): Promise<{ ok: boolean; session?: Record<string, unknown> }>;
  dominio: string;
  esperar(ms: number): Promise<void>;
  ahora(): number;
}

export interface Respuesta {
  status: number;
  body: Record<string, unknown>;
}

const MENSAJES: Record<string, string> = {
  bad_code: 'La clave de la sección no es válida. Revísela con su profesor.',
  closed: 'La activación de cuentas de esta sección está cerrada. Consulte a su profesor.',
  id_taken: 'Ese ID ya tiene una cuenta. Entre con su ID y su contraseña; si la olvidó, pida al profesor que la restablezca.',
  invalid: 'El ID no es válido: use su matrícula (3 a 40 letras, dígitos, punto o guion).',
  rate_ip: 'Demasiados intentos con claves incorrectas. Espere una hora y vuelva a intentarlo.',
};

async function rpc<T>(d: ActivarDeps, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function activar(body: unknown, ipHash: string | null, d: ActivarDeps): Promise<Respuesta> {
  const inicio = d.ahora();
  const pausa = async () => {
    const resto = 600 - (d.ahora() - inicio);
    if (resto > 0) await d.esperar(resto);
  };
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const clave = typeof b.clave === 'string' ? b.clave.slice(0, 40) : '';
  const id = normalizarId(typeof b.id === 'string' ? b.id.slice(0, 80) : '');
  const nombre = (typeof b.nombre === 'string' ? b.nombre : '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const password = typeof b.password === 'string' ? b.password : '';

  if (!clave || !idValido(id)) return { status: 400, body: { error: !clave ? 'Escriba la clave de su sección.' : MENSAJES.invalid } };
  if (nombre.length < 5 || !/\s/.test(nombre)) return { status: 400, body: { error: 'Escriba su nombre y apellidos.' } };
  const problemas = problemasContrasena(password, id);
  if (problemas.length) return { status: 400, body: { error: problemas.join(' ') } };

  const chk = await rpc<{ ok: boolean; reason?: string; class_id?: string; group_id?: string | null; class_name?: string }>(d, 'svc_activation_check', {
    p_code: clave,
    p_login: id,
    p_ip_hash: ipHash,
  });
  if (!chk.ok) {
    await rpc(d, 'svc_activation_record', { p_ip_hash: ipHash, p_login: id, p_class: chk.class_id ?? null, p_success: false, p_reason: chk.reason ?? 'error' });
    await pausa();
    const status = chk.reason === 'rate_ip' ? 429 : chk.reason === 'id_taken' ? 409 : 400;
    return { status, body: { error: MENSAJES[chk.reason ?? ''] ?? 'No se pudo activar la cuenta.' } };
  }

  const email = correoTecnico(d.dominio);
  const creado = await d.crearUsuario({ email, password, app_metadata: { login_id: id, full_name: nombre, aula_role: 'student' } });
  if (!creado.id) {
    await rpc(d, 'svc_activation_record', { p_ip_hash: ipHash, p_login: id, p_class: chk.class_id, p_success: false, p_reason: 'error' });
    return { status: 500, body: { error: 'No se pudo crear la cuenta. Inténtelo de nuevo.' } };
  }
  try {
    await rpc(d, 'svc_account_activated', { p_user: creado.id, p_class: chk.class_id, p_group: chk.group_id ?? null });
  } catch (e) {
    // p. ej. dos activaciones simultáneas con el mismo ID: se deshace la cuenta recién creada
    await d.borrarUsuario(creado.id);
    await rpc(d, 'svc_activation_record', { p_ip_hash: ipHash, p_login: id, p_class: chk.class_id, p_success: false, p_reason: 'id_taken' });
    return { status: 409, body: { error: /uso/.test(String(e)) ? MENSAJES.id_taken : 'No se pudo activar la cuenta.' } };
  }
  await rpc(d, 'svc_activation_record', { p_ip_hash: ipHash, p_login: id, p_class: chk.class_id, p_success: true, p_reason: 'ok' });
  const s = await d.passwordGrant(email, password);
  return {
    status: 200,
    body: {
      seccion: chk.class_name,
      login_id: id,
      access_token: s.session?.access_token,
      refresh_token: s.session?.refresh_token,
    },
  };
}
