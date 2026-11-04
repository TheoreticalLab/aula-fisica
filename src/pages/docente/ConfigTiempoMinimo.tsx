/**
 * Tiempo mínimo de realización de una práctica (migración 78): el profesor lo activa, lo cambia o lo quita, y ve el
 * tiempo activo de cada intento. El servidor cuenta el tiempo, bloquea la entrega y reduce la nota; aquí solo se muestra.
 */
import { useEffect, useState } from 'react';
import { configTiempo, guardarTiempo, intentosTiempo } from '@/api/tiempoMinimo';
import { duracion, factorNota } from '@/lib/tiempoMinimo';
import { useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';

export function ConfigTiempoMinimo({ activityId }: { activityId: string }) {
  const cfg = useAsync(() => configTiempo(activityId), [activityId]);
  const intentos = useAsync(() => intentosTiempo(activityId), [activityId]);
  const [activo, setActivo] = useState(false);
  const [minutos, setMinutos] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!cfg.data) return;
    setActivo(cfg.data.activo);
    if (cfg.data.minutos) setMinutos(cfg.data.minutos);
  }, [cfg.data]);

  async function guardar() {
    setBusy(true);
    setError(null);
    setAviso(null);
    try {
      const r = await guardarTiempo(activityId, activo ? minutos : null);
      cfg.setData(r);
      setAviso(r.activo ? `Guardado: ${r.minutos} min de trabajo activo.` : 'Tiempo mínimo desactivado.' + (r.recalculados ? ` Se recalcularon ${r.recalculados} nota(s).` : ''));
      await intentos.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (cfg.loading && !cfg.data) return <Card title="Tiempo mínimo de realización"><Spinner /></Card>;
  if (cfg.error) return <Card title="Tiempo mínimo de realización"><ErrorBox error={cfg.error} onRetry={() => void cfg.reload()} /></Card>;
  const cambiado = activo !== !!cfg.data?.activo || (activo && minutos !== cfg.data?.minutos);
  const xs = (intentos.data ?? []).filter((i) => !i.exento);
  return (
    <Card title="Tiempo mínimo de realización" className="mt-4">
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Exigir un tiempo mínimo de trabajo antes de entregar
      </label>
      {activo && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="tmin-minutos">Minutos de trabajo activo:</label>
          <input id="tmin-minutos" type="number" min={1} max={600} className="campo w-28" value={minutos} onChange={(e) => setMinutos(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} />
        </div>
      )}
      <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
        <li>Solo cuenta el tiempo con la práctica en pantalla y con actividad (si se va, cambia de pestaña o la deja quieta más de 2 min, el reloj se detiene). Lo cuenta el servidor.</li>
        <li>Antes de cumplirlo, el estudiante no puede entregar.</li>
        <li>Si no la entrega y usted la entrega al cierre («Entregar y calificar» o Orbe Control), o la entrega él después del cierre, la nota se multiplica por (tiempo activo ÷ mínimo). Ej.: 20 de 60 min → un tercio.</li>
        <li>Solo afecta a intentos empezados después de activarlo; las demás prácticas no cambian.</li>
        <li>Es un indicador de trabajo: no prueba esfuerzo ni autoría, ni impide el uso de IA.</li>
      </ul>
      <ErrorBox error={error} />
      {aviso && <Notice tone="ok">{aviso}</Notice>}
      <button className="btn-primario" disabled={busy || !cambiado} onClick={() => void guardar()}>{busy ? 'Guardando…' : 'Guardar tiempo mínimo'}</button>

      {cfg.data?.activo && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tiempo activo por intento</h3>
            <button className="enlace text-sm" disabled={intentos.loading} onClick={() => void intentos.reload()}>{intentos.loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
          <ErrorBox error={intentos.error} />
          {intentos.data && xs.length === 0 && <p className="text-sm text-gray-500">Todavía no hay intentos con tiempo mínimo.</p>}
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            {xs.map((i) => (
              <li key={i.attempt_id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span>{i.full_name} <span className="font-mono text-xs text-gray-500">{i.login_id}</span></span>
                <span className="flex items-center gap-2 text-xs">
                  {duracion(i.segundos)} de {duracion(i.minimo_s ?? 0)}{i.pausas ? ` · ${i.pausas} pausa(s)` : ''}
                  {i.cumplido ? <Badge tone="green">Cumplido</Badge>
                    : i.status === 'submitted' ? <Badge tone="amber">Entregado al {Math.round(100 * factorNota(i.segundos, i.minimo_s ?? 1))} %</Badge>
                    : <Badge>En curso</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
