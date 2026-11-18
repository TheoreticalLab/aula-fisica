/**
 * Informe docente del Maratón adaptativo: rendimiento, recorrido adaptativo (gráfico inspeccionable), comportamiento
 * ante dificultades, evolución por jornadas, historial ejercicio por ejercicio con seguimiento en vivo, indicadores descriptivos de consistencia, incidencias
 * y exportaciones. Solo para el profesorado de la sección (lo comprueba el servidor).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import {
  maratonConsultaCerrar, maratonConsultas, maratonExportar, maratonHistorial, maratonIncidencia, maratonReincorporar, maratonResumen, type EstudianteResumen, type TipoFuera, type FilaExportacion, type Historial, type MaratonDocente, type PresentacionHistorial,
} from '@/api/maraton';
import { etiquetaNivel } from '@/lib/maraton/config';
import {
  AVISO_INTERPRETACION, comportamiento, consistencia, evolucion, evolucionPorTema, nivelesDe, rendimiento, situacionPorEstudiante, tipoPunto, trayectoria, type PuntoTrayectoria, type Situacion,
} from '@/lib/maraton/indicadores';
import { csvDetalle, csvEstadisticas, csvResumen, descargarBlob, estadisticasSeccion, xlsxMaraton } from '@/lib/maraton/exportar';
import { downloadText, fecha, useAction, useAsync } from '@/lib/util';
import { useDark } from '@/lib/tema';
import { Badge, Card, ErrorBox, Modal, Notice, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { TABLA } from './PesTab';

const pct = (a: number | null | undefined) => (a == null ? '—' : `${Math.round(a * 100)} %`);
const min = (s: number | null | undefined) => (s == null ? '—' : `${Math.round(s / 60)} min`);
const COLORES: Record<PuntoTrayectoria['tipo'], string> = { correcta: '#16a34a', incorrecta: '#dc2626', no_puedo: '#7c3aed', cambio: '#d97706', cierre: '#6b7280', abierta: '#2563eb' };
const NOMBRE_TIPO: Record<PuntoTrayectoria['tipo'], string> = { correcta: 'Correcta', incorrecta: 'Incorrecta', no_puedo: '«No puedo»', cambio: 'Sustitución (comodín)', cierre: 'Cerrada por plazo', abierta: 'Abierta' };
const ESTADO_J: Record<string, string> = { completada: '✔', en_curso: '…', cerrada_limite: '⚠', incompleta: '✖', justificada: 'J', pendiente: '○' };

const NOMBRE_FUERA: Record<TipoFuera, string> = { aciertos: 'mínimo de aciertos', presentados: 'máximo de problemas', continuidad: 'continuidad', rapidez: 'resolución demasiado rápida', declaracion: 'declaró uso de IA' };
const SEG_RECARGA = 20;
const tipoFila = (f: FilaExportacion) => (f.accion === 'respuesta' ? (f.resultado === 'correcta' ? 'correcta' : 'incorrecta') : f.accion ?? 'abierta') as PuntoTrayectoria['tipo'];
const tonoTipo = (t: PuntoTrayectoria['tipo']) => (t === 'correcta' ? 'green' : t === 'incorrecta' ? 'red' : t === 'abierta' ? 'blue' : 'gray');
const haceMin = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

/** Recarga periódica (solo con la pestaña visible) mientras `activo`; devuelve la hora de la última recarga. */
function useRecarga(activo: boolean, recargar: () => void) {
  const ref = useRef(recargar);
  ref.current = recargar;
  const [hora, setHora] = useState(() => new Date());
  useEffect(() => {
    if (!activo) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') { ref.current(); setHora(new Date()); } }, SEG_RECARGA * 1000);
    return () => window.clearInterval(t);
  }, [activo]);
  return { hora, ahora: () => { ref.current(); setHora(new Date()); } };
}

function ControlRecarga({ auto, setAuto, r }: { auto: boolean; setAuto: (v: boolean) => void; r: ReturnType<typeof useRecarga> }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm no-print">
      <label className="flex items-center gap-1"><input type="checkbox" checked={auto} onChange={(ev) => setAuto(ev.target.checked)} /> Actualizar solo cada {SEG_RECARGA} s</label>
      <button className="enlace" onClick={r.ahora}>Actualizar ahora</button>
      <span className="text-xs text-gray-500">Última actualización: {r.hora.toLocaleTimeString()}</span>
    </div>
  );
}

/** Celda «Ejercicio actual»: el que está resolviendo (abierto) o el último que cerró, con sus aciertos y fallos. */
function EjercicioActual({ s }: { s: Situacion | undefined }) {
  if (!s) return <span className="text-gray-500">sin empezar</span>;
  const u = s.ultima, t = tipoFila(u);
  return (
    <div className="whitespace-nowrap text-xs">
      <Badge tone={tonoTipo(t)}>{s.abierta ? `Resolviendo #${u.secuencia}` : `#${u.secuencia} ${NOMBRE_TIPO[t] ?? u.accion}`}</Badge>
      <div className="mt-0.5 text-gray-500">{s.abierta ? `D${u.nivel} · ${u.tema} · hace ${haceMin(u.presentada_at)} min` : `✔ ${s.correctas} · ✖ ${s.incorrectas} de ${s.presentados}`}</div>
    </div>
  );
}

export function MaratonInforme({ m }: { m: MaratonDocente }) {
  const st = useAsync(() => maratonResumen(m.id), [m.id]);
  const vivo = useAsync(() => maratonExportar(m.id), [m.id]);
  const cons = useAsync(() => maratonConsultas(m.id), [m.id]);
  const [sel, setSel] = useState<EstudianteResumen | null>(null);
  const [auto, setAuto] = useState(true);
  const recarga = useRecarga(auto && !sel, () => { void st.reload(); void vivo.reload(); void cons.reload(); });
  const sit = useMemo(() => situacionPorEstudiante(vivo.data ?? []), [vivo.data]);
  const act = useAction();
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const d = st.data!;
  const n = m.config.programacion.jornadas;
  const exp = m.config.informes.exportaciones;
  const nombreBase = m.titulo.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60);
  if (sel) return <DetalleEstudiante m={m} e={sel} onVolver={() => setSel(null)} onCambio={() => void st.reload()} />;
  const est = estadisticasSeccion(d);
  return (
    <div className="space-y-4">
      <Notice>El sistema no asigna calificaciones. Estos datos describen el trabajo registrado; la decisión sobre la recuperación corresponde al profesor según criterios comunicados a todos.</Notice>
      <Card title="Estudiantes" actions={
        <div className="flex flex-wrap gap-2 no-print">
          {exp.includes('csv') && <button className="btn-secundario text-sm" onClick={() => downloadText(`${nombreBase}_resumen.csv`, csvResumen(d))}>CSV resumen</button>}
          {exp.includes('csv') && <button className="btn-secundario text-sm" disabled={act.busy} onClick={() => void act.run(async () => downloadText(`${nombreBase}_problemas.csv`, csvDetalle(await maratonExportar(m.id))))}>CSV problemas</button>}
          {exp.includes('csv') && <button className="btn-secundario text-sm" onClick={() => downloadText(`${nombreBase}_seccion.csv`, csvEstadisticas(d))}>CSV sección</button>}
          {exp.includes('xlsx') && <button className="btn-secundario text-sm" disabled={act.busy} onClick={() => void act.run(async () => descargarBlob(`${nombreBase}.xlsx`, await xlsxMaraton(d, await maratonExportar(m.id))))}>Excel</button>}
        </div>}>
        <ErrorBox error={act.error} />
        <ControlRecarga auto={auto} setAuto={setAuto} r={recarga} />
        {vivo.error && <p className="text-xs text-red-600">No se pudo cargar el ejercicio actual: {vivo.error}</p>}
        <div className="mt-2 overflow-x-auto">
          <table className={TABLA}>
            <thead><tr><th>Estudiante</th><th>Ejercicio actual</th><th>Jornadas (1…{n})</th><th>Compl.</th><th>Rev.</th><th>Válidos</th><th>% aciertos</th><th>No puedo</th><th>Comod.</th><th>Tiempo</th><th>Máx.</th><th>D6 ✔</th><th>Nivel actual</th></tr></thead>
            <tbody>
              {d.estudiantes.map((e) => {
                const r = e.resumen;
                const porNum = new Map((r?.por_jornada ?? []).map((j) => [j.numero, j]));
                return (
                  <tr key={e.user_id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setSel(e)}>
                    <td><span className="font-medium">{e.nombre}</span>
                      {e.fuera ? <span title={e.fuera.motivo ?? ''}> <Badge tone="red">Fuera · {NOMBRE_FUERA[e.fuera.tipo]}</Badge></span>
                        : e.continuidad_pendiente ? <span title="Se aplicará cuando vuelva a entrar; puede reincorporarle antes"> <Badge tone="amber">No completó la J{e.continuidad_pendiente}</Badge></span> : null}
                      <br /><span className="text-xs text-gray-500">{e.login_id}{!e.matriculado ? ' · ya no está matriculado' : ''}</span></td>
                    <td><EjercicioActual s={sit.get(e.login_id ?? e.nombre)} /></td>
                    <td className="whitespace-nowrap font-mono text-xs" title="✔ completada · ✖ no completada · ⚠ cerrada por límite · J justificada · … en curso · · sin registro">
                      {Array.from({ length: n }, (_, i) => { const j = porNum.get(i + 1); return j ? ESTADO_J[j.estado] ?? '?' : '·'; }).join('')}</td>
                    <td>{r?.jornadas_completadas ?? 0}</td>
                    <td>{r?.jornadas_revision ? <Badge tone="amber">{r.jornadas_revision}</Badge> : '—'}</td>
                    <td>{r?.intentos_validos ?? 0}</td>
                    <td>{r ? pct(r.intentos_validos ? r.correctas / r.intentos_validos : null) : '—'}</td>
                    <td>{r?.no_puedo ?? 0}</td>
                    <td>{e.comodines_usados ?? 0}</td>
                    <td>{min(r?.segundos)}</td>
                    <td>{r?.nivel_maximo ? `D${r.nivel_maximo}` : '—'}</td>
                    <td>{r?.extremos_resueltos ?? 0}</td>
                    <td>{e.nivel_actual ? `D${e.nivel_actual}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Pulse una fila para ver, ejercicio por ejercicio, qué recibió, qué respondió, si acertó y la clave; además el recorrido adaptativo y el informe individual.</p>
      </Card>
      {(cons.data ?? []).map((c) => (
        <Card key={c.id} title={`Pregunta de la plataforma: ${c.titulo}`} actions={c.activa
          ? <button className="btn-secundario text-sm no-print" disabled={act.busy}
              onClick={() => { if (window.confirm('¿Cerrar la pregunta? Dejará de mostrarse a quienes no la han respondido; las respuestas se conservan.')) void act.run(async () => cons.setData(await maratonConsultaCerrar(c.id))); }}>Cerrar la pregunta</button>
          : <Badge>Cerrada {fecha(c.cerrada_at)}</Badge>}>
          <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{c.texto}</p>
          <p className="mt-2 text-sm">
            <strong>{c.respuestas.filter((r) => r.respuesta).length}</strong> «Sí» · <strong>{c.respuestas.filter((r) => !r.respuesta).length}</strong> «No» · <strong>{c.pendientes.length}</strong> sin responder
            {c.fuera_si ? ' · quien responde «Sí» queda fuera del maratón (puede reincorporarlo desde su ficha)' : ''}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className={TABLA}>
              <thead><tr><th>Estudiante</th><th>Respuesta</th><th>Jornada</th><th>Hora</th></tr></thead>
              <tbody>
                {c.respuestas.map((r) => (
                  <tr key={r.user_id}><td>{r.nombre}<br /><span className="text-xs text-gray-500">{r.login_id}</span></td>
                    <td>{r.respuesta ? <Badge tone="red">Sí</Badge> : <Badge tone="green">No</Badge>}</td><td>{r.jornada ?? '—'}</td><td>{fecha(r.created_at)}</td></tr>
                ))}
                {c.pendientes.map((p) => (
                  <tr key={p.user_id}><td>{p.nombre}<br /><span className="text-xs text-gray-500">{p.login_id}</span></td>
                    <td><Badge>{c.activa ? 'Pendiente (la verá al entrar)' : 'No respondió'}</Badge></td><td>—</td><td>—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {est.length > 0 && (
        <Card title="Estadísticas de la sección por jornada">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={est}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="jornada" /><YAxis yAxisId="n" allowDecimals={false} /><YAxis yAxisId="p" orientation="right" domain={[0, 100]} />
                <Tooltip /><Legend />
                <Line yAxisId="n" dataKey="participantes" name="Participantes" stroke="#2563eb" />
                <Line yAxisId="n" dataKey="completadas" name="Completadas" stroke="#16a34a" />
                <Line yAxisId="p" dataKey="precision" name="% aciertos" stroke="#d97706" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetalleEstudiante({ m, e, onVolver, onCambio }: { m: MaratonDocente; e: EstudianteResumen; onVolver: () => void; onCambio: () => void }) {
  const st = useAsync(() => maratonHistorial(m.id, e.user_id), [m.id, e.user_id]);
  const [h, setH] = useState<Historial | null>(null);
  const [ver, setVer] = useState<PresentacionHistorial | null>(null);
  const hist = h ?? st.data ?? null;
  const ps = hist?.presentaciones ?? [];
  const tray = useMemo(() => trayectoria(ps), [ps]);
  const rend = useMemo(() => rendimiento(ps), [ps]);
  const comp = useMemo(() => comportamiento(ps), [ps]);
  const evo = useMemo(() => evolucion(ps), [ps]);
  const evoTema = useMemo(() => evolucionPorTema(ps), [ps]);
  const obs = useMemo(() => consistencia(ps), [ps]);
  const oscuro = useDark();
  const [auto, setAuto] = useState(true);
  const recarga = useRecarga(auto, () => { setH(null); void st.reload(); });
  if (st.loading && !hist) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  if (!hist) return null;
  const jornadas = [...new Set(ps.map((p) => p.jornada))];
  const abierta = [...ps].reverse().find((p) => p.accion == null) ?? null;
  const recientes = [...ps].sort((a, b) => b.secuencia - a.secuencia);
  const csvAlumno = () => downloadText(`maraton_${e.login_id ?? e.user_id}.csv`, csvDetalle(ps.map((p) => ({
    login_id: e.login_id, nombre: e.nombre, jornada: p.jornada, fecha: p.presentada_at.slice(0, 10), secuencia: p.secuencia, variante_id: p.variante_id, plantilla_id: p.plantilla_id,
    tema: p.tema, nivel: p.nivel, presentada_at: p.presentada_at, cerrada_at: p.cerrada_at, accion: p.accion, resultado: p.resultado, respuesta: p.respuesta?.partes ?? null,
    segundos: p.segundos, anticipada: p.anticipada, unidades: p.unidades, nivel_despues: p.nivel_despues, comodines_despues: p.comodines_despues,
  }))));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button className="btn-secundario" onClick={onVolver}>← Todos los estudiantes</button>
        <span className="flex-1" />
        {m.config.informes.exportaciones.includes('pdf') && <button className="btn-secundario" onClick={() => window.print()}>Informe individual (PDF)</button>}
        {m.config.informes.exportaciones.includes('csv') && <button className="btn-secundario" onClick={csvAlumno}>CSV del estudiante</button>}
      </div>
      <h2 className="text-xl font-semibold">{hist.estudiante.nombre} <span className="text-sm font-normal text-gray-500">{hist.estudiante.login_id} · {m.titulo}</span></h2>
      <ControlRecarga auto={auto} setAuto={setAuto} r={recarga} />
      <AvisoFuera m={m} e={e} hist={hist} onHist={(x) => { setH(x); onCambio(); }} />
      {!hist.inscripcion ? <Notice>Este estudiante no ha comenzado el maratón.</Notice> : (
        <>
          <Card title="Ejercicio por ejercicio (historial no modificable; lo más reciente arriba)">
            {abierta ? (
              <div className="mb-3 rounded border border-primario-300 bg-primario-50 p-3 text-sm dark:border-primario-700 dark:bg-primario-900/30">
                <strong>Está resolviendo ahora el ejercicio #{abierta.secuencia}</strong> · jornada {abierta.jornada} · {etiquetaNivel(abierta.nivel)} · {abierta.tema}
                {' '}· recibido hace {haceMin(abierta.presentada_at)} min (tiempo mínimo {Math.round(abierta.t_min_s / 60)} min). <button className="enlace" onClick={() => setVer(abierta)}>Ver enunciado y clave</button>
              </div>
            ) : <p className="mb-3 text-sm text-gray-500">No tiene ningún ejercicio abierto en este momento.</p>}
            <div className="max-h-[36rem] overflow-auto">
              <table className={TABLA}>
                <thead><tr><th>#</th><th>J</th><th>Recibido</th><th>Nivel</th><th>Tema</th><th>Decisión</th><th>Respuesta del estudiante · clave</th><th>Tiempo</th><th /></tr></thead>
                <tbody>{recientes.map((p) => { const t = tipoPunto(p); return (
                  <tr key={p.id}>
                    <td>{p.secuencia}</td><td>{p.jornada}</td><td className="whitespace-nowrap text-xs">{fecha(p.presentada_at)}</td>
                    <td className="whitespace-nowrap">D{p.nivel}{p.nivel_despues ? ` → D${p.nivel_despues}` : ''}</td><td className="text-xs">{p.tema}</td>
                    <td><Badge tone={tonoTipo(t)}>{t === 'abierta' ? 'Resolviendo' : NOMBRE_TIPO[t]}</Badge>{p.anticipada && <Badge tone="amber">anticipada</Badge>}</td>
                    <td className="text-xs">{p.partes.map((pt, i) => { const ok = p.detalle?.partes[i]?.correcta; return (
                      <div key={i} title={pt.etiqueta}><span className="text-gray-500">{p.partes.length > 1 ? `${i + 1}) ` : ''}</span>
                        <span className="font-mono">{p.respuesta?.partes[i] ?? '—'}</span>{ok != null && <span className={ok ? 'text-emerald-600' : 'text-red-600'}> {ok ? '✔' : '✖'}</span>}
                        <span className="text-gray-500"> · clave <span className="font-mono">{p.clave?.partes[i]?.value ?? '—'}</span></span></div>); })}</td>
                    <td className="text-xs">{p.segundos == null ? '—' : `${Math.round(p.segundos)} s`}</td>
                    <td><button className="enlace" onClick={() => setVer(p)}>Ver</button></td>
                  </tr>); })}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">«Ver» abre el enunciado tal como lo recibió, cada parte con su respuesta y su clave, el procedimiento escrito, los tiempos y los comodines.</p>
          </Card>

          <Card title="A. Rendimiento general">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {[['Presentados', rend.presentados], ['Intentos válidos', rend.validos], ['Correctas', rend.correctas], ['Incorrectas', rend.incorrectas], ['% aciertos (bruto)', pct(rend.precision)],
                ['«No puedo»', rend.noPuedo], ['Sustituidos', rend.cambios], ['Cerrados por plazo', rend.cierres], ['Anticipados', rend.anticipadas], ['Tiempo registrado', `${Math.round(rend.minutos)} min`],
                ['Jornadas completadas', `${hist.inscripcion.resumen.jornadas_completadas} de ${m.config.programacion.jornadas}`], ['Vía cuota / alternativa', `${hist.inscripcion.resumen.via_cuota ?? 0} / ${hist.inscripcion.resumen.via_alternativa ?? 0}`],
                ['Jornadas para revisión', hist.inscripcion.resumen.jornadas_revision ?? 0], ['Comodines usados', hist.inscripcion.comodines_usados], ['Nivel actual', `D${hist.inscripcion.nivel}`]].map(([t, v]) => (
                <div key={String(t)}><div className="text-xs uppercase text-gray-500">{t}</div><div className="font-semibold">{v}</div></div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto"><table className={TABLA}><thead><tr><th>Nivel</th><th>Pres.</th><th>Válidos</th><th>Correctas</th><th>%</th><th>No puedo</th><th>Cambios</th><th>Tiempo medio</th></tr></thead>
                <tbody>{rend.porNivel.map((x) => <tr key={x.nivel}><td>{etiquetaNivel(x.nivel)}</td><td>{x.presentados}</td><td>{x.validos}</td><td>{x.correctas}</td><td>{pct(x.precision)}</td><td>{x.noPuedo}</td><td>{x.cambios}</td><td>{x.mediaSegundos == null ? '—' : `${Math.round(x.mediaSegundos / 60 * 10) / 10} min`}</td></tr>)}</tbody></table></div>
              <div className="overflow-x-auto"><table className={TABLA}><thead><tr><th>Tema</th><th>Pres.</th><th>Válidos</th><th>Correctas</th><th>%</th><th>No puedo</th></tr></thead>
                <tbody>{rend.porTema.map((x) => <tr key={x.tema}><td>{x.tema}</td><td>{x.presentados}</td><td>{x.validos}</td><td>{x.correctas}</td><td>{pct(x.precision)}</td><td>{x.noPuedo}</td></tr>)}</tbody></table></div>
            </div>
          </Card>

          <Card title="B. Recorrido adaptativo (pulse un punto para inspeccionarlo)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tray} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="x" type="number" domain={[1, Math.max(1, tray.length)]} allowDecimals={false} label={{ value: 'Ejercicio (secuencia)', position: 'insideBottom', offset: -10 }} />
                  <YAxis dataKey="nivel" domain={[1, nivelesDe(ps).length]} ticks={nivelesDe(ps)} tickFormatter={(v) => `D${v}`} />
                  <Tooltip content={({ payload }) => { const p = payload?.[0]?.payload as PuntoTrayectoria | undefined; return p ? (
                    <div className="rounded border bg-white p-2 text-xs shadow dark:bg-gray-900">#{p.x} · jornada {p.jornada} · D{p.nivel}{p.despues ? ` → D${p.despues}` : ''}<br />{NOMBRE_TIPO[p.tipo]} · {p.p.tema}</div>) : null; }} />
                  <Line type="stepAfter" dataKey="nivel" stroke={oscuro ? '#9ca3af' : '#4b5563'} dot={false} isAnimationActive={false} />
                  {(Object.keys(COLORES) as PuntoTrayectoria['tipo'][]).map((t) => (
                    <Scatter key={t} name={NOMBRE_TIPO[t]} data={tray.filter((p) => p.tipo === t)} fill={COLORES[t]} isAnimationActive={false}
                      onClick={(pt: { payload?: PuntoTrayectoria }) => pt?.payload && setVer(pt.payload.p)} cursor="pointer" />
                  ))}
                  <Legend verticalAlign="top" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500">Línea: nivel en cada ejercicio. Ascensos {tray.filter((p) => p.movimiento === 'ascenso').length}, descensos {tray.filter((p) => p.movimiento === 'descenso').length}, permanencias {tray.filter((p) => p.movimiento === 'igual').length} (incluye la permanencia en D6 al acertar y los cambios de ejercicio).</p>
          </Card>

          <Card title="C. Comportamiento ante dificultades">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto"><table className={TABLA}><thead><tr><th>Nivel</th><th>«No puedo»</th><th>Frecuencia relativa</th><th>Cambios</th></tr></thead>
                <tbody>{comp.noPuedoPorNivel.map((x, i) => <tr key={x.nivel}><td>{etiquetaNivel(x.nivel)}</td><td>{x.n}</td><td>{pct(x.frecuencia)}</td><td>{comp.cambiosPorNivel[i].n}</td></tr>)}</tbody></table></div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[['Tiempo (mediana) antes de «No puedo»', comp.segundosAntesDeAbandonar == null ? '—' : `${Math.round(comp.segundosAntesDeAbandonar)} s`], ['Racha máx. de aciertos', comp.rachaCorrectas],
                  ['Racha máx. de fallos', comp.rachaIncorrectas], ['Máx. permanencia en D6 (ejercicios seguidos)', comp.maxPermanenciaD6], ['Entradas a D5–D6 desde abajo', comp.entradasAltas],
                  ['Cambios de nivel', comp.oscilaciones], ['Cambios de dirección (oscilaciones)', comp.cambiosDeDireccion]].map(([t, v]) => (
                  <div key={String(t)}><dt className="text-xs uppercase text-gray-500">{t}</dt><dd className="font-semibold">{v}</dd></div>))}
              </dl>
            </div>
          </Card>

          <Card title="D. Evolución durante las jornadas">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evo.map((x) => ({ ...x, precisionPct: x.precision == null ? null : Math.round(x.precision * 100), minutos: x.medianaSegundos == null ? null : Math.round(x.medianaSegundos / 6) / 10 }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="jornada" /><YAxis yAxisId="p" domain={[0, 100]} /><YAxis yAxisId="n" orientation="right" domain={[0, nivelesDe(ps).length]} />
                  <Tooltip /><Legend />
                  <Line yAxisId="p" dataKey="precisionPct" name="% aciertos" stroke="#16a34a" connectNulls />
                  <Line yAxisId="n" dataKey="nivelMedio" name="Nivel medio" stroke="#2563eb" connectNulls />
                  <Line yAxisId="n" dataKey="nivelMaximo" name="Nivel máximo" stroke="#7c3aed" strokeDasharray="4 2" connectNulls />
                  <Line yAxisId="p" dataKey="minutos" name="Min por intento (mediana)" stroke="#d97706" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className={TABLA}><thead><tr><th>Jornada</th><th>Pres.</th><th>Válidos</th><th>%</th><th>Nivel medio</th><th>Máx.</th><th>Min/intento</th><th>No puedo</th><th>Cambios</th></tr></thead>
                <tbody>{evo.map((x) => <tr key={x.jornada}><td>{x.jornada}</td><td>{x.presentados}</td><td>{x.validos}</td><td>{pct(x.precision)}</td><td>{x.nivelMedio?.toFixed(2) ?? '—'}</td><td>{x.nivelMaximo ?? '—'}</td>
                  <td>{x.medianaSegundos == null ? '—' : (x.medianaSegundos / 60).toFixed(1)}</td><td>{x.noPuedo}</td><td>{x.cambios}</td></tr>)}</tbody></table>
              <table className={`${TABLA} mt-3`}><thead><tr><th>Tema</th>{jornadas.map((j) => <th key={j}>J{j}</th>)}</tr></thead>
                <tbody>{evoTema.map((t) => <tr key={t.tema}><td>{t.tema}</td>{jornadas.map((j) => { const c = t.celdas[j]; return <td key={j} className="text-xs">{c ? `${c.correctas}/${c.validos}` : ''}</td>; })}</tr>)}</tbody></table>
            </div>
            <p className="mt-2 text-xs text-gray-500">Los cambios de nivel reflejan en parte la regla del algoritmo (sube al acertar, baja al fallar); no deben leerse por sí solos como cambios de competencia.</p>
          </Card>

          {m.config.informes.indicadores && (
            <Card title="Indicadores descriptivos de consistencia">
              <Notice>{AVISO_INTERPRETACION}</Notice>
              {obs.length === 0 ? <p className="mt-2 text-sm text-gray-500">No hay observaciones con los criterios descriptivos actuales.</p> : (
                <ul className="mt-2 space-y-2 text-sm">{obs.map((o, i) => (
                  <li key={i} className="rounded border border-gray-200 p-2 dark:border-white/10"><strong>Observación:</strong> {o.titulo}<br /><span className="text-gray-600 dark:text-gray-400">{o.detalle}</span>
                    {o.referencias.length > 0 && <span className="block text-xs text-gray-500">Problemas: {o.referencias.slice(0, 20).map((r) => `#${r}`).join(', ')}{o.referencias.length > 20 ? '…' : ''}</span>}</li>))}</ul>
              )}
            </Card>
          )}

        </>
      )}
      <Incidencias m={m} e={e} hist={hist} onHist={(x) => { setH(x); onCambio(); }} />
      {ver && <VerPresentacion p={ver} siguiente={ps.find((x) => x.secuencia === ver.secuencia + 1) ?? null} onClose={() => setVer(null)} />}
    </div>
  );
}

function VerPresentacion({ p, siguiente, onClose }: { p: PresentacionHistorial; siguiente: PresentacionHistorial | null; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Ejercicio #${p.secuencia} · jornada ${p.jornada} · ${etiquetaNivel(p.nivel)}`}>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
        <div className="break-all text-xs text-gray-500">{p.plantilla_id} · variante {p.variante_id} · {p.tema} · {p.subtema}</div>
        <Markdown className="prosa text-sm">{p.enunciado}</Markdown>
        {/* problema por etapas o con comprobación (migración 99): texto de cada etapa, cuándo la entregó y si acertó */}
        {(p.etapas ?? []).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              Etapa 1: {p.etapa1 ? <>{p.etapa1.correcta ? '✔' : '✖'} · entregada {fecha(p.etapa1.entregada_at)}</> : (p.accion ? 'cerrada sin entregar' : 'en curso')}
            </div>
            {p.etapas!.map((et) => (
              <div key={et.numero} className="rounded border border-dashed border-gray-300 p-2 dark:border-white/20">
                <div className="text-xs text-gray-500">
                  {et.tipo === 'comprobacion' ? 'Comprobación de razonamiento' : `Etapa ${et.numero}`} ·{' '}
                  {et.entregada_at ? <>{et.correcta ? '✔' : '✖'} · entregada {fecha(et.entregada_at)}</> : (p.etapa_actual === et.numero && !p.accion ? 'en curso' : 'no entregada')}
                </div>
                <Markdown className="prosa text-sm">{et.enunciado}</Markdown>
              </div>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-xs text-gray-500">Recibido</dt><dd>{fecha(p.presentada_at)}</dd></div>
          <div><dt className="text-xs text-gray-500">Cerrado</dt><dd>{fecha(p.cerrada_at)}</dd></div>
          <div><dt className="text-xs text-gray-500">Decisión</dt><dd>{p.accion ?? 'abierta'}{p.resultado ? ` · ${p.resultado}` : ''}{p.anticipada ? ' · anticipada' : ''}</dd></div>
          <div><dt className="text-xs text-gray-500">Tiempo acreditado (informado por el navegador)</dt><dd>{p.segundos ?? '—'} s ({p.segundos_cliente ?? '—'} s) · mínimo {p.t_min_s} s · tope {p.t_max_s} s</dd></div>
          <div><dt className="text-xs text-gray-500">Nivel antes → después</dt><dd>D{p.nivel} → {p.nivel_despues ? `D${p.nivel_despues}` : '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">Comodines usados antes → después</dt><dd>{p.comodines_antes ?? '—'} → {p.comodines_despues ?? '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">Unidades / ponderación</dt><dd>{p.unidades ?? 0} / {p.peso}</dd></div>
          <div><dt className="text-xs text-gray-500">Siguiente ejercicio</dt><dd>{siguiente ? `#${siguiente.secuencia} (${etiquetaNivel(siguiente.nivel)}, ${siguiente.tema})` : '—'}</dd></div>
        </dl>
        {p.partes.map((pt, i) => (
          <div key={i} className="rounded border border-gray-200 p-2 dark:border-white/10">
            <div className="text-xs text-gray-500">{pt.etiqueta}</div>
            <div>Respuesta: <span className="font-mono">{p.respuesta?.partes[i] ?? '—'}</span>{p.detalle?.partes[i] && <> · {p.detalle.partes[i].correcta ? '✔' : '✖'} <span className="text-xs text-gray-500">({p.detalle.partes[i].codigo})</span></>}</div>
            <div>Clave: <span className="font-mono">{p.clave?.partes[i]?.value ?? '—'}</span></div>
          </div>
        ))}
        {p.procedimiento && <div><div className="text-xs text-gray-500">Procedimiento escrito</div><Markdown className="prosa text-sm">{p.procedimiento}</Markdown></div>}
      </div>
    </Modal>
  );
}

/** Fuera del maratón por una regla de permanencia (migración 98): motivo detallado y reincorporación con motivo. */
function AvisoFuera({ m, e, hist, onHist }: { m: MaratonDocente; e: EstudianteResumen; hist: Historial; onHist: (h: Historial) => void }) {
  const act = useAction();
  const [hecho, setHecho] = useState(false);   // `e` es la fila del resumen al abrir el detalle: no se refresca sola
  const f = hist.inscripcion?.fuera ?? null;
  const pendiente = !f && !hecho && hist.inscripcion ? e.continuidad_pendiente ?? null : null;
  if (!f && !pendiente) return null;
  const reincorporar = () => {
    const motivo = window.prompt('Motivo de la reincorporación (queda en el historial). Se justifican las jornadas que lo dejaron fuera; para que rehaga la de hoy, reábrala después en «Incidencias».');
    if (motivo === null) return;
    void act.run(async () => { onHist(await maratonReincorporar(m.id, e.user_id, motivo)); setHecho(true); });
  };
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm dark:border-red-700 dark:bg-red-900/20">
      {f ? <><strong>Fuera del maratón</strong> desde la jornada {f.jornada ?? '—'} ({fecha(f.desde)}) · {NOMBRE_FUERA[f.tipo]}<br />{f.motivo}</>
        : <><strong>No completó la jornada {pendiente}.</strong> Por la regla de continuidad quedará fuera cuando vuelva a entrar.</>}
      <div className="mt-2 no-print"><button className="btn-secundario text-sm" disabled={act.busy} onClick={reincorporar}>Reincorporar…</button></div>
      <ErrorBox error={act.error} />
    </div>
  );
}

function Incidencias({ m, e, hist, onHist }: { m: MaratonDocente; e: EstudianteResumen; hist: Historial; onHist: (h: Historial) => void }) {
  const [jornada, setJornada] = useState(1);
  const [tipo, setTipo] = useState<'reapertura' | 'justificacion' | 'nota'>('reapertura');
  const [motivo, setMotivo] = useState('');
  const [hasta, setHasta] = useState('');
  const act = useAction();
  return (
    <Card title="Incidencias y registro de la jornada" className="no-print">
      <form className="grid gap-3 sm:grid-cols-4" onSubmit={async (ev) => {
        ev.preventDefault();
        const r = await act.run(() => maratonIncidencia(m.id, e.user_id, jornada, tipo, motivo.trim(), tipo === 'reapertura' && hasta ? new Date(hasta).toISOString() : null));
        if (r) { onHist(r); setMotivo(''); }
      }}>
        <label className="block"><span className="etiqueta">Jornada</span><input type="number" className="campo" min={1} max={m.config.programacion.jornadas} value={jornada} onChange={(ev) => setJornada(Number(ev.target.value))} /></label>
        <label className="block"><span className="etiqueta">Tipo</span>
          <select className="campo" value={tipo} onChange={(ev) => setTipo(ev.target.value as typeof tipo)}>
            <option value="reapertura">Reabrir la jornada</option><option value="justificacion">Justificar la jornada</option><option value="nota">Solo una nota</option></select></label>
        {tipo === 'reapertura' && <label className="block"><span className="etiqueta">Reabierta hasta</span><input type="datetime-local" className="campo" value={hasta} onChange={(ev) => setHasta(ev.target.value)} required /></label>}
        <label className="block sm:col-span-4"><span className="etiqueta">Motivo (queda registrado)</span><input className="campo" value={motivo} minLength={3} onChange={(ev) => setMotivo(ev.target.value)} required /></label>
        <div className="sm:col-span-4"><button className="btn-primario" disabled={act.busy || motivo.trim().length < 3}>Registrar</button></div>
      </form>
      <ErrorBox error={act.error} />
      <p className="mt-2 text-xs text-gray-500">Reabrir permite completar una jornada perdida por una falla verificable (hasta 14 días); justificar la marca como justificada sin que el estudiante la haga. Ninguna de las dos borra datos.</p>
      {hist.incidencias.length > 0 && (
        <div className="mt-3 overflow-x-auto"><table className={TABLA}><thead><tr><th>Fecha</th><th>Jornada</th><th>Tipo</th><th>Motivo</th><th>Hasta</th></tr></thead>
          <tbody>{hist.incidencias.map((i) => <tr key={i.id}><td className="text-xs">{fecha(i.created_at)}</td><td>{i.jornada}</td><td>{i.tipo}</td><td>{i.motivo}</td><td className="text-xs">{fecha(i.reabierta_hasta)}</td></tr>)}</tbody></table></div>
      )}
      {hist.eventos.length > 0 && (
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Registro de eventos ({hist.eventos.length})</summary>
          <ul className="mt-2 space-y-1 text-xs">{hist.eventos.map((v, i) => <li key={i}>{fecha(v.created_at)} · {v.tipo}{v.jornada ? ` · jornada ${v.jornada}` : ''}{Object.keys(v.datos ?? {}).length ? ` · ${JSON.stringify(v.datos)}` : ''}</li>)}</ul>
        </details>
      )}
    </Card>
  );
}
