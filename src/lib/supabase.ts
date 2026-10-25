import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true si el frontend se compiló con la URL y la clave pública de Supabase. */
export const supabaseConfigured = !!url && !!anonKey && !url.includes('xxxxxxxx');

// La clave «anon» es pública por diseño; la seguridad la aplican las políticas RLS y las funciones del servidor.
export const supabase: SupabaseClient = createClient(url ?? 'http://localhost:54321', anonKey ?? 'sin-configurar', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'aula-fisica-sesion',
  },
});

/** URL base de la aplicación (sirve como destino de los enlaces de confirmación por correo). */
export function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

/** Convierte un error de Supabase o de la red en un mensaje en español. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Error desconocido';
  const msg = typeof e === 'string' ? e : (e as { message?: string }).message ?? String(e);
  const map: [RegExp, string][] = [
    [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/Email not confirmed/i, 'Debe confirmar su correo antes de entrar. Revise su bandeja de entrada.'],
    [/User already registered/i, 'Ya existe una cuenta con ese correo.'],
    [/Password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit/i, 'Demasiados intentos. Espere unos minutos.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'No hay conexión con el servidor. Compruebe su conexión a internet.'],
    [/JWT expired/i, 'Su sesión caducó. Vuelva a iniciar sesión.'],
    [/permission denied|row-level security/i, 'No tiene permiso para realizar esta acción.'],
    [/duplicate key value/i, 'Ya existe un elemento con ese identificador.'],
    [/violates foreign key constraint.*responses|update or delete on table "exercises"/i, 'No se puede borrar: hay respuestas de estudiantes asociadas. Despublíquelo en su lugar.'],
  ];
  for (const [re, txt] of map) if (re.test(msg)) return txt;
  return msg;
}

/** Llama a una función RPC y lanza un Error con mensaje legible si falla. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw new Error(errorMessage(error));
  return data as T;
}

/** Llama a la Edge Function de calificación. */
export function calificar<T>(body: Record<string, unknown>): Promise<T> {
  return invocar<T>('calificar', body);
}

/** Llama a una Edge Function y convierte sus errores en mensajes legibles. */
export async function invocar<T>(funcion: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcion, { body });
  if (error) {
    // FunctionsHttpError trae la respuesta JSON con { error }
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json();
        if (j?.error) throw new Error(j.error);
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error(errorMessage(error));
  }
  return data as T;
}
