// Edge Function «recuperar» (Deno): recuperación supervisada de acceso (sin sesión). Ver handler.ts.
// Despliegue: npm run plan / npm run aplicar (--no-verify-jwt: la usan estudiantes sin sesión)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { recuperar } from './handler.ts';
import { describirUA } from '../acceder/handler.ts';

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
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const raw = await req.text();
    if (raw.length > 2000) return new Response(JSON.stringify({ error: 'Solicitud demasiado grande' }), { status: 413, headers });
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      /* cuerpo inválido: el manejador responde 400 */
    }
    // la IP y la instalación solo se guardan como hash (con un secreto del servidor como sal), igual que en «acceder»
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const ipHash = ip ? (await sha256(service.slice(-24) + '|' + ip)).slice(0, 32) : null;
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const instalacion = typeof b.install_id === 'string' && b.install_id.trim() ? b.install_id.trim().slice(0, 64) : null;
    const ua = describirUA((req.headers.get('user-agent') ?? '').slice(0, 300));
    const meta = {
      device_hash: instalacion ? (await sha256(service.slice(-24) + '|dev|' + instalacion)).slice(0, 32) : null,
      browser: ua.browser,
      device_type: ua.device_type,
    };
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await recuperar(body, ipHash, {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message } : null };
      },
      // API oficial de administración de Supabase Auth: genera el enlace SIN enviarlo; solo se usa el token hasheado
      emitirToken: async (email) => {
        const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        const p = data?.properties;
        if (error || !p?.hashed_token) return null;
        return { token_hash: p.hashed_token, tipo: p.verification_type || 'magiclink' };
      },
      sha256,
      esperar: (ms) => new Promise((res) => setTimeout(res, ms)),
      ahora: () => Date.now(),
    }, meta);
    return new Response(JSON.stringify(r.body), { status: r.status, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'No se pudo procesar la solicitud. Inténtelo de nuevo.' }), { status: 500, headers });
  }
});
