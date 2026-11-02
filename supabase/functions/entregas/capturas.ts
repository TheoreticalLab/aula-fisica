/**
 * Capturas de la «Regularización de prácticas anteriores» (migración 45), dentro de la Edge Function «entregas».
 * Independiente de Deno para probarla con Vitest (tests/regularizacion-capturas.test.ts).
 *
 *  - subir_captura  { declaration_id, posicion, archivo, sha_original?, bytes_original? }
 *        comprueba el permiso (svc_hist_captura_check), exige una IMAGEN real (WebP, JPEG o PNG por su firma, no por
 *        la extensión; un PDF o un documento se rechaza), lee sus dimensiones, la guarda en el almacenamiento PRIVADO
 *        «regularizacion» con ruta sección/estudiante/sha256.ext (la misma imagen del mismo estudiante se guarda una
 *        sola vez) y registra solo los metadatos (svc_hist_captura_registrar).
 *  - captura_ver     { capture_id }      → enlace temporal (5 min) para verla: autor, profesorado de la sección o admin.
 *  - captura_quitar  { capture_id }      → la quita del registro y borra el archivo si ya nadie lo usa.
 *  - borrador_eliminar { declaration_id } → borra un borrador propio y sus archivos sin uso.
 *
 * Las imágenes nunca se envían a servicios externos.
 */
import { comprobarDuplicado, HttpError } from './handler.ts';

export interface DepsCapturas {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  ensureBucket(): Promise<void>;
  /** 'nuevo' si se escribió; 'existe' si ya había un objeto con esa ruta (misma imagen del mismo estudiante). */
  upload(path: string, bytes: Uint8Array, mime: string): Promise<'nuevo' | 'existe'>;
  remove(paths: string[]): Promise<void>;
  signedUrl(path: string, seconds: number): Promise<string>;
  newId(): string;
  sha256(bytes: Uint8Array): Promise<string>;
}

export const BUCKET_CAPTURAS = 'regularizacion';
export const MAX_BYTES_CAPTURA = 5 * 1048576;           // tope absoluto; el límite real lo fija la sección (por defecto 2 MB)
export const MIME_CAPTURA = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type MimeCaptura = (typeof MIME_CAPTURA)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{64}$/;
const EXT: Record<MimeCaptura, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, `Parámetro ${name} inválido`);
  return v;
}

async function call<T>(d: DepsCapturas, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === 'P0001' ? 400 : error.code === 'P0002' ? 404 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno' : error.message);
  }
  return data as T;
}

export interface InfoImagen { mime: MimeCaptura; ancho: number; alto: number }

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Identifica la imagen por su FIRMA y lee sus dimensiones. null si no es WebP, JPEG ni PNG válidos. */
export function infoImagen(b: Uint8Array): InfoImagen | null {
  if (b.length < 32) return null;
  // PNG: firma de 8 bytes y cabecera IHDR
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && ascii(b, 12, 4) === 'IHDR') {
    return { mime: 'image/png', ancho: u32be(b, 16), alto: u32be(b, 20) };
  }
  // WebP: RIFF....WEBP y un bloque VP8 / VP8L / VP8X
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const tipo = ascii(b, 12, 4);
    if (tipo === 'VP8X') return { mime: 'image/webp', ancho: u24le(b, 24) + 1, alto: u24le(b, 27) + 1 };
    if (tipo === 'VP8L' && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { mime: 'image/webp', ancho: (bits & 0x3fff) + 1, alto: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (tipo === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { mime: 'image/webp', ancho: u16le(b, 26) & 0x3fff, alto: u16le(b, 28) & 0x3fff };
    }
    return null;
  }
  // JPEG: FFD8 y el primer marcador SOFn con las dimensiones
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i++; continue; }
      const len = u16be(b, i + 2);
      if (len < 2) return null;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { mime: 'image/jpeg', alto: u16be(b, i + 5), ancho: u16be(b, i + 7) };
      if (m === 0xda || m === 0xd9) return null;
      i += 2 + len;
    }
    return null;
  }
  return null;
}

/** Mensaje claro cuando suben el documento en vez de la captura. */
function motivoNoImagen(b: Uint8Array): string {
  const inicio = ascii(b, 0, Math.min(8, b.length));
  if (inicio.startsWith('%PDF')) return 'Ese archivo es un PDF. No suba el documento de la práctica: solo una captura de pantalla del envío.';
  if (inicio.startsWith('PK')) return 'Ese archivo es un documento (Word u otro). No suba la práctica: solo una captura de pantalla del envío.';
  return 'El archivo no es una imagen válida. Adjunte una captura de pantalla (WebP, JPEG o PNG).';
}

export const rutaCaptura = (clase: string, usuario: string, sha: string, mime: MimeCaptura) => `${clase}/${usuario}/${sha}.${EXT[mime]}`;

/**
 * Dos destinos con las mismas reglas de imagen: capturas de envíos por correo (declaration) y fotos de prácticas sin
 * correo (libre, migración 47, ruta con prefijo «libre/» para que los dos registros nunca compartan un archivo).
 */
export type Destino = 'declaracion' | 'libre';
const DESTINOS = {
  declaracion: { check: 'svc_hist_captura_check', registrar: 'svc_hist_captura_registrar', ruta: 'svc_hist_captura_ruta', quitar: 'svc_hist_captura_quitar',
    pId: 'p_decl', pObjeto: 'p_capture', campo: 'declaration_id', maxPos: 3, prefijo: '' },
  libre: { check: 'svc_hist_libre_foto_check', registrar: 'svc_hist_libre_foto_registrar', ruta: 'svc_hist_libre_foto_ruta', quitar: 'svc_hist_libre_foto_quitar',
    pId: 'p_libre', pObjeto: 'p_foto', campo: 'libre_id', maxPos: 4, prefijo: 'libre/' },
} as const;
export const destino = (v: unknown): Destino => (v === 'libre' ? 'libre' : 'declaracion');

export async function subirCaptura(
  campos: { declaration_id?: unknown; libre_id?: unknown; destino?: unknown; posicion: unknown; sha_original?: unknown; bytes_original?: unknown; dhash?: unknown },
  archivo: { bytes: Uint8Array } | null, userId: string, d: DepsCapturas,
) {
  const D = DESTINOS[destino(campos.destino)];
  const decl = uuid(D.campo === 'libre_id' ? campos.libre_id : campos.declaration_id, D.campo);
  const posicion = Number(campos.posicion);
  if (!Number.isInteger(posicion) || posicion < 1 || posicion > D.maxPos) throw new HttpError(400, 'Posición de imagen no válida');
  if (!archivo || !archivo.bytes.length) throw new HttpError(400, 'No se recibió ninguna imagen');
  if (archivo.bytes.length > MAX_BYTES_CAPTURA) throw new HttpError(413, 'La imagen es demasiado grande');
  const shaOriginal = typeof campos.sha_original === 'string' && SHA_RE.test(campos.sha_original) ? campos.sha_original : null;
  const bOrig = Number(campos.bytes_original);
  const bytesOriginal = Number.isInteger(bOrig) && bOrig > 0 && bOrig < 200 * 1048576 ? bOrig : null;

  // permiso, plazo, cuota y tamaño ANTES de tocar el almacenamiento
  const chk = await call<{ class_id: string }>(d, D.check, { p_user: userId, [D.pId]: decl, p_posicion: posicion, p_bytes: archivo.bytes.length });
  const info = infoImagen(archivo.bytes);
  if (!info) throw new HttpError(400, motivoNoImagen(archivo.bytes));
  if (Math.min(info.ancho, info.alto) < 200) throw new HttpError(400, 'La imagen es demasiado pequeña para leerla (mínimo 200 píxeles por lado)');
  if (Math.max(info.ancho, info.alto) > 16384) throw new HttpError(400, 'La imagen es demasiado grande en píxeles; recórtela o divídala');

  const sha = await d.sha256(archivo.bytes);
  // la misma imagen que ya subió otro estudiante de la asignatura (exacta o a otra resolución): no se guarda
  const kind = D.campo === 'libre_id' ? 'foto_libre' : 'captura';
  const dhash = typeof campos.dhash === 'string' && /^[0-9a-f]{16}$/.test(campos.dhash) ? campos.dhash : null;
  await comprobarDuplicado(d.rpc, { p_user: userId, p_class: chk.class_id, p_box: null, p_kind: kind, p_sha: sha, p_sha_original: shaOriginal, p_dhash: dhash }, 'imagen');
  const path = D.prefijo + rutaCaptura(chk.class_id, userId, sha, info.mime);
  await d.ensureBucket();
  const estado = await d.upload(path, archivo.bytes, info.mime);
  try {
    const r = await call<{ id: string; liberar: string | null }>(d, D.registrar, {
      p_user: userId, [D.pId]: decl, p_posicion: posicion, p_id: d.newId(), p_path: path, p_mime: info.mime, p_bytes: archivo.bytes.length,
      p_ancho: info.ancho, p_alto: info.alto, p_sha: sha, p_sha_original: shaOriginal, p_bytes_original: bytesOriginal,
    });
    if (r.liberar) await d.remove([r.liberar]).catch(() => undefined);
    await d.rpc('svc_huella_guardar', { p_kind: kind, p_object: r.id, p_user: userId, p_class: chk.class_id, p_box: null, p_sha: sha, p_sha_original: shaOriginal, p_dhash: dhash });
    return { id: r.id, bytes: archivo.bytes.length, ancho: info.ancho, alto: info.alto, mime: info.mime, reutilizada: estado === 'existe' };
  } catch (e) {
    // si no se pudo registrar, no queda un archivo huérfano (pero nunca se borra uno que ya existía y otro registro usa)
    if (estado === 'nuevo') await d.remove([path]).catch(() => undefined);
    throw e;
  }
}

export async function verCaptura(captureId: unknown, userId: string, d: DepsCapturas, dest: Destino = 'declaracion') {
  const id = uuid(captureId, 'capture_id');
  const D = DESTINOS[dest];
  const path = await call<string>(d, D.ruta, { p_user: userId, [D.pObjeto]: id });
  return { url: await d.signedUrl(path, 300) };
}

export async function quitarCaptura(captureId: unknown, userId: string, d: DepsCapturas, dest: Destino = 'declaracion') {
  const id = uuid(captureId, 'capture_id');
  const D = DESTINOS[dest];
  const libre = await call<string | null>(d, D.quitar, { p_user: userId, [D.pObjeto]: id });
  if (libre) await d.remove([libre]).catch(() => undefined);
  return { ok: true };
}

export async function eliminarBorrador(declId: unknown, userId: string, d: DepsCapturas) {
  const id = uuid(declId, 'declaration_id');
  const libres = await call<string[]>(d, 'svc_hist_borrador_eliminar', { p_user: userId, p_decl: id });
  if (libres?.length) await d.remove(libres).catch(() => undefined);
  return { ok: true };
}
