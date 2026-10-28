/**
 * Bloqueo de pantalla con código (enviado por el profesor). Cubre TODA el aula, incluido el menú de «Salir», y
 * deja inerte la página de debajo (ni ratón ni teclado llegan a ella; su estado se conserva intacto). Solo se
 * quita con el código correcto o si el profesor lo libera. El estado vive en el servidor: recargar, cerrar
 * sesión o entrar desde otro dispositivo no lo quita. Los intentos están limitados en el servidor.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/auth/AuthContext';
import { rpc, supabase, supabaseConfigured } from '@/lib/supabase';
import { useEmergente } from '@/lib/emergentes';

interface Bloqueo { id: string; body: string; sender_name: string; created_at: string; locked_until: string | null }

export function BloqueoPantalla() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const activo = supabaseConfigured && !!uid && profile?.role === 'student';
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const consultar = useCallback(async () => {
    if (!activo) return setBloqueo(null);
    try {
      setBloqueo(await rpc<Bloqueo | null>('my_screen_lock'));
    } catch {
      /* sin conexión: se mantiene el estado conocido (si estaba bloqueado, sigue bloqueado) */
    }
  }, [activo]);

  useEffect(() => {
    if (!activo || !uid) {
      setBloqueo(null);
      return;
    }
    void consultar();
    const canal = supabase
      .channel(`bloqueo-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_locks', filter: `user_id=eq.${uid}` }, () => void consultar())
      .subscribe((e) => e === 'SUBSCRIBED' && void consultar());
    const t = window.setInterval(() => void consultar(), 20_000);
    const vis = () => document.visibilityState === 'visible' && void consultar();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', vis);
    return () => {
      void supabase.removeChannel(canal);
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', vis);
    };
  }, [activo, uid, consultar]);

  // la aplicación de debajo queda inerte (sin foco, sin clics) mientras dure el bloqueo
  useEffect(() => {
    const raiz = document.getElementById('root');
    if (!raiz) return;
    if (bloqueo) {
      raiz.setAttribute('inert', '');
      raiz.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'hidden';
    }
    return () => {
      raiz.removeAttribute('inert');
      raiz.removeAttribute('aria-hidden');
      document.body.style.overflow = '';
    };
  }, [bloqueo]);

  async function desbloquear(e: FormEvent) {
    e.preventDefault();
    if (!bloqueo) return;
    setBusy(true);
    setError(null);
    try {
      const r = await rpc<{ ok: boolean; intentos?: number; espera_hasta?: string | null }>('unlock_screen', { p_lock: bloqueo.id, p_code: codigo });
      if (r.ok) {
        setCodigo('');
        await consultar();
      } else if (r.espera_hasta) {
        setError(`Demasiados intentos. Podrá intentarlo de nuevo a las ${new Date(r.espera_hasta).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}.`);
      } else {
        setError('Código incorrecto.');
      }
    } catch {
      setError('No se pudo comprobar el código. Revise su conexión e inténtelo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  useEmergente('bloqueo-pantalla', activo && !!bloqueo);
  if (!activo || !bloqueo) return null;
  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-label="Pantalla bloqueada por el profesor"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-primario-950/95 p-4 text-white backdrop-blur-sm">
      <form onSubmit={desbloquear} className="w-full max-w-md rounded-2xl border-4 border-red-600 bg-primario-950 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-300">🔒 Pantalla bloqueada por el profesor</p>
        <p className="mt-1 text-sm text-primario-200">{bloqueo.sender_name} · {new Date(bloqueo.created_at).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <p className="mt-4 whitespace-pre-wrap text-lg">{bloqueo.body}</p>
        <label className="mt-5 block text-sm text-primario-200">
          Código de desbloqueo (se lo entrega el profesor)
          <input autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={32}
            className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-lg tracking-widest text-white outline-none focus:border-white"
            value={codigo} onChange={(ev) => setCodigo(ev.target.value)} />
        </label>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <button className="mt-4 w-full rounded-lg bg-white py-2 font-semibold text-primario-950 disabled:opacity-50" disabled={busy || codigo.trim().length < 4}>
          {busy ? 'Comprobando…' : 'Desbloquear'}
        </button>
        <p className="mt-3 text-xs text-primario-300">Su trabajo en el aula queda guardado tal como estaba.</p>
      </form>
    </div>,
    document.body,
  );
}
