import { describe, expect, it } from 'vitest';
import { correoTecnico, generarContrasena, idValido, leerCsvCuentas, normalizarId, problemasContrasena } from '../supabase/functions/_shared/cuentas.ts';
import { acceder, MENSAJE_BLOQUEO, MENSAJE_GENERICO, type Deps } from '../supabase/functions/acceder/handler.ts';
import { AdminError, administrar, type AdminDeps } from '../supabase/functions/admin-cuentas/handler.ts';

describe('IDs y contraseñas', () => {
  it('normaliza IDs', () => {
    expect(normalizarId('  EST-100 ')).toBe('est-100');
    expect(idValido('2023-1234')).toBe(true);
    expect(idValido('ab')).toBe(false);
    expect(idValido('ana lópez')).toBe(false);
    expect(idValido('-abc')).toBe(false);
  });
  it('genera contraseñas provisionales fuertes y distintas', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = generarContrasena();
      expect(p).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
      expect(problemasContrasena(p)).toEqual([]);
      vistas.add(p);
    }
    expect(vistas.size).toBe(300);
  });
  it('correos técnicos aleatorios que no revelan el ID', () => {
    const a = correoTecnico('cuentas.aula.invalid');
    expect(a).toMatch(/^u[0-9a-f]{24}@cuentas\.aula\.invalid$/);
    expect(correoTecnico('x.invalid')).not.toBe(correoTecnico('x.invalid'));
  });
  it('reglas de la contraseña elegida por el usuario', () => {
    expect(problemasContrasena('corta1')).toContain('Debe tener al menos 10 caracteres.');
    expect(problemasContrasena('solamenteletras')).toContain('Debe combinar letras y números.');
    expect(problemasContrasena('Est-100-segura9', 'est-100')).toContain('No puede contener su ID.');
    expect(problemasContrasena('Fisica-Basica-2026', 'est-100')).toEqual([]);
  });
});

describe('importación CSV', () => {
  it('lee «;» con acentos, comillas, roles y secciones', () => {
    const r = leerCsvCuentas('﻿ID;Nombre;Matrícula;Rol;Secciones\n100-001;"López, Ana";2023-001;estudiante;FB-01|FG1-02\nPROF-9;Juan Pérez;;profesor;\n\n');
    expect(r.errores).toEqual([]);
    expect(r.filas).toEqual([
      { login_id: '100-001', full_name: 'López, Ana', student_code: '2023-001', role: 'student', secciones: ['FB-01', 'FG1-02'] },
      { login_id: 'prof-9', full_name: 'Juan Pérez', student_code: undefined, role: 'teacher', secciones: [] },
    ]);
  });
  it('lee «,» y detecta errores por línea', () => {
    const r = leerCsvCuentas('id,nombre\nab,Corto\nok-123,\nok-124,Ana\nOK-124,Ana bis');
    expect(r.filas.map((f) => f.login_id)).toEqual(['ok-124']);
    expect(r.errores.map((e) => e.linea)).toEqual([2, 3, 5]);
  });
  it('exige encabezado', () => {
    expect(leerCsvCuentas('a;b\n1;2').errores[0].mensaje).toMatch(/id.*nombre/);
  });
});

function depsAcceso(over: Partial<Record<string, unknown>> = {}) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  let reloj = 0;
  const esperas: number[] = [];
  const d: Deps = {
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_login_check') return { data: over.check ?? { allowed: true, login: 'est-100', user_id: 'u1', email: 'u1@x.invalid', active: true }, error: null };
      if (fn === 'svc_login_record') return { data: { must_change_password: over.mustChange ?? false }, error: null };
      return { data: null, error: null };
    },
    passwordGrant: async (_e, pw) => (pw === 'correcta-123' ? { ok: true, session: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } } : { ok: false }),
    esperar: async (ms) => {
      esperas.push(ms);
      reloj += ms;
    },
    ahora: () => reloj,
  };
  return { d, llamadas, esperas };
}

describe('Edge Function «acceder»', () => {
  it('acceso correcto: devuelve la sesión y registra el éxito', async () => {
    const { d, llamadas } = depsAcceso({ mustChange: true });
    const r = await acceder({ id: 'EST-100', password: 'correcta-123' }, 'iph', d);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, must_change_password: true });
    expect(llamadas.at(-1)).toMatchObject({ fn: 'svc_login_record', args: { p_success: true, p_reason: 'ok', p_ip_hash: 'iph' } });
    expect(JSON.stringify(llamadas)).not.toContain('correcta-123');
  });
  it('misma respuesta y mismo tiempo mínimo para contraseña incorrecta, ID inexistente o cuenta suspendida', async () => {
    const casos = [
      depsAcceso(),
      depsAcceso({ check: { allowed: true, login: 'nadie', user_id: null, email: null, active: false } }),
      depsAcceso({ check: { allowed: true, login: 'est-100', user_id: 'u1', email: 'u1@x', active: false } }),
    ];
    const razones: string[] = [];
    for (const c of casos) {
      const r = await acceder({ id: 'x-123', password: 'mala-clave-1' }, null, c.d);
      expect(r).toEqual({ status: 401, body: { error: MENSAJE_GENERICO } });
      expect(c.esperas.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(700);
      razones.push(String(c.llamadas.at(-1)?.args.p_reason));
    }
    expect(razones).toEqual(['bad_password', 'unknown_id', 'suspended']);
  });
  it('bloqueo por demasiados intentos', async () => {
    const { d, llamadas } = depsAcceso({ check: { allowed: false, reason: 'locked', login: 'est-100' } });
    const r = await acceder({ id: 'est-100', password: 'correcta-123' }, 'iph', d);
    expect(r).toEqual({ status: 429, body: { error: MENSAJE_BLOQUEO } });
    expect(llamadas.map((l) => l.fn)).toEqual(['svc_login_check', 'svc_login_record']);
  });
  it('rechaza cuerpos inválidos sin consultar la base de datos', async () => {
    const { d, llamadas } = depsAcceso();
    expect((await acceder({ id: 'a' }, null, d)).status).toBe(400);
    expect((await acceder(null, null, d)).status).toBe(400);
    expect(llamadas).toEqual([]);
  });
});

function depsAdmin(esAdmin = true) {
  const creados: { email: string; password: string; app_metadata: Record<string, unknown> }[] = [];
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const actualizaciones: { id: string; cambios: Record<string, unknown> }[] = [];
  const d: AdminDeps = {
    dominio: 'cuentas.aula.invalid',
    rpc: async (fn, args) => {
      llamadas.push({ fn, args });
      if (fn === 'svc_is_admin') return { data: esAdmin, error: null };
      if (fn === 'svc_login_taken') return { data: args.p_login === 'ya-existe', error: null };
      if (fn === 'svc_enroll') return { data: (args.p_classes as string[]).length, error: null };
      if (fn === 'svc_account_issued') return { data: { login_id: 'est-1', full_name: 'Uno' }, error: null };
      return { data: null, error: null };
    },
    crearUsuario: async (u) => {
      creados.push(u);
      return { id: `id-${creados.length}` };
    },
    actualizarUsuario: async (id, cambios) => {
      actualizaciones.push({ id, cambios });
      return {};
    },
  };
  return { d, creados, llamadas, actualizaciones };
}

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const CLASE = '33333333-3333-4333-8333-333333333333';

describe('Edge Function «admin-cuentas»', () => {
  it('solo administradores', async () => {
    const { d } = depsAdmin(false);
    await expect(administrar({ accion: 'crear', cuentas: [] }, ADMIN, d)).rejects.toMatchObject({ status: 403 });
  });
  it('crea cuentas con contraseña provisional, correo técnico y matrícula', async () => {
    const { d, creados, llamadas } = depsAdmin();
    const r = (await administrar(
      {
        accion: 'crear',
        cuentas: [
          { login_id: ' EST-1 ', full_name: 'Uno', class_ids: [CLASE, 'no-uuid'] },
          { login_id: 'ya-existe', full_name: 'Dos' },
          { login_id: 'x', full_name: 'Tres' },
          { login_id: 'est-1', full_name: 'Repetido' },
          { login_id: 'prof-1', full_name: 'Profe', role: 'teacher' },
        ],
      },
      ADMIN,
      d,
    )) as { resultados: { login_id: string; password?: string; error?: string; matriculas?: number }[] };
    expect(r.resultados.map((x) => x.error ?? 'ok')).toEqual(['ok', 'Ese ID ya existe', 'ID inválido', 'Ese ID ya existe', 'ok']);
    expect(r.resultados[0].password).toMatch(/^.{4}-.{4}-.{4}$/);
    expect(r.resultados[0].matriculas).toBe(1);
    expect(creados[0].email).toMatch(/@cuentas\.aula\.invalid$/);
    expect(creados[0].email).not.toContain('est-1');
    expect(creados[0].app_metadata).toMatchObject({ login_id: 'est-1', aula_role: 'student' });
    expect(creados[1].app_metadata).toMatchObject({ aula_role: 'teacher' });
    // la contraseña nunca viaja a la base de datos
    expect(JSON.stringify(llamadas)).not.toContain(r.resultados[0].password!);
  });
  it('restablecer y suspender', async () => {
    const { d, actualizaciones } = depsAdmin();
    const r = (await administrar({ accion: 'restablecer', user_id: OTRO }, ADMIN, d)) as { password: string };
    expect(r.password).toMatch(/^.{4}-.{4}-.{4}$/);
    expect(actualizaciones[0]).toMatchObject({ id: OTRO, cambios: { ban_duration: 'none' } });
    await administrar({ accion: 'suspender', user_id: OTRO, suspender: true }, ADMIN, d);
    expect(actualizaciones[1]).toEqual({ id: OTRO, cambios: { ban_duration: '876000h' } });
    await expect(administrar({ accion: 'restablecer', user_id: ADMIN }, ADMIN, d)).rejects.toBeInstanceOf(AdminError);
    await expect(administrar({ accion: 'borrar' }, ADMIN, d)).rejects.toMatchObject({ status: 400 });
  });
});
