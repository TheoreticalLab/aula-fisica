/** Configuración del motor de examen de una evaluación (una pregunta a la vez, navegación, duración y pausas). */
import { useEffect, useState } from 'react';
import { adaptativoGet, adaptativoSave, examSettingsGet, examSettingsSave, funcionAusente, type ConfigAdaptativa } from '@/api/examen';
import type { ConfigExamen } from '@/lib/examen/motor';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';

export function ModoExamen({ activityId }: { activityId: string }) {
  const st = useAsync(() => examSettingsGet(activityId), [activityId]);
  const action = useAction();
  const [cfg, setCfg] = useState<ConfigExamen | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (st.data) setCfg({ presentacion: st.data.presentacion, navegacion: st.data.navegacion, duracion_s: st.data.duracion_s, pausas: st.data.pausas,
      ...(st.data.integridad ? { integridad: { bloquear_al_salir: st.data.integridad.bloquear_al_salir, impedir_copiar: st.data.integridad.impedir_copiar, codigo: '' } } : {}) });
  }, [st.data]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
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
      {cfg.integridad && (
        <Integridad valor={cfg.integridad} codigoGuardado={!!st.data?.integridad?.codigo_configurado} onChange={(i) => set({ integridad: i })} />
      )}
      <ErrorBox error={action.error} />
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primario" onClick={() => void guardar()} disabled={action.busy}>{action.busy ? 'Guardando…' : 'Guardar modo de examen'}</button>
        {ok && <span className="text-sm text-emerald-700 dark:text-emerald-300">Guardado ✓</span>}
      </div>
      <ExamenAdaptativo activityId={activityId} onCambio={st.reload} />
    </Card>
  );
}

type ValorIntegridad = NonNullable<ConfigExamen['integridad']>;

/** Quiz y exámenes protegidos (migración 85): bloquear al salir (con código) e impedir copiar y pegar. */
function Integridad({ valor: v, codigoGuardado, onChange }: { valor: ValorIntegridad; codigoGuardado: boolean; onChange: (v: ValorIntegridad) => void }) {
  const falta = v.bloquear_al_salir && !codigoGuardado && (v.codigo ?? '').trim().length < 4;
  return (
    <fieldset className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
      <legend className="etiqueta">Protección durante el intento</legend>
      <p className="mb-2 text-xs text-gray-500">Se aplican de inmediato, también a los intentos en curso. El reloj del examen sigue corriendo mientras un estudiante está bloqueado.</p>
      <label className="flex items-start gap-2 py-1 text-sm">
        <input type="checkbox" checked={v.bloquear_al_salir} onChange={(e) => onChange({ ...v, bloquear_al_salir: e.target.checked })} />
        <span><strong>Bloquear si sale del examen</strong>
          <span className="block text-xs text-gray-500">Cambiar de pestaña o de aplicación, minimizar, apagar la pantalla, más de 5 s fuera, recargar, cerrar o ir a otra página del aula
            bloquea su pantalla. Solo vuelve con el código de abajo o si usted lo libera (Comunicación → Pantallas bloqueadas, Orbe Control o el resumen de esta evaluación).
            Mientras está bloqueado, el servidor no acepta sus respuestas. Una llamada entrante en el teléfono también cuenta como salida.</span></span>
      </label>
      {v.bloquear_al_salir && (
        <label className="ml-6 block max-w-sm text-sm">
          <span className="etiqueta">Código de desbloqueo {codigoGuardado && <Badge tone="green">guardado</Badge>}</span>
          <input className="campo" type="text" autoComplete="off" maxLength={32} value={v.codigo ?? ''} placeholder={codigoGuardado ? 'Dejar vacío para conservar el actual' : '4 a 32 caracteres'}
            onChange={(e) => onChange({ ...v, codigo: e.target.value })} />
          <span className="mt-1 block text-xs text-gray-500">Anótelo: se guarda cifrado y no se puede volver a mostrar. No distingue mayúsculas. Cambiarlo no afecta a quien ya esté bloqueado.</span>
          {falta && <span className="mt-1 block text-xs text-acento-700">Escriba el código para poder guardar.</span>}
        </label>
      )}
      <label className="flex items-start gap-2 py-1 text-sm">
        <input type="checkbox" checked={v.impedir_copiar} onChange={(e) => onChange({ ...v, impedir_copiar: e.target.checked })} />
        <span><strong>Impedir copiar y pegar</strong>
          <span className="block text-xs text-gray-500">No se puede pegar ni arrastrar texto en las respuestas, ni copiar o seleccionar el enunciado. Los intentos quedan anotados.
            Es una barrera de la página: no impide fotografiar la pantalla ni usar otro dispositivo.</span></span>
      </label>
    </fieldset>
  );
}

/** Examen adaptativo (migración 53): preguntas elegidas una a una del banco calibrado según las respuestas. */
function ExamenAdaptativo({ activityId, onCambio }: { activityId: string; onCambio: () => void }) {
  const st = useAsync(() => adaptativoGet(activityId), [activityId]);
  const action = useAction();
  const [cfg, setCfg] = useState<ConfigAdaptativa | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => { if (st.data) setCfg(st.data.config ?? { activo: false, max_items: 15, min_items: 10, se_objetivo: 0.35, exposicion: 3, incluir_provisionales: false }); }, [st.data]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!cfg || !st.data) return null;
  const d = st.data;
  const banco = d.calibradas + (cfg.incluir_provisionales ? d.provisionales : 0);
  const set = (p: Partial<ConfigAdaptativa>) => { setCfg({ ...cfg, ...p }); setOk(false); };
  const bloqueado = d.intentos > 0;
  const guardar = async () => { const r = await action.run(() => adaptativoSave(activityId, cfg)); if (r) { setOk(true); st.setData(r); onCambio(); } };
  const num = (v: string, min: number, max: number, def: number) => Math.max(min, Math.min(max, Number(v) || def));
  return (
    <div className="mt-5 border-t border-gray-200 pt-4 dark:border-white/10">
      <h3 className="font-semibold">Examen adaptativo {d.config?.activo ? <Badge tone="purple">activo</Badge> : <Badge>no</Badge>}</h3>
      <p className="text-xs text-gray-500">Cada estudiante recibe las preguntas una a una, elegidas del banco calibrado de esta evaluación según sus respuestas (TRI 2PL, máxima información). La nota no es el número de aciertos, que no sería comparable, sino el <strong>dominio estimado</strong>: la proporción de aciertos que se espera en todo el banco con su habilidad estimada. Navegación siempre solo hacia adelante.</p>
      <p className="mt-1 text-xs">Banco: {d.preguntas} preguntas en la evaluación · {d.calibradas} calibradas · {d.provisionales} provisionales. Se necesitan al menos {d.minimo_banco} (se calibran en LIEIA → 📐 Calibración de ítems, con exámenes ya aplicados).</p>
      {bloqueado && <Notice tone="warn">Ya hay {d.intentos} intento(s): la configuración adaptativa no puede cambiar. Para otra configuración, cree otra evaluación.</Notice>}
      <fieldset disabled={bloqueado} className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={cfg.activo} onChange={(e) => set({ activo: e.target.checked })} /> Administrar esta evaluación de forma adaptativa</label>
        {cfg.activo && <>
          <label className="text-sm"><span className="etiqueta">Máximo de preguntas</span>
            <input type="number" className="campo" min={5} max={Math.min(60, banco || 60)} value={cfg.max_items} onChange={(e) => set({ max_items: num(e.target.value, 5, 60, 15) })} /></label>
          <label className="text-sm"><span className="etiqueta">Mínimo de preguntas</span>
            <input type="number" className="campo" min={3} max={cfg.max_items} value={cfg.min_items} onChange={(e) => set({ min_items: num(e.target.value, 3, cfg.max_items, 10) })} /></label>
          <label className="text-sm"><span className="etiqueta">Terminar antes si el error típico de la habilidad es ≤</span>
            <input type="number" className="campo" step={0.05} min={0.2} max={1} placeholder="No terminar antes" value={cfg.se_objetivo ?? ''}
              onChange={(e) => set({ se_objetivo: e.target.value ? num(e.target.value, 0.2, 1, 0.35) : null })} />
            <span className="mt-1 block text-xs text-gray-500">Vacío: todos responden el máximo (más parejo). 0,30–0,40 es una precisión habitual.</span></label>
          <label className="text-sm"><span className="etiqueta">Control de exposición (elegir entre las k mejores)</span>
            <input type="number" className="campo" min={1} max={5} value={cfg.exposicion} onChange={(e) => set({ exposicion: num(e.target.value, 1, 5, 3) })} />
            <span className="mt-1 block text-xs text-gray-500">Con 1, estudiantes con las mismas respuestas ven las mismas preguntas; con 3, se reparten (algo menos de precisión).</span></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={cfg.incluir_provisionales} onChange={(e) => set({ incluir_provisionales: e.target.checked })} /> Incluir preguntas con calibración provisional (menos fiable)</label>
        </>}
      </fieldset>
      <ErrorBox error={action.error} />
      {!bloqueado && (
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-secundario" onClick={() => void guardar()} disabled={action.busy || (cfg.activo && banco < d.minimo_banco)}>{action.busy ? 'Guardando…' : 'Guardar modo adaptativo'}</button>
          {cfg.activo && banco < d.minimo_banco && <span className="text-xs text-acento-700">Faltan {d.minimo_banco - banco} preguntas calibradas.</span>}
          {ok && <span className="text-sm text-emerald-700 dark:text-emerald-300">Guardado ✓</span>}
        </div>
      )}
    </div>
  );
}
