/**
 * npm run estado — SOLO LECTURA. Compara el código local con producción:
 * migraciones, Edge Functions, configuración de Auth, datos protegidos y git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  conectar,
  contarFilas,
  credenciales,
  ESTADO,
  funcionesLocales,
  gestion,
  hashFuncion,
  migracionesAplicadas,
  migracionesLocales,
  ocultar,
  ROOT,
  TABLAS_PROTEGIDAS,
  ultimoRespaldo,
} from './comun';

export const AUTH_DESEADO = join(ROOT, 'supabase', 'auth-deseado.json');

export function diferenciasAuth(actual: Record<string, unknown>): { clave: string; actual: unknown; deseado: unknown }[] {
  const deseado = JSON.parse(readFileSync(AUTH_DESEADO, 'utf8')) as Record<string, unknown>;
  return Object.entries(deseado)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([k, v]) => JSON.stringify(actual[k]) !== JSON.stringify(v))
    .map(([k, v]) => ({ clave: k, actual: actual[k], deseado: v }));
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export async function comandoEstado(): Promise<number> {
  const c = credenciales();
  console.log('═══ ESTADO DEL AULA VIRTUAL ═══\n');

  // --- git / GitHub Pages ---
  const cambios = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
  const rama = git(['rev-parse', '--abbrev-ref', 'HEAD']) || '(sin commits)';
  const remoto = git(['remote', 'get-url', 'origin']);
  const sinSubir = remoto ? git(['rev-list', '--count', '@{u}..HEAD']) : '';
  console.log('Código y GitHub');
  console.log(`  rama: ${rama} · archivos con cambios sin confirmar: ${cambios}`);
  console.log(`  remoto: ${remoto || 'NO CONFIGURADO (GitHub Pages no se actualizará)'}${sinSubir ? ` · commits sin subir: ${sinSubir}` : ''}`);

  // --- migraciones ---
  const locales = migracionesLocales();
  console.log('\nMigraciones');
  if (!c.SUPABASE_DB_URL) {
    console.log('  (sin SUPABASE_DB_URL: no se puede consultar producción)');
  } else {
    const db = await conectar(c.SUPABASE_DB_URL, true);
    try {
      const aplicadas = await migracionesAplicadas(db);
      const existeEsquema = (await db.query(`select to_regclass('public.profiles') as t`)).rows[0].t;
      for (const m of locales) {
        const marca = aplicadas.has(m.version) ? '✔ aplicada' : existeEsquema && aplicadas.size === 0 && m.version <= '20261025000003' ? '≈ aplicada a mano (sin registrar)' : '• PENDIENTE';
        console.log(`  ${marca.padEnd(34)} ${m.archivo}`);
      }
      for (const v of aplicadas) if (!locales.some((m) => m.version === v)) console.log(`  ⚠ en producción pero no en el código: ${v}`);

      console.log('\nDatos en producción (filas)');
      const filas = await contarFilas(db, TABLAS_PROTEGIDAS);
      console.log('  ' + Object.entries(filas).map(([t, n]) => `${t}: ${n}`).join(' · '));
      const usuarios = await db.query(`select count(*)::int as n, count(*) filter (where banned_until > now())::int as suspendidos from auth.users`);
      console.log(`  cuentas de Auth: ${usuarios.rows[0].n} (suspendidas: ${usuarios.rows[0].suspendidos})`);
      const pg = await db.query(`select current_setting('server_version') as v`);
      console.log(`  PostgreSQL de producción: ${pg.rows[0].v}`);
    } finally {
      await db.end();
    }
  }

  // --- respaldos ---
  const r = ultimoRespaldo();
  console.log('\nRespaldos');
  console.log(r ? `  último: ${r.manifiesto.creado} · verificado: ${r.manifiesto.verificado ? 'sí' : 'NO'} · ${r.dir.slice(ROOT.length + 1)}` : '  ninguno todavía (npm run respaldo)');

  // --- Edge Functions y Auth ---
  if (!c.SUPABASE_ACCESS_TOKEN) {
    console.log('\nEdge Functions y Auth: (sin SUPABASE_ACCESS_TOKEN: no se puede consultar)');
  } else {
    console.log('\nEdge Functions');
    try {
      const remotas = await gestion<{ slug: string; version: number; updated_at: number; status: string }[]>(c, 'GET', '/functions');
      const registro = existsSync(join(ESTADO, 'funciones.json')) ? JSON.parse(readFileSync(join(ESTADO, 'funciones.json'), 'utf8')) : {};
      for (const f of funcionesLocales()) {
        const rem = remotas.find((x) => x.slug === f);
        const h = hashFuncion(f);
        const estado = !rem ? '• NO DESPLEGADA' : registro[f] === h ? '✔ al día' : '• cambios sin desplegar (o desplegada fuera de este flujo)';
        console.log(`  ${estado.padEnd(56)} ${f}${rem ? ` (v${rem.version}, ${rem.status})` : ''}`);
      }
    } catch (e) {
      console.log('  ' + ocultar(String(e), c));
    }
    console.log('\nConfiguración de Auth');
    try {
      const auth = await gestion<Record<string, unknown>>(c, 'GET', '/config/auth');
      const dif = diferenciasAuth(auth);
      if (!dif.length) console.log('  ✔ coincide con supabase/auth-deseado.json');
      for (const d of dif) console.log(`  • ${d.clave}: actual=${JSON.stringify(d.actual)} → deseado=${JSON.stringify(d.deseado)}`);
    } catch (e) {
      console.log('  ' + ocultar(String(e), c));
    }
  }
  console.log('\nSiguiente paso habitual: npm run plan');
  return 0;
}
