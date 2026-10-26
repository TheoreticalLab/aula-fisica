/**
 * Utilidades comunes de los scripts de operación (estado, respaldo, prueba, plan, aplicar).
 * Nunca imprimen credenciales: todo lo que se muestra pasa por `ocultar()`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { ROOT } from '../cargar-contenido';
import { sha256 } from './migraciones';

export { ROOT };
export { MIGRACIONES } from './migraciones';
export const PRIVADO = join(ROOT, 'privado');
export const FUNCIONES = join(ROOT, 'supabase', 'functions');
export const RESPALDOS = join(PRIVADO, 'respaldos');
export const ESTADO = join(PRIVADO, 'estado');

export interface Credenciales {
  SUPABASE_PROJECT_REF: string;
  SUPABASE_ACCESS_TOKEN?: string;
  SUPABASE_DB_URL?: string;
  LOCAL_DB_URL: string;
  LOCAL_ADMIN_DB_URL: string;
}

const RUTA_CRED = join(PRIVADO, 'credenciales.env');

export function credenciales(requeridas: (keyof Credenciales)[] = []): Credenciales {
  if (!existsSync(RUTA_CRED) && requeridas.length) {
    fallar(`Falta ${RUTA_CRED}. Copie scripts/ops/credenciales.ejemplo.env y complételo (vea FLUJO_DE_TRABAJO.md).`);
  }
  const env: Record<string, string> = {};
  let texto = '';
  try {
    texto = existsSync(RUTA_CRED) ? readFileSync(RUTA_CRED, 'utf8') : '';
  } catch {
    // Dentro del sandbox de Claude Code el archivo es ilegible a propósito: solo sirven las operaciones locales.
    if (requeridas.length) fallar(`No se puede leer ${RUTA_CRED} (¿sandbox?). Esta operación la ejecuta el administrador en su terminal.`);
  }
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  const c: Credenciales = {
    SUPABASE_PROJECT_REF: env.SUPABASE_PROJECT_REF ?? '',
    SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN || undefined,
    SUPABASE_DB_URL: env.SUPABASE_DB_URL || undefined,
    LOCAL_DB_URL: env.LOCAL_DB_URL || 'postgresql:///aula_prueba?host=/var/run/postgresql',
    LOCAL_ADMIN_DB_URL: env.LOCAL_ADMIN_DB_URL || 'postgresql:///postgres?host=/var/run/postgresql',
  };
  for (const r of requeridas) if (!c[r]) fallar(`Falta ${r} en privado/credenciales.env.`);
  if (c.SUPABASE_DB_URL?.includes('[YOUR-PASSWORD]')) fallar('SUPABASE_DB_URL todavía contiene [YOUR-PASSWORD].');
  return c;
}

/** Sustituye cualquier credencial conocida por «***» antes de mostrar un texto. */
export function ocultar(texto: string, c?: Credenciales): string {
  let t = texto;
  for (const v of [c?.SUPABASE_ACCESS_TOKEN, c?.SUPABASE_DB_URL]) if (v) t = t.split(v).join('***');
  return t
    .replace(/postgres(ql)?:\/\/[^\s@]+@/g, 'postgresql://***@')
    .replace(/sbp_[A-Za-z0-9]+/g, 'sbp_***')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, 'sb_secret_***')
    .replace(/eyJ[\w-]{10,}\.[\w-]+\.[\w-]+/g, 'eyJ***');
}

export function fallar(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/**
 * Conexión a una base de datos. Las conexiones a PRODUCCIÓN son de SOLO LECTURA salvo que se pida
 * expresamente escritura (solo lo hace «aplicar», tras la autorización del administrador).
 */
export async function conectar(url: string, produccion: boolean, opciones: { escritura?: boolean; lanzar?: boolean } = {}): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: url,
    ssl: produccion ? { rejectUnauthorized: false } : undefined,
    application_name: 'aula-ops',
    connectionTimeoutMillis: 20_000,
  });
  try {
    await client.connect();
  } catch (e) {
    if (opciones.lanzar) throw new Error(ocultar(String(e)));
    fallar(`No se pudo conectar a la base de datos ${produccion ? 'de PRODUCCIÓN' : 'local'}: ${ocultar(String(e))}`);
  }
  if (produccion && !opciones.escritura) {
    await client.query('set session characteristics as transaction read only');
  }
  return client;
}

export { migracionesLocales, sha256, type Migracion } from './migraciones';

/** Versiones registradas en el historial de migraciones de la base de datos (formato de la CLI de Supabase). */
export async function migracionesAplicadas(db: pg.Client): Promise<Set<string>> {
  const r = await db.query(`select to_regclass('supabase_migrations.schema_migrations') as t`);
  if (!r.rows[0].t) return new Set();
  const v = await db.query(`select version from supabase_migrations.schema_migrations`);
  return new Set(v.rows.map((x) => String(x.version)));
}

export const SQL_HISTORIAL = `
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`;

/** Hash del código de una Edge Function (incluye _shared, del que todas dependen). */
export function hashFuncion(nombre: string): string {
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (/\.(ts|json)$/.test(f)) archivos.push(p);
    }
  };
  recorrer(join(FUNCIONES, nombre));
  recorrer(join(FUNCIONES, '_shared'));
  return sha256(archivos.map((p) => p.slice(FUNCIONES.length) + '\n' + readFileSync(p, 'utf8')).join('\n---\n'));
}

export function funcionesLocales(): string[] {
  return readdirSync(FUNCIONES).filter((f) => !f.startsWith('_') && statSync(join(FUNCIONES, f)).isDirectory()).sort();
}

export function asegurarDir(d: string) {
  mkdirSync(d, { recursive: true });
}

/**
 * Datos privados: archivos SQL de privado/datos/ con contenido que no puede ir al repositorio público
 * (p. ej. actividades con sus claves, generadas por scripts/generar-actividad.ts). Pasan por el mismo
 * flujo que las migraciones: probar → plan → autorización → aplicar. Lo aplicado se anota en
 * privado/estado/datos-aplicados.json (nombre → huella); un archivo ya aplicado no debe editarse.
 */
export const DATOS = join(PRIVADO, 'datos');
const RUTA_DATOS_APLICADOS = join(ESTADO, 'datos-aplicados.json');

export interface DatoPrivado {
  archivo: string;
  sql: string;
  hash: string;
}

export function datosLocales(): DatoPrivado[] {
  if (!existsSync(DATOS)) return [];
  return readdirSync(DATOS)
    .filter((f) => /^\d{14}_[\w-]+\.sql$/.test(f))
    .sort()
    .map((archivo) => {
      const sql = readFileSync(join(DATOS, archivo), 'utf8');
      return { archivo, sql, hash: sha256(sql) };
    });
}

export function datosAplicados(): Record<string, string> {
  return existsSync(RUTA_DATOS_APLICADOS) ? JSON.parse(readFileSync(RUTA_DATOS_APLICADOS, 'utf8')) : {};
}

export function anotarDatoAplicado(d: DatoPrivado) {
  asegurarDir(ESTADO);
  writeFileSync(RUTA_DATOS_APLICADOS, JSON.stringify({ ...datosAplicados(), [d.archivo]: d.hash }, null, 2));
}

/**
 * Tablas cuyos datos deben conservarse siempre (estudiantes, matrículas, respuestas, calificaciones…).
 * Tras cualquier migración, su número de filas no puede disminuir.
 */
export const TABLAS_PROTEGIDAS = [
  'profiles',
  'classes',
  'class_groups',
  'class_teachers',
  'enrollments',
  'activities',
  'activity_items',
  'attempts',
  'responses',
  'response_events',
  'courses',
  'units',
  'lessons',
  'concepts',
  'exercises',
  'exercise_keys',
  'reading_progress',
  'study_visits',
  'analytics_audit',
];

export async function contarFilas(db: pg.Client, tablas: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tablas) {
    const ex = await db.query(`select to_regclass($1) as t`, [`public.${t}`]);
    if (!ex.rows[0].t) continue;
    if (!/^[a-z_]+$/.test(t)) fallar(`Nombre de tabla inválido: ${t}`);
    const r = await db.query(`select count(*)::bigint as n from public."${t}"`);
    out[t] = Number(r.rows[0].n);
  }
  return out;
}

export async function gestion<T>(c: Credenciales, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  if (!c.SUPABASE_ACCESS_TOKEN) fallar('Falta SUPABASE_ACCESS_TOKEN en privado/credenciales.env.');
  const r = await fetch(`https://api.supabase.com/v1/projects/${c.SUPABASE_PROJECT_REF}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`API de gestión ${metodo} ${ruta}: ${r.status} ${ocultar(txt, c).slice(0, 300)}`);
  return (txt ? JSON.parse(txt) : null) as T;
}

export function ultimoRespaldo(): { dir: string; manifiesto: Manifiesto } | null {
  if (!existsSync(RESPALDOS)) return null;
  const dirs = readdirSync(RESPALDOS).filter((d) => existsSync(join(RESPALDOS, d, 'manifiesto.json'))).sort();
  const d = dirs.at(-1);
  if (!d) return null;
  return { dir: join(RESPALDOS, d), manifiesto: JSON.parse(readFileSync(join(RESPALDOS, d, 'manifiesto.json'), 'utf8')) };
}

export interface Manifiesto {
  creado: string;
  proyecto: string;
  migraciones_aplicadas: string[];
  tablas: Record<string, { filas: number; sha256: string; archivo: string }>;
  verificado: boolean;
}
