/**
 * Quiz y exámenes protegidos (migración 85), lado del navegador.
 *  · useVigilanciaSalida: avisa al servidor cuando el estudiante sale del examen (pestaña u app ocultas, más de 5 s sin
 *    foco, cerrar o recargar, ir a otra parte del aula). El servidor bloquea la pantalla con el bloqueo con código de
 *    siempre (BloqueoPantalla, montado en Layout) y deja de aceptar respuestas. El aviso usa keepalive para llegar aunque
 *    se cierre la pestaña; si no llega, se reintenta al volver. Reabrir el examen lo detecta además el servidor.
 *  · BarreraCopiado: no deja pegar ni arrastrar texto en las respuestas (BarreraPegado de las PES) ni copiar, cortar o
 *    seleccionar el enunciado; cada intento se anota. Es una barrera de la página: no controla otros dispositivos.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
import { examEventoCopia, examSalida } from '@/api/examen';
import { blurEsSalida, crearLimitador, ESPERA_SIN_FOCO, vigilanciaSuspendida, type MotivoSalida, type TipoCopia } from '@/lib/examen/integridad';
import { BarreraPegado } from './BarreraPegado';

const PENDIENTE = 'aula.examen.salida';
let navegacion: { attemptId: string; t: number } | null = null;

export function useVigilanciaSalida(attemptId: string, activo: boolean) {
  const { session } = useAuth();
  const token = useRef<string | undefined>(undefined);
  token.current = session?.access_token;
  const vigente = useRef(activo);
  vigente.current = activo;

  useEffect(() => {
    if (!activo) return;
    if (navegacion?.attemptId === attemptId) { window.clearTimeout(navegacion.t); navegacion = null; }
    const limitar = crearLimitador(3000);
    const avisar = (motivo: MotivoSalida) => {
      if (!vigente.current || vigilanciaSuspendida() || !limitar(motivo)) return;
      try { sessionStorage.setItem(PENDIENTE, JSON.stringify({ attemptId, motivo })); } catch { /* sin almacenamiento */ }
      if (!token.current) return;
      void fetch(`${SUPABASE_URL}/rest/v1/rpc/exam_salida`, {
        method: 'POST', keepalive: true,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_attempt: attemptId, p_motivo: motivo }),
      }).then((r) => { if (r.ok) try { sessionStorage.removeItem(PENDIENTE); } catch { /* */ } }).catch(() => undefined);
    };
    // un aviso que no llegó (sin red al salir): se reenvía al volver o al cargar la página
    const reenviar = () => {
      let p: { attemptId: string; motivo: MotivoSalida } | null = null;
      try { p = JSON.parse(sessionStorage.getItem(PENDIENTE) ?? 'null'); } catch { /* */ }
      if (p?.attemptId === attemptId) void examSalida(attemptId, p.motivo).then(() => { try { sessionStorage.removeItem(PENDIENTE); } catch { /* */ } }).catch(() => undefined);
    };
    reenviar();
    let sinFoco: number | undefined;
    const visibilidad = () => {
      if (document.visibilityState === 'hidden') avisar('oculta');
      else reenviar();
    };
    const cierre = () => avisar('cierre');
    const blur = () => {
      window.clearTimeout(sinFoco);
      sinFoco = window.setTimeout(() => { if (!document.hasFocus() && blurEsSalida(document.activeElement)) avisar('sin_foco'); }, ESPERA_SIN_FOCO);
    };
    const focus = () => window.clearTimeout(sinFoco);
    document.addEventListener('visibilitychange', visibilidad);
    window.addEventListener('pagehide', cierre);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibilidad);
      window.removeEventListener('pagehide', cierre);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.clearTimeout(sinFoco);
      // el examen deja la pantalla sin haberse entregado (otra página del aula): también es salir. Se espera un
      // instante: si el mismo examen se vuelve a montar enseguida (React en desarrollo), no se sale de nada.
      if (vigente.current) navegacion = { attemptId, t: window.setTimeout(() => avisar('navegacion'), 400) };
    };
  }, [attemptId, activo]);
}

export function BarreraCopiado({ attemptId, activo, children }: { attemptId: string; activo: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const limitar = useRef(crearLimitador(2000));
  const anotar = useRef<(tipo: TipoCopia) => void>(() => undefined);
  anotar.current = (tipo: TipoCopia) => { if (limitar.current(tipo)) void examEventoCopia(attemptId, tipo).catch(() => undefined); };

  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    const copiar = (e: Event) => { e.preventDefault(); anotar.current('copia'); };
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener('copy', copiar, true);
    el.addEventListener('cut', copiar, true);
    el.addEventListener('contextmenu', menu, true);
    return () => {
      el.removeEventListener('copy', copiar, true);
      el.removeEventListener('cut', copiar, true);
      el.removeEventListener('contextmenu', menu, true);
    };
  }, [activo]);

  if (!activo) return <>{children}</>;
  return (
    <div ref={ref} className="sin-copiar">
      <BarreraPegado permitido={false} onBloqueo={(t) => anotar.current(t)}>{children}</BarreraPegado>
    </div>
  );
}
