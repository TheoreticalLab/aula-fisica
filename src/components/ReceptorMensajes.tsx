/**
 * Receptor global de mensajes del profesor (montado una sola vez en el Layout: sigue activo al navegar).
 *  · Supabase Realtime avisa de cada mensaje nuevo (RLS: solo llegan los eventos de las filas propias).
 *  · Al suscribirse, al reconectar, al volver la conexión o la pestaña y cada minuto se recuperan los pendientes
 *    de la base de datos: nada se pierde durante una desconexión. La cola no duplica (por id).
 *  · Se dibuja ENCIMA de la página, sin desmontarla ni navegar: respuestas, temporizadores y guardados siguen.
 *  · «Entendido» registra la lectura; un aviso informativo cerrado o caducado en pantalla solo queda como
 *    «cerrado sin confirmar». Si el servidor no responde, el aviso se cierra igualmente (nunca bloquea un
 *    examen) y la confirmación se reintenta más tarde.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { rpc, supabase, supabaseConfigured } from '@/lib/supabase';
import { ETIQUETA_TIPO, fusionarCola, porMarcarRecibidos, type MensajeVivo } from '@/lib/mensajes';

const RESPONDIDOS = 'aula-mensajes-respondidos';
const ACKS = 'aula-mensajes-acks';
type Accion = 'leido' | 'descartado';

function leer<T>(k: string, def: T): T {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? def;
  } catch {
    return def;
  }
}
function guardar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
}
const hora = (iso: string) => new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

export function ReceptorMensajes() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const activo = supabaseConfigured && !!uid && profile?.role === 'student' && profile.active !== false;
  const [cola, setCola] = useState<MensajeVivo[]>([]);
  const marcados = useRef(new Set<string>());
  const respondidos = useRef(new Set<string>(leer<string[]>(RESPONDIDOS, [])));

  const reintentarAcks = useCallback(async () => {
    const pend = leer<{ id: string; accion: Accion }[]>(ACKS, []);
    if (!pend.length) return;
    const quedan: typeof pend = [];
    for (const a of pend) {
      try {
        await rpc('ack_live_message', { p_id: a.id, p_action: a.accion });
      } catch (e) {
        if (!/no encontrado/i.test(String(e))) quedan.push(a);
      }
    }
    guardar(ACKS, quedan);
  }, []);

  const recuperar = useCallback(async () => {
    if (!activo) return;
    await reintentarAcks();
    try {
      const srv = await rpc<MensajeVivo[]>('my_pending_messages');
      setCola((c) => fusionarCola(c, srv, respondidos.current));
      const nuevos = porMarcarRecibidos(srv, marcados.current);
      if (nuevos.length) {
        nuevos.forEach((id) => marcados.current.add(id));
        await rpc('mark_messages_delivered', { p_ids: nuevos }).catch(() => nuevos.forEach((id) => marcados.current.delete(id)));
      }
    } catch {
      /* sin conexión: se reintenta en el próximo aviso o en un minuto */
    }
  }, [activo, reintentarAcks]);

  useEffect(() => {
    if (!activo || !uid) return;
    void recuperar();
    const canal = supabase
      .channel(`mensajes-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_message_recipients', filter: `user_id=eq.${uid}` }, () => void recuperar())
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') void recuperar(); // también tras cada reconexión automática
      });
    const alVolver = () => document.visibilityState === 'visible' && void recuperar();
    const enLinea = () => void recuperar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', enLinea);
    const t = window.setInterval(() => void recuperar(), 60_000);
    return () => {
      void supabase.removeChannel(canal);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', enLinea);
      window.clearInterval(t);
    };
  }, [activo, uid, recuperar]);

  const responder = useCallback((m: MensajeVivo, accion: Accion) => {
    respondidos.current.add(m.id);
    guardar(RESPONDIDOS, [...respondidos.current].slice(-300));
    setCola((c) => c.filter((x) => x.id !== m.id));
    rpc('ack_live_message', { p_id: m.id, p_action: accion }).catch(() => {
      guardar(ACKS, [...leer<{ id: string; accion: Accion }[]>(ACKS, []), { id: m.id, accion }]);
    });
  }, []);

  const actual = cola[0];

  // los informativos se retiran solos a los 20 s (sin contar como leídos)
  useEffect(() => {
    if (!actual || actual.kind !== 'informativo') return;
    const t = window.setTimeout(() => responder(actual, 'descartado'), 20_000);
    return () => window.clearTimeout(t);
  }, [actual, responder]);

  if (!activo || !actual) return null;
  const quedan = cola.length - 1;
  const cabecera = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide">
        📢 Mensaje del profesor · {ETIQUETA_TIPO[actual.kind]}
      </p>
      <p className="mt-1 text-sm font-medium">{actual.sender_name}</p>
      <p className="text-xs opacity-75">{hora(actual.created_at)}</p>
    </>
  );

  if (actual.kind === 'informativo') {
    return (
      <div role="status" aria-live="polite" className="fixed bottom-20 right-3 z-[60] w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-primario-200 bg-white p-4 shadow-xl dark:border-white/15 dark:bg-primario-950 md:bottom-6">
        <div className="flex items-start justify-between gap-2">
          <div className="text-primario-900 dark:text-primario-100">{cabecera}</div>
          <button className="btn-texto" aria-label="Cerrar" onClick={() => responder(actual, 'descartado')}>✕</button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{actual.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">{quedan > 0 ? `${quedan} mensaje(s) más` : ''}</span>
          <button className="btn-primario !py-1 text-sm" onClick={() => responder(actual, 'leido')}>Entendido</button>
        </div>
      </div>
    );
  }

  const urgente = actual.kind === 'urgente';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Mensaje del profesor"
        className={`w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-primario-950 ${urgente ? 'border-4 border-red-600' : 'border border-primario-200 dark:border-white/15'}`}
      >
        <div className={urgente ? 'text-red-700 dark:text-red-300' : 'text-primario-900 dark:text-primario-100'}>{cabecera}</div>
        <p className="mt-3 whitespace-pre-wrap text-base">{actual.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">{quedan > 0 ? `${quedan} mensaje(s) más` : 'Su trabajo en la página sigue intacto.'}</span>
          <button autoFocus className={`btn-primario ${urgente ? '!bg-red-700 hover:!bg-red-800' : ''}`} onClick={() => responder(actual, 'leido')}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
