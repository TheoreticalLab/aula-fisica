/**
 * Centro de Datos · base de datos para SQLite como SCRIPT SQL (investigacion.sql).
 *
 * Generar el archivo binario .sqlite en el navegador requiere SQLite compilado a WebAssembly (p. ej. sql.js), que
 * todavía no está instalado en el proyecto. Mientras tanto se entrega este script, que crea exactamente la misma base
 * (tablas, claves primarias y foráneas, índices, diccionario y manifiesto):
 *     sqlite3 investigacion.sqlite < investigacion.sql
 * Tipos: TEXT (identificadores, fechas ISO 8601 UTC, JSON), INTEGER (enteros y booleanos 0/1), REAL (decimales).
 */
import type { Fila } from './formato';

export interface TablaSql { nombre: string; columnas: string[]; filas: Fila[]; clave?: string[]; relaciones?: Record<string, string>; tipos?: Record<string, string> }

const id = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Tipo SQLite a partir del tipo de PostgreSQL (si se conoce) o de los valores. */
export function tipoSqlite(tipoPg: string | undefined, valores: unknown[]): 'TEXT' | 'INTEGER' | 'REAL' {
  if (tipoPg) {
    if (/^(integer|bigint|smallint|boolean)$/.test(tipoPg)) return 'INTEGER';
    if (/^(numeric|double precision|real)$/.test(tipoPg)) return 'REAL';
    return 'TEXT';
  }
  let entero = true, numero = true, alguno = false;
  for (const v of valores) {
    if (v === null || v === undefined) continue;
    alguno = true;
    if (typeof v === 'boolean') continue;
    if (typeof v !== 'number') { numero = false; entero = false; break; }
    if (!Number.isInteger(v)) entero = false;
  }
  return !alguno || !numero ? 'TEXT' : entero ? 'INTEGER' : 'REAL';
}

export function literal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return `'${s.replace(/'/g, "''").replace(/\u0000/g, '')}'`;
}

/** Script completo; se devuelve en trozos para no crear una única cadena gigantesca. */
export function scriptSqlite(tablas: TablaSql[], extra: { diccionario: Fila[]; manifiesto: Record<string, unknown> }): string[] {
  const out: string[] = [
    '-- Base de datos de investigación del Aula Virtual (generada por el Centro de Datos).',
    '-- Crear la base:  sqlite3 investigacion.sqlite < investigacion.sql',
    'PRAGMA foreign_keys = OFF;', 'PRAGMA journal_mode = OFF;', 'BEGIN TRANSACTION;',
  ];
  const nombres = new Set(tablas.map((t) => t.nombre));
  for (const t of tablas) {
    // sin columnas conocidas (tabla vacía y sin esquema): se crea igual, con una columna que lo indica
    if (!t.columnas.length) { out.push(`CREATE TABLE ${id(t.nombre)} ("_sin_columnas_conocidas" TEXT);`); continue; }
    const tipos = t.columnas.map((c) => tipoSqlite(t.tipos?.[c], t.filas.slice(0, 2000).map((f) => f[c])));
    const defs = t.columnas.map((c, i) => `  ${id(c)} ${tipos[i]}`);
    if (t.clave?.length && t.clave.every((c) => t.columnas.includes(c))) defs.push(`  PRIMARY KEY (${t.clave.map(id).join(', ')})`);
    for (const [col, ref] of Object.entries(t.relaciones ?? {})) {
      const [tabla, colRef] = ref.split('.');
      if (t.columnas.includes(col) && nombres.has(tabla) && tabla !== t.nombre) defs.push(`  FOREIGN KEY (${id(col)}) REFERENCES ${id(tabla)} (${id(colRef)})`);
    }
    out.push(`CREATE TABLE ${id(t.nombre)} (\n${defs.join(',\n')}\n);`);
    for (let i = 0; i < t.filas.length; i += 500) {
      const lote = t.filas.slice(i, i + 500).map((f) => `(${t.columnas.map((c) => literal(f[c])).join(', ')})`);
      out.push(`INSERT INTO ${id(t.nombre)} (${t.columnas.map(id).join(', ')}) VALUES\n${lote.join(',\n')};`);
    }
    // índices en las columnas que relacionan tablas y en las marcas temporales más consultadas
    const indexar = new Set([...Object.keys(t.relaciones ?? {}), ...['user_id', 'attempt_id', 'exercise_id', 'session_id', 'received_at', 'started_at', 'created_at']]);
    for (const c of t.columnas) if (indexar.has(c) && !(t.clave?.length === 1 && t.clave[0] === c)) out.push(`CREATE INDEX ${id(`ix_${t.nombre}_${c}`)} ON ${id(t.nombre)} (${id(c)});`);
  }
  out.push('CREATE TABLE "_diccionario" ("tabla" TEXT, "variable" TEXT, "tipo" TEXT, "unidad" TEXT, "naturaleza" TEXT, "fuente" TEXT, "descripcion" TEXT, "calculo" TEXT, "limitaciones" TEXT);');
  for (let i = 0; i < extra.diccionario.length; i += 500) {
    out.push(`INSERT INTO "_diccionario" VALUES\n${extra.diccionario.slice(i, i + 500).map((f) =>
      `(${['tabla', 'variable', 'tipo', 'unidad', 'naturaleza', 'fuente', 'descripcion', 'calculo', 'limitaciones'].map((c) => literal(f[c])).join(', ')})`).join(',\n')};`);
  }
  out.push('CREATE TABLE "_manifiesto" ("clave" TEXT PRIMARY KEY, "valor" TEXT);');
  out.push(`INSERT INTO "_manifiesto" VALUES\n${Object.entries(extra.manifiesto).map(([k, v]) => `(${literal(k)}, ${literal(v)})`).join(',\n')};`);
  out.push('COMMIT;');
  return out.map((s) => s + '\n');
}
