/**
 * Aviso para el estudiante cuando el profesor abre la asistencia de una de sus secciones y aún no está presente.
 * Consulta periódica solo con la pestaña visible (`CONSUMO.avisoAsistenciaMs`); nunca recibe el código. No se muestra
 * en el inicio (allí está el botón «Asistencia») ni en la propia página de asistencia.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSUMO, hechaHaceMenosDe, marcarHecha, sondeo } from '@/lib/consumo';
import { Link, useLocation } from 'react-router-dom';
import { misAsistenciasAbiertas, type AsistenciaAbiertaMia } from '@/api/asistencia';
import { useEmergente } from '@/lib/emergentes';

export function AvisoAsistencia() {
  const [pendientes, setPendientes] = useState<AsistenciaAbiertaMia[]>([]);
  const { pathname } = useLocation();
  // modo de bajo consumo: un sondeo que no se reinicia al cambiar de página (ver AvisoControl)
  const vivo = useRef(true);
  const cargar = useCallback(() => {
    marcarHecha('my_open_attendance');
    misAsistenciasAbiertas()
      .then((d) => vivo.current && setPendientes(d.filter((x) => !x.presente)))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    vivo.current = true;
    const parar = sondeo(cargar, CONSUMO.avisoAsistenciaMs, { minimoMs: 2_000 });
    return () => { vivo.current = false; parar(); };
  }, [cargar]);
  const anterior = useRef<string | null>(null);
  useEffect(() => {
    const venia = anterior.current;
    anterior.current = pathname;
    if (venia === null || document.visibilityState !== 'visible') return;
    // al salir de /asistencia (donde quizá acaba de marcar) se consulta siempre; en otro cambio de página, solo si pasó un rato
    if (venia === '/asistencia' || !hechaHaceMenosDe('my_open_attendance', CONSUMO.minEntreConsultasRutaMs)) cargar();
  }, [pathname, cargar]);
  const visible = pendientes.length > 0 && pathname !== '/asistencia' && pathname !== '/';
  useEmergente('aviso-asistencia', visible);
  if (!visible) return null;
  return (
    <Link to="/asistencia" className="fixed inset-x-3 top-3 z-50 mx-auto block max-w-lg rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">📋 El profesor abrió la asistencia</p>
      <p className="text-sm">{pendientes.map((p) => `${p.asignatura} · ${p.clase}`).join(', ')} — toque aquí y escriba el código para quedar presente.</p>
    </Link>
  );
}
