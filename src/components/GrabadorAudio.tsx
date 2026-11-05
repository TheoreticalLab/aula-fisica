/**
 * Pregunta de respuesta oral (migración 86): grabar con el micrófono, escuchar antes de enviar, enviar.
 * MediaRecorder con el formato que admita el navegador (WebM-Opus en Chrome/Edge/Firefox; MP4 en Safari/iOS).
 * La grabación se sube a almacenamiento privado (Edge Function «entregas»); el servidor comprueba duración, número de
 * grabaciones y que sea audio de verdad, y deja la respuesta apuntando a ella. Una grabación anterior nunca se borra.
 * Si el micrófono no está disponible o se deniega, se explica y se anota como incidencia (exam_incidencia).
 */
import { useEffect, useRef, useState } from 'react';
import { audioMiPregunta, subirAudio, urlAudio, type ConfigAudio, type GrabacionAudio } from '@/api/audio';
import { examIncidencia } from '@/api/examen';
import { elegirMime, mmss, motivoDuracion, motivoMicrofono, restantes } from '@/lib/audio';
import { confirmarSinSalida, reanudarVigilancia, suspenderVigilancia } from '@/lib/examen/integridad';
import type { StudentAnswer } from '@/api/tipos';

/** Reproduce una grabación ya enviada (enlace temporal pedido al servidor solo al pulsar). */
export function ReproductorAudio({ audioId, etiqueta = 'Escuchar' }: { audioId: string; etiqueta?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  if (url) return <audio controls src={url} className="w-full max-w-md" onError={() => { setUrl(null); setError('El enlace caducó; vuelva a pulsar.'); }} />;
  return (
    <span>
      <button type="button" className="btn-secundario text-sm" disabled={cargando}
        onClick={async () => { setCargando(true); setError(null); try { setUrl((await urlAudio(audioId)).url); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); } }}>
        {cargando ? 'Cargando…' : `▶ ${etiqueta}`}
      </button>
      {error && <span className="ml-2 text-xs text-red-700 dark:text-red-400">{error}</span>}
    </span>
  );
}

type Fase = 'listo' | 'pidiendo' | 'grabando' | 'grabado' | 'enviando';

export function GrabadorAudio({ attemptId, exerciseId, answer, onChange, disabled }: {
  attemptId: string; exerciseId: string; answer: StudentAnswer; onChange: (a: StudentAnswer) => void; disabled: boolean;
}) {
  const [cfg, setCfg] = useState<ConfigAudio | null>(null);
  const [grabaciones, setGrabaciones] = useState<GrabacionAudio[]>([]);
  const [fase, setFase] = useState<Fase>('listo');
  const [ms, setMs] = useState(0);
  const [toma, setToma] = useState<{ blob: Blob; url: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const inicio = useRef(0);
  const reloj = useRef<number | undefined>(undefined);

  const cargar = () => audioMiPregunta(attemptId, exerciseId).then((r) => { setCfg(r.config); setGrabaciones(r.grabaciones); }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [attemptId, exerciseId]);
  // al salir de la pregunta: se apaga el micrófono y se libera la vista previa
  useEffect(() => () => { window.clearInterval(reloj.current); flujo.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (toma) URL.revokeObjectURL(toma.url); }, [toma]);

  if (!cfg) return error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : <p className="text-sm text-gray-500">Cargando la pregunta oral…</p>;
  const quedan = restantes(cfg, grabaciones.length);
  const vigente = answer.audio_id ? grabaciones.find((g) => g.id === answer.audio_id) : undefined;

  const detener = () => {
    window.clearInterval(reloj.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  };
  const comenzar = async () => {
    setError(null);
    if (toma) { URL.revokeObjectURL(toma.url); setToma(null); }
    const mime = typeof MediaRecorder !== 'undefined' ? elegirMime((m) => MediaRecorder.isTypeSupported(m)) : null;
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      setError('Este navegador no permite grabar audio. Use Chrome, Edge, Firefox o Safari actualizados, y avise al profesor.');
      void examIncidencia(attemptId, 'grabacion_fallida').catch(() => undefined);
      return;
    }
    setFase('pidiendo');
    // el aviso de permiso del navegador quita el foco a la página: no cuenta como salir del examen
    suspenderVigilancia(60_000);
    try {
      flujo.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      reanudarVigilancia();
    } catch (e) {
      reanudarVigilancia();
      const m = motivoMicrofono((e as { name?: string }).name);
      setError(m.texto); setFase('listo');
      void examIncidencia(attemptId, m.incidencia).catch(() => undefined);
      return;
    }
    const partes: Blob[] = [];
    const r = new MediaRecorder(flujo.current, { mimeType: mime, audioBitsPerSecond: 48_000 });
    r.ondataavailable = (ev) => { if (ev.data.size) partes.push(ev.data); };
    r.onstop = () => {
      flujo.current?.getTracks().forEach((t) => t.stop());
      const dur = Date.now() - inicio.current;
      const blob = new Blob(partes, { type: mime.split(';')[0] });
      setToma({ blob, url: URL.createObjectURL(blob), ms: dur });
      setMs(dur);
      setFase('grabado');
    };
    rec.current = r;
    r.start(1000);
    inicio.current = Date.now();
    setMs(0);
    setFase('grabando');
    reloj.current = window.setInterval(() => {
      const t = Date.now() - inicio.current;
      setMs(t);
      if (t >= cfg.max_s * 1000) detener();            // al llegar al máximo se detiene sola
    }, 250);
  };
  const enviar = async () => {
    if (!toma) return;
    const m = motivoDuracion(toma.ms, cfg);
    if (m) { setError(m); return; }
    if (!confirmarSinSalida(`¿Enviar esta grabación (${mmss(toma.ms)})?${quedan > 1 ? ` Le quedarán ${quedan - 1} grabación(es).` : ' Es su última grabación permitida.'}`)) return;
    setFase('enviando'); setError(null);
    try {
      const r = await subirAudio(attemptId, exerciseId, toma.blob, toma.ms);
      onChange({ audio_id: r.id, duracion_ms: r.duracion_ms });
      URL.revokeObjectURL(toma.url); setToma(null);
      await cargar();
      setFase('listo');
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)} La grabación sigue aquí: puede intentar enviarla de nuevo.`);
      setFase('grabado');
      void examIncidencia(attemptId, 'subida_fallida').catch(() => undefined);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Respuesta oral: entre <strong>{mmss(cfg.min_s * 1000)}</strong> y <strong>{mmss(cfg.max_s * 1000)}</strong> minutos.
        {' '}Puede enviar hasta {cfg.max_grabaciones} grabación(es); cuenta la última que envíe. Le quedan <strong>{quedan}</strong>.
      </p>
      {vigente && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
          <p className="mb-2">✓ Respuesta enviada ({mmss(vigente.duracion_ms)}) · {new Date(vigente.subido).toLocaleString('es-DO')}</p>
          <ReproductorAudio audioId={vigente.id} etiqueta="Escuchar mi respuesta" />
        </div>
      )}
      {fase === 'grabando' && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20" role="status" aria-live="polite">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" aria-hidden />
          <span className="font-semibold text-red-800 dark:text-red-200">Micrófono activo · grabando</span>
          <span className="ml-auto font-mono text-lg tabular-nums">{mmss(ms)} / {mmss(cfg.max_s * 1000)}</span>
        </div>
      )}
      {toma && fase !== 'grabando' && (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <p className="mb-2 text-sm">Grabación de {mmss(toma.ms)} · <strong>aún no se ha enviado</strong>.</p>
          {cfg.reproducir_previa && <audio controls src={toma.url} className="w-full max-w-md" />}
          {motivoDuracion(toma.ms, cfg) && <p className="mt-2 text-sm text-acento-700 dark:text-acento-300">{motivoDuracion(toma.ms, cfg)}</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>}
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {fase === 'grabando' ? (
            <button type="button" className="btn-primario" onClick={detener}>■ Detener grabación</button>
          ) : quedan > 0 ? (
            <>
              <button type="button" className={toma ? 'btn-secundario' : 'btn-primario'} onClick={() => void comenzar()} disabled={fase === 'pidiendo' || fase === 'enviando'}>
                {fase === 'pidiendo' ? 'Pidiendo el micrófono…' : toma ? '● Grabar de nuevo' : '● Comenzar grabación'}
              </button>
              {toma && !motivoDuracion(toma.ms, cfg) && (
                <button type="button" className="btn-primario" onClick={() => void enviar()} disabled={fase === 'enviando'}>
                  {fase === 'enviando' ? 'Enviando…' : 'Enviar grabación'}
                </button>
              )}
            </>
          ) : <p className="text-sm text-gray-500">Ya usó todas las grabaciones permitidas.</p>}
        </div>
      )}
    </div>
  );
}
