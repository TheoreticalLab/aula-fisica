/**
 * Tiempo mínimo de realización (migración 78): latidos al servidor y barra de avance para el estudiante.
 * Solo late si la práctica lo exige (el servidor responde aplica = false en caso contrario y se deja de latir).
 * Activo = página visible + alguna interacción (tocar, escribir, desplazarse) en los últimos 2 min.
 */
import { useEffect, useRef, useState } from 'react';
import { latidoPractica } from '@/api/tiempoMinimo';
import { avance, duracion, estaActivo, LATIDO_MS, type EstadoTiempo } from '@/lib/tiempoMinimo';

export function useTiempoActivo(attemptId: string, habilitado: boolean): EstadoTiempo | null {
  const [estado, setEstado] = useState<EstadoTiempo | null>(null);
  const ultima = useRef(Date.now());
  useEffect(() => {
    if (!habilitado || !attemptId) return;
    let vivo = true;
    let aplica = true;
    const visible = () => document.visibilityState === 'visible';
    const latir = async (activo: boolean) => {
      if (!aplica) return;
      try {
        const e = await latidoPractica(attemptId, activo);
        if (!vivo) return;
        aplica = e.aplica;
        setEstado(e);
      } catch {
        /* sin conexión o sin la migración: se reintenta en el próximo latido (la entrega la decide el servidor) */
      }
    };
    const tocar = () => { ultima.current = Date.now(); };
    const eventos = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart', 'wheel'] as const;
    eventos.forEach((ev) => window.addEventListener(ev, tocar, { passive: true, capture: true }));
    let movido = 0;
    const mover = () => { const t = Date.now(); if (t - movido > 5000) { movido = t; tocar(); } };
    window.addEventListener('mousemove', mover, { passive: true });
    const alCambiarVisibilidad = () => {
      if (visible()) { tocar(); void latir(true); } else void latir(false);
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    void latir(visible());
    const t = setInterval(() => void latir(estaActivo(visible(), ultima.current, Date.now())), LATIDO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
      eventos.forEach((ev) => window.removeEventListener(ev, tocar, { capture: true }));
      window.removeEventListener('mousemove', mover);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      void latir(false);
    };
  }, [attemptId, habilitado]);
  return estado;
}

export function BarraTiempoActivo({ estado }: { estado: EstadoTiempo | null }) {
  if (!estado?.aplica || !estado.minimo_s) return null;
  const pct = avance(estado);
  const falta = Math.max(0, estado.minimo_s - (estado.segundos ?? 0));
  return (
    <div className="tarjeta mb-4 !py-3" role="status" aria-live="polite">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Tiempo de trabajo: {duracion(estado.segundos ?? 0)} de {duracion(estado.minimo_s)}</span>
        <span className={`text-xs ${estado.contando ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
          {estado.cumplido ? '✓ Mínimo cumplido' : estado.cerrada ? 'Práctica cerrada' : estado.contando ? '● Contando' : '⏸ En pausa (sin actividad o fuera de la página)'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <div className={`h-full rounded-full transition-all ${estado.cumplido ? 'bg-emerald-500' : 'bg-acento-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {!estado.cumplido && !estado.cerrada && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Esta práctica exige un tiempo mínimo de trabajo: podrá entregar cuando lo complete (faltan {duracion(falta)}). Solo cuenta el tiempo con la práctica en
          pantalla y trabajando en ella. Si no la entrega, al cierre se entregará lo guardado y la nota se multiplicará por la parte del tiempo cumplida.
        </p>
      )}
      {!estado.cumplido && estado.cerrada && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          No completó el tiempo mínimo antes del cierre: al entregar, la nota se multiplicará por {Math.round(100 * Math.min(1, (estado.segundos ?? 0) / estado.minimo_s))} %.
        </p>
      )}
    </div>
  );
}
