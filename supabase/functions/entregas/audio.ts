/**
 * Respuestas ORALES (migración 86), dentro de la Edge Function «entregas». Independiente de Deno para probarla con
 * Vitest (tests/respuesta-oral.test.ts).
 *
 *  - subir (modulo «audio») { attempt_id, exercise_id, duracion_ms, archivo }
 *        comprueba el permiso (svc_audio_check: dueño, intento escribible, pregunta oral abierta, duración y número de
 *        grabaciones), exige un AUDIO real por su firma (WebM, Ogg, MP4/M4A, MP3 o WAV; nunca por la extensión), lo
 *        guarda en el almacenamiento PRIVADO «respuestas-audio» con ruta intento/estudiante/archivo.ext y lo registra
 *        (svc_audio_record, que deja la respuesta apuntando a la grabación). Si el registro falla, se borra el archivo.
 *  - audio_ver { audio_id } → enlace temporal (5 min): autor, profesorado de la sección, personal o administrador.
 *  - audio_purgar { dias } → solo administradores: borra los archivos de intentos entregados hace más de `dias` (≥ 180)
 *        y deja constancia; las filas, las respuestas y las notas se conservan.
 * Las grabaciones nunca se envían a servicios externos.
 */
import { HttpError } from './handler.ts';
import type { DepsCapturas } from './capturas.ts';

export const BUCKET_AUDIO = 'respuestas-audio';
export const MAX_BYTES_AUDIO = 20 * 1048576;
export const MIME_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const;
export type MimeAudio = (typeof MIME_AUDIO)[number];
const EXT: Record<MimeAudio, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA_AUDIO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|m4a|mp3|wav)$/i;

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

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Identifica el contenedor de audio por su FIRMA. null si no es un formato admitido. */
export function tipoAudio(b: Uint8Array): MimeAudio | null {
  if (b.length < 16) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';     // EBML (WebM/Matroska)
  if (ascii(b, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(b, 4, 4) === 'ftyp') return 'audio/mp4';                                              // MP4/M4A (Safari)
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return 'audio/wav';
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}

export const rutaAudio = (attempt: string, user: string, id: string, mime: MimeAudio) => `${attempt}/${user}/${id}.${EXT[mime]}`;

export async function subirAudio(campos: { attempt_id: unknown; exercise_id: unknown; duracion_ms: unknown }, archivo: { bytes: Uint8Array } | null,
  userId: string, d: DepsCapturas) {
  const attempt = uuid(campos.attempt_id, 'attempt_id');
  const exercise = uuid(campos.exercise_id, 'exercise_id');
  const dur = Number(campos.duracion_ms);
  if (!Number.isInteger(dur) || dur <= 0 || dur > 660_000) throw new HttpError(400, 'Duración no válida');
  if (!archivo || !archivo.bytes.length) throw new HttpError(400, 'No se recibió ninguna grabación');
  if (archivo.bytes.length > MAX_BYTES_AUDIO) throw new HttpError(413, 'La grabación es demasiado grande');
  // permiso, plazo, duración y grabaciones restantes ANTES de tocar el almacenamiento
  await call(d, 'svc_audio_check', { p_user: userId, p_attempt: attempt, p_exercise: exercise, p_bytes: archivo.bytes.length, p_duracion_ms: dur });
  const mime = tipoAudio(archivo.bytes);
  if (!mime) throw new HttpError(400, 'El archivo no es una grabación de audio válida.');
  const id = d.newId();
  const path = rutaAudio(attempt, userId, id, mime);
  const sha = await d.sha256(archivo.bytes);
  await d.ensureBucket();
  const estado = await d.upload(path, archivo.bytes, mime);
  if (estado === 'existe') throw new HttpError(409, 'Intente de nuevo');   // id nuevo: no debería ocurrir; nunca se sobrescribe
  try {
    return await call<{ id: string; subido: string; duracion_ms: number }>(d, 'svc_audio_record', {
      p_user: userId, p_attempt: attempt, p_exercise: exercise, p_id: id, p_path: path, p_mime: mime, p_bytes: archivo.bytes.length,
      p_duracion_ms: dur, p_sha: sha,
    });
  } catch (e) {
    await d.remove([path]).catch(() => undefined);
    throw e;
  }
}

export async function verAudio(audioId: unknown, userId: string, d: DepsCapturas) {
  const id = uuid(audioId, 'audio_id');
  const path = await call<string>(d, 'svc_audio_path', { p_user: userId, p_audio: id });
  if (typeof path !== 'string' || !RUTA_AUDIO.test(path)) throw new HttpError(400, 'No es una grabación');
  return { url: await d.signedUrl(path, 300) };
}

export async function purgarAudios(dias: unknown, userId: string, d: DepsCapturas) {
  const n = Number(dias);
  if (!Number.isInteger(n) || n < 180) throw new HttpError(400, 'La conservación mínima es de 180 días');
  const lista = await call<{ id: string; path: string }[]>(d, 'svc_audio_caducados', { p_admin: userId, p_dias: n });
  let borrados = 0;
  for (let i = 0; i < lista.length; i += 100) {
    const lote = lista.slice(i, i + 100);
    await d.remove(lote.map((x) => x.path));                       // si falla, no se marca nada (se reintentará)
    borrados += await call<number>(d, 'svc_audio_marcar_eliminados', { p_admin: userId, p_ids: lote.map((x) => x.id) });
  }
  return { borrados };
}
