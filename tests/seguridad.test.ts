/**
 * Controles de seguridad estáticos sobre el código y las migraciones:
 *  - el frontend no importa contenido privado ni claves;
 *  - todas las tablas tienen RLS y anon no recibe privilegios;
 *  - las funciones SECURITY DEFINER fijan search_path;
 *  - las funciones de servicio no son ejecutables por usuarios;
 *  - privado/ está excluido de git;
 *  - si existe dist/, no contiene textos de las claves.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, loadContent } from '../scripts/cargar-contenido';

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, exts) : exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const sql = readdirSync(join(ROOT, 'supabase', 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8'))
  .join('\n');

describe('frontend', () => {
  const files = walk(join(ROOT, 'src'), ['.ts', '.tsx']);
  it('no importa contenido/, privado/ ni scripts/', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, relative(ROOT, f)).not.toMatch(/from\s+['"][^'"]*(contenido|privado|scripts)\//);
    }
  });
  it('no usa la clave service_role ni la menciona en variables VITE_', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, relative(ROOT, f)).not.toMatch(/service_role|SERVICE_ROLE/i);
    }
  });
  it('no lee la tabla exercise_keys como estudiante (solo en el panel docente)', () => {
    for (const f of files.filter((x) => !x.includes(join('pages', 'docente')) && !x.endsWith(join('api', 'docente.ts')))) {
      expect(readFileSync(f, 'utf8'), relative(ROOT, f)).not.toMatch(/exercise_keys/);
    }
  });
  it('no inserta HTML sin sanear', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const uses = src.match(/dangerouslySetInnerHTML/g)?.length ?? 0;
      if (uses) {
        // solo se permite con KaTeX (renderToString escapa el texto)
        expect(src, relative(ROOT, f)).toMatch(/katex\.renderToString/);
      }
    }
  });
});

describe('migraciones', () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
  it('todas las tablas tienen RLS activado', () => {
    expect(tables.length).toBeGreaterThan(10);
    for (const t of tables) expect(sql, t).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });
  it('anon no recibe privilegios', () => {
    expect(sql).not.toMatch(/grant[^;]*to[^;]*\banon\b/i);
    expect(sql).toMatch(/revoke all on all tables in schema public from anon, authenticated/);
  });
  it('toda función SECURITY DEFINER fija search_path', () => {
    const fns = sql.split(/create or replace function/).slice(1);
    for (const f of fns) {
      const header = f.slice(0, f.indexOf('$$'));
      if (/security definer/.test(header)) expect(header, header.slice(0, 80)).toMatch(/set search_path = ''/);
    }
  });
  it('las funciones svc_* y bootstrap_admin no se conceden a usuarios', () => {
    const grants = [...sql.matchAll(/grant execute on function([\s\S]*?)to (\w+);/g)];
    for (const [, list, role] of grants) {
      if (role !== 'service_role') {
        expect(list).not.toMatch(/svc_|bootstrap_admin|save_response_for|recompute_attempt/);
      }
    }
    expect(sql).toMatch(/revoke execute on all functions in schema public from public, anon, authenticated/);
  });
  it('exercise_keys solo tiene políticas para profesorado', () => {
    const policies = [...sql.matchAll(/create policy \w+ on public\.exercise_keys[\s\S]*?;/g)].map((m) => m[0]);
    expect(policies.length).toBe(4);
    for (const p of policies) expect(p).toMatch(/can_view_keys|is_course_staff/);
  });
  it('intentos y respuestas no se pueden escribir directamente', () => {
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]*on public\.(attempts|responses|response_events)/i);
  });
  it('el rol del perfil no lo puede cambiar el propio usuario', () => {
    expect(sql).toMatch(/grant update \(full_name, student_code\) on public\.profiles to authenticated/);
    expect(sql).toMatch(/'student' -- nunca se toma el rol de los metadatos del cliente/);
  });
});

describe('cuentas gestionadas por el administrador', () => {
  const src = walk(join(ROOT, 'src'), ['.ts', '.tsx']).map((f) => ({ f, s: readFileSync(f, 'utf8') }));
  it('el frontend no registra cuentas ni usa la API de administración de Auth', () => {
    for (const { f, s } of src) {
      expect(s, relative(ROOT, f)).not.toMatch(/auth\.signUp|auth\.admin|signInWithPassword/);
    }
  });
  it('la gestión de cuentas solo se invoca desde la API del panel docente', () => {
    for (const { f, s } of src.filter((x) => !x.f.endsWith(join('api', 'docente.ts')))) {
      expect(s, relative(ROOT, f)).not.toMatch(/['"]admin-cuentas['"]/);
    }
  });
  it('los registros de acceso y auditoría no se pueden escribir desde la API', () => {
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]*on public\.(login_attempts|account_events)/i);
    for (const t of ['login_attempts', 'account_events']) expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });
  it('el perfil nace inactivo si el ID no lo asignó el servidor (app_metadata)', () => {
    expect(sql).toMatch(/v_login is not null,\s+-- sin ID asignado por el servidor/);
    expect(sql).not.toMatch(/raw_user_meta_data\s*->>\s*'(aula_role|login_id|role)'/);
  });
  it('las Edge Functions de cuentas no devuelven ni registran contraseñas salvo la provisional recién creada', () => {
    const acceder = readFileSync(join(ROOT, 'supabase', 'functions', 'acceder', 'handler.ts'), 'utf8');
    expect(acceder).not.toMatch(/p_password|password:\s*password/);
    const admin = readFileSync(join(ROOT, 'supabase', 'functions', 'admin-cuentas', 'handler.ts'), 'utf8');
    expect(admin).not.toMatch(/rpc\([^)]*password/);
  });
  it('ninguna migración contiene operaciones destructivas sin autorizar', async () => {
    const { revisarMigraciones } = await import('../scripts/ops/lint-migraciones');
    expect(revisarMigraciones().filter((p) => p.nivel === 'error')).toEqual([]);
  });
});

describe('repositorio', () => {
  it('privado/ está en .gitignore', () => {
    const gi = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(gi).toMatch(/^privado\/$/m);
    expect(gi).toMatch(/^\.env$/m);
  });
  it('ningún archivo del repositorio contiene tokens, claves secretas ni cadenas de conexión', () => {
    const archivos = walk(ROOT, ['.ts', '.tsx', '.json', '.md', '.sql', '.toml', '.yml', '.env', '.example', '.js', '.html']).filter(
      // .claude/ y .mcp.json son configuración local de la herramienta (no forman parte del repositorio)
      (f) => !/[\\/](node_modules|privado|dist|\.git|\.claude)[\\/]/.test(f) && !/[\\/]\.mcp\.json$/.test(f),
    );
    for (const f of archivos) {
      const s = readFileSync(f, 'utf8');
      expect(s, relative(ROOT, f)).not.toMatch(/sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{16,}|postgres(ql)?:\/\/[^\s:@/]+:[^\s@[\]]{6,}@/);
    }
  });
  it('contenido/ no contiene claves', async () => {
    for (const f of walk(join(ROOT, 'contenido'), ['.ts']).filter((x) => !x.endsWith('tipos.ts'))) {
      const src = readFileSync(f, 'utf8');
      expect(src, relative(ROOT, f)).not.toMatch(/\b(correct|explanation|hints|rubric|modelJustification)\s*:/);
    }
  });
});

describe.skipIf(!existsSync(join(ROOT, 'dist')))('compilación publicada (dist/)', () => {
  it('no contiene explicaciones ni pistas de las claves', async () => {
    const units = await loadContent();
    const secrets = units
      .flatMap((u) => u.lessons.flatMap((l) => Object.values(l.keys ?? {})))
      .flatMap((k) => [k.explanation, ...k.hints])
      .filter((s) => s && s.length > 40)
      .map((s) => s.slice(0, 40));
    const bundle = walk(join(ROOT, 'dist'), ['.js', '.html', '.css', '.json']).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const s of secrets) expect(bundle.includes(s), s).toBe(false);
  });
});
