/**
 * Latido de CONEXIÓN del estudiante (para Orbe Control y el Centro de Comunicación).
 * Cada pestaña abierta del aula avisa cada 25 s que sigue conectada, esté o no interactuando (eso lo mide aparte
 * el seguimiento de tiempo). Al volver la conexión o la pestaña se avisa de inmediato; al cerrar la pestaña se
 * intenta borrar la conexión. Si el navegador se cierra de golpe, el servidor la da por perdida a los 75 s.
 * El servidor toma el usuario de la sesión: no se puede registrar la presencia de otra persona.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase, supabaseConfigured } from '@/lib/supabase';

const INTERVALO_MS = 25_000;

export function ConexionEnVivo() {
  const { session, profile } = useAuth();
  const activo = supabaseConfigured && !!session && profile?.role === 'student' && profile.active !== false;
  const conn = useRef<string>(crypto.randomUUID()); // una por pestaña (y por carga de página)
  const token = useRef<string | null>(null);
  token.current = session?.access_token ?? null;

  useEffect(() => {
    if (!activo) return;
    let parado = false;
    const ping = () => {
      if (parado) return;
      void supabase.rpc('presence_ping', { p_conn: conn.current, p_visible: document.visibilityState === 'visible' }).then(({ data }) => {
        if (data && (data as { tracked?: boolean }).tracked === false) parado = true; // no es estudiante
      });
    };
    const salir = () => {
      if (!token.current) return;
      // keepalive: la petición sobrevive al cierre de la pestaña
      void fetch(`${SUPABASE_URL}/rest/v1/rpc/presence_leave`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_conn: conn.current }),
      }).catch(() => undefined);
    };
    ping();
    const t = window.setInterval(ping, INTERVALO_MS);
    document.addEventListener('visibilitychange', ping);
    window.addEventListener('online', ping);
    window.addEventListener('pagehide', salir);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', ping);
      window.removeEventListener('online', ping);
      window.removeEventListener('pagehide', salir);
      salir();
    };
  }, [activo]);

  return null;
}
