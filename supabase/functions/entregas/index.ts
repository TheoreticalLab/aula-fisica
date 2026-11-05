// Edge Function «entregas» (Deno): subida y descarga de los PDF de las entregas escritas, y capturas de la
// «Regularización de prácticas anteriores» (capturas.ts, almacenamiento privado aparte), fotos de clases impartidas
// (clases.ts) e imágenes de los controles de laboratorio (controles.ts).
//
// Verifica el JWT del usuario y usa la clave service_role (variable de entorno del servidor, nunca expuesta al
// navegador) para el almacenamiento privado y las funciones svc_*, que deciden la autorización.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BUCKET, descargar, HttpError, MAX_BYTES_ABSOLUTO, subir, type Deps } from './handler.ts';
import {
  BUCKET_CAPTURAS, destino, eliminarBorrador, MAX_BYTES_CAPTURA, MIME_CAPTURA, quitarCaptura, subirCaptura, verCaptura, type DepsCapturas,
} from './capturas.ts';
import { BUCKET_LABORATORIO, MAX_BYTES_CONTROL, MIME_CONTROL, subirControl, verControl } from './controles.ts';
import { BUCKET_AUDIO, MAX_BYTES_AUDIO, MIME_AUDIO, purgarAudios, subirAudio, verAudio } from './audio.ts';
import { BUCKET_CLASES, eliminarClase, MAX_BYTES_FOTO_CLASE, MAX_BYTES_MINIATURA, quitarFotoClase, subirFotoClase, verFotosClase } from './clases.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());

function cors(origin: string | null): Record<string, string> {
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Debe iniciar sesión');
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new HttpError(401, 'Sesión no válida');

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const deps: Deps = {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message, code: error.code } : null };
      },
      ensureBucket: async () => {
        const { data } = await admin.storage.getBucket(BUCKET);
        if (!data) {
          const { error } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES_ABSOLUTO, allowedMimeTypes: ['application/pdf'] });
          if (error && !/exist/i.test(error.message)) throw error;
        }
      },
      upload: async (path, bytes) => {
        const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
        if (error) throw error;
      },
      remove: async (path) => {
        await admin.storage.from(BUCKET).remove([path]);
      },
      signedUrl: async (path, seconds, name) => {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, seconds, { download: name });
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
      newId: () => crypto.randomUUID(),
      sha256: async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join(''),
    };

    const depsCapturas: DepsCapturas = {
      rpc: deps.rpc,
      ensureBucket: async () => {
        const { data } = await admin.storage.getBucket(BUCKET_CAPTURAS);
        if (!data) {
          const { error } = await admin.storage.createBucket(BUCKET_CAPTURAS, { public: false, fileSizeLimit: MAX_BYTES_CAPTURA, allowedMimeTypes: [...MIME_CAPTURA] });
          if (error && !/exist/i.test(error.message)) throw error;
        }
      },
      upload: async (path, bytes, mime) => {
        const { error } = await admin.storage.from(BUCKET_CAPTURAS).upload(path, bytes, { contentType: mime, upsert: false });
        if (!error) return 'nuevo';
        if (/exist|duplicate/i.test(error.message)) return 'existe';
        throw error;
      },
      remove: async (paths) => {
        await admin.storage.from(BUCKET_CAPTURAS).remove(paths);
      },
      signedUrl: async (path, seconds) => {
        const { data, error } = await admin.storage.from(BUCKET_CAPTURAS).createSignedUrl(path, seconds);
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
      newId: deps.newId,
      sha256: deps.sha256,
    };

    // Clases impartidas (migración 66): mismo patrón, otro bucket privado
    const depsClases: DepsCapturas & { signedDownload: (path: string, seconds: number, name: string) => Promise<string> } = {
      ...depsCapturas,
      ensureBucket: async () => {
        const { data } = await admin.storage.getBucket(BUCKET_CLASES);
        if (!data) {
          const { error } = await admin.storage.createBucket(BUCKET_CLASES, { public: false, fileSizeLimit: MAX_BYTES_FOTO_CLASE, allowedMimeTypes: [...MIME_CAPTURA] });
          if (error && !/exist/i.test(error.message)) throw error;
        }
      },
      upload: async (path, bytes, mime) => {
        const { error } = await admin.storage.from(BUCKET_CLASES).upload(path, bytes, { contentType: mime, upsert: false });
        if (!error) return 'nuevo';
        if (/exist|duplicate/i.test(error.message)) return 'existe';
        throw error;
      },
      remove: async (paths) => {
        await admin.storage.from(BUCKET_CLASES).remove(paths);
      },
      signedUrl: async (path, seconds) => {
        const { data, error } = await admin.storage.from(BUCKET_CLASES).createSignedUrl(path, seconds);
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
      signedDownload: async (path, seconds, name) => {
        const { data, error } = await admin.storage.from(BUCKET_CLASES).createSignedUrl(path, seconds, { download: name });
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
    };

    // Controles de laboratorio (migración 84): mismo patrón, otro bucket privado
    const depsLab: DepsCapturas = {
      ...depsCapturas,
      ensureBucket: async () => {
        const { data } = await admin.storage.getBucket(BUCKET_LABORATORIO);
        if (!data) {
          const { error } = await admin.storage.createBucket(BUCKET_LABORATORIO, { public: false, fileSizeLimit: MAX_BYTES_CONTROL, allowedMimeTypes: [...MIME_CONTROL] });
          if (error && !/exist/i.test(error.message)) throw error;
        }
      },
      upload: async (path, bytes, mime) => {
        const { error } = await admin.storage.from(BUCKET_LABORATORIO).upload(path, bytes, { contentType: mime, upsert: false });
        if (!error) return 'nuevo';
        if (/exist|duplicate/i.test(error.message)) return 'existe';
        throw error;
      },
      remove: async (paths) => {
        await admin.storage.from(BUCKET_LABORATORIO).remove(paths);
      },
      signedUrl: async (path, seconds) => {
        const { data, error } = await admin.storage.from(BUCKET_LABORATORIO).createSignedUrl(path, seconds);
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
    };

    // Respuestas orales (migración 86): mismo patrón, otro bucket privado
    const depsAudio: DepsCapturas = {
      ...depsCapturas,
      ensureBucket: async () => {
        const { data } = await admin.storage.getBucket(BUCKET_AUDIO);
        if (!data) {
          const { error } = await admin.storage.createBucket(BUCKET_AUDIO, { public: false, fileSizeLimit: MAX_BYTES_AUDIO, allowedMimeTypes: [...MIME_AUDIO] });
          if (error && !/exist/i.test(error.message)) throw error;
        }
      },
      upload: async (path, bytes, mime) => {
        const { error } = await admin.storage.from(BUCKET_AUDIO).upload(path, bytes, { contentType: mime, upsert: false });
        if (!error) return 'nuevo';
        if (/exist|duplicate/i.test(error.message)) return 'existe';
        throw error;
      },
      remove: async (paths) => {
        const { error } = await admin.storage.from(BUCKET_AUDIO).remove(paths);
        if (error) throw error;
      },
      signedUrl: async (path, seconds) => {
        const { data, error } = await admin.storage.from(BUCKET_AUDIO).createSignedUrl(path, seconds);
        if (error || !data) throw error ?? new Error('Sin enlace');
        return data.signedUrl;
      },
    };

    const tipo = req.headers.get('Content-Type') ?? '';
    let out: unknown;
    if (tipo.startsWith('multipart/form-data')) {
      if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES_ABSOLUTO + 100_000) throw new HttpError(413, 'El archivo es demasiado grande');
      const form = await req.formData();
      const f = form.get('archivo');
      if (form.get('modulo') === 'clases') {
        const foto = f instanceof File && f.size <= MAX_BYTES_FOTO_CLASE ? { bytes: new Uint8Array(await f.arrayBuffer()) } : null;
        if (f instanceof File && !foto) throw new HttpError(413, 'La fotografía es demasiado grande');
        const m = form.get('miniatura');
        const mini = m instanceof File && m.size <= MAX_BYTES_MINIATURA ? { bytes: new Uint8Array(await m.arrayBuffer()) } : null;
        out = await subirFotoClase({ session_id: form.get('session_id'), posicion: form.get('posicion'), sha_original: form.get('sha_original') },
          foto, mini, userData.user.id, depsClases);
      } else if (form.get('modulo') === 'audio') {
        const grabacion = f instanceof File && f.size <= MAX_BYTES_AUDIO ? { bytes: new Uint8Array(await f.arrayBuffer()) } : null;
        if (f instanceof File && !grabacion) throw new HttpError(413, 'La grabación es demasiado grande');
        out = await subirAudio({ attempt_id: form.get('attempt_id'), exercise_id: form.get('exercise_id'), duracion_ms: form.get('duracion_ms') },
          grabacion, userData.user.id, depsAudio);
      } else if (form.get('modulo') === 'laboratorio') {
        const imagen = f instanceof File && f.size <= MAX_BYTES_CONTROL ? { bytes: new Uint8Array(await f.arrayBuffer()) } : null;
        if (f instanceof File && !imagen) throw new HttpError(413, 'La imagen es demasiado grande');
        out = await subirControl(form.get('box_id'), imagen, userData.user.id, depsLab);
      } else if (form.get('modulo') === 'regularizacion') {
        const imagen = f instanceof File && f.size <= MAX_BYTES_CAPTURA ? { bytes: new Uint8Array(await f.arrayBuffer()) } : null;
        if (f instanceof File && !imagen) throw new HttpError(413, 'La imagen es demasiado grande');
        out = await subirCaptura({ declaration_id: form.get('declaration_id'), libre_id: form.get('libre_id'), destino: form.get('destino'),
          posicion: form.get('posicion'), sha_original: form.get('sha_original'), bytes_original: form.get('bytes_original'), dhash: form.get('dhash') }, imagen, userData.user.id, depsCapturas);
      } else {
        const archivo = f instanceof File ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
        out = await subir(form.get('box_id'), archivo, userData.user.id, deps);
      }
    } else {
      const raw = await req.text();
      if (raw.length > 10_000) throw new HttpError(413, 'Solicitud demasiado grande');
      const body = JSON.parse(raw);
      if (body?.action === 'descargar') out = await descargar(body.file_id, userData.user.id, deps);
      else if (body?.action === 'captura_ver') out = await verCaptura(body.capture_id, userData.user.id, depsCapturas, destino(body.destino));
      else if (body?.action === 'captura_quitar') out = await quitarCaptura(body.capture_id, userData.user.id, depsCapturas, destino(body.destino));
      else if (body?.action === 'borrador_eliminar') out = await eliminarBorrador(body.declaration_id, userData.user.id, depsCapturas);
      else if (body?.action === 'audio_ver') out = await verAudio(body.audio_id, userData.user.id, depsAudio);
      else if (body?.action === 'audio_purgar') out = await purgarAudios(body.dias, userData.user.id, depsAudio);
      else if (body?.action === 'control_ver') out = await verControl(body.file_id, userData.user.id, depsLab);
      else if (body?.action === 'clase_fotos') out = await verFotosClase(body.session_id, userData.user.id, depsClases);
      else if (body?.action === 'clase_foto_quitar') out = await quitarFotoClase(body.image_id, userData.user.id, depsClases);
      else if (body?.action === 'clase_eliminar') out = await eliminarClase(body.session_id, userData.user.id, depsClases);
      else throw new HttpError(400, 'Acción no válida');
    }
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof SyntaxError ? 400 : 500;
    const message = e instanceof HttpError ? e.message : status === 400 ? 'JSON inválido' : 'Error interno';
    if (status === 500) console.error(e);
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
