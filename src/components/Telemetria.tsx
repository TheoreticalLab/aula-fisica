/**
 * Telemetría del proceso de respuesta en el navegador. Envuelve un intento (práctica o evaluación) y conecta las
 * señales del navegador con el Rastreador: visibilidad de la página, foco, conexión, inactividad, salida (incluido
 * el cierre en el teléfono) y envío periódico. Solo registra el intento PROPIO en curso; en la vista previa del
 * profesor no hay proveedor y no se registra nada.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase';
import { ColaTelemetria, type EventoTelemetria, type ResultadoEnvio } from '@/lib/telemetria/cola';
import { Rastreador } from '@/lib/telemetria/rastreador';

const Ctx = createContext<Rastreador | null>(null);
export const useTelemetria = () => useContext(Ctx);

let token: string | null = null;
let suscrito = false;
function vigilarToken() {
  if (suscrito || !supabaseConfigured) return;
  suscrito = true;
  void supabase.auth.getSession().then(({ data }) => { token = data.session?.access_token ?? null; });
  supabase.auth.onAuthStateChange((_e, s) => { token = s?.access_token ?? null; });
}

async function enviar(eventos: EventoTelemetria[], keepalive: boolean): Promise<ResultadoEnvio> {
  if (!token) return 'error';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/telemetry_ingest`, {
      method: 'POST', keepalive: keepalive && JSON.stringify(eventos).length < 60_000,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_eventos: eventos }),
    });
    if (r.ok) return 'ok';
    return r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429 ? 'rechazo' : 'error';
  } catch {
    return 'error';
  }
}

const almacen = {
  leer: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  escribir: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* lleno o bloqueado */ } },
};
function pestana(): string {
  try {
    let id = sessionStorage.getItem('aula-pestana');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('aula-pestana', id); }
    return id;
  } catch { return 'desconocida'; }
}

export function TelemetriaProvider({ attemptId, activo, children }: { attemptId: string; activo: boolean; children: ReactNode }) {
  const ref = useRef<{ cola: ColaTelemetria; r: Rastreador } | null>(null);
  const rastreador = useMemo(() => {
    if (!activo || !supabaseConfigured) return null;
    vigilarToken();
    const cola = new ColaTelemetria({ almacen, enviar, monotonico: () => performance.now(), pared: () => Date.now(), uuid: () => crypto.randomUUID() });
    const r = new Rastreador(cola, attemptId);
    ref.current = { cola, r };
    return r;
  }, [attemptId, activo]);

  useEffect(() => {
    const x = ref.current;
    if (!rastreador || !x) return;
    const nav = (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'navigate';
    x.r.iniciar(nav, pestana());
    if (document.visibilityState === 'hidden') x.r.visibilidad(false);
    const vaciar = (keepalive = false) => void x.cola.vaciar(keepalive);
    let ultimaAct = 0;
    const actividad = () => { const t = performance.now(); if (t - ultimaAct > 2000) { ultimaAct = t; x.r.actividad(); } };
    const vis = () => { const v = document.visibilityState === 'visible'; x.r.visibilidad(v); if (!v) vaciar(true); };
    const foco = () => x.r.foco(true);
    const desenfoque = () => x.r.foco(false);
    const enLinea = () => { x.r.conexion(true); vaciar(); };
    const sinLinea = () => x.r.conexion(false);
    const salida = () => { x.r.salida(); vaciar(true); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', foco);
    window.addEventListener('blur', desenfoque);
    window.addEventListener('online', enLinea);
    window.addEventListener('offline', sinLinea);
    window.addEventListener('pagehide', salida);
    for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const) window.addEventListener(ev, actividad, { passive: true });
    const t1 = window.setInterval(() => x.r.tick(), 1000);
    const t2 = window.setInterval(() => vaciar(), 10_000);
    vaciar();
    return () => {
      x.r.salida();
      vaciar(true);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', foco);
      window.removeEventListener('blur', desenfoque);
      window.removeEventListener('online', enLinea);
      window.removeEventListener('offline', sinLinea);
      window.removeEventListener('pagehide', salida);
      for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const) window.removeEventListener(ev, actividad);
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [rastreador]);

  return <Ctx.Provider value={rastreador}>{children}</Ctx.Provider>;
}

/** Aviso transparente para el estudiante sobre lo que se registra. */
export function AvisoTelemetria() {
  return (
    <p className="text-xs text-gray-500">
      🛈 Para analizar cómo se resuelven las actividades, el aula registra cuándo ve, responde, modifica, guarda y entrega cada pregunta,
      y si la página está visible o inactiva. No registra lo que teclea ni nada fuera del aula; las respuestas se guardan como siempre, aparte.
    </p>
  );
}
