/** Configuración del aprendizaje asistido de una práctica: transferencia por ejercicio, pesos editables y verificación diferida. */
import { useEffect, useState } from 'react';
import { asistidaDeclaradaGuardar, asistidaDependenciaGuardar, asistidaNotaGuardar, assistedSettingsDisable, assistedSettingsGet, assistedSettingsSave, type ConfigAsistida as Cfg } from '@/api/asistida';
import { funcionAusente } from '@/api/examen';
import { activityItems, listActivities, listExercises } from '@/api/docente';
import { creditoConRegla, notaCompuesta } from '@/lib/asistida';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, Spinner } from '@/components/ui';

const POR_DEFECTO: Cfg = { transferencia: false, peso_inicial: 20, peso_correccion: 30, peso_justificacion: 20, peso_transferencia: 30,
  verificacion_tipo: null, verificacion_fecha: null, verificacion_actividad: null, verificacion_nota: null };

export function ConfigAsistida({ activityId, courseId, classId }: { activityId: string; courseId: string; classId: string }) {
  const st = useAsync(async () => {
    const [s, items, banco, acts] = await Promise.all([assistedSettingsGet(activityId), activityItems(activityId), listExercises({ courseId }), listActivities(classId)]);
    return { s, items, banco, examenes: acts.filter((a) => a.mode === 'exam') };
  }, [activityId]);
  const action = useAction();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [tr, setTr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  useEffect(() => { if (st.data) { setCfg(st.data.s.config ? { ...POR_DEFECTO, ...st.data.s.config } : null); setTr(st.data.s.transferencias); } }, [st.data]);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
  const { items, banco, examenes, s } = st.data!;
  const nombre = (id: string) => banco.find((e) => e.id === id)?.slug ?? id.slice(0, 8);
  const set = (p: Partial<Cfg>) => { setCfg((c) => ({ ...(c ?? POR_DEFECTO), ...p })); setOk(false); };
  const suma = cfg ? cfg.peso_inicial + cfg.peso_correccion + cfg.peso_justificacion + cfg.peso_transferencia : 100;
  async function guardar() {
    if (!cfg) return;
    const r = await action.run(() => assistedSettingsSave(activityId, cfg, cfg.transferencia ? tr : {}));
    if (r) { setOk(true); st.setData({ ...st.data!, s: r }); }
  }

  if (!cfg) {
    return (
      <Card title="Aprendizaje asistido" className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">Convierte esta práctica en un proceso por ejercicio: <strong>intentar solo → aprender con ayuda → corregir → explicar</strong> (y, si quiere, demostrar con un ejercicio nuevo). Se desactivan la solución inmediata y las pistas.</p>
        {s.con_pasos && <Notice tone="warn">Esta práctica ya tiene pasos de aprendizaje asistido.</Notice>}
        <button className="btn-secundario mt-3" onClick={() => set({})}>Activar el aprendizaje asistido…</button>
      </Card>
    );
  }
  const ef = notaCompuesta({ inicial: cfg.peso_inicial, correccion: cfg.peso_correccion, justificacion: cfg.peso_justificacion, transferencia: cfg.peso_transferencia },
    { inicial: true, correccion: 1, justificacion: true, transferencia: cfg.transferencia ? 1 : null }).efectivos;
  return (
    <Card title={<span>Aprendizaje asistido {st.data!.s.config ? <Badge tone="green">activo</Badge> : <Badge>sin guardar</Badge>}</span>} className="mt-4">
      <div className="space-y-4 text-sm">
        {st.data!.s.config && <ReglaNota activityId={activityId} cfg={cfg} pesos={ef} onGuardado={(c) => st.setData({ ...st.data!, s: { ...st.data!.s, config: { ...st.data!.s.config!, ...c } } })} />}
        {st.data!.s.config && <PenalizacionDependencia activityId={activityId} cfg={cfg} onGuardado={(c) => st.setData({ ...st.data!, s: { ...st.data!.s, config: { ...st.data!.s.config!, ...c } } })} />}
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={cfg.transferencia} onChange={(e) => set({ transferencia: e.target.checked })} />
          <span><strong>Paso 4 · Demuestra lo que aprendiste</strong>: después de explicar, un ejercicio distinto con el mismo concepto (un solo intento).</span></label>
        {cfg.transferencia && (
          <div>
            <p className="etiqueta">Ejercicio de transferencia de cada pregunta</p>
            <p className="mb-2 text-xs text-gray-500">Elija un ejercicio validado del banco que use el mismo concepto. No basta con cambiar los números si quiere comprobar comprensión. Sin ejercicio asignado, esa pregunta no tiene paso 4.</p>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.exercise_id} className="grid gap-1 sm:grid-cols-2 sm:items-center">
                  <span className="font-mono text-xs">{nombre(it.exercise_id)}</span>
                  <select className="campo" value={tr[it.exercise_id] ?? ''} onChange={(e) => { setTr({ ...tr, [it.exercise_id]: e.target.value }); setOk(false); }}>
                    <option value="">— Sin transferencia —</option>
                    {banco.filter((e) => e.id !== it.exercise_id).map((e) => <option key={e.id} value={e.id}>{e.slug}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details>
          <summary className="cursor-pointer font-medium">Opciones avanzadas: ponderación y verificación posterior</summary>
          <div className="mt-3 space-y-3">
            <div>
              <p className="etiqueta">Ponderación de cada fase (debe sumar 100) — <span className={suma === 100 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>suma {suma}</span></p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([['peso_inicial', 'Intento inicial'], ['peso_correccion', 'Corrección'], ['peso_justificacion', 'Explicación'], ['peso_transferencia', 'Transferencia']] as const).map(([k, t]) => (
                  <label key={k} className="text-xs">{t}<input type="number" min={0} max={100} className="campo" value={cfg[k]} onChange={(e) => set({ [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } as Partial<Cfg>)} /></label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Es una propuesta editable, no una escala validada. El intento inicial cuenta por presentarlo (acertar no es necesario); la corrección, por su resultado; la explicación, por presentarla (usted puede ajustar la nota en la revisión); la transferencia, por su resultado.
                Declarar que usó o no usó IA no cambia nada.
                {!cfg.transferencia && ` Sin transferencia, los pesos se reparten proporcionalmente: intento ${ef.inicial} %, corrección ${ef.correccion} %, explicación ${ef.justificacion} %.`}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">Verificación posterior
                <select className="campo" value={cfg.verificacion_tipo ?? ''} onChange={(e) => set({ verificacion_tipo: e.target.value || null })}>
                  <option value="">Ninguna</option><option value="otra_sesion">En otra sesión</option><option value="fecha">En una fecha</option>
                  <option value="presencial">En una actividad presencial</option><option value="examen">En un examen posterior</option>
                </select></label>
              {cfg.verificacion_tipo === 'fecha' && (
                <label className="text-xs">Fecha<input type="date" className="campo" value={cfg.verificacion_fecha?.slice(0, 10) ?? ''} onChange={(e) => set({ verificacion_fecha: e.target.value || null })} /></label>
              )}
              {cfg.verificacion_tipo && (
                <label className="text-xs">Actividad que la comprueba (para ver la retención)
                  <select className="campo" value={cfg.verificacion_actividad ?? ''} onChange={(e) => set({ verificacion_actividad: e.target.value || null })}>
                    <option value="">— Aún no —</option>{examenes.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select></label>
              )}
              {cfg.verificacion_tipo && <label className="text-xs sm:col-span-2">Nota para los estudiantes<input className="campo" maxLength={300} value={cfg.verificacion_nota ?? ''} onChange={(e) => set({ verificacion_nota: e.target.value || null })} /></label>}
            </div>
            <p className="text-xs text-gray-500">Una verificación en casa no prueba trabajo autónomo; la retención se interpreta mejor con una comprobación supervisada.</p>
          </div>
        </details>
        <ErrorBox error={action.error} />
        <div className="flex items-center gap-3">
          <button className="btn-primario" onClick={() => void guardar()} disabled={action.busy || suma !== 100}>{action.busy ? 'Guardando…' : 'Guardar aprendizaje asistido'}</button>
          {ok && <span className="text-emerald-700 dark:text-emerald-300">Guardado ✓</span>}
          {st.data!.s.config && !s.con_pasos && (
            <button className="btn-texto ml-auto text-sm text-red-700 dark:text-red-300" disabled={action.busy} onClick={async () => {
              if (!window.confirm('¿Volver a práctica tradicional? Se quita el aprendizaje asistido (ningún estudiante lo ha usado todavía). La retroalimentación inmediata y las pistas puede activarlas en la configuración de la actividad.')) return;
              const r = await action.run(() => assistedSettingsDisable(activityId));
              if (r) { st.setData({ ...st.data!, s: r }); setCfg(null); }
            }}>Desactivar el aprendizaje asistido</button>
          )}
        </div>
        {s.con_pasos && <p className="text-xs text-gray-500">Ya hay estudiantes con pasos registrados: el aprendizaje asistido no se puede desactivar en esta práctica.</p>}
      </div>
    </Card>
  );
}

/** Penalización por dependencia OBSERVADA de la ayuda (migración 59): no depende de lo que el estudiante declare. */
function PenalizacionDependencia({ activityId, cfg, onGuardado }: { activityId: string; cfg: Cfg; onGuardado: (c: Partial<Cfg>) => void }) {
  const [activa, setActiva] = useState(cfg.dependencia_umbral != null);
  const [umbral, setUmbral] = useState(cfg.dependencia_umbral ?? 50);
  const [descuento, setDescuento] = useState(cfg.dependencia_descuento ?? 20);
  const [recalcular, setRecalcular] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const accion = useAction();
  const guardar = () => void accion.run(async () => {
    const r = await asistidaDependenciaGuardar(activityId, activa ? umbral : null, descuento, recalcular);
    onGuardado({ dependencia_umbral: activa ? umbral : null, dependencia_descuento: descuento });
    setMsg(recalcular ? `Guardado; ${r.recalculados} intento(s) recalculado(s).` : 'Guardado: se aplicará a partir de los próximos pasos.');
  });
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={activa} onChange={(e) => { setActiva(e.target.checked); setMsg(null); }} />
        <span><strong>Penalización por dependencia de la ayuda</strong>
          <span className="block text-xs text-gray-500">Cuenta los ejercicios que el estudiante corrigió <em>después de fallar</em> su primer intento (se observa; no depende de lo que declare). Si superan el umbral, la nota de toda la práctica baja el porcentaje indicado.</span></span></label>
      {activa && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs"><span className="etiqueta">Si corrige tras fallar más del</span>
            <span className="flex items-center gap-2"><input type="number" min={1} max={100} className="campo w-24" value={umbral} onChange={(e) => setUmbral(Math.max(1, Math.min(100, Number(e.target.value) || 50)))} /> % de los ejercicios</span></label>
          <label className="text-xs"><span className="etiqueta">la nota de la práctica baja un</span>
            <span className="flex items-center gap-2"><input type="number" min={0} max={100} className="campo w-24" value={descuento} onChange={(e) => setDescuento(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /> %</span></label>
          <p className="text-xs text-gray-500 sm:col-span-2">Ejemplo: con 20 ejercicios, quien corrige tras fallar {Math.floor(umbral / 5) + 1} o más (más del {umbral} %) pasa de, por ejemplo, 50 % a {Math.round(50 * (1 - descuento / 100))} %. El estudiante ve la regla y su propio porcentaje mientras avanza.</p>
        </div>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={recalcular} onChange={(e) => setRecalcular(e.target.checked)} /> Recalcular ahora las notas de los intentos existentes</label>
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-secundario !py-1 text-sm" disabled={accion.busy} onClick={guardar}>{accion.busy ? 'Guardando…' : 'Guardar penalización'}</button>
        {msg && <span className="text-xs text-emerald-700 dark:text-emerald-300">{msg}</span>}
      </div>
      <ErrorBox error={accion.error} />
    </div>
  );
}

/** Regla de nota (migración 58): la corrección con ayuda tras fallar no vale lo mismo que acertar solo. */
function ReglaNota({ activityId, cfg, pesos, onGuardado }: { activityId: string; cfg: Cfg; pesos: { inicial: number; correccion: number; justificacion: number; transferencia: number }; onGuardado: (c: Partial<Cfg>) => void }) {
  const [modo, setModo] = useState<'participacion' | 'acierto'>(cfg.nota_primer_intento ?? 'participacion');
  const [factor, setFactor] = useState(Math.round(100 * (cfg.factor_ayuda ?? 1)));
  const [declarada, setDeclarada] = useState(Math.round(100 * (cfg.factor_declarada ?? 1)));
  const [recalcular, setRecalcular] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const accion = useAction();
  const p = { inicial: cfg.peso_inicial, correccion: cfg.peso_correccion, justificacion: cfg.peso_justificacion, transferencia: cfg.peso_transferencia };
  const regla = { primerIntento: modo, factorAyuda: factor / 100, factorDeclarada: declarada / 100 };
  const t = cfg.transferencia ? 1 : null;
  const pct = (x: number) => `${Math.round(100 * x)} %`;
  const solo = creditoConRegla(p, regla, { iniCredito: 1, corBruto: 1, justificacion: true, transferencia: t });
  const conAyuda = creditoConRegla(p, regla, { iniCredito: 0, corBruto: 1, justificacion: true, transferencia: t });
  const aciertaDeclarando = creditoConRegla(p, regla, { iniCredito: 1, corBruto: 1, justificacion: true, transferencia: t, declaroAyuda: true });
  const guardar = () => void accion.run(async () => {
    await asistidaNotaGuardar(activityId, modo, factor / 100, false);
    const r = await asistidaDeclaradaGuardar(activityId, declarada / 100, recalcular);   // un solo recálculo, con las dos reglas ya guardadas
    onGuardado({ nota_primer_intento: modo, factor_ayuda: factor / 100, factor_declarada: declarada / 100 });
    setMsg(recalcular ? `Regla guardada y ${r.recalculados} respuesta(s) recalculada(s). Las notas puestas a mano no cambian.` : 'Regla guardada: se aplicará a los pasos nuevos.');
  });
  const cambiada = modo !== (cfg.nota_primer_intento ?? 'participacion') || factor !== Math.round(100 * (cfg.factor_ayuda ?? 1)) || declarada !== Math.round(100 * (cfg.factor_declarada ?? 1));
  return (
    <div className={`rounded-lg border p-3 ${modo === 'participacion' && factor === 100 ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-white/10'}`}>
      <p className="font-medium">Regla de nota</p>
      {modo === 'participacion' && factor === 100 && <p className="text-xs text-amber-800 dark:text-amber-200">Con la regla actual, quien falla, busca ayuda y corrige saca lo mismo que quien acertó solo.</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <fieldset className="text-xs">
          <legend className="etiqueta">El primer intento cuenta…</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={modo === 'acierto'} onChange={() => setModo('acierto')} /> por acertar (recomendado)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={modo === 'participacion'} onChange={() => setModo('participacion')} /> por participar (regla anterior)</label>
        </fieldset>
        <label className="text-xs"><span className="etiqueta">La corrección hecha con ayuda tras fallar vale</span>
          <span className="flex items-center gap-2"><input type="range" min={0} max={100} step={5} value={factor} onChange={(e) => setFactor(Number(e.target.value))} className="flex-1" /><span className="w-12 text-right tabular-nums">{factor} %</span></span>
          <span className="block text-gray-500">de su valor. Si el primer intento ya era correcto, la corrección cuenta completa.</span></label>
        <label className="text-xs sm:col-span-2"><span className="etiqueta">El primer intento hecho con ayuda declarada (p. ej. IA) vale</span>
          <span className="flex items-center gap-2"><input type="range" min={0} max={100} step={5} value={declarada} onChange={(e) => setDeclarada(Number(e.target.value))} className="flex-1" /><span className="w-12 text-right tabular-nums">{declarada} %</span></span>
          <span className="block text-gray-500">100 % = la declaración no cambia la nota. Por debajo, el estudiante lo verá antes de declarar. Tenga en cuenta que puede animar a declarar «sin ayuda»; la penalización por dependencia (abajo) no depende de lo que declaren.</span></label>
      </div>
      <p className="mt-2 text-xs">Con estos pesos ({pesos.inicial}/{pesos.correccion}/{pesos.justificacion}{cfg.transferencia ? `/${pesos.transferencia}` : ''}) y la explicación presentada:
        acierta solo → <strong>{pct(solo)}</strong> · acierta declarando ayuda → <strong>{pct(aciertaDeclarando)}</strong> · falla y corrige con ayuda → <strong>{pct(conAyuda)}</strong>.</p>
      <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={recalcular} onChange={(e) => setRecalcular(e.target.checked)} /> Recalcular ahora las notas de los intentos que ya existen (incluidos los que están en curso)</label>
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-primario !py-1 text-sm" disabled={accion.busy || (!cambiada && !recalcular)} onClick={guardar}>{accion.busy ? 'Guardando…' : 'Guardar regla de nota'}</button>
        {msg && <span className="text-xs text-emerald-700 dark:text-emerald-300">{msg}</span>}
      </div>
      <ErrorBox error={accion.error} />
    </div>
  );
}
