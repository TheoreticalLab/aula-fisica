/**
 * Orbe IA desde Orbe Control: llamada a la Edge Function «orbe-ia» (la clave de Claude vive en el servidor) y textos
 * de los motivos por los que una llamada no se hizo. Presupuesto, límite diario y simulador: los mismos de Orbe IA.
 */
import { supabase } from './supabase';

export const MOTIVOS_IA: Record<string, string> = {
  apagado: 'Orbe IA está apagado (panel del aula → 🤖 Orbe IA → Configuración).',
  permiso: 'Sin permiso.',
  leccion: 'Lección no encontrada.',
  limite_diario: 'Se alcanzó el límite diario de llamadas a Claude.',
  presupuesto: 'Se alcanzaría el presupuesto mensual de Orbe IA.',
  sin_clave: 'Falta la clave de la API en el servidor.',
  autenticacion: 'La API rechazó la clave.',
  limite_api: 'Claude está ocupado; inténtelo en unos segundos.',
  red: 'No se pudo conectar con Claude.',
  servidor_api: 'Error de la API de Claude.',
  formato: 'La respuesta no tuvo el formato esperado; inténtelo de nuevo.',
  rechazo_modelo: 'Claude no quiso responder a eso.',
  peticion_invalida: 'La API no aceptó la petición.',
};

export interface RespuestaIA<T> { ok: boolean; motivo?: string; simulado?: boolean; resultado?: T }

/** Llama a la Edge Function y devuelve el resultado, o lanza un error con un texto legible. */
export async function pedirIA<T>(body: Record<string, unknown>): Promise<{ resultado: T; simulado: boolean }> {
  const { data, error } = await supabase.functions.invoke('orbe-ia', { body });
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
  const r = data as RespuestaIA<T>;
  if (!r.ok || r.resultado === undefined) throw new Error(MOTIVOS_IA[r.motivo ?? ''] ?? r.motivo ?? 'No se pudo completar');
  return { resultado: r.resultado, simulado: !!r.simulado };
}
