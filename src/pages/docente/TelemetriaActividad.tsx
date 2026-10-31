/**
 * Telemetría V2 — análisis descriptivo de una actividad (fase 11). Todo sale de estadistica.ts, que reconstruye cada
 * intento con el mismo motor que la vista individual. Descriptivo: no compara personas ni infiere conductas.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { rpc } from '@/lib/supabase';
import {
  analizarIntentos, histograma, METRICAS, N_ESTABLE, porGrupo, porIntento, porPregunta, resumen,
  type Agrupacion, type Descriptivos, type MetricaAnalizada,
} from '@/lib/telemetria/v2/estadistica';
import type { PaqueteIntento } from '@/lib/telemetria/v2/fuente';
import { useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { dur } from './TelemetriaIntento';

interface DatosActividad {
  actividad: { id: string; titulo: string; modo: string; class_id: string };
  intentos: { estudiante: { user_id: string; full_name: string; student_code: string | null }; numero: number; paquete: PaqueteIntento }[];
}
const ausente = (e: unknown) => /Could not find the function|PGRST202|schema cache/i.test(e instanceof Error ? e.message : String(e));
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(100 * x)} %`);
const valor = (m: MetricaAnalizada, x: number | null) => (x === null ? '—' : m === 'visitas' ? x.toFixed(1).replace(/\.0$/, '') : dur(x));
const TINTA = 'currentColor';
const SERIE = '#2563eb';

export default function TelemetriaActividad() {
  const { activityId = '' } = useParams();
  const [soloEntregados, setSoloEntregados] = useState(true);
  const st = useAsync(() => rpc<DatosActividad>('telemetria_v2_actividad', { p_activity: activityId, p_solo_entregados: soloEntregados }).catch((e) => { if (ausente(e)) return null; throw e; }), [activityId, soloEntregados]);
  const [metrica, setMetrica] = useState<MetricaAnalizada>('T_focus');
  const [agrupar, setAgrupar] = useState<Agrupacion>('dificultad');
  const an = useMemo(() => {
    if (!st.data) return null;
    const intentos = analizarIntentos(st.data.intentos);
    return { intentos, preguntas: porPregunta(intentos), filas: porIntento(intentos), res: resumen(intentos) };
  }, [st.data]);
  if (st.loading) return <Spinner label="Reconstruyendo los intentos…" />;
  if (st.error) return <ErrorBox error={st.error} />;
  if (st.data === null) return <Empty>El análisis estará disponible al instalar la migración 44.</Empty>;
  const d = st.data!, a = an!;
  const grupos = porGrupo(a.intentos, agrupar, metrica);
  const escala = Math.max(1, ...a.preguntas.map((p) => p.metricas[metrica].p90 ?? p.metricas[metrica].max ?? 0));
  const todos = a.intentos.flatMap((i) => i.rec?.preguntas.map((q) => (q[metrica].estado === 'no_identificable' || q[metrica].estado === 'informacion_insuficiente' || q[metrica].estado === 'dato_temporal_invalido' ? null : q[metrica].valor)) ?? [])
    .filter((x): x is number => x !== null);
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Telemetría V2 — análisis de la actividad" subtitle={d.actividad.titulo} back={{ to: `/docente/actividades/${activityId}`, label: 'Actividad' }} />
      <Card className="mb-4 text-sm">
        <p>Estadística <strong>descriptiva</strong> del proceso observable en esta actividad. Solo cuentan los valores que la telemetría permite identificar; los demás figuran como faltantes (nunca como cero) y cada cifra informa su cobertura. Con menos de {N_ESTABLE} observaciones el resultado es poco estable. No es un indicador de conducta ni compara personas.</p>
        {a.res.formatos.length > 1 && <p className="mt-1 text-amber-700 dark:text-amber-300">La actividad mezcla formatos ({a.res.formatos.join(', ')}): compare tiempos solo entre preguntas del mismo formato.</p>}
        <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={!soloEntregados} onChange={(e) => setSoloEntregados(!e.target.checked)} /> Incluir intentos no entregados</label>
      </Card>
      {!a.intentos.length ? <Empty>No hay intentos {soloEntregados ? 'entregados ' : ''}en esta actividad.</Empty> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Dato k="Intentos" v={String(a.res.intentos)} />
            <Dato k="Estudiantes" v={String(a.res.estudiantes)} />
            <Dato k="Duración (mediana)" v={dur(a.res.duracion.mediana)} />
            <Dato k="Tiempo activo (mediana)" v={pct(a.res.proporcion_activa.mediana)} />
            <Dato k="Sin observar (mediana)" v={pct(a.res.proporcion_sin_observar.mediana)} />
            <Dato k="Fuente de los datos" v={(Object.entries(a.res.fuentes) as [string, number][]).filter(([, n]) => n).map(([f, n]) => `${f === 'diario_examen' ? 'examen' : f.toUpperCase()} ${n}`).join(' · ') || '—'} />
          </div>
          {a.res.fuentes.v1 > 0 && <p className="mb-3 text-xs text-gray-500">Los intentos con datos V1 (sin pregunta activa) no aportan foco ni trabajo por pregunta: aparecen como faltantes en esas métricas.</p>}

          <Card className="mb-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Métrica">
              <span className="text-gray-600 dark:text-gray-300">Métrica:</span>
              {(Object.keys(METRICAS) as MetricaAnalizada[]).map((m) => (
                <button key={m} className={metrica === m ? 'btn-primario py-1 text-sm' : 'btn-secundario py-1 text-sm'} aria-pressed={metrica === m} onClick={() => setMetrica(m)}>{METRICAS[m]}</button>
              ))}
            </div>
            <h2 className="mb-1 text-sm font-semibold">{METRICAS[metrica]} por pregunta (caja: cuartiles; línea: mediana; bigotes: percentiles 10–90)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500">
                  <th className="py-1">Pregunta</th><th>n / cobertura</th><th>Mediana [P25–P75]</th><th>IC 95 % mediana</th><th className="w-[30%]">Distribución</th><th>Acierto</th><th>Cambió la respuesta</th>
                </tr></thead>
                <tbody>
                  {a.preguntas.map((p, k) => {
                    const m = p.metricas[metrica];
                    return (
                      <tr key={p.exercise_id} className="border-t border-gray-100 dark:border-white/10">
                        <td className="py-1 pr-2"><span className="font-medium">P{k + 1}</span> <span className="text-gray-600 dark:text-gray-300">{p.titulo.slice(0, 40)}</span>
                          <span className="block text-xs text-gray-500">{p.dificultad} · {p.formato}</span></td>
                        <td className="tabular-nums">{m.n}/{p.intentos} {!m.estable && m.n > 0 && <Badge tone="amber">poco estable</Badge>}</td>
                        <td className="tabular-nums">{valor(metrica, m.mediana)} <span className="text-xs text-gray-500">[{valor(metrica, m.p25)}–{valor(metrica, m.p75)}]</span></td>
                        <td className="tabular-nums text-xs">{m.ic95_mediana ? `${valor(metrica, m.ic95_mediana[0])}–${valor(metrica, m.ic95_mediana[1])}` : '—'}</td>
                        <td><Caja d={m} escala={escala} etiqueta={`P${k + 1}`} metrica={metrica} /></td>
                        <td className="tabular-nums">{pct(p.acierto.tasa)} <span className="text-xs text-gray-500">({p.acierto.correctas}/{p.acierto.n})</span></td>
                        <td className="tabular-nums">{p.cambio_respuesta.n ? `${p.cambio_respuesta.cambiaron}/${p.cambio_respuesta.n}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-gray-500">La escala de las cajas llega al mayor percentil 90 ({valor(metrica, escala)}); los valores mayores se recortan al borde. «Cambió la respuesta»: la primera versión guardada difiere de la final (solo intentos con historial de revisiones).</p>
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-sm font-semibold">Distribución de {METRICAS[metrica].toLowerCase()} (todas las preguntas, {todos.length} valores)</h2>
              <Histograma valores={todos} metrica={metrica} />
            </Card>
            <Card>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Por</span>
                <select className="campo !w-auto py-1" value={agrupar} onChange={(e) => setAgrupar(e.target.value as Agrupacion)} aria-label="Agrupar por">
                  <option value="dificultad">dificultad</option><option value="formato">formato</option><option value="concepto">concepto</option>
                </select>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Grupo</th><th>Preguntas</th><th>n</th><th>Mediana [P25–P75]</th></tr></thead>
                <tbody>{grupos.map((g) => (
                  <tr key={g.grupo} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-1">{g.grupo}{g.formatos.length > 1 && <span className="block text-xs text-amber-700 dark:text-amber-300">mezcla {g.formatos.join(' y ')}</span>}</td>
                    <td>{g.preguntas}</td><td>{g.d.n}{g.d.faltantes ? <span className="text-xs text-gray-500"> (+{g.d.faltantes} faltantes)</span> : ''}</td>
                    <td className="tabular-nums">{valor(metrica, g.d.mediana)} <span className="text-xs text-gray-500">[{valor(metrica, g.d.p25)}–{valor(metrica, g.d.p75)}]</span></td>
                  </tr>))}</tbody>
              </table>
            </Card>
          </div>

          {a.preguntas.some((p) => p.asistida) && (
            <Card className="mb-4">
              <h2 className="mb-1 text-sm font-semibold">Práctica asistida: primer intento (declarado), respuesta final y transferencia</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Pregunta</th><th>Estudiantes</th><th>Primer intento correcto</th><th>Final correcta</th><th>Transferencia correcta</th></tr></thead>
                <tbody>{a.preguntas.filter((p) => p.asistida).map((p) => (
                  <tr key={p.exercise_id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-1">{p.titulo.slice(0, 50)}</td><td>{p.asistida!.n}</td>
                    <td>{pct(p.asistida!.inicial_correcta / p.asistida!.n)}</td><td>{pct(p.asistida!.final_correcta / p.asistida!.n)}</td>
                    <td>{p.asistida!.transferencias ? `${pct(p.asistida!.transferencia_correcta / p.asistida!.transferencias)} (de ${p.asistida!.transferencias})` : '—'}</td>
                  </tr>))}</tbody>
              </table>
              <p className="mt-1 text-xs text-gray-500">El primer intento es «rendimiento inicial declarado»: la declaración del estudiante no es una verificación.</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-1 text-sm font-semibold">Intentos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500">
                  <th className="py-1">Estudiante</th><th>Fuente</th><th>Duración</th><th>Activo</th><th>Oculta</th><th>Pausa</th><th>Sin observar</th><th>Foco total</th><th>Cobertura</th><th>Correctas</th><th></th>
                </tr></thead>
                <tbody>{a.filas.map((f) => (
                  <tr key={f.attempt_id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-1">{f.estudiante.full_name || f.estudiante.student_code}{f.numero > 1 ? ` (intento ${f.numero})` : ''}</td>
                    <td className="text-xs">{f.fuente === 'diario_examen' ? 'examen' : f.fuente}</td>
                    <td className="tabular-nums">{dur(f.T_wall)}</td><td className="tabular-nums">{dur(f.activo)}</td><td className="tabular-nums">{dur(f.oculta)}</td>
                    <td className="tabular-nums">{dur(f.pausa)}</td><td className="tabular-nums">{dur(f.sin_observar)}</td>
                    <td className="tabular-nums" title={f.foco_total === null ? 'No identificable en alguna pregunta' : undefined}>{f.foco_total === null ? '—' : dur(f.foco_total)}</td>
                    <td className="tabular-nums">{pct(f.cobertura_media)}</td><td className="tabular-nums">{f.correctas}/{f.respondidas}</td>
                    <td><Link className="enlace text-xs" to={`/docente/intentos/${f.attempt_id}/telemetria`}>Reconstrucción</Link></td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-gray-500">Las diferencias entre estudiantes dependen de la dificultad, la cobertura y las condiciones de cada intento. Una pausa o una página oculta tienen muchas explicaciones legítimas.</p>
          </Card>
        </>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg border border-gray-200 p-2 dark:border-white/10"><p className="text-xs text-gray-500">{k}</p><p className="text-base font-semibold tabular-nums">{v}</p></div>;
}

/** Diagrama de caja horizontal (una serie: un solo tono; texto emergente por marca). */
function Caja({ d, escala, etiqueta, metrica }: { d: Descriptivos; escala: number; etiqueta: string; metrica: MetricaAnalizada }) {
  if (!d.n || d.mediana === null) return <span className="text-xs text-gray-500">sin datos</span>;
  const W = 200, H = 22, x = (v: number) => 4 + (Math.min(v, escala) / escala) * (W - 8);
  const p10 = d.p10 ?? d.min!, p90 = d.p90 ?? d.max!, p25 = d.p25!, p75 = d.p75!;
  const texto = `${etiqueta}: n = ${d.n}; P10 ${valor(metrica, p10)}, P25 ${valor(metrica, p25)}, mediana ${valor(metrica, d.mediana)}, P75 ${valor(metrica, p75)}, P90 ${valor(metrica, p90)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-full max-w-[220px]" role="img" aria-label={texto}>
      <title>{texto}</title>
      <line x1={x(p10)} x2={x(p90)} y1={H / 2} y2={H / 2} stroke={TINTA} strokeOpacity={0.45} strokeWidth={1.5} />
      <rect x={x(p25)} y={4} width={Math.max(2, x(p75) - x(p25))} height={H - 8} rx={4} fill={SERIE} fillOpacity={0.25} stroke={SERIE} strokeWidth={1.5} />
      <line x1={x(d.mediana)} x2={x(d.mediana)} y1={3} y2={H - 3} stroke={SERIE} strokeWidth={2.5} />
    </svg>
  );
}

/** Histograma (una serie; barras finas con separación de 2 px y extremos redondeados; texto emergente por barra). */
function Histograma({ valores, metrica }: { valores: number[]; metrica: MetricaAnalizada }) {
  const h = histograma(valores);
  if (!h.length) return <p className="text-sm text-gray-500">Sin valores identificables.</p>;
  const W = 420, H = 150, base = H - 22, max = Math.max(...h.map((c) => c.n)), bw = (W - 20) / h.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Histograma de ${METRICAS[metrica]}`}>
      <line x1={10} x2={W - 10} y1={base} y2={base} stroke={TINTA} strokeOpacity={0.3} />
      {h.map((c, i) => {
        const alto = max ? ((base - 10) * c.n) / max : 0;
        return (
          <g key={i}>
            <rect x={10 + i * bw + 1} y={base - alto} width={Math.max(1, bw - 2)} height={alto} rx={Math.min(4, (bw - 2) / 2)} fill={SERIE}>
              <title>{`${valor(metrica, c.desde)} – ${valor(metrica, c.hasta)}: ${c.n} ${c.n === 1 ? 'valor' : 'valores'}`}</title>
            </rect>
          </g>
        );
      })}
      <text x={10} y={H - 6} fontSize={11} fill={TINTA} opacity={0.7}>{valor(metrica, h[0].desde)}</text>
      <text x={W - 10} y={H - 6} fontSize={11} fill={TINTA} opacity={0.7} textAnchor="end">{valor(metrica, h[h.length - 1].hasta)}</text>
      <text x={W - 10} y={14} fontSize={11} fill={TINTA} opacity={0.7} textAnchor="end">máx. {max}</text>
    </svg>
  );
}
