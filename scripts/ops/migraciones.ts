/** Lectura de las migraciones locales (sin dependencias de base de datos: la usan también las pruebas). */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../cargar-contenido';

export const MIGRACIONES = join(ROOT, 'supabase', 'migrations');

export interface Migracion {
  version: string;
  nombre: string;
  archivo: string;
  sql: string;
  hash: string;
}

export function sha256(s: string | Buffer): string {
  return createHash('sha256').update(s).digest('hex');
}

export function migracionesLocales(): Migracion[] {
  return readdirSync(MIGRACIONES)
    .filter((f) => /^\d{14}_[\w-]+\.sql$/.test(f))
    .sort()
    .map((f) => {
      const sql = readFileSync(join(MIGRACIONES, f), 'utf8');
      return { version: f.slice(0, 14), nombre: f.slice(15, -4), archivo: f, sql, hash: sha256(sql) };
    });
}
