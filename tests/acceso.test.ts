/**
 * Acceso sin contraseña: lógica del cliente y flujo completo SIMULADO dispositivo ↔ Edge Function «recuperar» ↔
 * Supabase Auth (GoTrue simulado: tokens de un solo uso). La base de datos se prueba en supabase/pruebas/acceso_recuperacion.sql.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_PESTANA, borrarPendiente, esFinal, formatoCodigo, guardarPendiente, leerPendiente, normalizarCodigo, pasoRecuperacion, restante, secretoHex,
  soportaPasskeys, type EstadoSolicitud, type Pendiente,
} from '@/lib/acceso';
import { recuperar, type Deps } from '../supabase/functions/recuperar/handler.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('lógica del cliente', () => {
  it('secreto del dispositivo: 32 bytes → 64 hex', () => {
    expect(secretoHex(new Uint8Array(32).fill(171))).toBe('ab'.repeat(32));
    expect(() => secretoHex(new Uint8Array(16))).toThrow();
  });

  it('códigos: formato legible y normalización de lo que se escribe', () => {
    expect(formatoCodigo('acdefg')).toBe('ACD EFG');
    expect(normalizarCodigo(' acd-efg ')).toBe('ACDEFG');
    expect(normalizarCodigo('ACD EFG XYZ')).toBe('ACDEFG');
  });

  it('tiempo restante', () => {
    expect(restante('2026-11-04T10:05:30Z', Date.parse('2026-11-04T10:00:00Z'))).toBe('5:30');
    expect(restante('2026-11-04T10:00:00Z', Date.parse('2026-11-04T10:00:09Z'))).toBe('0:00');
  });

  it('solicitud en curso: se descarta si venció o está corrupta', () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const p: Pendiente = { solicitud: 'S', secreto: 'a'.repeat(64), codigo: 'ACDEFG', expira: '2026-11-04T10:30:00Z', destinatario: 'profesor' };
    guardarPendiente(s, p);
    expect(leerPendiente(s, Date.parse('2026-11-04T10:00:00Z'))).toEqual(p);
    expect(leerPendiente(s, Date.parse('2026-11-04T10:31:00Z'))).toBeNull();
    mem.set('aula-recuperacion', '{"solicitud":"S","secreto":"corto","expira":"2099-01-01"}');
    expect(leerPendiente(s, 0)).toBeNull();
    mem.set('aula-recuperacion', 'no es json');
    expect(leerPendiente(s, 0)).toBeNull();
    borrarPendiente(s);
    expect(mem.size).toBe(0);
  });

  it('pestañas y estados finales', () => {
    expect(ESTADOS_PESTANA.pendientes).toEqual(['pendiente']);
    expect(ESTADOS_PESTANA.aprobadas).toContain('completada');
    expect((['pendiente', 'aprobada'] as EstadoSolicitud[]).some(esFinal)).toBe(false);
    expect((['rechazada', 'vencida', 'revocada', 'cancelada', 'completada', 'desconocida'] as EstadoSolicitud[]).every(esFinal)).toBe(true);
  });

  it('passkeys: solo con WebAuthn y contexto seguro', () => {
    expect(soportaPasskeys({ PublicKeyCredential: function () {}, isSecureContext: true })).toBe(true);
    expect(soportaPasskeys({ isSecureContext: true })).toBe(false);
    expect(soportaPasskeys({ PublicKeyCredential: function () {}, isSecureContext: false })).toBe(false);
    expect(soportaPasskeys(undefined)).toBe(false);
  });
});

/** Servidor simulado: solicitudes (como la base) + GoTrue con tokens de un solo uso. */
function servidor() {
  const sol = new Map<string, { secretoHash: string; estado: EstadoSolicitud; email: string | null }>();
  const tokens = new Map<string, string>();   // token_hash → email (GoTrue)
  const sesiones: string[] = [];
  let n = 0;
  const deps: Deps = {
    rpc: async (fn, a) => {
      if (fn === 'svc_acceso_solicitar') {
        const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
        sol.set(id, { secretoHash: a.p_secreto_hash as string, estado: 'pendiente', email: a.p_login === 'est-1' ? 'u1@cuentas.aula.invalid' : null });
        return { data: { disponible: true, id, codigo: 'ACDEFG', expira: '2099-01-01T00:00:00Z' }, error: null };
      }
      const s = sol.get(a.p_id as string);
      const propio = !!s && s.secretoHash === a.p_secreto_hash;
      if (fn === 'svc_acceso_estado') return { data: { estado: propio ? s!.estado : 'desconocida' }, error: null };
      if (fn === 'svc_acceso_canjear') {
        if (!propio || s!.estado !== 'aprobada' || !s!.email) return { data: { ok: false, estado: s?.estado }, error: null };
        s!.estado = 'completada';
        return { data: { ok: true, email: s!.email }, error: null };
      }
      return { data: null, error: null };
    },
    emitirToken: async (email) => {
      const t = `th-${tokens.size + 1}`;
      tokens.set(t, email);
      return { token_hash: t, tipo: 'magiclink' };
    },
    sha256: async (x) => sha(x),
    esperar: async () => undefined,
    ahora: () => 0,
  };
  const edge = async (body: Record<string, unknown>) => {
    const r = await recuperar(body, null, deps);
    if (r.status !== 200) throw new Error(String(r.body.error));
    return r.body;
  };
  const verificarOtp = async (token_hash: string) => {
    const email = tokens.get(token_hash);
    if (!email) return { error: new Error('Token has expired or is invalid') };
    tokens.delete(token_hash);   // un solo uso
    sesiones.push(email);
    return { error: null };
  };
  const dispositivo = (secreto: string) => ({
    estado: (solicitud: string) => edge({ accion: 'estado', solicitud, secreto }) as Promise<{ estado: EstadoSolicitud }>,
    completar: (solicitud: string) => edge({ accion: 'completar', solicitud, secreto }) as Promise<{ token_hash: string; tipo: 'magiclink' }>,
    verificarOtp,
  });
  return { sol, tokens, sesiones, edge, verificarOtp, dispositivo };
}

describe('flujo completo simulado', () => {
  it('pendiente → (aprobación presencial) → canje → Supabase Auth crea la sesión; el token no se reutiliza', async () => {
    const srv = servidor();
    const secreto = 'c'.repeat(64);
    const { solicitud } = (await srv.edge({ accion: 'solicitar', id: 'est-1', destinatario: 'profesor', secreto })) as { solicitud: string };
    const p = { solicitud, secreto };
    expect(await pasoRecuperacion(p, srv.dispositivo(secreto))).toEqual({ estado: 'pendiente', sesion: false });
    expect(srv.sesiones).toHaveLength(0);
    srv.sol.get(solicitud)!.estado = 'aprobada';   // el profesor/monitor aprobó en el panel
    expect(await pasoRecuperacion(p, srv.dispositivo(secreto))).toEqual({ estado: 'completada', sesion: true });
    expect(srv.sesiones).toEqual(['u1@cuentas.aula.invalid']);
    expect(srv.tokens.size).toBe(0);
    expect((await srv.verificarOtp('th-1')).error).toBeTruthy();   // reutilizar el token: rechazado por GoTrue
    expect(await pasoRecuperacion(p, srv.dispositivo(secreto))).toEqual({ estado: 'completada', sesion: false });
  });

  it('otro dispositivo (sin el secreto) no puede ver ni canjear la aprobación', async () => {
    const srv = servidor();
    const { solicitud } = (await srv.edge({ accion: 'solicitar', id: 'est-1', destinatario: 'monitor', secreto: 'c'.repeat(64) })) as { solicitud: string };
    srv.sol.get(solicitud)!.estado = 'aprobada';
    const ladron = srv.dispositivo('d'.repeat(64));
    expect(await pasoRecuperacion({ solicitud, secreto: 'd'.repeat(64) }, ladron)).toEqual({ estado: 'desconocida', sesion: false });
    await expect(ladron.completar(solicitud)).rejects.toThrow();
    expect(srv.sesiones).toHaveLength(0);
    expect(srv.sol.get(solicitud)!.estado).toBe('aprobada');   // sigue disponible para el dispositivo legítimo
  });

  it('rechazada, revocada o vencida: nunca hay sesión', async () => {
    for (const estado of ['rechazada', 'revocada', 'vencida', 'cancelada'] as EstadoSolicitud[]) {
      const srv = servidor();
      const secreto = 'e'.repeat(64);
      const { solicitud } = (await srv.edge({ accion: 'solicitar', id: 'est-1', destinatario: 'profesor', secreto })) as { solicitud: string };
      srv.sol.get(solicitud)!.estado = estado;
      expect(await pasoRecuperacion({ solicitud, secreto }, srv.dispositivo(secreto))).toEqual({ estado, sesion: false });
      await expect(srv.dispositivo(secreto).completar(solicitud)).rejects.toThrow();
      expect(srv.sesiones).toHaveLength(0);
    }
  });

  it('si Supabase Auth rechaza el token, el paso falla (no se inventa una sesión)', async () => {
    const srv = servidor();
    const secreto = 'f'.repeat(64);
    const { solicitud } = (await srv.edge({ accion: 'solicitar', id: 'est-1', destinatario: 'profesor', secreto })) as { solicitud: string };
    srv.sol.get(solicitud)!.estado = 'aprobada';
    const d = { ...srv.dispositivo(secreto), verificarOtp: async () => ({ error: new Error('Token has expired or is invalid') }) };
    await expect(pasoRecuperacion({ solicitud, secreto }, d)).rejects.toThrow('expired');
    expect(srv.sesiones).toHaveLength(0);
  });
});

describe('el frontend no fabrica sesiones', () => {
  it('ningún archivo del acceso escribe tokens o sesiones a mano', async () => {
    const fs = await import('node:fs');
    for (const f of ['src/pages/publico/Recuperar.tsx', 'src/pages/estudiante/Passkeys.tsx', 'src/lib/acceso.ts', 'src/api/acceso.ts', 'src/pages/docente/GestionAcceso.tsx', 'orbe-control/src/AccesoOrbe.tsx']) {
      const t = fs.readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/setSession\(|localStorage\.setItem\([^)]*(token|sesion|session)|access_token|refresh_token|service_role|jwt\.sign|btoa\(/i);
    }
  });
});
