// Edge Function «admin-cuentas» (Deno). Solo administradores (comprobado con el JWT y en la base de datos).
// La clave service_role la proporciona Supabase en el servidor; nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AdminError, administrar } from './handler.ts';

const ORIGENES = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());
// Dominio de los correos técnicos (no se envían correos). Configurable con «supabase secrets set CUENTAS_DOMINIO=…».
const DOMINIO = Deno.env.get('CUENTAS_DOMINIO') ?? 'cuentas.aula-fisica.invalid';

function cors(origin: string | null): Record<string, string> {
  const allow = ORIGENES.includes('*') ? '*' : origin && ORIGENES.includes(origin) ? origin : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) throw new AdminError(401, 'Debe iniciar sesión');
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) throw new AdminError(401, 'Sesión no válida');
    const raw = await req.text();
    if (raw.length > 400_000) throw new AdminError(413, 'Solicitud demasiado grande');
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const out = await administrar(JSON.parse(raw), u.user.id, {
      dominio: DOMINIO,
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message, code: error.code } : null };
      },
      crearUsuario: async ({ email, password, app_metadata }) => {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata });
        if (error) console.error('createUser', error.message);
        return { id: data.user?.id, error: error?.message };
      },
      actualizarUsuario: async (id, cambios) => {
        const { error } = await admin.auth.admin.updateUserById(id, cambios);
        if (error) console.error('updateUserById', error.message);
        return { error: error?.message };
      },
    });
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof AdminError ? e.status : e instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error(e);
    const message = e instanceof AdminError ? e.message : status === 400 ? 'JSON inválido' : 'Error interno';
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
