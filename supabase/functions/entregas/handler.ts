/**
 * Lógica de la Edge Function «entregas» (PDF de prácticas y exámenes escritos), independiente de Deno para
 * probarla con Vitest (tests/entregas.test.ts).
 *
 *  - subir     { box_id, archivo }  → comprueba la autorización (svc_upload_check), verifica que es un PDF real,
 *                                     lo guarda en el almacenamiento PRIVADO y lo registra (svc_upload_record).
 *  - descargar { file_id }          → enlace temporal (2 min) si es el autor, el profesorado de la sección o el admin.
 *
 * La autorización la deciden las funciones SQL svc_* con el id del usuario verificado por el JWT.
 */

export interface Deps {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  ensureBucket(): Promise<void>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  signedUrl(path: string, seconds: number, downloadName: string): Promise<string>;
  newId(): string;
  sha256(bytes: Uint8Array): Promise<string>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const BUCKET = 'entregas';
export const MAX_BYTES_ABSOLUTO = 20 * 1048576;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, `Parámetro ${name} inválido`);
  return v;
}

async function call<T>(d: Deps, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await d.rpc(fn, args);
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === 'P0001' ? 400 : error.code === 'P0002' ? 404 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno' : error.message);
  }
  return data as T;
}

/** Un PDF real empieza por «%PDF-» y termina (salvo espacios) con «%%EOF». No basta con la extensión. */
export function esPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const fin = new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  return inicio.indexOf('%PDF-') >= 0 && inicio.indexOf('%PDF-') < 1024 && fin.includes('%%EOF');
}

/** Nombre original saneado (solo para mostrarlo; el archivo se guarda con un nombre generado). */
export function nombreSeguro(nombre: string): string {
  const base = (nombre.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
  const sinExt = base.replace(/\.pdf$/i, '').slice(0, 190) || 'entrega';
  return `${sinExt}.pdf`;
}

export const rutaArchivo = (box: string, user: string, file: string) => `${box}/${user}/${file}.pdf`;

/** Duplicados entre estudiantes (migración 67): mensaje al bloquear; nunca dice quién subió el otro archivo. */
export function mensajeDuplicado(r: { exacto?: boolean }, que: 'imagen' | 'documento'): string {
  return (r.exacto ? `Este ${que === 'imagen' ? 'archivo' : 'documento'} es idéntico a uno que ya subió otro estudiante de la asignatura.`
    : 'Esta imagen coincide con una que ya subió otro estudiante de la asignatura (aunque cambie la resolución o el formato).')
    + ' No se guardó. Si es un trabajo en grupo, el profesor puede autorizarlo: la solicitud quedó registrada.';
}

/** Comprobación de duplicados antes de guardar. Si la función aún no existe (migración pendiente), no bloquea. */
export async function comprobarDuplicado(rpc: Deps['rpc'], args: Record<string, unknown>, que: 'imagen' | 'documento') {
  const { data, error } = await rpc('svc_huella_check', args);
  if (error) {
    if (/svc_huella_check|does not exist|function/i.test(error.message)) return;
    const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === 'P0001' ? 400 : 500;
    throw new HttpError(status, status === 500 ? 'Error interno' : error.message);
  }
  const r = data as { ok?: boolean; exacto?: boolean } | null;
  if (r && r.ok === false) throw new HttpError(409, mensajeDuplicado(r, que));
}

export async function subir(boxId: unknown, archivo: { name: string; bytes: Uint8Array } | null, userId: string, d: Deps) {
  const box = uuid(boxId, 'box_id');
  if (!archivo || !archivo.bytes.length) throw new HttpError(400, 'No se recibió ningún archivo');
  if (archivo.bytes.length > MAX_BYTES_ABSOLUTO) throw new HttpError(413, 'El archivo es demasiado grande');
  // autorización y tamaño ANTES de tocar el almacenamiento
  await call(d, 'svc_upload_check', { p_user: userId, p_box: box, p_size: archivo.bytes.length });
  if (!esPdf(archivo.bytes)) throw new HttpError(400, 'El archivo no es un PDF válido');
  const id = d.newId();
  const path = rutaArchivo(box, userId, id);
  const sha = await d.sha256(archivo.bytes);
  // el mismo PDF que ya subió otro estudiante de la asignatura: no se guarda (salvo autorización del profesor)
  await comprobarDuplicado(d.rpc, { p_user: userId, p_class: null, p_box: box, p_kind: 'pdf', p_sha: sha, p_sha_original: null, p_dhash: null }, 'documento');
  await d.ensureBucket();
  await d.upload(path, archivo.bytes);
  try {
    const r = await call<{ id: string; estado: string }>(d, 'svc_upload_record', {
      p_user: userId, p_box: box, p_file: id, p_path: path, p_name: nombreSeguro(archivo.name), p_size: archivo.bytes.length, p_sha: sha,
    });
    await d.rpc('svc_huella_guardar', { p_kind: 'pdf', p_object: r.id ?? id, p_user: userId, p_class: null, p_box: box, p_sha: sha, p_sha_original: null, p_dhash: null });
    return r;
  } catch (e) {
    // si no se pudo registrar (p. ej. otra subida simultánea llenó el cupo), no queda un archivo huérfano
    await d.remove(path).catch(() => undefined);
    throw e;
  }
}

export async function descargar(fileId: unknown, userId: string, d: Deps) {
  const id = uuid(fileId, 'file_id');
  const path = await call<string>(d, 'svc_upload_file_path', { p_user: userId, p_file: id });
  return { url: await d.signedUrl(path, 120, `entrega-${id.slice(0, 8)}.pdf`) };
}
