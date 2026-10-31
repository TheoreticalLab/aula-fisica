/** Configuración del motor de examen de una evaluación (una pregunta a la vez, navegación, duración y pausas). */
import { useEffect, useState } from 'react';
import { examSettingsGet, examSettingsSave } from '@/api/examen';
import type { ConfigExamen } from '@/lib/examen/motor';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';

export function ModoExamen({ activityId }: { activityId: string }) {
  const st = useAsync(() => examSettingsGet(activityId), [activityId]);
  const action = useAction();
  const [cfg, setCfg] = useState<ConfigExamen | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => { if (st.data) setCfg({ presentacion: st.data.presentacion, navegacion: st.data.navegacion, duracion_s: st.data.duracion_s, pausas: st.data.pausas }); }, [st.data]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!cfg) return null;
  const set = (p: Partial<ConfigExamen>) => { setCfg({ ...cfg, ...p }); setOk(false); };
  const setP = (p: Partial<ConfigExamen['pausas']>) => set({ pausas: { ...cfg.pausas, ...p } });
  const unaALaVez = cfg.presentacion === 'una_a_la_vez';
  const guardar = async () => { const r = await action.run(() => examSettingsSave(activityId, cfg)); if (r) { setOk(true); st.setData(r); } };

  return (
    <Card title={<span>Modo de examen {st.data?.configurado ? <Badge tone="green">configurado</Badge> : <Badge>clásico</Badge>}</span>} className="mt-4">
      {!!st.data?.en_curso && <Notice tone="warn">Hay {st.data.en_curso} intento(s) en curso: conservan la configuración con la que empezaron. Los cambios valen para los intentos nuevos.</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className="etiqueta">Presentación</legend>
          <label className="flex items-start gap-2 py-1 text-sm"><input type="radio" checked={unaALaVez} onChange={() => set({ presentacion: 'una_a_la_vez' })} />
            <span><strong>Una pregunta a la vez</strong><span className="block text-xs text-gray-500">Reloj oficial del servidor, tiempo por pregunta, pausas y recuperación tras desconexiones.</span></span></label>
          <label className="flex items-start gap-2 py-1 text-sm"><input type="radio" checked={!unaALaVez} onChange={() => set({ presentacion: 'todas' })} />
            <span><strong>Todas en una página</strong> (clásico)<span className="block text-xs text-gray-500">Sin límite de tiempo por intento ni pausas.</span></span></label>
        </fieldset>
        {unaALaVez && (
          <fieldset>
            <legend className="etiqueta">Navegación</legend>
            <label className="flex items-start gap-2 py-1 text-sm"><input type="radio" checked={cfg.navegacion === 'libre'} onChange={() => set({ navegacion: 'libre' })} />
              <span><strong>Libre</strong><span className="block text-xs text-gray-500">Puede ir y volver entre preguntas y marcarlas para revisar.</span></span></label>
            <label className="flex items-start gap-2 py-1 text-sm"><input type="radio" checked={cfg.navegacion === 'solo_adelante'} onChange={() => set({ navegacion: 'solo_adelante' })} />
              <span><strong>Solo hacia adelante</strong><span className="block text-xs text-gray-500">Una pregunta ya vista no se puede volver a abrir ni modificar.</span></span></label>
          </fieldset>
        )}
        {unaALaVez && (
          <label className="text-sm">
            <span className="etiqueta">Duración del intento (minutos)</span>
            <input type="number" className="campo" min={1} max={360} placeholder="Sin límite (solo el cierre de la actividad)"
              value={cfg.duracion_s ? Math.round(cfg.duracion_s / 60) : ''} onChange={(e) => set({ duracion_s: e.target.value ? Math.max(1, Math.min(360, Number(e.target.value))) * 60 : null })} />
            <span className="mt-1 block text-xs text-gray-500">Cuenta desde que el estudiante empieza. Nunca pasa del cierre de la actividad.</span>
          </label>
        )}
        {unaALaVez && (
          <fieldset>
            <legend className="etiqueta">Pausas declaradas</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.pausas.permitidas}
              onChange={(e) => setP(e.target.checked ? { permitidas: true, max_numero: Math.max(1, cfg.pausas.max_numero), max_total_s: Math.max(60, cfg.pausas.max_total_s || 300) } : { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false })} />
              Permitir pausas (las preguntas se ocultan durante la pausa)</label>
            {cfg.pausas.permitidas && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">Número máximo<input type="number" className="campo" min={1} max={10} value={cfg.pausas.max_numero} onChange={(e) => setP({ max_numero: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></label>
                <label className="text-xs">Minutos en total<input type="number" className="campo" min={1} max={60} value={Math.round(cfg.pausas.max_total_s / 60)} onChange={(e) => setP({ max_total_s: Math.max(1, Math.min(60, Number(e.target.value) || 1)) * 60 })} /></label>
                <label className="col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={cfg.pausas.detienen_reloj} onChange={(e) => setP({ detienen_reloj: e.target.checked })} disabled={!cfg.duracion_s} />
                  La pausa detiene el reloj del examen{!cfg.duracion_s && ' (requiere una duración)'}</label>
              </div>
            )}
          </fieldset>
        )}
      </div>
      <ErrorBox error={action.error} />
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primario" onClick={() => void guardar()} disabled={action.busy}>{action.busy ? 'Guardando…' : 'Guardar modo de examen'}</button>
        {ok && <span className="text-sm text-emerald-700 dark:text-emerald-300">Guardado ✓</span>}
      </div>
    </Card>
  );
}
