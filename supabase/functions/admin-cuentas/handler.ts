/**
 * Administración de cuentas (lógica pura, probada con Vitest). Solo administradores.
 *
 * Acciones:
 *  - crear       { cuentas: [{ login_id, full_name, student_code?, role?, class_ids? }] }  (hasta 300)
 *  - restablecer { user_id }   → nueva contraseña provisional
 *  - suspender   { user_id, suspender: boolean }
 *
 * Las contraseñas provisionales se generan aquí, se entregan UNA sola vez en la respuesta y no se guardan
 * en ningún sitio: Supabase Auth almacena solo su hash bcrypt.
 */
import { correoTecnico, generarContrasena, LOGIN_RE, normalizarId } from '../_shared/cuentas.ts';

export interface AdminDeps {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  crearUsuario(u: { email: string; password: string; app_metadata: Record<string, unknown> }): Promise<{ id?: string; error?: string }>;
  actualizarUsuario(id: string, cambios: { password?: string; ban_duration?: string }): Promise<{ error?: string }>;
  dominio: string;
}

export class AdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc<T>(d: AdminDeps, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) throw new AdminError(error.code === '42501' ? 403 : 400, error.message);
  return data as T;
}

export interface ResultadoCreacion {
  login_id: string;
  full_name: string;
  password?: string;
  matriculas?: number;
  error?: string;
}

export async function administrar(body: unknown, actor: string, d: AdminDeps): Promise<unknown> {
  if (!(await rpc<boolean>(d, 'svc_is_admin', { p_user: actor }))) throw new AdminError(403, 'Solo un administrador puede gestionar cuentas.');
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  switch (b.accion) {
    case 'crear': {
      const cuentas = Array.isArray(b.cuentas) ? b.cuentas : [];
      if (!cuentas.length || cuentas.length > 300) throw new AdminError(400, 'Envíe entre 1 y 300 cuentas.');
      const resultados: ResultadoCreacion[] = [];
      const vistos = new Set<string>();
      for (const raw of cuentas as Record<string, unknown>[]) {
        const login = normalizarId(String(raw?.login_id ?? ''));
        const nombre = String(raw?.full_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const rol = raw?.role === 'teacher' ? 'teacher' : 'student';
        const clases = (Array.isArray(raw?.class_ids) ? raw.class_ids : []).filter((x): x is string => typeof x === 'string' && UUID.test(x));
        if (!LOGIN_RE.test(login)) {
          resultados.push({ login_id: login, full_name: nombre, error: 'ID inválido' });
          continue;
        }
        if (!nombre) {
          resultados.push({ login_id: login, full_name: nombre, error: 'Falta el nombre' });
          continue;
        }
        if (vistos.has(login) || (await rpc<boolean>(d, 'svc_login_taken', { p_login: login }))) {
          resultados.push({ login_id: login, full_name: nombre, error: 'Ese ID ya existe' });
          continue;
        }
        vistos.add(login);
        const password = generarContrasena();
        const creado = await d.crearUsuario({
          email: correoTecnico(d.dominio),
          password,
          app_metadata: {
            login_id: login,
            full_name: nombre,
            aula_role: rol,
            ...(raw?.student_code ? { student_code: String(raw.student_code).slice(0, 40) } : {}),
          },
        });
        if (!creado.id) {
          resultados.push({ login_id: login, full_name: nombre, error: 'No se pudo crear la cuenta' });
          continue;
        }
        await rpc(d, 'svc_account_issued', { p_actor: actor, p_user: creado.id, p_action: 'create' });
        const matriculas = clases.length ? await rpc<number>(d, 'svc_enroll', { p_actor: actor, p_user: creado.id, p_classes: clases }) : 0;
        resultados.push({ login_id: login, full_name: nombre, password, matriculas });
      }
      return { resultados };
    }
    case 'restablecer': {
      const id = String(b.user_id ?? '');
      if (!UUID.test(id)) throw new AdminError(400, 'Cuenta inválida.');
      if (id === actor) throw new AdminError(400, 'Para su propia cuenta use «Cambiar contraseña» en su perfil.');
      const password = generarContrasena();
      const r = await d.actualizarUsuario(id, { password, ban_duration: 'none' });
      if (r.error) throw new AdminError(400, 'No se pudo restablecer la contraseña.');
      const perfil = await rpc<{ login_id: string; full_name: string }>(d, 'svc_account_issued', { p_actor: actor, p_user: id, p_action: 'reset_password' });
      return { login_id: perfil.login_id, full_name: perfil.full_name, password };
    }
    case 'suspender': {
      const id = String(b.user_id ?? '');
      if (!UUID.test(id)) throw new AdminError(400, 'Cuenta inválida.');
      const suspender = b.suspender === true;
      await rpc(d, 'svc_set_suspended', { p_actor: actor, p_user: id, p_suspend: suspender });
      // además se bloquea en Supabase Auth: no podrá iniciar sesión ni renovar la sesión
      const r = await d.actualizarUsuario(id, { ban_duration: suspender ? '876000h' : 'none' });
      if (r.error) throw new AdminError(500, 'La cuenta quedó marcada, pero no se pudo bloquear en Auth. Reintente.');
      return { ok: true };
    }
    default:
      throw new AdminError(400, 'Acción desconocida.');
  }
}
