// Edge Function «calificar» (Deno). Despliegue: npx supabase functions deploy calificar
//
// Verifica el JWT del usuario y usa la clave service_role (variable de entorno del servidor,
// nunca expuesta al navegador) para llamar a las funciones svc_*, que hacen la autorización.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, HttpError } from './handler.ts';

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

    const raw = await req.text();
    if (raw.length > 50_000) throw new HttpError(413, 'Solicitud demasiado grande');
    const body = JSON.parse(raw);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const out = await handle(body, userData.user.id, {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message, code: error.code } : null };
      },
    });
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof SyntaxError ? 400 : 500;
    const message = e instanceof HttpError ? e.message : status === 400 ? 'JSON inválido' : 'Error interno';
    if (status === 500) console.error(e);
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
