/**
 * Aviso al estudiante cuando el profesor INICIA una Práctica de Control que le corresponde (migración 62).
 * Consulta periódica con la pestaña visible (`CONSUMO.controlPendienteMs`, 20 s en bajo consumo). Al tocarlo abre (o retoma tras una recarga o desconexión) su intento:
 * el reloj oficial lo lleva el servidor, así que volver a entrar no reinicia ni regala tiempo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSUMO, hechaHaceMenosDe, marcarHecha, sondeo } from '@/lib/consumo';
import { useLocation, useNavigate } from 'react-router-dom';
import { miControlPendiente, type ControlPendiente } from '@/api/control';
import { startActivityAttempt } from '@/api/estudiante';
import { useEmergente } from '@/lib/emergentes';

export function AvisoControl() {
  const [c, setC] = useState<ControlPendiente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const { pathname } = useLocation();
  const nav = useNavigate();
  // modo de bajo consumo: un solo sondeo (con la pestaña visible) que no se reinicia al cambiar de página; el cambio de
  // página solo consulta si la última consulta tiene más de `minEntreConsultasRutaMs`
  const vivo = useRef(true);
  const cargar = useCallback(() => {
    marcarHecha('my_control_pendiente');
    miControlPendiente().then((d) => vivo.current && setC(d)).catch(() => undefined);
  }, []);
  useEffect(() => {
    vivo.current = true;
    const parar = sondeo(cargar, CONSUMO.controlPendienteMs, { minimoMs: 2_000 });
    return () => { vivo.current = false; parar(); };
  }, [cargar]);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (document.visibilityState === 'visible' && !hechaHaceMenosDe('my_control_pendiente', CONSUMO.minEntreConsultasRutaMs)) cargar();
  }, [pathname, cargar]);
  const enIntento = !!c?.attempt_id && pathname === `/intento/${c.attempt_id}`;
  const visible = !!c && !enIntento;
  useEmergente('aviso-control', visible);
  if (!visible || !c) return null;
  async function abrir() {
    setAbriendo(true);
    setError(null);
    try {
      const id = c!.attempt_id ?? (await startActivityAttempt(c!.activity_id));
      nav(`/intento/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAbriendo(false);
    }
  }
  return (
    <div role="alert" className="fixed inset-x-3 top-3 z-50 mx-auto block max-w-lg rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-blue-950 shadow-lg dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
      <p className="font-semibold">📝 Práctica de Control {c.attempt_id ? 'en curso' : 'activada por el profesor'}</p>
      <p className="text-sm">Sobre «{c.practica}»{c.competencia ? ` · competencia: ${c.competencia}` : ''} · {c.duracion_min + c.extra_min} minutos desde que la abras.
        Es individual: resuélvela sin ayudas externas salvo las que indique el profesor.</p>
      <button className="btn-primario mt-2" disabled={abriendo} onClick={() => void abrir()}>{abriendo ? 'Abriendo…' : c.attempt_id ? 'Volver a mi control' : 'Comenzar ahora'}</button>
      {error && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}. Si el problema continúa, avisa al profesor: se registra como incidencia y no afecta tu nota.</p>}
    </div>
  );
}
