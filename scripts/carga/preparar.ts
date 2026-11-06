/**
 * Pruebas de carga · prepara el entorno SINTÉTICO en la copia local (aula_prueba): 94 estudiantes ficticios, un profesor
 * ficticio, una sección y una práctica de 10 ejercicios con clave (scripts/carga/preparar-sintetico.sql). Idempotente.
 * La copia local se crea antes con `node privado/tmp/probar-local.mjs` (= `npm run probar` sobre el último respaldo).
 * Uso: vite-node scripts/carga/preparar.ts
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { arrancar, parar, URL_DB } from './servidor';

const s = await arrancar();
try {
  const c = new pg.Client({ connectionString: URL_DB });
  await c.connect();
  const r = (await c.query(readFileSync('scripts/carga/preparar-sintetico.sql', 'utf8'))) as unknown as pg.QueryResult[] | pg.QueryResult;
  console.log('preparado:', (Array.isArray(r) ? r[r.length - 1] : r).rows[0]);
  console.log('tamaño de la base:', (await c.query(`select pg_size_pretty(pg_database_size(current_database())) t`)).rows[0].t);
  await c.end();
} finally {
  await parar(s);
}
process.exit(0);
