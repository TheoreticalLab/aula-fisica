// Edge Function «entregas» (Deno): subida y descarga de los PDF de las entregas escritas.
//
// Verifica el JWT del usuario y usa la clave service_role (variable de entorno del servidor, nunca expuesta al
// navegador) para el almacenamiento privado y las funciones svc_upload_*, que deciden la autorización.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BUCKET, descargar, HttpError, MAX_BYTES_ABSOLUTO, subir, type Deps } from './handler.ts';

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

    const tipo = req.headers.get('Content-Type') ?? '';
    let out: unknown;
    if (tipo.startsWith('multipart/form-data')) {
      if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES_ABSOLUTO + 100_000) throw new HttpError(413, 'El archivo es demasiado grande');
      const form = await req.formData();
      const f = form.get('archivo');
      const archivo = f instanceof File ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
      out = await subir(form.get('box_id'), archivo, userData.user.id, deps);
    } else {
      const raw = await req.text();
      if (raw.length > 10_000) throw new HttpError(413, 'Solicitud demasiado grande');
      const body = JSON.parse(raw);
      if (body?.action !== 'descargar') throw new HttpError(400, 'Acción no válida');
      out = await descargar(body.file_id, userData.user.id, deps);
    }
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof SyntaxError ? 400 : 500;
    const message = e instanceof HttpError ? e.message : status === 400 ? 'JSON inválido' : 'Error interno';
    if (status === 500) console.error(e);
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
