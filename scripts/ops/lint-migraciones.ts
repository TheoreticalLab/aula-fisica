/**
 * Revisión estática de las migraciones PENDIENTES (y de todas, con --todas).
 *
 * Bloquea operaciones que pueden perder datos (DROP TABLE, DROP COLUMN, TRUNCATE, DELETE/UPDATE sin WHERE,
 * cambios de tipo, borrado de esquemas…). Una migración solo puede contenerlas si la línea anterior lleva
 *   -- @destructivo-autorizado: <motivo>
 * y aun así el plan las mostrará destacadas para que el administrador las apruebe expresamente.
 */
import { migracionesLocales } from './migraciones';

export interface Problema {
  archivo: string;
  linea: number;
  nivel: 'error' | 'aviso';
  mensaje: string;
}

const REGLAS: { re: RegExp; nivel: 'error' | 'aviso'; msg: string }[] = [
  { re: /\bdrop\s+table\b/i, nivel: 'error', msg: 'DROP TABLE borra una tabla y sus datos' },
  { re: /\bdrop\s+schema\b/i, nivel: 'error', msg: 'DROP SCHEMA' },
  { re: /\btruncate\b/i, nivel: 'error', msg: 'TRUNCATE vacía una tabla' },
  { re: /\balter\s+table\b[^;]*\bdrop\s+column\b/is, nivel: 'error', msg: 'DROP COLUMN borra datos de una columna' },
  { re: /\balter\s+table\b[^;]*\balter\s+column\b[^;]*\btype\b/is, nivel: 'error', msg: 'cambio de tipo de columna (puede perder o reescribir datos)' },
  { re: /\balter\s+table\b[^;]*\brename\b/is, nivel: 'error', msg: 'renombrar tablas o columnas rompe el código que las usa' },
  { re: /\bdelete\s+from\b(?![^;]*\bwhere\b)/is, nivel: 'error', msg: 'DELETE sin WHERE' },
  { re: /\bupdate\s+[\w."]+\s+set\b(?![^;]*\bwhere\b)/is, nivel: 'aviso', msg: 'UPDATE sin WHERE (revise que sea intencionado)' },
  { re: /\bdrop\s+type\b/i, nivel: 'error', msg: 'DROP TYPE' },
  { re: /\bdrop\s+function\b/i, nivel: 'aviso', msg: 'DROP FUNCTION (asegúrese de que nada la usa)' },
  { re: /\bdrop\s+policy\b/i, nivel: 'aviso', msg: 'DROP POLICY (debe recrearse en la misma migración)' },
  { re: /\bdelete\s+from\s+auth\./i, nivel: 'error', msg: 'borrado de cuentas de usuario' },
  { re: /\bdisable\s+row\s+level\s+security\b/i, nivel: 'error', msg: 'desactivar RLS deja los datos expuestos' },
  { re: /\bgrant\b[^;]*\bto\s+anon\b/i, nivel: 'error', msg: 'conceder privilegios al rol anónimo' },
  { re: /\b(begin|commit|rollback)\s*;/i, nivel: 'aviso', msg: 'control de transacciones dentro de la migración (el flujo ya usa una transacción por archivo)' },
];

/** Quita comentarios y el contenido de los cuerpos $$…$$ de funciones (su lógica se prueba aparte). */
function sinCuerposNiComentarios(sql: string): string {
  return sql
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (m) => (m.includes('@destructivo-autorizado') ? m : ' '.repeat(m.length)));
}

export function revisarMigraciones(opts: { soloVersiones?: Set<string> } = {}): Problema[] {
  const out: Problema[] = [];
  for (const m of migracionesLocales()) {
    if (opts.soloVersiones && !opts.soloVersiones.has(m.version)) continue;
    const limpio = sinCuerposNiComentarios(m.sql);
    const lineas = m.sql.split('\n');
    // cada sentencia por separado
    let offset = 0;
    for (const sent of limpio.split(';')) {
      const linea = limpio.slice(0, offset).split('\n').length;
      offset += sent.length + 1;
      for (const r of REGLAS) {
        if (!r.re.test(sent + ';')) continue;
        const primeraLinea = linea + (sent.match(/^\s*/)?.[0].split('\n').length ?? 1) - 1;
        const previa = lineas[primeraLinea - 2] ?? '';
        const autorizado = /@destructivo-autorizado:\s*\S/.test(previa);
        out.push({
          archivo: m.archivo,
          linea: primeraLinea,
          nivel: autorizado ? 'aviso' : r.nivel,
          mensaje: autorizado ? `${r.msg} — marcado como autorizado: ${previa.split('@destructivo-autorizado:')[1].trim()}` : r.msg,
        });
      }
    }
  }
  return out;
}

export function comandoLint(): number {
  const p = revisarMigraciones();
  for (const x of p) console.log(`${x.nivel === 'error' ? '✖' : '⚠'} ${x.archivo}:${x.linea} ${x.mensaje}`);
  console.log(p.some((x) => x.nivel === 'error') ? '\nHay operaciones destructivas sin autorizar.' : '✔ Migraciones revisadas: sin operaciones destructivas sin autorizar.');
  return p.some((x) => x.nivel === 'error') ? 1 : 0;
}
