// Edge Function «orbe-ia» (Deno): genera chistes de física con la API de Claude para Orbe IA.
//
// · Verifica la sesión del usuario (JWT) y decide permisos en SQL (svc_orbe_ia_*, solo service_role).
// · La clave de Anthropic es un secreto del servidor: «supabase secrets set ANTHROPIC_API_KEY=…». Nunca llega
//   al navegador; si falta, la función responde «sin_clave» y no llama a nada.
// · Mientras la configuración tenga api_real = false se usa el simulador: ninguna llamada de pago.
import Anthropic from 'npm:@anthropic-ai/sdk@^1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { atender, HttpError, type Peticion, type RespuestaModelo } from './handler.ts';
import type { DepsClase } from './clase.ts';

const BUCKET_CLASES = 'archivo-clases';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());
const CLAVE = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Modelos que admiten el respaldo automático del servidor ante un rechazo («fallbacks: "default"»).
const CON_RESPALDO = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

function cors(origin: string | null): Record<string, string> {
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const cliente = CLAVE ? new Anthropic({ apiKey: CLAVE, timeout: 120_000, maxRetries: 1 }) : null;

async function llamarModelo(p: Peticion): Promise<RespuestaModelo> {
  if (!cliente) throw new HttpError(503, 'sin_clave');
  try {
    const respaldo = CON_RESPALDO.has(p.model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};
    const params = {
      model: p.model,
      max_tokens: p.max_tokens,
      system: p.system,
      // clases impartidas: bloques de texto e imágenes (base64); el resto, una cadena
      messages: [{ role: 'user' as const, content: (p.contenido ?? p.user) as string }],
      // por defecto poco razonamiento (chistes, mensajes); la generación de preguntas pide «medium»; salida JSON por esquema
      output_config: { effort: p.effort ?? 'low', format: { type: 'json_schema' as const, schema: p.schema } },
      ...respaldo,
    };
    // respuestas largas (clase ampliada): streaming, que la API exige para salidas grandes, y más tiempo
    const r = p.largo
      ? await cliente.beta.messages.stream(params, { timeout: 380_000 }).finalMessage()
      : await cliente.beta.messages.create(params);
    const texto = r.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    return { texto, stop_reason: r.stop_reason ?? null, input_tokens: r.usage.input_tokens ?? 0, output_tokens: r.usage.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new HttpError(502, 'autenticacion');
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(502, 'limite_api');
    if (e instanceof Anthropic.BadRequestError) throw new HttpError(502, 'peticion_invalida');
    if (e instanceof Anthropic.APIConnectionError) throw new HttpError(502, 'red');
    if (e instanceof Anthropic.APIError) throw new HttpError(502, 'servidor_api');
    throw e;
  }
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
    // (el pulso de la clase trae cifras agregadas; el resto, unos cientos de caracteres)
    if (raw.length > 16_000) throw new HttpError(413, 'Solicitud demasiado grande');
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const deps: DepsClase = {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error: error ? { message: error.message } : null };
      },
      llamarModelo,
      hayClave: !!cliente,
      // clases impartidas: fotos del bucket privado (solo en el servidor) y catálogo oficial de modelos
      leerImagen: async (path) => {
        const { data, error } = await admin.storage.from(BUCKET_CLASES).download(path);
        if (error || !data) throw new HttpError(502, 'foto_no_disponible');
        const bytes = new Uint8Array(await data.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { data: btoa(bin), media_type: data.type || (path.endsWith('.png') ? 'image/png' : path.endsWith('.jpg') ? 'image/jpeg' : 'image/webp') };
      },
      consultarModelo: async (id) => {
        if (!cliente) return null;
        try {
          const m = await cliente.models.retrieve(id) as unknown as { capabilities?: { image_input?: { supported?: boolean } } };
          return { disponible: true, imagenes: m.capabilities?.image_input?.supported !== false };
        } catch (e) {
          if (e instanceof Anthropic.NotFoundError) return { disponible: false, imagenes: false };
          return null;
        }
      },
      enSegundoPlano: (p) => {
        const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
        if (rt) rt.waitUntil(p); else void p;
      },
    };
    const out = await atender(JSON.parse(raw || '{}'), userData.user.id, deps);
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    // registro sin datos sensibles: solo el tipo de error
    if (status >= 500) console.error('orbe-ia:', e instanceof Error ? e.name : 'error');
    return new Response(JSON.stringify({ error: e instanceof HttpError ? e.message : 'Error interno' }), { status, headers });
  }
});
