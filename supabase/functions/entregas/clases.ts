/**
 * Clases impartidas (migración 66): fotografías de las pizarras en el bucket privado «archivo-clases».
 * Reutiliza la validación de imágenes de la regularización (tipo REAL por bytes mágicos, dimensiones) y el mismo
 * patrón: permiso y límites en SQL ANTES de tocar el almacenamiento, ruta construida por el servidor (sección/clase/sha),
 * duplicados por SHA-256, nunca archivos huérfanos, y acceso solo con URLs firmadas de corta duración.
 * El navegador ya corrige la orientación, quita los metadatos EXIF (al recodificar) y genera la miniatura.
 */
import { HttpError } from './handler.ts';
import { infoImagen, type DepsCapturas, type MimeCaptura } from './capturas.ts';

export const BUCKET_CLASES = 'archivo-clases';
export const MAX_BYTES_FOTO_CLASE = 8 * 1048576;        // tope absoluto; la sección fija el suyo (4 MB por defecto)
export const MAX_BYTES_MINIATURA = 400 * 1024;
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
    const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === 'P0001' ? 400 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno' : error.message);
  }
  return data as T;
}

export const rutaFotoClase = (clase: string, sesion: string, sha: string, mime: MimeCaptura, miniatura = false) =>
  `${clase}/${sesion}/${miniatura ? 't_' : ''}${sha}.${EXT[mime]}`;

export async function subirFotoClase(
  campos: { session_id: unknown; posicion: unknown; sha_original?: unknown },
  archivo: { bytes: Uint8Array } | null, miniatura: { bytes: Uint8Array } | null, userId: string, d: DepsCapturas,
) {
  const sesion = uuid(campos.session_id, 'session_id');
  const posicion = Number(campos.posicion);
  if (!Number.isInteger(posicion) || posicion < 1 || posicion > 4) throw new HttpError(400, 'Máximo 4 fotografías por clase');
  if (!archivo || !archivo.bytes.length) throw new HttpError(400, 'No se recibió ninguna fotografía');
  if (archivo.bytes.length > MAX_BYTES_FOTO_CLASE) throw new HttpError(413, 'La fotografía es demasiado grande');
  const shaOriginal = typeof campos.sha_original === 'string' && SHA_RE.test(campos.sha_original) ? campos.sha_original : null;

  // permiso, estado de la clase, máximo de 4 y tamaño: en SQL, antes de escribir nada
  const chk = await call<{ class_id: string; max_bytes: number }>(d, 'svc_clase_foto_check',
    { p_user: userId, p_session: sesion, p_posicion: posicion, p_bytes: archivo.bytes.length });
  const info = infoImagen(archivo.bytes);
  if (!info) throw new HttpError(400, 'El archivo no es una imagen válida (WebP, JPEG o PNG).');
  // una pizarra debe poder leerse: exponentes, subíndices y signos necesitan resolución
  if (Math.min(info.ancho, info.alto) < 600) throw new HttpError(400, 'La fotografía tiene poca resolución para leer las ecuaciones (mínimo 600 píxeles por lado)');
  if (Math.max(info.ancho, info.alto) > 16384) throw new HttpError(400, 'La fotografía es demasiado grande en píxeles');
  let mini: { bytes: Uint8Array; mime: MimeCaptura } | null = null;
  if (miniatura?.bytes.length) {
    const im = infoImagen(miniatura.bytes);
    if (!im || im.mime === 'image/png' || miniatura.bytes.length > MAX_BYTES_MINIATURA || Math.max(im.ancho, im.alto) > 800) throw new HttpError(400, 'Miniatura no válida');
    mini = { bytes: miniatura.bytes, mime: im.mime };
  }

  const sha = await d.sha256(archivo.bytes);
  const path = rutaFotoClase(chk.class_id, sesion, sha, info.mime);
  const thumb = mini ? rutaFotoClase(chk.class_id, sesion, sha, mini.mime, true) : null;
  await d.ensureBucket();
  const estado = await d.upload(path, archivo.bytes, info.mime);
  const estadoMini = mini && thumb ? await d.upload(thumb, mini.bytes, mini.mime).catch(() => null) : null;
  try {
    const r = await call<{ liberar: string[] }>(d, 'svc_clase_foto_registrar', {
      p_user: userId, p_session: sesion, p_posicion: posicion, p_path: path, p_thumb: estadoMini ? thumb : null, p_mime: info.mime,
      p_bytes: archivo.bytes.length, p_thumb_bytes: mini?.bytes.length ?? 0, p_ancho: info.ancho, p_alto: info.alto, p_sha: sha, p_sha_original: shaOriginal,
    });
    if (r.liberar?.length) await d.remove(r.liberar).catch(() => undefined);
    return { ok: true, posicion, bytes: archivo.bytes.length, ancho: info.ancho, alto: info.alto, mime: info.mime, reutilizada: estado === 'existe' };
  } catch (e) {
    const nuevos = [estado === 'nuevo' ? path : null, estadoMini === 'nuevo' ? thumb : null].filter((x): x is string => !!x);
    if (nuevos.length) await d.remove(nuevos).catch(() => undefined);
    throw e;
  }
}

/** URLs firmadas (10 min) de las fotos que el usuario puede ver; con descarga solo si el profesor la habilitó. */
export async function verFotosClase(sessionId: unknown, userId: string, d: DepsCapturas & { signedDownload?: (path: string, seconds: number, name: string) => Promise<string> }) {
  const sesion = uuid(sessionId, 'session_id');
  const r = await call<{ descarga: boolean; fotos: { id: string; posicion: number; path: string; thumb_path: string | null; mime: string }[] }>(
    d, 'svc_clase_fotos', { p_user: userId, p_session: sesion });
  const fotos = [];
  for (const f of r.fotos) {
    fotos.push({
      id: f.id, posicion: f.posicion,
      url: await d.signedUrl(f.path, 600),
      miniatura: f.thumb_path ? await d.signedUrl(f.thumb_path, 600) : null,
      descarga: r.descarga && d.signedDownload ? await d.signedDownload(f.path, 600, `pizarra-${f.posicion}.${f.path.split('.').pop()}`) : null,
    });
  }
  return { fotos };
}

export async function quitarFotoClase(imageId: unknown, userId: string, d: DepsCapturas) {
  const id = uuid(imageId, 'image_id');
  const r = await call<{ liberar: string[] }>(d, 'svc_clase_foto_quitar', { p_user: userId, p_image: id });
  if (r.liberar?.length) await d.remove(r.liberar).catch(() => undefined);
  return { ok: true };
}

export async function eliminarClase(sessionId: unknown, userId: string, d: DepsCapturas) {
  const id = uuid(sessionId, 'session_id');
  const r = await call<{ liberar: string[] }>(d, 'svc_clase_eliminar', { p_user: userId, p_session: id });
  if (r.liberar?.length) await d.remove(r.liberar).catch(() => undefined);
  return { ok: true };
}
