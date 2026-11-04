import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MENSAJES, recuperar, type Deps } from '../supabase/functions/recuperar/handler.ts';

const SECRETO = 'a'.repeat(64);
const OTRO = 'b'.repeat(64);
const SOL = '11111111-2222-4333-8444-555555555555';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function deps(resp: Record<string, unknown> = {}, token: { token_hash: string; tipo: string } | null = { token_hash: 'TH', tipo: 'magiclink' }) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const emitidos: string[] = [];
  let reloj = 0;
  const d: Deps = {
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      return { data: resp[fn] ?? null, error: null };
    },
    emitirToken: async (email) => {
      emitidos.push(email);
      return token;
    },
    sha256: async (s) => sha(s),
    esperar: async (ms) => {
      reloj += ms;
    },
    ahora: () => reloj,
  };
  return { d, llamadas, emitidos, reloj: () => reloj };
}

describe('recuperar · solicitar', () => {
  it('nunca envía el secreto al servidor de datos, solo su hash; devuelve id y código', async () => {
    const { d, llamadas } = deps({ svc_acceso_solicitar: { disponible: true, id: SOL, codigo: 'ACDEFG', expira: 'x' } });
    const r = await recuperar({ accion: 'solicitar', id: '2024-0001', destinatario: 'profesor', secreto: SECRETO }, 'iph', d, { device_hash: 'dh', browser: 'Chrome 130', device_type: 'teléfono' });
    expect(r).toEqual({ status: 200, body: { solicitud: SOL, codigo: 'ACDEFG', expira: 'x' } });
    expect(llamadas[0].args).toEqual({
      p_login: '2024-0001', p_destinatario: 'profesor', p_secreto_hash: sha(SECRETO), p_ip_hash: 'iph',
      p_meta: { device_hash: 'dh', browser: 'Chrome 130', device_type: 'teléfono' },
    });
    expect(JSON.stringify(llamadas)).not.toContain(SECRETO);
  });

  it('respuesta uniforme: misma forma y tiempo mínimo exista o no la cuenta (lo decide el servidor)', async () => {
    const a = deps({ svc_acceso_solicitar: { disponible: true, id: SOL, codigo: 'QQQQQQ', expira: 'x' } });
    const r = await recuperar({ accion: 'solicitar', id: 'no-existe', destinatario: 'monitor', secreto: SECRETO }, null, a.d);
    expect(Object.keys(r.body).sort()).toEqual(['codigo', 'expira', 'solicitud']);
    expect(a.reloj()).toBeGreaterThanOrEqual(600);
  });

  it('mensajes: desactivado (503), límite (429), formato (400) sin llamar a la base si la entrada es inválida', async () => {
    expect((await recuperar({ accion: 'solicitar', id: 'x1', destinatario: 'profesor', secreto: SECRETO }, null, deps({ svc_acceso_solicitar: { disponible: false } }).d)).status).toBe(503);
    expect((await recuperar({ accion: 'solicitar', id: 'x1', destinatario: 'profesor', secreto: SECRETO }, null, deps({ svc_acceso_solicitar: { disponible: true, limitado: true } }).d)).body).toEqual({ error: MENSAJES.limitado });
    const malo = deps();
    for (const b of [
      { accion: 'solicitar', id: '', destinatario: 'profesor', secreto: SECRETO },
      { accion: 'solicitar', id: 'x1', destinatario: 'admin', secreto: SECRETO },
      { accion: 'solicitar', id: 'x1', destinatario: 'profesor', secreto: 'corto' },
    ]) {
      const r = await recuperar(b, null, malo.d);
      expect(r.status).toBe(400);
    }
    expect(malo.llamadas).toHaveLength(0);
  });
});

describe('recuperar · estado y canje', () => {
  it('estado: pasa el hash del secreto y normaliza estados desconocidos', async () => {
    const { d, llamadas } = deps({ svc_acceso_estado: { estado: 'aprobada', expira: 'e', aprobada_hasta: 'h' } });
    expect((await recuperar({ accion: 'estado', solicitud: SOL, secreto: SECRETO }, null, d)).body).toEqual({ estado: 'aprobada', expira: 'e', aprobada_hasta: 'h' });
    expect(llamadas[0].args).toEqual({ p_id: SOL, p_secreto_hash: sha(SECRETO) });
    const raro = deps({ svc_acceso_estado: { estado: 'hackeado' } });
    expect((await recuperar({ accion: 'estado', solicitud: SOL, secreto: SECRETO }, null, raro.d)).body.estado).toBe('desconocida');
  });

  it('canje aprobado: token de un solo uso de Supabase Auth; nunca devuelve el correo técnico', async () => {
    const { d, emitidos } = deps({ svc_acceso_canjear: { ok: true, email: 'u1@cuentas.aula.invalid', user_id: 'U1' } });
    const r = await recuperar({ accion: 'completar', solicitud: SOL, secreto: SECRETO }, 'iph', d);
    expect(r).toEqual({ status: 200, body: { token_hash: 'TH', tipo: 'magiclink' } });
    expect(emitidos).toEqual(['u1@cuentas.aula.invalid']);
    expect(JSON.stringify(r.body)).not.toContain('cuentas.aula.invalid');
    expect(JSON.stringify(r.body)).not.toContain('U1');
  });

  it('canje no aprobado, de otro dispositivo o repetido: 409 y NO se emite token', async () => {
    const { d, emitidos } = deps({ svc_acceso_canjear: { ok: false, estado: 'completada' } });
    const r = await recuperar({ accion: 'completar', solicitud: SOL, secreto: OTRO }, null, d);
    expect(r.status).toBe(409);
    expect(emitidos).toHaveLength(0);
  });

  it('si Supabase Auth no emite el token (o emite un tipo inesperado) se registra el fallo y no se inventa nada', async () => {
    for (const token of [null, { token_hash: '', tipo: 'magiclink' }, { token_hash: 'TH', tipo: 'recovery' }]) {
      const { d, llamadas } = deps({ svc_acceso_canjear: { ok: true, email: 'u1@x' } }, token);
      const r = await recuperar({ accion: 'completar', solicitud: SOL, secreto: SECRETO }, null, d);
      expect(r).toEqual({ status: 502, body: { error: MENSAJES.sinToken } });
      expect(llamadas.map((l) => l.fn)).toEqual(['svc_acceso_canjear', 'svc_acceso_canje_fallido']);
    }
  });

  it('entradas inválidas y acciones desconocidas', async () => {
    const { d, llamadas } = deps();
    expect((await recuperar({ accion: 'completar', solicitud: 'no-uuid', secreto: SECRETO }, null, d)).status).toBe(400);
    expect((await recuperar({ accion: 'estado', solicitud: SOL, secreto: 'x' }, null, d)).status).toBe(400);
    expect((await recuperar({ accion: 'emitir_token', email: 'a@b' }, null, d)).status).toBe(400);
    expect((await recuperar(null, null, d)).status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });

  it('config: solo interruptores', async () => {
    const { d } = deps({ svc_acceso_config: { passkeys: true, recuperacion: false, monitores: false, minutos_solicitud: 30 } });
    expect((await recuperar({ accion: 'config' }, null, d)).body).toEqual({ passkeys: true, recuperacion: false, monitores: false, minutos_solicitud: 30 });
  });
});
