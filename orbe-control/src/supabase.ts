/**
 * Cliente de Supabase de Orbe Control: mismo proyecto que el aula, clave PÚBLICA (la seguridad está en RLS y en
 * las funciones del servidor). Sesión guardada con otra clave para no interferir con el aula, que comparte dominio.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configurado = !!url && !!anon && !url.includes('xxxxxxxx');

export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'orbe-control-sesion' },
});

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Inicio de sesión con el mismo ID y contraseña del aula (Edge Function «acceder»). */
export async function ingresar(id: string, password: string): Promise<{ must_change_password?: boolean }> {
  const { data, error } = await supabase.functions.invoke('acceder', { body: { id: id.trim(), password } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    try {
      const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch {
      /* respuesta no JSON */
    }
    throw new Error(msg);
  }
  const s = data as { access_token: string; refresh_token: string; must_change_password?: boolean };
  const { error: se } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (se) throw new Error(se.message);
  return s;
}
