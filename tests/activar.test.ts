import { describe, expect, it } from 'vitest';
import { activar, type ActivarDeps } from '../supabase/functions/activar/handler.ts';

function deps(check: Record<string, unknown> = { ok: true, login: 'est-1', class_id: 'C1', group_id: null, class_name: 'Física Básica' }, falloAlta = false) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const creados: { email: string; password: string; app_metadata: Record<string, unknown> }[] = [];
  const borrados: string[] = [];
  let reloj = 0;
  const d: ActivarDeps = {
    dominio: 'cuentas.aula.invalid',
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_activation_check') return { data: check, error: null };
      if (fn === 'svc_account_activated' && falloAlta) return { data: null, error: { message: 'Ese ID ya está en uso' } };
      return { data: { login_id: 'est-1' }, error: null };
    },
    crearUsuario: async (u) => {
      creados.push(u);
      return { id: 'U1' };
    },
    borrarUsuario: async (id) => {
      borrados.push(id);
    },
    passwordGrant: async () => ({ ok: true, session: { access_token: 'AT', refresh_token: 'RT' } }),
    esperar: async (ms) => {
      reloj += ms;
    },
    ahora: () => reloj,
  };
  return { d, llamadas, creados, borrados };
}

const valido = { clave: 'ABCD-2345', id: 'EST-1', nombre: 'Ana López Pérez', password: 'Fisica-2026-ok' };

describe('Edge Function «activar»', () => {
  it('crea la cuenta con la contraseña elegida, la matricula en su sección e inicia sesión', async () => {
    const { d, llamadas, creados } = deps();
    const r = await activar(valido, 'iph', d);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ seccion: 'Física Básica', login_id: 'est-1', access_token: 'AT', refresh_token: 'RT' });
    expect(creados[0].app_metadata).toEqual({ login_id: 'est-1', full_name: 'Ana López Pérez', aula_role: 'student' });
    expect(creados[0].email).toMatch(/^u[0-9a-f]+@cuentas\.aula\.invalid$/);
    expect(llamadas.find((l) => l.fn === 'svc_account_activated')?.args).toEqual({ p_user: 'U1', p_class: 'C1', p_group: null });
    expect(JSON.stringify(llamadas)).not.toContain(valido.password);
  });
  it('valida antes de consultar la base de datos', async () => {
    for (const malo of [
      { ...valido, clave: '' },
      { ...valido, id: 'a b' },
      { ...valido, nombre: 'Ana' },
      { ...valido, password: 'corta1' },
      { ...valido, password: 'est-1-larga-123' },
    ]) {
      const { d, llamadas } = deps();
      const r = await activar(malo, null, d);
      expect(r.status).toBe(400);
      expect(llamadas).toEqual([]);
    }
  });
  it('clave incorrecta, sección cerrada, ID ocupado y bloqueo por IP', async () => {
    const casos: [string, number, RegExp][] = [
      ['bad_code', 400, /clave/],
      ['closed', 400, /cerrada/],
      ['id_taken', 409, /ya tiene una cuenta/],
      ['rate_ip', 429, /Demasiados/],
    ];
    for (const [reason, status, msg] of casos) {
      const { d, llamadas, creados } = deps({ ok: false, reason });
      const r = await activar(valido, 'iph', d);
      expect(r.status).toBe(status);
      expect(String(r.body.error)).toMatch(msg);
      expect(creados).toEqual([]);
      expect(llamadas.at(-1)).toMatchObject({ fn: 'svc_activation_record', args: { p_success: false, p_reason: reason } });
    }
  });
  it('si el alta falla después de crear el usuario, lo borra', async () => {
    const { d, borrados } = deps(undefined, true);
    const r = await activar(valido, null, d);
    expect(r.status).toBe(409);
    expect(borrados).toEqual(['U1']);
  });
});
