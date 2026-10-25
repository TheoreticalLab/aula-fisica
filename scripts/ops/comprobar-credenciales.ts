/**
 * npm run comprobar-credenciales — SOLO LECTURA. Verifica privado/credenciales.env sin mostrar ningún valor:
 *  1. formato del token y de la cadena de conexión;
 *  2. acceso a la API de gestión de Supabase (lectura de los datos del proyecto);
 *  3. que la contraseña de PostgreSQL es válida (conexión en sesión de solo lectura);
 *  4. que el archivo está protegido (permisos) y excluido de git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { conectar, credenciales, gestion, ocultar, PRIVADO, ROOT } from './comun';

type Res = { ok: boolean; texto: string };
const res: Res[] = [];
const marca = (ok: boolean, texto: string) => res.push({ ok, texto });

export async function comandoComprobarCredenciales(): Promise<number> {
  const ruta = join(PRIVADO, 'credenciales.env');
  if (!existsSync(ruta)) {
    console.log('✖ No existe privado/credenciales.env');
    return 1;
  }
  const c = credenciales();

  // --- 1. formato -------------------------------------------------------------
  const ref = c.SUPABASE_PROJECT_REF;
  marca(/^[a-z]{20}$/.test(ref), `Identificador del proyecto con formato válido (20 letras)`);
  const tok = c.SUPABASE_ACCESS_TOKEN ?? '';
  marca(/^sbp_[A-Za-z0-9]{30,}$/.test(tok), tok ? `SUPABASE_ACCESS_TOKEN con formato válido (sbp_…, ${tok.length} caracteres)` : 'SUPABASE_ACCESS_TOKEN vacío');
  let url: URL | null = null;
  try {
    url = c.SUPABASE_DB_URL ? new URL(c.SUPABASE_DB_URL) : null;
  } catch {
    url = null;
  }
  if (!url) {
    marca(false, 'SUPABASE_DB_URL vacía o no es una URI válida (debe empezar por postgresql://)');
  } else {
    marca(/^postgres(ql)?:$/.test(url.protocol), 'SUPABASE_DB_URL usa el protocolo postgresql://');
    const pw = decodeURIComponent(url.password);
    const corchetes = pw.startsWith('[') && pw.endsWith(']');
    marca(
      pw.length > 0 && !/YOUR-PASSWORD|\[|\]/.test(pw),
      !pw
        ? 'La URI no incluye contraseña'
        : corchetes
          ? 'La contraseña está entre corchetes [ ]: bórrelos (la URI debe quedar …:SUCONTRASEÑA@aws-…, sin [ ])'
          : /YOUR-PASSWORD/.test(pw)
            ? 'La URI todavía tiene el texto [YOUR-PASSWORD]: sustitúyalo por la contraseña real'
            : `La URI incluye una contraseña (${pw.length} caracteres, no se muestra)`,
    );
    if (/[@:/#?%\s]/.test(pw)) marca(false, 'La contraseña tiene caracteres especiales (@ : / # ? % o espacios): restablézcala con solo letras y números');
    const esPooler = /pooler\.supabase\.com$/.test(url.hostname);
    const esDirecta = url.hostname === `db.${ref}.supabase.co`;
    marca(esPooler || esDirecta, `Servidor: ${esPooler ? 'Session/Transaction pooler de Supabase' : esDirecta ? 'conexión directa' : 'desconocido'} (${url.hostname.replace(/^[^.]+/, '***')})`);
    if (esPooler) {
      marca(decodeURIComponent(url.username) === `postgres.${ref}`, `Usuario del pooler corresponde a este proyecto (postgres.<ref>)`);
      marca(url.port === '5432', url.port === '5432' ? 'Puerto 5432 (Session pooler, recomendado)' : `Puerto ${url.port || '(ninguno)'}: use el «Session pooler» (5432)`);
    }
  }

  // --- 2. API de gestión -------------------------------------------------------------
  if (/^sbp_/.test(tok)) {
    try {
      const p = await gestion<{ id: string; name: string; region: string; status: string }>(c, 'GET', '');
      marca(p.id === ref, `API de gestión: acceso correcto al proyecto «${p.name}» (${p.region}, estado ${p.status})`);
    } catch (e) {
      const m = ocultar(String(e), c);
      marca(
        false,
        /missing required permission/i.test(m)
          ? 'API de gestión: el token es válido pero NO tiene permisos sobre los proyectos (se creó con permisos limitados). Cree otro con acceso a los proyectos.'
          : /401/.test(m)
            ? 'API de gestión: token rechazado (caducado, revocado o mal copiado)'
            : `API de gestión: ${m.slice(0, 160)}`,
      );
    }
  }

  // --- 3. PostgreSQL -----------------------------------------------------------------------
  if (url) {
    try {
      const db = await conectar(c.SUPABASE_DB_URL!, true, { lanzar: true });
      const r = await db.query(`select current_user as u, current_setting('transaction_read_only') as ro, split_part(version(), ' ', 2) as v`);
      await db.end();
      marca(r.rows[0].ro === 'on', `PostgreSQL: contraseña válida; conectado como ${r.rows[0].u.replace(/\..*/, '.***')} (PostgreSQL ${r.rows[0].v}) en sesión de SOLO LECTURA`);
    } catch (e) {
      const m = ocultar(String((e as Error).message ?? e), c);
      const pista = /password authentication failed|SASL|28P01/i.test(m)
        ? 'contraseña de la base de datos incorrecta (restablézcala en Project Settings → Database y actualice SUPABASE_DB_URL)'
        : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)
          ? 'no se encuentra el servidor (revise la dirección o la conexión a internet)'
          : /Tenant or user not found/i.test(m)
            ? 'usuario o región del pooler incorrectos (copie de nuevo la URI de «Session pooler»)'
            : /ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(m)
              ? 'el servidor no responde (red, cortafuegos o conexión directa solo IPv6: use el Session pooler)'
              : m.slice(0, 160);
      marca(false, `PostgreSQL: ${pista}`);
    }
  }

  // --- 4. protección del archivo ------------------------------------------------------------
  const modo = statSync(ruta).mode & 0o777;
  marca((modo & 0o077) === 0, `Permisos del archivo: ${modo.toString(8)}${(modo & 0o077) === 0 ? ' (solo su usuario)' : ' → conviene 600: chmod 600 privado/credenciales.env'}`);
  let ignorado = false;
  let rastreado = false;
  try {
    execFileSync('git', ['check-ignore', '-q', 'privado/credenciales.env'], { cwd: ROOT });
    ignorado = true;
  } catch {
    ignorado = false;
  }
  try {
    rastreado = execFileSync('git', ['ls-files', 'privado'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0;
  } catch {
    rastreado = false;
  }
  marca(ignorado, ignorado ? 'Excluido de git (.gitignore: privado/)' : 'NO está excluido de git');
  marca(!rastreado, rastreado ? 'Hay archivos de privado/ dentro de git' : 'Ningún archivo de privado/ está en el historial de git');

  for (const r of res) console.log(`${r.ok ? '✔' : '✖'} ${ocultar(r.texto, c)}`);
  const fallos = res.filter((r) => !r.ok).length;
  console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\n✔ Credenciales correctas. No se ha modificado nada.');
  return fallos ? 1 : 0;
}
