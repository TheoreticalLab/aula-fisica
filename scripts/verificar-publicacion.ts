/**
 * Comprueba que la carpeta dist/ (lo que se publica en GitHub Pages) no contenga secretos:
 *  - ninguna clave service_role ni JWT con rol service_role;
 *  - ninguna explicación, pista o rúbrica de las claves privadas (si privado/ existe);
 *  - ningún archivo .sql ni de contenido privado.
 * Sale con código 1 si encuentra algo.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadContent, ROOT } from './cargar-contenido';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function decodeJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const dist = join(ROOT, 'dist');
  if (!existsSync(dist)) {
    console.error('No existe dist/. Ejecute antes «npm run build».');
    process.exit(1);
  }
  const problems: string[] = [];
  const files = walk(dist);
  const texts = files.filter((f) => /\.(js|html|css|json|txt|map)$/.test(f)).map((f) => ({ f, s: readFileSync(f, 'utf8') }));
  for (const f of files) if (/\.(sql|env)$/.test(f) || f.includes('privado')) problems.push(`Archivo no permitido: ${relative(ROOT, f)}`);
  for (const { f, s } of texts) {
    for (const m of s.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g)) {
      const role = decodeJwtRole(m[0]);
      if (role && role !== 'anon') problems.push(`${relative(ROOT, f)}: contiene un JWT con rol «${role}»`);
    }
    // una clave real (no el prefijo que supabase-js menciona en su propio código)
    if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(s)) problems.push(`${relative(ROOT, f)}: contiene una clave secreta de Supabase`);
  }
  const units = await loadContent();
  const secrets = units
    .flatMap((u) => u.lessons.flatMap((l) => Object.values(l.keys ?? {})))
    .flatMap((k) => [k.explanation, ...k.hints, k.answer.format === 'open' ? k.answer.rubric : '', k.answer.format === 'truefalse' ? k.answer.modelJustification : ''])
    .filter((s): s is string => !!s && s.length >= 40)
    .map((s) => s.slice(0, 40));
  const bundle = texts.map((t) => t.s).join('\n');
  let leaked = 0;
  for (const s of secrets) if (bundle.includes(s)) leaked++;
  if (leaked) problems.push(`${leaked} textos de claves privadas aparecen en dist/`);
  if (problems.length) {
    console.error('PUBLICACIÓN BLOQUEADA:\n' + problems.map((p) => ' - ' + p).join('\n'));
    process.exit(1);
  }
  console.log(`dist/ verificado: ${files.length} archivos, sin secretos${secrets.length ? ` (comparado con ${secrets.length} textos de claves)` : ''}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
