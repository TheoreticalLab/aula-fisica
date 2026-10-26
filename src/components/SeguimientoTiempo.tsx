/**
 * Seguimiento automático del tiempo de aprendizaje (solo estudiantes; invisible para ellos).
 * Se monta una vez en el Layout: deduce el contexto de la ruta, alimenta el MedidorTiempo con señales de
 * actividad y envía cada ~15 s un latido con los totales acumulados de la visita (study_beat).
 *  · Pendientes en localStorage: si falla la red o se cierra la página, se reenvían después (los totales son
 *    acumulados y llevan número de secuencia: reenviar no duplica).
 *  · Las duraciones se miden con performance.now() (monótono): cambiar la hora del dispositivo no influye.
 *  · No se registra nada de lo que el estudiante escribe: solo duraciones y recuentos.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase, supabaseConfigured } from '@/lib/supabase';
import { CONFIG_TIEMPO, contextoDeRuta, MedidorTiempo, type ConfigTiempo, type ContextoRuta, type Senal } from '@/lib/tiempo';

const PENDIENTES = 'aula-tiempo-pendientes';
const SESION = 'aula-tiempo-sesion';

interface Payload {
  p_visit: string;
  p_session: string;
  p_kind: string;
  p_ref: string | null;
  p_section: string;
  p_seq: number;
  p_effective: number;
  p_visible: number;
  p_idle: number;
  p_hidden: number;
  p_weak: number;
  p_interactions: number;
  p_answers: number;
  p_offline: boolean;
}

function uuid(): string {
  return crypto.randomUUID();
}

function leerPendientes(): Record<string, Payload> {
  try {
    return JSON.parse(localStorage.getItem(PENDIENTES) || '{}') as Record<string, Payload>;
  } catch {
    return {};
  }
}
function guardarPendientes(p: Record<string, Payload>) {
  try {
    localStorage.setItem(PENDIENTES, JSON.stringify(p));
  } catch {
    /* almacenamiento lleno o bloqueado: se pierde como mucho un latido */
  }
}

let token: string | null = null;

async function enviar(p: Payload, keepalive = false): Promise<{ tracked?: boolean; server_now?: string } | null> {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/study_beat`, {
      method: 'POST',
      keepalive,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (!r.ok) {
      // 4xx de validación (lección ya no visible, etc.): se descarta para no reintentar sin fin
      if (r.status >= 400 && r.status < 500) {
        const pend = leerPendientes();
        delete pend[p.p_visit];
        guardarPendientes(pend);
      }
      return null;
    }
    const pend = leerPendientes();
    if (pend[p.p_visit] && pend[p.p_visit].p_seq <= p.p_seq) {
      delete pend[p.p_visit];
      guardarPendientes(pend);
    }
    return (await r.json()) as { tracked?: boolean; server_now?: string };
  } catch {
    return null; // sin conexión: queda pendiente
  }
}

interface Visita {
  id: string;
  ctx: ContextoRuta;
  seq: number;
  medidor: MedidorTiempo;
  hora: number;
}

export function SeguimientoTiempo() {
  const { session, profile } = useAuth();
  const location = useLocation();
  const activo = supabaseConfigured && !!session && profile?.role === 'student' && profile.active !== false;
  const cfg = useRef<ConfigTiempo & { beatSeconds: number }>({ ...CONFIG_TIEMPO, beatSeconds: 15 });
  const visita = useRef<Visita | null>(null);
  const offset = useRef(0); // reloj del servidor − reloj local (ms), solo para cortar visitas por hora
  const huboFallo = useRef(false);
  const deshabilitado = useRef(false);
  const sesionId = useRef<string>('');

  useEffect(() => {
    token = session?.access_token ?? null;
  }, [session]);

  // identificador de pestaña: se conserva al recargar
  if (!sesionId.current) {
    let s = sessionStorage.getItem(SESION);
    if (!s) {
      s = uuid();
      sessionStorage.setItem(SESION, s);
    }
    sesionId.current = s;
  }

  // configuración y reenvío de pendientes al iniciar
  useEffect(() => {
    if (!activo) return;
    void supabase.rpc('study_config').then(({ data }) => {
      const d = data as Record<string, number> | null;
      if (d) {
        cfg.current = {
          idleSeconds: d.idle_seconds,
          tailSeconds: d.reading_tail_seconds,
          minVisitSeconds: d.min_visit_seconds,
          weakMaxSeconds: d.weak_max_seconds,
          beatSeconds: d.beat_seconds,
        };
      }
    });
    for (const p of Object.values(leerPendientes())) void enviar({ ...p, p_offline: true });
  }, [activo]);

  const horaServidor = () => Math.floor((Date.now() + offset.current) / 3_600_000);

  function payload(v: Visita): Payload {
    const t = v.medidor.totales(performance.now());
    v.seq += 1;
    return {
      p_visit: v.id,
      p_session: sesionId.current,
      p_kind: v.ctx.kind,
      p_ref: v.ctx.ref,
      p_section: v.ctx.section,
      p_seq: v.seq,
      p_effective: t.effective,
      p_visible: t.visible,
      p_idle: t.idle,
      p_hidden: t.hidden,
      p_weak: t.weak,
      p_interactions: t.interactions,
      p_answers: t.answers,
      p_offline: huboFallo.current,
    };
  }

  function latido(keepalive = false) {
    const v = visita.current;
    if (!v || deshabilitado.current) return;
    const p = payload(v);
    // nada que contar todavía: no se envía (evita filas de visitas instantáneas)
    if (p.p_visible === 0 && p.p_hidden === 0) return;
    const pend = leerPendientes();
    pend[v.id] = p;
    guardarPendientes(pend);
    void enviar(p, keepalive).then((r) => {
      if (!r) {
        huboFallo.current = true;
        return;
      }
      huboFallo.current = false;
      if (r.tracked === false) deshabilitado.current = true;
      if (r.server_now) offset.current = new Date(r.server_now).getTime() - Date.now();
    });
  }

  function nuevaVisita(ctx: ContextoRuta, calificada = false) {
    visita.current = {
      id: uuid(),
      ctx,
      seq: 0,
      hora: horaServidor(),
      medidor: new MedidorTiempo(performance.now(), {
        visible: document.visibilityState === 'visible',
        foco: document.hasFocus(),
        cfg: cfg.current,
        calificada,
      }),
    };
  }

  // cambio de ruta: se cierra la visita anterior y empieza otra
  useEffect(() => {
    if (!activo) return;
    const ctx = contextoDeRuta(location.pathname, location.search);
    const actual = visita.current;
    if (actual && ctx && actual.ctx.kind === ctx.kind && actual.ctx.ref === ctx.ref && actual.ctx.section === ctx.section) return;
    if (actual) latido();
    visita.current = null;
    if (ctx) nuevaVisita(ctx);
  }, [activo, location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // señales de actividad, visibilidad, foco y latido periódico
  useEffect(() => {
    if (!activo) return;
    const ahora = () => performance.now();
    const senal = (tipo: Senal) => visita.current?.medidor.senal(ahora(), tipo);
    const fuerte = () => senal('fuerte');
    let scrollAcum = 0;
    let ultimoScroll = window.scrollY;
    const onScroll = () => {
      scrollAcum += Math.abs(window.scrollY - ultimoScroll);
      ultimoScroll = window.scrollY;
      if (scrollAcum >= 40) {
        scrollAcum = 0;
        fuerte();
      }
    };
    let ultimoMov = 0;
    let mx = 0;
    let my = 0;
    const onMove = (e: MouseEvent) => {
      const t = ahora();
      if (t - ultimoMov < 1000) return;
      if (Math.hypot(e.clientX - mx, e.clientY - my) < 8) return;
      mx = e.clientX;
      my = e.clientY;
      ultimoMov = t;
      senal('debil');
    };
    const canal = 'BroadcastChannel' in window ? new BroadcastChannel('aula-tiempo') : null;
    const onFuerteYAviso = () => {
      fuerte();
      canal?.postMessage({ activa: sesionId.current });
    };
    if (canal) {
      canal.onmessage = () => {
        // otra pestaña del aula está activa: si esta no tiene el foco, no acumula
        if (!document.hasFocus()) visita.current?.medidor.foco_(ahora(), false);
      };
    }
    const onVis = () => {
      const v = visita.current;
      if (!v) return;
      const visible = document.visibilityState === 'visible';
      v.medidor.visibilidad(ahora(), visible);
      if (!visible) latido(true);
    };
    const onFocus = () => visita.current?.medidor.foco_(ahora(), true);
    const onBlur = () => {
      visita.current?.medidor.foco_(ahora(), false);
      latido();
    };
    const onHide = () => latido(true);
    const onRespuesta = () => senal('respuesta');
    const onOnline = () => {
      for (const p of Object.values(leerPendientes())) void enviar({ ...p, p_offline: true });
    };

    const pasivo = { passive: true, capture: true } as const;
    window.addEventListener('keydown', onFuerteYAviso, pasivo);
    window.addEventListener('pointerdown', onFuerteYAviso, pasivo);
    window.addEventListener('wheel', fuerte, pasivo);
    window.addEventListener('touchstart', fuerte, pasivo);
    window.addEventListener('input', fuerte, pasivo);
    window.addEventListener('scroll', onScroll, pasivo);
    window.addEventListener('mousemove', onMove, pasivo);
    // reproducción y control de recursos (audio/vídeo): los eventos de medios no burbujean, se capturan
    document.addEventListener('play', fuerte, true);
    document.addEventListener('seeked', fuerte, true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('aula:respuesta', onRespuesta);
    window.addEventListener('online', onOnline);

    const intervalo = window.setInterval(() => {
      const v = visita.current;
      if (!v) return;
      // corte por cambio de hora (reloj del servidor): las estadísticas por día y hora quedan bien repartidas
      if (horaServidor() !== v.hora) {
        latido();
        const calificada = v.medidor.esCalificada;
        nuevaVisita(v.ctx, calificada);
        return;
      }
      if (document.visibilityState === 'visible') latido();
    }, cfg.current.beatSeconds * 1000);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('keydown', onFuerteYAviso, pasivo);
      window.removeEventListener('pointerdown', onFuerteYAviso, pasivo);
      window.removeEventListener('wheel', fuerte, pasivo);
      window.removeEventListener('touchstart', fuerte, pasivo);
      window.removeEventListener('input', fuerte, pasivo);
      window.removeEventListener('scroll', onScroll, pasivo);
      window.removeEventListener('mousemove', onMove, pasivo);
      document.removeEventListener('play', fuerte, true);
      document.removeEventListener('seeked', fuerte, true);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('aula:respuesta', onRespuesta);
      window.removeEventListener('online', onOnline);
      canal?.close();
      latido();
    };
  }, [activo]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
