/**
 * Pruebas de carga · coste de las lecturas de contenido con las políticas RLS antiguas y con las de la migración 88,
 * para estudiantes REALES de la copia local. Cada variante se instala dentro de una transacción que se deshace: la
 * base no cambia. Además compara las filas devueltas (deben ser idénticas).
 * Uso: vite-node scripts/carga/medir-rls.ts [repeticiones]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { arrancar, parar, URL_DB } from './servidor';

const REP = Number(process.argv.slice(2).filter((a) => a !== '--')[0] ?? 15);
const VARIANTES = {
  antes: 'supabase/reversion/20261106000088_rls_permisos_una_vez_revertir.sql',
  despues: 'supabase/migrations/20261106000088_rls_permisos_una_vez.sql',
};
const LECTURAS = {
  lecciones: (c: string) => `select id, unit_id, course_id, slug, position, title, summary, hidden, simulation, updated_at from public.lessons where course_id = '${c}' order by position`,
  unidades: (c: string) => `select * from public.units where course_id = '${c}' order by position`,
  conceptos: (c: string) => `select * from public.concepts where course_id = '${c}'`,
  asignaturas: () => `select * from public.courses`,
};
const q = (a: number[], x: number) => +a.slice().sort((m, n) => m - n)[Math.min(a.length - 1, Math.floor(x * a.length))].toFixed(1);

const s = await arrancar();
const c = new pg.Client({ connectionString: URL_DB });
await c.connect();
try {
  // estudiantes reales con matrícula activa y su asignatura con más lecciones
  const est = (await c.query(`select distinct on (e.user_id) e.user_id, cl.course_id from public.enrollments e
      join public.classes cl on cl.id = e.class_id join public.profiles p on p.id = e.user_id
      where p.role = 'student' and p.active and not p.must_change_password and e.user_id::text not like 'cafe0000%'
      order by e.user_id, (select count(*) from public.lessons l where l.course_id = cl.course_id) desc limit 8`)).rows as { user_id: string; course_id: string }[];
  const resultado: Record<string, Record<string, { p50: number; p95: number; filas: number }>> = {};
  const firmas: Record<string, string[]> = { antes: [], despues: [] };
  for (const [variante, archivo] of Object.entries(VARIANTES)) {
    await c.query('begin');
    await c.query(readFileSync(archivo, 'utf8'));
    resultado[variante] = {};
    for (const [nombre, sql] of Object.entries(LECTURAS)) {
      const tiempos: number[] = [];
      let filas = 0;
      for (const e of est) {
        await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.path', '/rest/v1/lessons', true)`,
          [JSON.stringify({ sub: e.user_id, role: 'authenticated' }), e.user_id]);
        await c.query('set local role authenticated');
        for (let i = 0; i < REP; i++) {
          const t0 = performance.now();
          const r = await c.query(sql(e.course_id));
          tiempos.push(performance.now() - t0);
          if (i === 0) { filas += r.rowCount ?? 0; firmas[variante].push(`${nombre}:${e.user_id}:${JSON.stringify(r.rows.map((x) => x.id))}`); }
        }
        await c.query('reset role');
      }
      resultado[variante][nombre] = { p50: q(tiempos, 0.5), p95: q(tiempos, 0.95), filas };
    }
    await c.query('rollback');
  }
  const iguales = firmas.antes.length === firmas.despues.length && firmas.antes.every((f, i) => f === firmas.despues[i]);
  const salida = { estudiantes: est.length, repeticiones: REP, filas_identicas: iguales, resultado };
  mkdirSync('privado/carga', { recursive: true });
  writeFileSync('privado/carga/medir-rls.json', JSON.stringify(salida, null, 1));
  console.log(JSON.stringify(salida));
  if (!iguales) process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
  await parar(s);
}
