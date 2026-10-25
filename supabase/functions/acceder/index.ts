// Edge Function «acceder» (Deno): inicio de sesión con ID y contraseña.
// Despliegue: npm run plan / npm run aplicar (o: supabase functions deploy acceder --no-verify-jwt)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { acceder } from './handler.ts';

const ORIGENES = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());

function cors(origin: string | null): Record<string, string> {
  const allow = ORIGENES.includes('*') ? '*' : origin && ORIGENES.includes(origin) ? origin : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const raw = await req.text();
    if (raw.length > 2000) return new Response(JSON.stringify({ error: 'Solicitud demasiado grande' }), { status: 413, headers });
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      /* cuerpo inválido: el manejador responde 400 */
    }
    // la IP solo se guarda como hash (con un secreto del servidor como sal)
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const ipHash = ip ? (await sha256(service.slice(-24) + '|' + ip)).slice(0, 32) : null;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const r = await acceder(body, ipHash, {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message } : null };
      },
      passwordGrant: async (email, password) => {
        const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: anon, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return { ok: false };
        return { ok: true, session: await res.json() };
      },
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      ahora: () => Date.now(),
    });
    return new Response(JSON.stringify(r.body), { status: r.status, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'No se pudo iniciar sesión. Inténtelo de nuevo.' }), { status: 500, headers });
  }
});
