#!/usr/bin/env node
// Busca secretos en los archivos que git va a versionar (o en los indicados). Falla (código 1) si encuentra alguno.
//
//   node scripts/escanear-secretos.mjs            → archivos rastreados + los que se añadirían (respeta .gitignore)
//   node scripts/escanear-secretos.mjs a.ts b.sql → solo esos archivos
//
// Qué se considera secreto (nunca debe estar en el repositorio ni en lo que se publica a los estudiantes):
//   · JWT de Supabase con rol service_role (la «llave maestra»)
//   · claves secretas nuevas de Supabase (sb_secret_…) y tokens personales de la CLI (sbp_…)
//   · cadenas de conexión de Postgres con contraseña
//   · claves privadas (PEM), tokens de GitHub, contraseñas asignadas en variables *_PASSWORD / *_SECRET / SERVICE_ROLE
// La clave «anon»/publicable es pública por diseño, pero tampoco se escribe en el código: llega por variables de entorno.
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATRONES = [
  { nombre: 'clave secreta de Supabase (sb_secret_)', re: /sb_secret_[A-Za-z0-9_\-]{20,}/g },
  { nombre: 'token personal de la CLI de Supabase (sbp_)', re: /\bsbp_[a-f0-9]{40}\b/g },
  { nombre: 'cadena de conexión de Postgres con contraseña', re: /postgres(?:ql)?:\/\/[^\s:@\/]+:[^\s@\/]{6,}@/gi },
  { nombre: 'clave privada PEM', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { nombre: 'token de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { nombre: 'variable secreta con valor', re: /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|DB_PASSWORD|SUPABASE_ACCESS_TOKEN|JWT_SECRET)\s*[=:]\s*["']?[A-Za-z0-9_\-\.]{16,}/g },
];
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

function archivos() {
  const extra = process.argv.slice(2);
  if (extra.length) return extra;
  const salida = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' });
  return salida.split('\n').filter(Boolean);
}

const hallazgos = [];
for (const f of archivos()) {
  let st; try { st = statSync(f) } catch { continue }
  if (!st.isFile() || st.size > 5e6 || /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|lock)$/i.test(f) || f === 'package-lock.json') continue;
  const texto = readFileSync(f, 'utf8');
  for (const p of PATRONES) for (const m of texto.matchAll(p.re)) hallazgos.push({ f, linea: texto.slice(0, m.index).split('\n').length, que: p.nombre });
  for (const m of texto.matchAll(JWT)) {
    let rol = '?';
    try { rol = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url').toString()).role || '?' } catch { }
    // cualquier JWT completo en el código es sospechoso; el de service_role es grave
    hallazgos.push({ f, linea: texto.slice(0, m.index).split('\n').length, que: rol === 'service_role' ? 'JWT con rol service_role (LLAVE MAESTRA)' : `JWT completo (rol ${rol}): debe llegar por variables de entorno, no escrito en el código` });
  }
}

if (hallazgos.length) {
  console.error('SECRETOS ENCONTRADOS — no publique ni haga commit hasta quitarlos:');
  for (const h of hallazgos) console.error(`  ${h.f}:${h.linea}  ${h.que}`);
  process.exit(1);
}
console.log('Sin secretos en los archivos versionados.');
