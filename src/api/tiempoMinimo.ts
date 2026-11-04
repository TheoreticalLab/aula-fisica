/** Tiempo mínimo de realización en prácticas (migración 78). */
import { rpc } from '@/lib/supabase';
import type { EstadoTiempo } from '@/lib/tiempoMinimo';

export interface ConfigTiempo { activo: boolean; minutos: number | null; activado_at: string | null; recalculados?: number }
export interface IntentoTiempo {
  attempt_id: string; user_id: string; full_name: string; login_id: string | null; status: string; started_at: string; submitted_at: string | null;
  minimo_s: number | null; segundos: number; cumplido: boolean; pausas: number; exento: boolean;
}

export const latidoPractica = (attempt: string, activo: boolean) => rpc<EstadoTiempo>('practica_latido', { p_attempt: attempt, p_activo: activo });
export const estadoTiempo = (attempt: string) => rpc<EstadoTiempo>('practica_tiempo_estado', { p_attempt: attempt });
export const configTiempo = (activity: string) => rpc<ConfigTiempo>('practica_tiempo_config', { p_activity: activity });
export const guardarTiempo = (activity: string, minutos: number | null) => rpc<ConfigTiempo>('practica_tiempo_guardar', { p_activity: activity, p_minutos: minutos });
export const intentosTiempo = (activity: string) => rpc<IntentoTiempo[]>('practica_tiempo_intentos', { p_activity: activity });
