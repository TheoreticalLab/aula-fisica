/**
 * npm run probar — pruebas de base de datos en un PostgreSQL LOCAL desechable (nunca toca producción).
 *
 *  1. Crea de cero la base local «aula_prueba» con un entorno mínimo tipo Supabase.
 *  2. Base de partida:
 *     - con respaldo (por defecto si existe): aplica las migraciones que ya tiene producción y
 *       restaura la copia de los datos reales (estudiantes, respuestas, calificaciones…);
 *     - con --limpio: aplica todas las migraciones y la semilla del curso, sin datos de producción.
 *  3. Aplica las migraciones pendientes, cada una en su transacción.
 *  4. Comprueba que ninguna tabla protegida haya perdido filas.
 *  5. Ejecuta las pruebas SQL de supabase/pruebas/*.sql (seguridad RLS, cuentas, secciones…).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { huellaPruebas } from './plan';
import {
  asegurarDir,
  conectar,
  ESTADO,
  contarFilas,
  credenciales,
  fallar,
  migracionesLocales,
  ocultar,
  PRIVADO,
  ROOT,
  TABLAS_PROTEGIDAS,
  ultimoRespaldo,
  type Manifiesto,
} from './comun';
import { revisarMigraciones } from './lint-migraciones';

const BASE_INICIAL = '20261025000003'; // las tres primeras se aplicaron a mano desde el editor SQL

function nombreBase(url: string): string {
  const u = new URL(url.replace(/^postgresql:\/\/\//, 'postgresql://localhost/'));
  return decodeURIComponent(u.pathname.slice(1));
}

function asegurarLocal(url: string) {
  if (/supabase\.(co|com)|pooler|amazonaws/.test(url)) fallar('LOCAL_DB_URL apunta a un servidor remoto. Las pruebas solo se ejecutan en local.');
}

export function versionesBase(m: Manifiesto | null): string[] {
  if (!m) return [];
  if (m.migraciones_aplicadas.length) return m.migraciones_aplicadas;
  return m.tablas['public.profiles'] ? migracionesLocales().filter((x) => x.version <= BASE_INICIAL).map((x) => x.version) : [];
}

async function restaurar(db: pg.Client, dir: string, m: Manifiesto) {
  await db.query(`set session_replication_role = replica`); // sin disparadores ni comprobación de FK durante la carga
  const orden = Object.keys(m.tablas).sort((a, b) => Number(b.startsWith('auth.')) - Number(a.startsWith('auth.')));
  // Las migraciones de datos (p. ej. las asignaturas de la 8) ya insertaron filas con otros id: se vacía la copia LOCAL
  // para que quede idéntica a producción. Solo corre sobre aula_prueba (lo comprueban asegurarLocal y nombreBase).
  const presentes: string[] = [];
  for (const tabla of orden) {
    if ((await db.query(`select to_regclass($1) as t`, [tabla])).rows[0].t) presentes.push(tabla.split('.').map((p) => `"${p}"`).join('.'));
  }
  if (presentes.length) await db.query(`truncate table ${presentes.join(', ')} cascade`);
  for (const tabla of orden) {
    const info = m.tablas[tabla];
    const filas = JSON.parse(readFileSync(join(dir, info.archivo), 'utf8')) as Record<string, unknown>[];
    if (!filas.length) continue;
    const [esq, nom] = tabla.split('.');
    const existe = (await db.query(`select to_regclass($1) as t`, [`${esq}.${nom}`])).rows[0].t;
    if (!existe) {
      console.log(`  (omitida ${tabla}: no existe en el esquema base)`);
      continue;
    }
    const cols = Object.keys(filas[0]).map((c) => `"${c}"`).join(', ');
    const identidad = (await db.query(
      `select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and is_identity='YES' and identity_generation='ALWAYS'`,
      [esq, nom],
    )).rowCount;
    for (let i = 0; i < filas.length; i += 500) {
      await db.query(
        `insert into "${esq}"."${nom}" (${cols}) ${identidad ? 'overriding system value' : ''}
         select ${cols} from json_populate_recordset(null::"${esq}"."${nom}", $1::json)`,
        [JSON.stringify(filas.slice(i, i + 500))],
      );
    }
  }
  await db.query(`set session_replication_role = origin`);
  // secuencias de columnas identidad
  const seqs = await db.query(`select table_schema, table_name, column_name from information_schema.columns where table_schema='public' and is_identity='YES'`);
  for (const s of seqs.rows) {
    await db.query(`select setval(pg_get_serial_sequence($1, $2), greatest(1, (select coalesce(max("${s.column_name}"), 0) from "${s.table_schema}"."${s.table_name}")))`, [
      `${s.table_schema}.${s.table_name}`,
      s.column_name,
    ]);
  }
}

export interface ResultadoPrueba {
  ok: boolean;
  lineas: string[];
}

export async function probar(opts: { limpio?: boolean; silencioso?: boolean } = {}): Promise<ResultadoPrueba> {
  const c = credenciales();
  asegurarLocal(c.LOCAL_DB_URL);
  asegurarLocal(c.LOCAL_ADMIN_DB_URL);
  const lineas: string[] = [];
  const log = (s: string) => {
    lineas.push(s);
    if (!opts.silencioso) console.log(s);
  };
  let ok = true;

  const problemas = revisarMigraciones();
  for (const p of problemas) log(`${p.nivel === 'error' ? '✖' : '⚠'} ${p.archivo}:${p.linea} ${p.mensaje}`);
  if (problemas.some((p) => p.nivel === 'error')) return { ok: false, lineas };

  const nombre = nombreBase(c.LOCAL_DB_URL);
  if (!/^aula_prueba[\w]*$/.test(nombre)) fallar(`Por seguridad, la base local debe llamarse aula_prueba… (es «${nombre}»).`);
  const admin = await conectar(c.LOCAL_ADMIN_DB_URL, false);
  await admin.query(`drop database if exists "${nombre}" with (force)`);
  await admin.query(`create database "${nombre}"`);
  await admin.end();

  const db = await conectar(c.LOCAL_DB_URL, false);
  try {
    await db.query(readFileSync(join(ROOT, 'supabase', 'pruebas', 'local', '00_entorno_supabase.sql'), 'utf8'));
    const migs = migracionesLocales();
    const resp = opts.limpio ? null : ultimoRespaldo();
    const base = new Set(versionesBase(resp?.manifiesto ?? null));
    log(resp ? `Base: respaldo ${resp.manifiesto.creado} (${base.size} migraciones ya en producción)` : 'Base: base de datos vacía + semilla del curso');

    for (const m of migs.filter((x) => base.has(x.version))) await db.query(m.sql);
    if (resp) {
      await restaurar(db, resp.dir, resp.manifiesto);
      log('  datos de producción restaurados en local');
    }
    const antes = await contarFilas(db, TABLAS_PROTEGIDAS);

    for (const m of migs.filter((x) => !base.has(x.version))) {
      try {
        await db.query('begin');
        await db.query(m.sql);
        await db.query('commit');
        log(`✔ migración ${m.archivo}`);
      } catch (e) {
        await db.query('rollback');
        log(`✖ migración ${m.archivo}: ${ocultar(String((e as Error).message))}`);
        return { ok: false, lineas };
      }
    }
    if (!resp && existsSync(join(PRIVADO, 'semilla.sql'))) {
      await db.query(readFileSync(join(PRIVADO, 'semilla.sql'), 'utf8'));
      log('✔ semilla del curso cargada');
    }

    const despues = await contarFilas(db, TABLAS_PROTEGIDAS);
    for (const [t, n] of Object.entries(antes)) {
      if ((despues[t] ?? 0) < n) {
        ok = false;
        log(`✖ PÉRDIDA DE DATOS en ${t}: ${n} → ${despues[t] ?? 0} filas`);
      }
    }
    if (ok) log(`✔ datos protegidos conservados (${Object.values(despues).reduce((a, b) => a + b, 0)} filas en ${Object.keys(despues).length} tablas)`);

    const pruebas = readdirSync(join(ROOT, 'supabase', 'pruebas')).filter((f) => f.endsWith('.sql')).sort();
    for (const f of pruebas) {
      try {
        const res = await db.query(readFileSync(join(ROOT, 'supabase', 'pruebas', f), 'utf8'));
        const ultimo = (Array.isArray(res) ? res : [res]).filter((r) => r.rows?.length).at(-1);
        log(`✔ prueba ${f}: ${ultimo?.rows[0]?.resultado ?? 'sin errores'}`);
      } catch (e) {
        ok = false;
        await db.query('rollback').catch(() => undefined);
        log(`✖ prueba ${f}: ${ocultar(String((e as Error).message))}`);
      }
    }
  } finally {
    await db.end();
  }
  log(ok ? '\n✔ TODAS LAS PRUEBAS LOCALES PASARON' : '\n✖ HAY FALLOS: no se debe aplicar a producción');
  return { ok, lineas };
}

export async function comandoProbar(args: string[]): Promise<number> {
  const limpio = args.includes('--limpio');
  const r = await probar({ limpio });
  asegurarDir(ESTADO);
  writeFileSync(
    join(ESTADO, 'ultima-prueba.json'),
    JSON.stringify({ ok: r.ok, huella: huellaPruebas(), modo: limpio || !ultimoRespaldo() ? 'limpio' : 'respaldo', fecha: new Date().toISOString() }, null, 2),
  );
  return r.ok ? 0 : 1;
}
