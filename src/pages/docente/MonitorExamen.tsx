/** Seguimiento en vivo de una evaluación con el motor de examen (se actualiza cada 10 s). Solo estado, sin respuestas. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { examMonitor, type MonitorExamenDatos } from '@/api/examen';
import { formatoCuenta } from '@/lib/examen/reloj';
import { estadoEnVivo } from '@/lib/examen/monitor';
import { Badge, Card } from '@/components/ui';


export function MonitorExamen({ activityId }: { activityId: string }) {
  const [d, setD] = useState<MonitorExamenDatos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [, setTic] = useState(0);
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try { const r = await examMonitor(activityId); if (vivo) { setD(r); setDesfase(r.ahora_ms - Date.now()); setError(null); } }
      catch (e) { if (vivo) setError(e instanceof Error ? e.message : String(e)); }
    };
    void cargar();
    const t = setInterval(() => void cargar(), 10_000), s = setInterval(() => setTic((x) => x + 1), 1000);
    return () => { vivo = false; clearInterval(t); clearInterval(s); };
  }, [activityId]);
  if (error) return null;               // sin motor de examen (o migración sin aplicar): no se muestra
  if (!d) return null;
  const ahora = Date.now() + desfase;
  const sinEmpezar = Math.max(0, d.inscritos - d.entregados - d.en_curso.length);
  return (
    <Card title={<span>En vivo <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden /></span>} className="mb-4">
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Badge tone="green">{d.en_curso.length} respondiendo</Badge>
        <Badge tone="blue">{d.entregados} entregados</Badge>
        <Badge>{sinEmpezar} sin empezar</Badge>
      </div>
      {d.en_curso.length ? (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {d.en_curso.map((e) => {
            const est = estadoEnVivo(e, ahora);
            return (
              <li key={e.attempt_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Link className="enlace min-w-[10rem] flex-1 font-medium" to={`/docente/intentos/${e.attempt_id}`}>{e.nombre || 'Estudiante'}</Link>
                <Badge tone={est.tono}>{est.etiqueta}</Badge>
                <span className="tabular-nums text-gray-600 dark:text-gray-300">Pregunta {e.pregunta ?? '—'}/{e.total}</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-300">{e.respondidas} respondidas</span>
                {e.limite_ms !== null && <span className="tabular-nums text-gray-600 dark:text-gray-300">⏱ {formatoCuenta(Math.max(0, e.limite_ms - ahora))}</span>}
                {e.pausas > 0 && <span className="text-xs text-gray-500">{e.pausas} pausa(s)</span>}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-gray-500">Nadie está respondiendo ahora.</p>}
      <p className="mt-2 text-xs text-gray-500">«Sin conexión» = más de 45 s sin contacto con el servidor (red, pantalla apagada o página cerrada). Sus respuestas guardadas no se pierden.</p>
    </Card>
  );
}
