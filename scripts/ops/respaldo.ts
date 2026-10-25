/**
 * npm run respaldo — SOLO LECTURA en producción.
 * Copia todas las tablas de public, más auth.users y auth.identities, en privado/respaldos/AAAAMMDD-HHMMSS/,
 * a partir de una instantánea consistente (transacción REPEATABLE READ de solo lectura).
 * Después verifica la copia: vuelve a leer cada archivo, cuenta las filas y comprueba su SHA-256.
 *
 * El respaldo contiene datos personales y hashes de contraseñas (bcrypt, nunca texto plano):
 * se guarda en privado/ (excluido de git). No lo comparta.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { asegurarDir, conectar, credenciales, migracionesAplicadas, RESPALDOS, sha256, type Manifiesto } from './comun';

/** Columnas de auth que se respaldan (las necesarias para recrear cuentas con la misma contraseña). */
const AUTH_TABLAS: Record<string, string> = {
  'auth.users':
    'id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at, last_sign_in_at, is_sso_user, deleted_at',
  'auth.identities': 'id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at',
};

export async function hacerRespaldo(silencioso = false): Promise<string> {
  const c = credenciales(['SUPABASE_DB_URL']);
  const db = await conectar(c.SUPABASE_DB_URL!, true);
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const dir = join(RESPALDOS, sello);
  asegurarDir(dir);
  const manifiesto: Manifiesto = { creado: new Date().toISOString(), proyecto: c.SUPABASE_PROJECT_REF, migraciones_aplicadas: [], tablas: {}, verificado: false };
  try {
    await db.query('begin isolation level repeatable read read only');
    manifiesto.migraciones_aplicadas = [...(await migracionesAplicadas(db))].sort();
    const tablas = (
      await db.query(`select tablename from pg_tables where schemaname = 'public' order by tablename`)
    ).rows.map((r) => `public.${r.tablename}`);
    const todas: [string, string][] = [...tablas.map((t) => [t, '*'] as [string, string]), ...Object.entries(AUTH_TABLAS)];
    for (const [tabla, cols] of todas) {
      const [esq, nom] = tabla.split('.');
      const rows = (await db.query(`select ${cols} from "${esq}"."${nom}"`)).rows;
      const contenido = JSON.stringify(rows);
      const archivo = `${tabla}.json`;
      writeFileSync(join(dir, archivo), contenido, { encoding: 'utf8', mode: 0o600 });
      manifiesto.tablas[tabla] = { filas: rows.length, sha256: sha256(contenido), archivo };
      if (!silencioso) console.log(`  ${tabla.padEnd(32)} ${String(rows.length).padStart(7)} filas`);
    }
    await db.query('commit');
  } catch (e) {
    await db.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    await db.end();
  }
  // verificación independiente: releer, parsear, contar y comparar hashes
  for (const [tabla, info] of Object.entries(manifiesto.tablas)) {
    const contenido = readFileSync(join(dir, info.archivo), 'utf8');
    const filas = (JSON.parse(contenido) as unknown[]).length;
    if (sha256(contenido) !== info.sha256 || filas !== info.filas) throw new Error(`Verificación fallida en ${tabla}`);
  }
  manifiesto.verificado = true;
  writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2), { encoding: 'utf8', mode: 0o600 });
  return dir;
}

export async function comandoRespaldo(): Promise<number> {
  console.log('Respaldo de producción (solo lectura)…');
  const dir = await hacerRespaldo();
  console.log(`\n✔ Respaldo creado y verificado: ${dir}`);
  return 0;
}
