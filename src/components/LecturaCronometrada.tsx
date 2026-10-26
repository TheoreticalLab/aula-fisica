/**
 * Lectura cronometrada. El tiempo lo cuenta el servidor (reading_beat): esta pantalla envía un latido cada
 * 10 s mientras el estudiante tiene la página delante y avisa al salir. Si cambia de pestaña, de aplicación
 * o de ventana, el tiempo se detiene, el texto se cubre y, al volver, se le indica lo ocurrido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { myReading, readingBeat } from '@/api/estudiante';
import type { ReadingState } from '@/api/tipos';
import { formatoTiempo } from '@/lib/lectura';
import { Markdown } from './Markdown';
import { ProgressBar, Spinner } from './ui';

const LATIDO_MS = 10_000;

function presente(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/** De dónde sale el tiempo: el servidor (estudiantes) o una simulación local (vista previa del profesor). */
export interface ServicioLectura {
  estado: () => Promise<ReadingState | null>;
  latido: (visible: boolean) => Promise<ReadingState>;
}

export function LecturaCronometrada({ actividadId, texto, onCompletada, servicio }: {
  actividadId: string;
  texto: string;
  onCompletada: () => void;
  servicio?: ServicioLectura;
}) {
  const srv = useMemo<ServicioLectura>(
    () => servicio ?? { estado: () => myReading(actividadId), latido: (v) => readingBeat(actividadId, v) },
    [servicio, actividadId],
  );
  const [estado, setEstado] = useState<ReadingState | null>(null);
  const [extra, setExtra] = useState(0); // segundos locales desde el último latido (solo para mostrar)
  const [activo, setActivo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activoRef = useRef(false);
  const salioRef = useRef(false);
  const completadaRef = useRef(false);
  const estadoRef = useRef<ReadingState | null>(null);

  const aplicar = useCallback(
    (s: ReadingState) => {
      estadoRef.current = s;
      setEstado(s);
      setExtra(0);
      setError(null);
      if (s.completed && !completadaRef.current) {
        completadaRef.current = true;
        activoRef.current = false;
        setActivo(false);
        onCompletada();
      }
    },
    [onCompletada],
  );

  const latido = useCallback(
    (visible: boolean) => {
      if (completadaRef.current) return;
      srv
        .latido(visible)
        .then(aplicar)
        .catch(() => setError('No se pudo registrar el tiempo de lectura. Revise su conexión; seguiremos intentándolo.'));
    },
    [srv, aplicar],
  );

  const reanudar = useCallback(() => {
    if (completadaRef.current || activoRef.current || !presente()) return;
    if (salioRef.current) {
      const leidos = estadoRef.current?.seconds_read ?? 0;
      setAviso(`Saliste de la plataforma y el tiempo de lectura se detuvo en ${formatoTiempo(leidos)}. Ya vuelve a contar mientras lees.`);
      salioRef.current = false;
    }
    activoRef.current = true;
    setActivo(true);
    latido(true);
  }, [latido]);

  const pausar = useCallback(() => {
    if (completadaRef.current || !activoRef.current) return;
    activoRef.current = false;
    salioRef.current = true;
    setActivo(false);
    latido(false);
  }, [latido]);

  // estado inicial (sin sumar tiempo)
  useEffect(() => {
    let vivo = true;
    srv
      .estado()
      .then((s) => {
        if (!vivo || !s) return;
        aplicar(s);
        if (!s.completed && presente()) reanudar();
      })
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [srv, aplicar, reanudar]);

  // salir y volver: pestaña, aplicación o ventana
  useEffect(() => {
    const alCambiar = () => (presente() ? reanudar() : pausar());
    document.addEventListener('visibilitychange', alCambiar);
    window.addEventListener('blur', pausar);
    window.addEventListener('focus', reanudar);
    window.addEventListener('pagehide', pausar);
    const latidos = window.setInterval(() => activoRef.current && latido(true), LATIDO_MS);
    const reloj = window.setInterval(() => activoRef.current && setExtra((e) => e + 1), 1000);
    return () => {
      document.removeEventListener('visibilitychange', alCambiar);
      window.removeEventListener('blur', pausar);
      window.removeEventListener('focus', reanudar);
      window.removeEventListener('pagehide', pausar);
      window.clearInterval(latidos);
      window.clearInterval(reloj);
      if (activoRef.current && !completadaRef.current) {
        activoRef.current = false;
        void srv.latido(false).catch(() => undefined); // salió de la página de la actividad
      }
    };
  }, [srv, latido, pausar, reanudar]);

  if (!estado) return error ? <p className="text-sm text-red-700">{error}</p> : <Spinner />;
  const leidos = Math.min(estado.min_seconds, estado.seconds_read + (activo ? extra : 0));
  const resta = estado.min_seconds - leidos;
  const enPausa = !estado.completed && !activo;

  return (
    <section className="space-y-3">
      <div className="sticky top-14 z-20 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-primario-950/95">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">
            {estado.completed ? '✔ Lectura completada' : enPausa ? '⏸ Lectura en pausa' : '📖 Leyendo…'}
          </span>
          <span className="tabular-nums text-gray-600 dark:text-gray-300">
            {estado.completed ? `Tiempo mínimo cumplido (${formatoTiempo(estado.min_seconds)})` : `Faltan ${formatoTiempo(resta)} de ${formatoTiempo(estado.min_seconds)}`}
          </span>
        </div>
        <ProgressBar value={leidos / estado.min_seconds} />
        {!estado.completed && (
          <p className="mt-2 text-xs text-gray-500">
            Los ejercicios se habilitan al cumplir el tiempo mínimo de lectura. Si sale de esta página o de la plataforma, el tiempo se detiene.
          </p>
        )}
      </div>

      {aviso && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
          <span>{aviso}</span>
          <button className="btn-texto text-xs" onClick={() => setAviso(null)}>Entendido</button>
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="relative">
        <article className="tarjeta" aria-hidden={enPausa}>
          <Markdown>{texto}</Markdown>
        </article>
        {enPausa && (
          <div className="absolute inset-0 flex items-start justify-center rounded-xl bg-white/85 p-6 pt-24 backdrop-blur-sm dark:bg-noche/85">
            <div role="alertdialog" aria-live="assertive" className="max-w-sm rounded-xl border border-gray-200 bg-white p-5 text-center shadow-lg dark:border-white/10 dark:bg-primario-950">
              <p className="font-serif text-lg font-semibold">Lectura en pausa</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {estado.seconds_read > 0
                  ? `Saliste de la plataforma, así que el tiempo de lectura se detuvo en ${formatoTiempo(estado.seconds_read)}.`
                  : 'El tiempo de lectura empieza a contar cuando la página está activa.'}
              </p>
              <button className="btn-primario mt-4" onClick={() => { window.focus(); reanudar(); }}>Continuar leyendo</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
