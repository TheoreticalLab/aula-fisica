/**
 * Proceso de aprendizaje de una práctica asistida (vista del profesor): resumen de la sección y, por estudiante,
 * primer intento ↔ respuesta final, ayudas declaradas, cambio, explicación, transferencia y retención, en una sola pantalla.
 * Son datos pedagógicos: no prueban autoría ni uso o ausencia de IA.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { asistidaProceso } from '@/api/asistida';
import { funcionAusente } from '@/api/examen';
import type { StudentAnswer } from '@/api/tipos';
import { CAMBIO, compararRespuestas, DECLARACION, FUENTE, resumenSeccion, ultimo, type Paso } from '@/lib/asistida';
import { porcentaje, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Spinner } from '@/components/ui';

const LETRAS = 'abcdefghij';
function textoRespuesta(p: Paso | null): string {
  if (!p) return '—';
  if (p.no_se) return '«No sé»';
  const a: StudentAnswer = p.answer ?? {};
  if (a.selected?.length) return a.selected.map((i) => LETRAS[i] ?? String(i)).join(', ');
  if (typeof a.value === 'boolean') return a.value ? 'Verdadero' : 'Falso';
  return a.text?.trim() || '—';
}
const tonoEstado = (s: string | null | undefined) => (s === 'correct' ? 'green' : s === 'partial' ? 'amber' : s ? 'red' : 'gray');
const etiquetaEstado = (s: string | null | undefined) => (s === 'correct' ? 'correcta' : s === 'partial' ? 'parcial' : s === 'pending_review' ? 'a revisar' : s ? 'no correcta' : '—');

export function ProcesoAprendizaje({ activityId }: { activityId: string }) {
  const st = useAsync(() => asistidaProceso(activityId), [activityId]);
  const [ej, setEj] = useState(0);
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return funcionAusente(st.error) ? null : <ErrorBox error={st.error} onRetry={st.reload} />;
  const d = st.data!;
  if (!d.asistida) return null;
  const ejercicio = d.ejercicios[ej];
  if (!ejercicio) return null;
  const filas = d.intentos.map((i) => ({ i, item: i.items.find((x) => x.exercise_id === ejercicio.exercise_id)! })).filter((f) => f.item);
  const r = resumenSeccion(d.intentos.flatMap((i) => i.items.map((item) => ({ ejercicio: d.ejercicios.find((e) => e.exercise_id === item.exercise_id)?.slug ?? item.exercise_id, item }))));
  return (
    <div className="space-y-4">
      <Card title="Proceso de aprendizaje · resumen de la sección">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-gray-500">Primeros intentos presentados</p><p className="text-xl font-semibold">{r.con_intento}</p></div>
          <div><p className="text-xs text-gray-500">Declararon haber usado ayuda en el 1.er intento</p><p className="text-xl font-semibold">{porcentaje(r.declaro_ayuda)}</p></div>
          <div><p className="text-xs text-gray-500">Rendimiento inicial declarado</p><p className="text-xl font-semibold">{porcentaje(r.rendimiento_inicial_declarado)}</p></div>
          <div><p className="text-xs text-gray-500">Rendimiento posterior a la asistencia</p><p className="text-xl font-semibold">{porcentaje(r.rendimiento_posterior)}</p></div>
          <div><p className="text-xs text-gray-500">Presentaron explicación</p><p className="text-xl font-semibold">{porcentaje(r.reflexion)}</p></div>
          <div><p className="text-xs text-gray-500">Transferencia correcta</p><p className="text-xl font-semibold">{r.con_transferencia ? porcentaje(r.transferencia) : '—'}</p></div>
          <div className="col-span-2"><p className="text-xs text-gray-500">Ayudas declaradas</p><p>{r.fuentes.length ? r.fuentes.map(([f, n]) => `${FUENTE[f]} (${n})`).join(', ') : '—'}</p></div>
        </div>
        {r.correcciones_por_ejercicio.length > 1 && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Más correcciones necesarias: {r.correcciones_por_ejercicio.slice(0, 3).map((x) => `${x.ejercicio} (${x.corrigieron} de ${x.con})`).join(', ')}.</p>
        )}
        <p className="mt-2 text-xs text-gray-500">«Rendimiento inicial declarado» se basa en el primer intento y en lo que cada estudiante declaró: no verifica trabajo autónomo. Estas cifras no indican quién hizo trampa.</p>
      </Card>

      {d.ejercicios.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {d.ejercicios.map((e, k) => <button key={e.exercise_id} onClick={() => setEj(k)} className={`rounded-lg border px-3 py-1.5 text-sm ${k === ej ? 'border-primario-600 bg-primario-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>{k + 1}. {e.slug}</button>)}
        </div>
      )}

      <Card title={`Por estudiante · ${ejercicio.slug}${ejercicio.concepts.length ? ` (${ejercicio.concepts.join(', ')})` : ''}`}>
        {filas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10">
                <th className="py-1 pr-2">Estudiante</th><th className="pr-2">Primer intento</th><th className="pr-2">Ayudas</th><th className="pr-2">Respuesta final</th>
                <th className="pr-2">Cambio</th><th className="pr-2">Explicación</th><th className="pr-2">Transferencia</th><th>Retención</th>
              </tr></thead>
              <tbody>
                {filas.map(({ i, item }) => {
                  const ini = ultimo(item.pasos, 'inicial'), cor = ultimo(item.pasos, 'corregida'), ref = ultimo(item.pasos, 'reflexion'), tra = ultimo(item.pasos, 'transferencia');
                  const c = compararRespuestas(ejercicio.format, ini, cor);
                  return (
                    <tr key={i.attempt_id} className="border-b border-gray-100 align-top dark:border-white/5">
                      <td className="py-2 pr-2"><Link className="enlace" to={`/docente/intentos/${i.attempt_id}`}>{i.nombre || 'Estudiante'}</Link>
                        {item.calificacion && <span className="block text-xs text-gray-500">valoración {porcentaje(item.calificacion.credito)}</span>}</td>
                      <td className="pr-2">{ini ? <><span className="font-mono">{textoRespuesta(ini)}</span> <Badge tone={tonoEstado(ini.status)}>{etiquetaEstado(ini.status)}</Badge>
                        <span className="block text-xs text-gray-500" title={ini.declaracion ? DECLARACION[ini.declaracion] : ''}>{ini.declaracion === 'autonomo' ? 'declaró: sin ayuda' : ini.declaracion === 'consulto_ayuda' ? 'declaró: consultó ayuda' : 'declaró: no pudo'}</span></> : <span className="text-gray-400">sin empezar</span>}</td>
                      <td className="pr-2 text-xs">{ref?.fuentes?.length ? ref.fuentes.map((f) => FUENTE[f]).join(', ') : '—'}</td>
                      <td className="pr-2">{cor ? <><span className="font-mono">{textoRespuesta(cor)}</span> <Badge tone={tonoEstado(cor.status)}>{etiquetaEstado(cor.status)}</Badge>{item.correcciones > 1 && <span className="block text-xs text-gray-500">{item.correcciones} versiones</span>}</> : '—'}</td>
                      <td className="pr-2 text-xs">{cor ? CAMBIO[c.cambio] : '—'}{c.procedimientoCambio && <span className="block text-gray-500">cambió el procedimiento</span>}</td>
                      <td className="max-w-[22rem] pr-2 text-xs">{ref ? (
                        <details><summary className="cursor-pointer">{Object.values(ref.reflexion ?? {}).find((v) => v?.trim())?.slice(0, 80) ?? '—'}…</summary>
                          <div className="mt-1 space-y-1">{Object.entries(ref.reflexion ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => <p key={k} className="whitespace-pre-wrap">{v}</p>)}
                            {ref.referencias?.map((x, n) => <p key={n} className="text-gray-500">Ref.: {x.fuente}{x.concepto ? ` · ${x.concepto}` : ''}{x.idea ? ` · ${x.idea}` : ''}{x.enlace ? ` · ${x.enlace}` : ''}</p>)}</div>
                        </details>) : <span className="text-gray-400">sin explicación</span>}</td>
                      <td className="pr-2">{tra ? <><span className="font-mono">{textoRespuesta(tra)}</span> <Badge tone={tonoEstado(tra.status)}>{etiquetaEstado(tra.status)}</Badge></> : item.con_transferencia ? <span className="text-gray-400">pendiente</span> : '—'}</td>
                      <td>{i.retencion !== null ? porcentaje(i.retencion) : d.config.verificacion_tipo ? <span className="text-xs text-gray-400">programada</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">Nadie ha empezado esta práctica.</p>}
        <p className="mt-2 text-xs text-gray-500">Una explicación correcta o bien redactada no prueba quién la escribió, y una que «parece de IA» no prueba nada. Úselo para acompañar el aprendizaje y, si lo necesita, ajuste la nota en la revisión de cada intento.</p>
      </Card>
    </div>
  );
}
