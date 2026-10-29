/**
 * Pregunta relámpago (estudiante). Montada una vez en el Layout, como el receptor de mensajes.
 *  · Llega por Realtime (o en la consulta de cada 15 s) y solo se pide al servidor con la pestaña visible: así la
 *    pregunta consta como «vista» únicamente cuando de verdad está en pantalla.
 *  · Con bloqueo: si el estudiante oculta el aula (otra pestaña u otra aplicación) o pasa 5 s en otra ventana antes
 *    de responder, se avisa al servidor (poll_left, con keepalive) y este bloquea la pantalla (migración 19: solo se
 *    quita con el código del profesor). El latido de conexión con la pestaña oculta bloquea también en el servidor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { rpc, SUPABASE_ANON_KEY, SUPABASE_URL, supabase, supabaseConfigured } from '@/lib/supabase';
import { useEmergente } from '@/lib/emergentes';
import { debeBloquearAlSalir, ESPERA_SIN_FOCO_MS, LETRAS, segundosQuedan, type PreguntaAbierta } from '@/lib/pregunta';

const SALIDA = 'aula-pregunta-salida';

export function PreguntaRelampago() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const activo = supabaseConfigured && !!uid && profile?.role === 'student' && profile.active !== false;
  const [p, setP] = useState<PreguntaAbierta | null>(null);
  const [offset, setOffset] = useState(0);
  const [respondida, setRespondida] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, setTic] = useState(0);
  const pendiente = useRef(false);
  useEmergente('pregunta-relampago', !!p);

  const consultar = useCallback(async () => {
    if (!activo) return;
    if (document.visibilityState !== 'visible') { pendiente.current = true; return; }
    pendiente.current = false;
    try {
      const d = await rpc<PreguntaAbierta | null>('my_open_poll');
      if (d) setOffset(new Date(d.server_now).getTime() - Date.now());
      setP((actual) => {
        if (d?.id !== actual?.id) { setRespondida(null); setMensaje(null); }
        return d;
      });
    } catch {
      /* sin conexión: se reintenta */
    }
  }, [activo]);

  // aviso de salida: keepalive para que llegue aunque se cierre o se oculte la pestaña; si falla, se reintenta al volver
  const avisarSalida = useCallback((id: string) => {
    try { sessionStorage.setItem(SALIDA, id); } catch { /* sin almacenamiento */ }
    const token = session?.access_token;
    if (!token) return;
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/poll_left`, {
      method: 'POST', keepalive: true,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_poll: id }),
    }).then((r) => { if (r.ok) try { sessionStorage.removeItem(SALIDA); } catch { /* */ } }).catch(() => undefined);
    setP(null);
  }, [session]);

  useEffect(() => {
    if (!activo || !uid) return;
    void consultar();
    const canal = supabase
      .channel(`pregunta-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quick_poll_recipients', filter: `user_id=eq.${uid}` }, () => void consultar())
      .subscribe((estado) => { if (estado === 'SUBSCRIBED') void consultar(); });
    const t = window.setInterval(() => void consultar(), 15_000);
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      let salida: string | null = null;
      try { salida = sessionStorage.getItem(SALIDA); } catch { /* */ }
      if (salida) void rpc('poll_left', { p_poll: salida }).then(() => { try { sessionStorage.removeItem(SALIDA); } catch { /* */ } }).catch(() => undefined);
      if (pendiente.current || !salida) void consultar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      void supabase.removeChannel(canal);
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo, uid, consultar]);

  // salir de la plataforma con la pregunta en pantalla y sin responder
  useEffect(() => {
    if (!p || !debeBloquearAlSalir(p, respondida !== null)) return;
    let sinFoco: number | undefined;
    const oculta = () => { if (document.visibilityState === 'hidden') avisarSalida(p.id); };
    const salir = () => avisarSalida(p.id);
    const blur = () => { sinFoco = window.setTimeout(() => avisarSalida(p.id), ESPERA_SIN_FOCO_MS); };
    const focus = () => window.clearTimeout(sinFoco);
    document.addEventListener('visibilitychange', oculta);
    window.addEventListener('pagehide', salir);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', oculta);
      window.removeEventListener('pagehide', salir);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.clearTimeout(sinFoco);
    };
  }, [p, respondida, avisarSalida]);

  // cuenta atrás; al terminar, se retira
  useEffect(() => {
    if (!p) return;
    const t = window.setInterval(() => {
      setTic((x) => x + 1);
      if (segundosQuedan(p.closes_at, offset) <= 0) setP(null);
    }, 1_000);
    return () => window.clearInterval(t);
  }, [p, offset]);

  // tras responder, la tarjeta se retira sola
  useEffect(() => {
    if (respondida === null) return;
    const t = window.setTimeout(() => setP(null), 2_500);
    return () => window.clearTimeout(t);
  }, [respondida]);

  async function responder(i: number) {
    if (!p || enviando || respondida !== null) return;
    setEnviando(true);
    try {
      const r = await rpc<{ ok: boolean; motivo?: string }>('poll_answer', { p_poll: p.id, p_option: i });
      if (r.ok || r.motivo === 'ya_respondida') setRespondida(i);
      else setMensaje(r.motivo === 'cerrada' ? 'La pregunta ya se cerró.' : 'No se pudo registrar la respuesta.');
    } catch {
      setMensaje('Sin conexión: vuelva a pulsar su respuesta.');
    } finally {
      setEnviando(false);
    }
  }

  if (!activo || !p) return null;
  const quedan = segundosQuedan(p.closes_at, offset);
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-3">
      <div role="dialog" aria-modal="true" aria-label="Pregunta del profesor"
        className="w-full max-w-lg rounded-2xl border-2 border-primario-500 bg-white p-5 shadow-2xl dark:bg-primario-950">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primario-700 dark:text-primario-200">❓ Pregunta del profesor · {p.sender_name}</p>
          <span className="tabular-nums text-sm font-semibold">{Math.floor(quedan / 60)}:{String(quedan % 60).padStart(2, '0')}</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-base font-medium">{p.question}</p>
        <div className="mt-4 grid gap-2">
          {p.options.map((o, i) => (
            <button key={i} disabled={enviando || respondida !== null}
              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${respondida === i ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'border-gray-300 hover:border-primario-500 hover:bg-primario-50 dark:border-white/15 dark:hover:bg-white/5'}`}
              onClick={() => void responder(i)}>
              <strong className="mr-2">{LETRAS[i]})</strong>{o}
            </button>
          ))}
        </div>
        {respondida !== null && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ Respuesta enviada.</p>}
        {mensaje && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{mensaje}</p>}
        {p.lock_on_leave && respondida === null && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            🔒 No salgas del aula hasta responder: si cambias de pestaña o de aplicación, tu pantalla se bloqueará y tendrás que pedir el código al profesor.
          </p>
        )}
      </div>
    </div>
  );
}
