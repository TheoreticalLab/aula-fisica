#!/usr/bin/env node
// Revisión estática de las migraciones SQL antes de aplicarlas. Falla (código 1) si:
//   · una migración YA versionada en git cambió (las migraciones aplicadas no se editan: se escribe otra nueva);
//   · el nombre no sigue AAAAMMDDHHMMSS_descripcion.sql o el orden no es creciente;
//   · contiene operaciones destructivas sin autorización explícita.
//
// Operaciones destructivas (pueden perder estudiantes, matrículas, respuestas o calificaciones):
//   DROP TABLE / DROP COLUMN / DROP SCHEMA / DROP TYPE, TRUNCATE, DELETE sin WHERE, ALTER COLUMN … TYPE (puede truncar),
//   RENAME de tablas o columnas (rompe el frontend publicado), ON DELETE CASCADE nuevo hacia tablas de resultados,
//   y UPDATE sin WHERE.
// Para permitir una, la propia línea anterior debe decir:   -- @destructiva-autorizada: <motivo y fecha de la autorización>
// Esa marca solo se pone después de que el administrador lo haya autorizado expresamente (ver CLAUDE.md).
//
//   node scripts/db/revisar-migraciones.mjs              → revisa todas
//   node scripts/db/revisar-migraciones.mjs --nuevas     → solo las que aún no están en git (las pendientes de esta tarea)
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
const NOMBRE = /^(\d{14})_[a-z0-9_]+\.sql$/;
const DESTRUCTIVAS = [
  [/\bdrop\s+table\b/i, 'DROP TABLE'],
  [/\bdrop\s+schema\b/i, 'DROP SCHEMA'],
  [/\bdrop\s+type\b/i, 'DROP TYPE'],
  [/\balter\s+table\b[^;]*\bdrop\s+(?:column\b|(?!constraint\b|policy\b|trigger\b|default\b|not\s+null\b)\w+\s*(?:,|;|$))/i, 'DROP COLUMN'],
  [/\btruncate\b/i, 'TRUNCATE'],
  [/\bdelete\s+from\s+[\w."]+\s*(?:;|$)/i, 'DELETE sin WHERE'],
  [/\bupdate\s+[\w."]+\s+set\b(?:(?!\bwhere\b)[^;])*;/i, 'UPDATE sin WHERE'],
  [/\balter\s+column\s+\w+\s+(?:set\s+data\s+)?type\b/i, 'ALTER COLUMN … TYPE'],
  [/\brename\s+(?:column\s+)?\w+\s+to\b|\balter\s+table\s+[\w."]+\s+rename\s+to\b/i, 'RENAME'],
  [/references\s+public\.(?:profiles|attempts|responses|enrollments)\b[^,;]*on\s+delete\s+cascade/i, 'ON DELETE CASCADE hacia datos de estudiantes'],
];
const MARCA = /--\s*@destructiva-autorizada:\s*\S+/i;

const soloNuevas = process.argv.includes('--nuevas');
let versionadas = new Set();
try { versionadas = new Set(execSync(`git ls-files ${DIR}`, { encoding: 'utf8' }).split('\n').filter(Boolean).map(f => f.split('/').pop())) } catch { }

const errores = [], avisos = [];
const lista = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
let anterior = '';
for (const f of lista) {
  const m = f.match(NOMBRE);
  if (!m) { errores.push(`${f}: el nombre debe ser AAAAMMDDHHMMSS_descripcion.sql (minúsculas y _)`); continue }
  if (m[1] <= anterior) errores.push(`${f}: la marca de tiempo no es posterior a la de la migración anterior`);
  anterior = m[1];
  if (versionadas.has(f)) {
    // una migración ya versionada no se modifica: puede estar aplicada en producción
    try { execSync(`git diff --quiet HEAD -- ${join(DIR, f)}`) } catch { errores.push(`${f}: está versionada y fue modificada. Las migraciones aplicadas NO se editan: cree una nueva`) }
    if (soloNuevas) continue;
  }
  const lineas = readFileSync(join(DIR, f), 'utf8').split('\n');
  // se quitan los comentarios de cada línea para el análisis, pero se mira la marca en la línea anterior
  const sinComentarios = lineas.map(l => l.replace(/--.*$/, ''));
  const texto = sinComentarios.join('\n');
  for (const [re, nombre] of DESTRUCTIVAS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const hit of texto.matchAll(g)) {
      const n = texto.slice(0, hit.index).split('\n').length;   // línea (1-based)
      // en funciones plpgsql un DELETE/UPDATE con variables es normal: se exige revisión humana, no se bloquea
      const dentroDeFuncion = /\$\$/.test(texto.slice(0, hit.index)) && (texto.slice(0, hit.index).match(/\$\$/g) || []).length % 2 === 1;
      const autorizada = MARCA.test(lineas[n - 2] || '') || MARCA.test(lineas[n - 1] || '');
      if (autorizada) avisos.push(`${f}:${n}  ${nombre} (autorizada: ${(lineas[n - 2] || lineas[n - 1]).match(MARCA)[0]})`);
      else if (dentroDeFuncion && /DELETE|UPDATE/.test(nombre)) avisos.push(`${f}:${n}  ${nombre} dentro de una función: revise que esté acotado`);
      else errores.push(`${f}:${n}  ${nombre} sin autorización (-- @destructiva-autorizada: …)`);
    }
  }
}

for (const a of avisos) console.log('AVISO  ' + a);
if (errores.length) { for (const e of errores) console.error('ERROR  ' + e); process.exit(1) }
console.log(`Migraciones revisadas: ${lista.length}${soloNuevas ? ' (solo las nuevas en detalle)' : ''}. Sin operaciones destructivas sin autorizar.`);
