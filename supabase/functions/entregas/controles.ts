/**
 * Controles de las asignaturas de LABORATORIO (migración 84), dentro de la Edge Function «entregas».
 * Independiente de Deno para probarla con Vitest (tests/laboratorio.test.ts).
 *
 *  - subir (modulo «laboratorio») { box_id, archivo }
 *        comprueba plazo, inscripción y cupo (svc_upload_check), exige una IMAGEN real (WebP, JPEG o PNG por su firma,
 *        no por la extensión), lee sus dimensiones, la guarda en el almacenamiento PRIVADO «laboratorio» con ruta
 *        buzón/estudiante/archivo.ext y la registra (svc_lab_control_record: bloquea el buzón, vuelve a comprobar todo
 *        y fija la hora del servidor). Si el registro falla, el archivo recién guardado se borra.
 *  - control_ver { file_id } → enlace temporal (5 min) para ver la imagen: autor, profesorado de la sección o admin
 *        (svc_upload_file_path, la misma regla que los PDF de las entregas).
 *
 * Las imágenes nunca se envían a servicios externos ni se califican de forma automática.
 */
import { HttpError } from './handler.ts';
import { infoImagen, MIME_CAPTURA, type DepsCapturas, type MimeCaptura } from './capturas.ts';

export const BUCKET_LABORATORIO = 'laboratorio';
/** Tope absoluto; el del buzón (5 MB) lo aplica la base de datos. La app comprime antes de enviar (≈1,6 MB). */
export const MAX_BYTES_CONTROL = 5 * 1048576;
export const MIME_CONTROL = MIME_CAPTURA;
const EXT: Record<MimeCaptura, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA_IMAGEN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/i;

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

export const rutaControl = (box: string, user: string, file: string, mime: MimeCaptura) => `${box}/${user}/${file}.${EXT[mime]}`;

function motivoNoImagen(b: Uint8Array): string {
  const inicio = String.fromCharCode(...b.subarray(0, Math.min(8, b.length)));
  if (inicio.startsWith('%PDF')) return 'Ese archivo es un PDF. El control se entrega como una fotografía (JPG, PNG o WEBP).';
  if (inicio.startsWith('PK')) return 'Ese archivo es un documento. El control se entrega como una fotografía (JPG, PNG o WEBP).';
  return 'El archivo no es una imagen válida. Use una fotografía JPG, PNG o WEBP.';
}

export async function subirControl(boxId: unknown, archivo: { bytes: Uint8Array } | null, userId: string, d: DepsCapturas) {
  const box = uuid(boxId, 'box_id');
  if (!archivo || !archivo.bytes.length) throw new HttpError(400, 'No se recibió ninguna imagen');
  if (archivo.bytes.length > MAX_BYTES_CONTROL) throw new HttpError(413, 'La imagen es demasiado grande');
  // inscripción, plazo, cupo y tamaño ANTES de tocar el almacenamiento
  await call(d, 'svc_upload_check', { p_user: userId, p_box: box, p_size: archivo.bytes.length });
  const info = infoImagen(archivo.bytes);
  if (!info) throw new HttpError(400, motivoNoImagen(archivo.bytes));
  if (Math.min(info.ancho, info.alto) < 200) throw new HttpError(400, 'La imagen es demasiado pequeña para leerla (mínimo 200 píxeles por lado)');
  if (Math.max(info.ancho, info.alto) > 16384) throw new HttpError(400, 'La imagen es demasiado grande en píxeles');

  const id = d.newId();
  const path = rutaControl(box, userId, id, info.mime);
  const sha = await d.sha256(archivo.bytes);
  await d.ensureBucket();
  const estado = await d.upload(path, archivo.bytes, info.mime);
  if (estado === 'existe') throw new HttpError(409, 'Intente de nuevo');   // id nuevo: no debería ocurrir; nunca se sobrescribe
  try {
    const r = await call<{ id: string; estado: string; subido: string }>(d, 'svc_lab_control_record', {
      p_user: userId, p_box: box, p_file: id, p_path: path, p_size: archivo.bytes.length, p_sha: sha,
      p_mime: info.mime, p_ancho: info.ancho, p_alto: info.alto,
    });
    return { ...r, bytes: archivo.bytes.length, ancho: info.ancho, alto: info.alto, mime: info.mime };
  } catch (e) {
    // si no se pudo registrar (p. ej. otro envío simultáneo del mismo control), no queda un archivo huérfano
    await d.remove([path]).catch(() => undefined);
    throw e;
  }
}

export async function verControl(fileId: unknown, userId: string, d: DepsCapturas) {
  const id = uuid(fileId, 'file_id');
  const path = await call<string>(d, 'svc_upload_file_path', { p_user: userId, p_file: id });
  // los PDF de las entregas viven en otro almacenamiento: por aquí solo se firman imágenes de control
  if (typeof path !== 'string' || !RUTA_IMAGEN.test(path)) throw new HttpError(400, 'No es la imagen de un control');
  return { url: await d.signedUrl(path, 300) };
}
