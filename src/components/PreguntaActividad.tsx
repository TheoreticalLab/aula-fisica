/**
 * Pregunta de la plataforma en una práctica (migración 108): cuadro que no se cierra sin responder «Sí» o «No».
 * Se consulta al cargar, al volver a la pestaña y cada 2 min con la página visible. Responder no tiene consecuencias
 * automáticas: queda registrado para el profesor.
 */
import { useEffect, useState } from 'react';
import { API_CONSULTAS_ACTIVIDAD, type ConsultaActividad } from '@/api/actividadConsultas';
import { useAction } from '@/lib/util';
import { ErrorBox } from './ui';

export function PreguntaActividad({ activityId }: { activityId: string }) {
  const [consulta, setConsulta] = useState<ConsultaActividad | null>(null);
  const act = useAction();

  useEffect(() => {
    let vivo = true;
    const buscar = () => {
      if (document.visibilityState !== 'visible') return;
      void API_CONSULTAS_ACTIVIDAD.pendiente(activityId).then((c) => { if (vivo) setConsulta(c); }).catch(() => undefined);
    };
    buscar();
    const iv = window.setInterval(buscar, 120_000);
    document.addEventListener('visibilitychange', buscar);
    return () => { vivo = false; window.clearInterval(iv); document.removeEventListener('visibilitychange', buscar); };
  }, [activityId]);

  if (!consulta) return null;
  const responder = async (r: boolean) => {
    const siguiente = await act.run(() => API_CONSULTAS_ACTIVIDAD.declarar(consulta.id, r));
    if (siguiente !== undefined) setConsulta(siguiente);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="pregunta-actividad-titulo" className="tarjeta w-full max-w-lg space-y-4 bg-white dark:bg-gray-900">
        <h2 id="pregunta-actividad-titulo" className="text-lg font-bold">{consulta.titulo}</h2>
        <div className="space-y-2">{consulta.texto.split(/\n\s*\n/).map((p, k) => <p key={k}>{p}</p>)}</div>
        <div className="flex flex-wrap justify-end gap-3">
          <button className="btn-secundario min-h-[44px] min-w-[96px]" disabled={act.busy} onClick={() => void responder(true)}>Sí</button>
          <button className="btn-secundario min-h-[44px] min-w-[96px]" disabled={act.busy} onClick={() => void responder(false)}>No</button>
        </div>
        <p className="text-xs text-gray-500">Su respuesta no se puede cambiar.</p>
        <ErrorBox error={act.error} />
      </div>
    </div>
  );
}
