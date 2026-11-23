/**
 * Práctica secuencial (migración 110): configuración de una práctica (orden al azar, umbrales y aviso de rapidez).
 * Sin la migración, o si la práctica no la tiene, devuelve null y la práctica se muestra como siempre.
 */
import { funcionAusente } from '@/api/examen';
import { rpc } from '@/lib/supabase';
import type { ConfigSecuencial } from '@/lib/practicaSecuencial';

export const configSecuencial = (activityId: string) =>
  rpc<ConfigSecuencial | null>('practica_secuencial_config', { p_activity: activityId })
    .then((c) => c ?? null)
    .catch((e) => { if (funcionAusente(e)) return null; throw e; });
