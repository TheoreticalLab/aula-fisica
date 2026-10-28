/**
 * Ficha del estudiante · pestaña «Exámenes»: todo lo de cada evaluación en un solo lugar, para ESTE estudiante.
 * Nota e intentos, cada respuesta (con calificación manual), la cronología de la telemetría y, a petición, lo que el
 * análisis LIEIA de la evaluación completa dice de ese estudiante (sus indicadores y las parejas en que aparece). El análisis usa
 * las mismas funciones del servidor que «Evaluaciones reales» y queda auditado igual (consulta y revelación de nombres).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc } from '@/lib/supabase';
import { activityAttempts } from '@/api/docente';
import { useAction, useAsync } from '@/lib/util';
import { enTrabajador } from '@/lib/lieia/cliente';
import { aExamen, type DatosRealesExamen } from '@/lib/lieia/datosReales';
import type { Analisis } from '@/lib/lieia/detectores';
import { analizarProceso } from '@/lib/lieia/detectoresProceso';
import { mediana } from '@/lib/lieia/estadistica';
import { integridadDe, type IntegridadEstudiante } from '@/lib/lieia/integridadEstudiante';
import { reconstruir, type EventoCrudo, type ProcesoIntento } from '@/lib/lieia/proceso';
import validacionProceso from '@/lib/lieia/procesoValidacion.json';
import { formatoDuracion } from '@/lib/tiempo';
import { CATEGORIAS } from '@/lib/notas';
import { Badge, Card, ErrorBox, Notice, Spinner, Tabs } from '@/components/ui';
import { RevisionIntentoContenido } from './RevisionIntento';
import { CronologiaDeIntento } from './lieia/Cronologia';
import { fmtP, interpretacion, Q } from './lieia/Reales';
import { habilitado } from './lieia/Validacion';

type Iso = string | null;
export interface Actividad {
  id: string; clase: string; titulo: string; modo: 'practice' | 'exam'; abre: Iso; cierra: Iso; max_intentos: number | null; notas_publicadas: boolean;
  items: number; intentos: number; entregados: number; mejor: number | null; mejor_pct: number | null; maximo: number | null; primer_inicio: Iso;
  ultimo: { id: string; estado: string; inicio: string; entrega: Iso; puntaje: number | null; maximo: number | null; por_revisar: boolean; respondidos: number } | null;
  tiempo_efectivo: number; lectura: { segundos: number; pausas: number; completada: Iso; minimo: number | null } | null;
  registro: { categoria: string; puntos: number | null } | null;
}

/** Estado de una actividad para el estudiante, en palabras. */
export function estadoActividad(a: Actividad): [string, 'green' | 'amber' | 'red' | 'gray' | 'blue'] {
  const vencida = a.cierra !== null && new Date(a.cierra) < new Date();
  const futura = a.abre !== null && new Date(a.abre) > new Date();
  if (a.entregados > 0) return a.ultimo?.por_revisar ? ['entregada · por revisar', 'blue'] : ['entregada', 'green'];
  if (a.intentos > 0) return vencida ? ['empezó y no entregó', 'red'] : ['en curso', 'amber'];
  if (futura) return ['aún no abre', 'gray'];
  return vencida ? ['no la intentó (cerrada)', 'red'] : ['no la ha intentado', 'amber'];
}

const fecha = (iso: Iso) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fmt = (s: number | null | undefined) => (s === null || s === undefined ? '—' : formatoDuracion(s));
const V = validacionProceso as { veredictos: Record<'p1' | 'p2', { estado: string }> };
const habilitadoP = (d: 'p1' | 'p2') => ['validado', 'validado_limitado'].includes(V.veredictos[d].estado);

export function ExamenesEstudiante({ userId, actividades }: { userId: string; actividades: Actividad[] }) {
  const [practicas, setPracticas] = useState(false);
  const lista = actividades.filter((a) => practicas || a.modo === 'exam');
  const [sel, setSel] = useState<string | null>(null);
  const elegida = actividades.find((a) => a.id === sel) ?? null;
  return (
    <div className="space-y-4">
      <Card title={`${practicas ? 'Evaluaciones y prácticas' : 'Evaluaciones'} · ${lista.length}`}
        actions={<label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={practicas} onChange={(e) => setPracticas(e.target.checked)} /> Incluir prácticas</label>}>
        {lista.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Actividad</th><th>Estado</th><th className="text-right">Mejor nota</th><th className="text-right">Intentos</th><th>Entregó</th><th /></tr></thead>
              <tbody>{lista.map((a) => {
                const [t, tono] = estadoActividad(a);
                return (
                  <tr key={a.id} className={`border-b border-gray-100 align-top dark:border-white/5 ${sel === a.id ? 'bg-primario-50 dark:bg-white/5' : ''}`}>
                    <td className="py-1.5">{a.titulo} {a.modo === 'exam' ? <Badge tone="purple">evaluación</Badge> : <Badge>práctica</Badge>}
                      <span className="block text-xs text-gray-500">{a.clase} · {a.items} ejercicios{a.cierra ? ` · cierra ${fecha(a.cierra)}` : ''}</span></td>
                    <td><Badge tone={tono}>{t}</Badge></td>
                    <td className="text-right tabular-nums">{a.mejor_pct !== null ? <>{a.mejor_pct} %<span className="block text-xs text-gray-500">{a.mejor}/{a.maximo}</span></> : '—'}</td>
                    <td className="text-right tabular-nums">{a.intentos}{a.max_intentos ? `/${a.max_intentos}` : ''}</td>
                    <td className="text-xs">{fecha(a.ultimo?.entrega ?? null)}</td>
                    <td className="text-right">{a.intentos > 0 && <button className="btn-secundario !py-0.5 text-xs" onClick={() => setSel(sel === a.id ? null : a.id)}>{sel === a.id ? 'Cerrar' : 'Ver todo'}</button>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">{practicas ? 'No hay actividades en sus secciones.' : 'No hay evaluaciones en sus secciones. Marque «Incluir prácticas» para ver las prácticas.'}</p>}
      </Card>
      {elegida && <DetalleExamen key={elegida.id} a={elegida} userId={userId} />}
    </div>
  );
}

type Vista = 'respuestas' | 'proceso' | 'integridad';

function DetalleExamen({ a, userId }: { a: Actividad; userId: string }) {
  const st = useAsync(async () => (await activityAttempts(a.id)).filter((x) => x.user_id === userId), [a.id, userId]);
  const [intento, setIntento] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('respuestas');
  if (st.loading) return <Card title={a.titulo}><Spinner /></Card>;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const intentos = st.data ?? [];
  if (!intentos.length) return <Card title={a.titulo}><p className="text-sm text-gray-500">No tiene intentos en esta actividad.</p></Card>;
  const entregados = intentos.filter((x) => x.status === 'submitted');
  const actual = intentos.find((x) => x.id === intento) ?? entregados[entregados.length - 1] ?? intentos[intentos.length - 1];
  const duracion = actual.submitted_at ? (new Date(actual.submitted_at).getTime() - new Date(actual.started_at).getTime()) / 1000 : null;
  const categoria = a.registro ? CATEGORIAS.find((c) => c.id === a.registro!.categoria)?.label ?? a.registro.categoria : null;
  return (
    <Card title={a.titulo} actions={<Link className="btn-secundario !py-1 text-xs" to={`/docente/actividades/${a.id}`}>Abrir la actividad</Link>}>
      {intentos.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-xs text-gray-500">Intento:</span>
          {intentos.map((x) => (
            <button key={x.id} className={`${x.id === actual.id ? 'btn-primario' : 'btn-secundario'} !px-2 !py-0.5 text-xs`} onClick={() => setIntento(x.id)}>
              {x.attempt_number}{x.status === 'submitted' ? '' : ' (en curso)'}
            </button>
          ))}
        </div>
      )}
      <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato k="Nota de este intento" v={actual.score !== null && actual.max_score ? `${actual.score}/${actual.max_score}` : '—'} sub={actual.needs_review ? 'hay respuestas por revisar' : actual.score !== null && actual.max_score ? `${Math.round((100 * actual.score) / actual.max_score)} %` : undefined} />
        <Dato k="Mejor nota" v={a.mejor_pct !== null ? `${a.mejor_pct} %` : '—'} sub={a.notas_publicadas ? 'publicada para el estudiante' : 'aún no publicada'} />
        <Dato k="Empezó" v={new Date(actual.started_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false })} sub={new Date(actual.started_at).toLocaleDateString('es-DO', { dateStyle: 'medium' })} />
        <Dato k="Entregó" v={actual.submitted_at ? new Date(actual.submitted_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'en curso'} sub={duracion !== null ? `duración ${fmt(duracion)}` : undefined} />
        <Dato k="Tiempo efectivo en la actividad" v={a.tiempo_efectivo ? fmt(a.tiempo_efectivo) : '—'} sub="todos los intentos" />
        <Dato k="Registro de calificaciones" v={categoria ?? '—'} sub={a.registro?.puntos ? `${a.registro.puntos} pts` : undefined} />
      </div>
      {a.lectura && <p className="mb-3 text-xs text-gray-500">Lectura cronometrada: {fmt(a.lectura.segundos)}{a.lectura.minimo ? ` de ${fmt(a.lectura.minimo)}` : ''} · {a.lectura.pausas} pausas · {a.lectura.completada ? 'completada' : 'sin completar'}</p>}
      <Tabs<Vista> value={vista} onChange={setVista} tabs={[
        { id: 'respuestas', label: 'Respuestas pregunta por pregunta' }, { id: 'proceso', label: 'Cómo respondió (cronología)' }, { id: 'integridad', label: 'Integridad (LIEIA)' },
      ]} />
      {vista === 'respuestas' && <RevisionIntentoContenido key={actual.id} attemptId={actual.id} />}
      {vista === 'proceso' && <CronologiaDeIntento key={actual.id} attemptId={actual.id} />}
      {vista === 'integridad' && <IntegridadEnExamen activityId={a.id} userId={userId} hayEntrega={entregados.length > 0} />}
    </Card>
  );
}

function Dato({ k, v, sub }: { k: string; v: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="tarjeta !p-3">
      <p className="text-xs text-gray-500">{k}</p>
      <p className="font-serif text-lg font-semibold tabular-nums">{v}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

type AnalisisSerial = Pick<Analisis, 'parejas' | 'estudiantes' | 'abstenciones'>;
interface Nombre { seudonimo: string; user_id: string; full_name: string; student_code: string | null }
interface TelSeud { seudonimo: string; inicio: number; entrega: number | null; eventos: EventoCrudo[] }
interface Resultado {
  integ: IntegridadEstudiante; nombres: Nombre[]; seudonimos: string[]; abstenciones: string[]; conTiempos: boolean;
  /** su proceso reconstruido y las medianas de la sección (si hay telemetría) */
  proceso: { propio: ProcesoIntento; latencia: number | null; latenciaSeccion: number | null; esperaSeccion: number | null } | null;
}

function IntegridadEnExamen({ activityId, userId, hayEntrega }: { activityId: string; userId: string; hayEntrega: boolean }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const accion = useAction();

  async function analizar() {
    setRes(null); setAviso(null);
    await accion.run(async () => {
      const [d, nombres, tel] = await Promise.all([
        rpc<DatosRealesExamen>('lieia_exam_data', { p_activity: activityId }),
        rpc<Nombre[]>('lieia_reveal', { p_activity: activityId }),
        rpc<TelSeud[]>('lieia_telemetry', { p_activity: activityId }),
      ]);
      const propio = nombres.find((n) => n.user_id === userId);
      if (!propio) { setAviso('El análisis usa el primer intento entregado de cada estudiante, y este estudiante no tiene ninguno entregado en esta actividad.'); return; }
      const ex = aExamen(d);
      const indice = ex.estudiantes.findIndex((e) => e.id === propio.seudonimo);
      if (ex.estudiantes.length < 3) { setAviso(`Solo hay ${ex.estudiantes.length} entregas: hacen falta al menos 3 para comparar.`); return; }
      const r = await enTrabajador<AnalisisSerial>({ tipo: 'analizar', examen: ex, opciones: { permutaciones: 199, bootstrap: 199 } }).promesa;

      const items = [...d.items].sort((x, y) => x.posicion - y.posicion).map((x) => x.exercise_id);
      const conTel = tel.filter((x) => x.eventos.length > 0);
      const kTel = conTel.findIndex((x) => x.seudonimo === propio.seudonimo);
      let proc: ReturnType<typeof analizarProceso>[number] | null = null;
      let proceso: Resultado['proceso'] = null;
      if (kTel >= 0) {
        const procesos = conTel.map((x) => reconstruir(x.eventos, x.inicio, x.entrega, items));
        proc = analizarProceso(procesos, items, { bootstrap: 199 })[kTel] ?? null;
        const medLat = (p: ProcesoIntento) => { const l = p.items.map((x) => x.latenciaGeneracion).filter((x): x is number => x !== null); return l.length ? mediana(l) : null; };
        const lats = procesos.map(medLat).filter((x): x is number => x !== null);
        const esperas = procesos.map((p) => p.esperaFinal).filter((x): x is number => x !== null);
        proceso = { propio: procesos[kTel], latencia: medLat(procesos[kTel]), latenciaSeccion: lats.length ? mediana(lats) : null, esperaSeccion: esperas.length ? mediana(esperas) : null };
      }
      const integ = integridadDe(indice, r, habilitado, proc);
      if (!integ) throw new Error('No se encontró al estudiante en el análisis.');
      setRes({ integ, nombres, seudonimos: ex.estudiantes.map((e) => e.id), abstenciones: r.abstenciones, conTiempos: ex.conTiempos, proceso });
    });
  }

  const nombre = (k: number) => {
    if (!res) return `#${k}`;
    const n = res.nombres.find((x) => x.seudonimo === res.seudonimos[k]);
    return n ? n.full_name || n.student_code || res.seudonimos[k] : res.seudonimos[k];
  };
  const usuario = (k: number) => res?.nombres.find((x) => x.seudonimo === res.seudonimos[k])?.user_id ?? null;

  return (
    <div className="space-y-4">
      <Notice tone="warn">Un resultado estadístico no es una acusación ni una sanción: indica que los datos serían improbables si los estudiantes hubieran respondido de forma independiente, según modelos validados con datos sintéticos. Úselo para decidir qué revisar, nunca como prueba por sí solo.</Notice>
      {!res && (
        <Card>
          <p className="text-sm">Para ver lo que el análisis dice de este estudiante hay que analizar la evaluación completa (se compara con el resto de la sección). Tarda unos segundos.</p>
          <p className="mt-1 text-xs text-gray-500">Queda registrado como consulta del examen y revelación de nombres, igual que en LIEIA → Evaluaciones reales. Se usa el primer intento entregado de cada estudiante.</p>
          <button className="btn-primario mt-2" disabled={accion.busy || !hayEntrega} onClick={() => void analizar()}>{accion.busy ? 'Analizando…' : 'Analizar esta evaluación'}</button>
          {!hayEntrega && <p className="mt-1 text-xs text-gray-500">Disponible cuando el estudiante haya entregado.</p>}
          {accion.busy && <Spinner label="Analizando (permutaciones y remuestreos en segundo plano)…" />}
          <ErrorBox error={accion.error} />
          {aviso && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
        </Card>
      )}
      {res && <ResultadoIntegridad res={res} nombre={nombre} usuario={usuario} />}
    </div>
  );
}

function ResultadoIntegridad({ res, nombre, usuario }: { res: Resultado; nombre: (k: number) => string; usuario: (k: number) => string | null }) {
  const { integ } = res;
  const e = integ.estudiante;
  const p = integ.proceso;
  const negrita = (q: number | null | undefined) => (q !== null && q !== undefined && q < Q ? 'font-semibold' : '');
  return (
    <>
      <Card title={`Sus indicadores en esta evaluación · ${integ.total} estudiantes comparados`}>
        <ul className="mb-2 text-xs text-gray-500">
          <li>Tiempos por pregunta: {res.conTiempos ? '✓ registrados' : '✗ no disponibles (evaluación anterior a la instrumentación)'}</li>
          {res.abstenciones.map((x) => <li key={x} className="text-amber-700 dark:text-amber-400">⚠ {x}</li>)}
        </ul>
        <table className="w-full text-sm">
          <tbody>
            <Fila k="Aciertos" v={`${e.puntaje}/${e.respondidas} · puesto ${integ.puesto} de ${integ.total}`} />
            <Fila k="Habilidad estimada (θ)" v={e.theta.toFixed(2)} />
            <Fila k="D6 · tarda lo mismo en preguntas fáciles y difíciles (p / q)" v={habilitado('d6') && e.d6 ? <span className={negrita(e.q6)}>{fmtP(e.d6.p)} / {fmtP(e.q6)} (pendiente {e.d6.pendiente.toFixed(2)}; lo normal ≈ 1)</span> : '—'} />
            <Fila k="D8 · respuestas distintas en preguntas equivalentes (p / q)" v={e.d8 ? (habilitado('d8') ? <span className={negrita(e.q8)}>{fmtP(e.d8.p)} / {fmtP(e.q8)}</span> : <span className="text-gray-400">no validado</span>) : '—'} />
            <Fila k="P1 · respondió rápido y envió mucho después (p / q)" v={habilitadoP('p1') && p?.p1 ? <span className={negrita(p.q1)}>{fmtP(p.p1.p)} / {fmtP(p.q1)}</span> : '—'} />
            <Fila k="P2 · ritmo anormalmente regular (p / q, potencia limitada)" v={habilitadoP('p2') && p?.p2 ? <span className="text-gray-500">{fmtP(p.p2.p)} / {fmtP(p.q2)}</span> : '—'} />
            <Fila k="Respuestas que aparecieron de golpe (descriptivo)" v={p ? p.p3.pegados : '—'} />
            <Fila k="Cambios de respuesta (descriptivo)" v={e.cambios} />
            <Fila k="Tiempo con el aula en segundo plano" v={e.oculto ? fmt(e.oculto) : '—'} />
            {res.proceso && <Fila k="Mediana hasta responder: estudiante / sección" v={`${fmt(res.proceso.latencia)} / ${fmt(res.proceso.latenciaSeccion)}`} />}
            {res.proceso && <Fila k="Espera entre la última modificación y el envío: estudiante / sección" v={`${fmt(res.proceso.propio.esperaFinal)} / ${fmt(res.proceso.esperaSeccion)}`} />}
            {res.proceso && <Fila k="Calidad de la telemetría" v={`${res.proceso.propio.calidad.sesiones} sesión(es) · ${res.proceso.propio.calidad.perdidos} eventos perdidos · ${res.proceso.propio.calidad.recargas} recargas`} />}
            <Fila k={<span className="text-gray-400">D4 · D5 · D7 (no validados, solo descriptivos)</span>} v={<span className="text-gray-400">{e.d4 ? `l_z ${e.d4.lz.toFixed(2)}` : '—'} · {e.d5 ? `${e.d5.rapidas} rápidas (esp. ${e.d5.esperadas.toFixed(1)})` : '—'} · {e.d7 ? `atipicidad ${e.d7.distancia.toFixed(1)}` : '—'}</span>} />
          </tbody>
        </table>
        {!p && <p className="mt-2 text-xs text-gray-500">Este intento no tiene telemetría del proceso (se registra desde su activación): P1, P2 y las apariciones de golpe no se calculan.</p>}
        <p className="mt-2 text-xs text-gray-500">En negrita, q &lt; {String(Q).replace('.', ',')}. Explicaciones legítimas: responder rápido y luego distraerse (P1), ser muy metódico (P2), pegar desde notas propias o la calculadora, dejar el aula en segundo plano por causas inocentes. Nada de esto prueba fraude.</p>
      </Card>

      <Card title={`Coincidencias con otros estudiantes (q < 0,2) · ${integ.parejas.length}`}>
        {!integ.parejas.length ? <p className="text-sm text-gray-500">No aparece en ninguna pareja con evidencia de dependencia tras corregir por comparaciones múltiples. Esto no prueba que no colaboró: los detectores tienen potencia limitada.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs dark:border-white/10">
                <th className="py-1">Con</th><th className="text-right">D1 errores idénticos (esperados)</th><th className="text-right">D1 p / q</th><th className="text-right">D3 sincronía p / q</th><th>Responde primero</th><th className="text-right">D2 p / q</th><th>Lectura</th>
              </tr></thead>
              <tbody>{integ.parejas.map((x) => {
                const u = usuario(x.otro);
                return (
                  <tr key={x.otro} className="border-b border-gray-100 align-top dark:border-white/5">
                    <td className="py-1">{u ? <Link className="enlace" to={`/docente/estudiantes/${u}`}>{nombre(x.otro)}</Link> : nombre(x.otro)}</td>
                    <td className="text-right tabular-nums">{x.par.d1 ? `${x.par.d1.identicas} (${x.par.d1.esperadas.toFixed(1)}) de ${x.par.d1.comunes}` : '—'}</td>
                    <td className={`text-right tabular-nums ${negrita(x.q1)}`}>{fmtP(x.par.d1?.p)} / {fmtP(x.q1)}</td>
                    <td className={`text-right tabular-nums ${negrita(x.q3)}`}>{fmtP(x.par.d3?.p)} / {fmtP(x.q3)}</td>
                    <td className="text-xs">{x.primero === null ? '—' : `${x.primero === 'estudiante' ? 'este estudiante' : nombre(x.otro)}${x.adelanto !== null ? ` (mediana ${Math.round(x.adelanto)} s antes)` : ''}`}</td>
                    <td className="text-right tabular-nums text-gray-500">{fmtP(x.par.d2?.p)} / {fmtP(x.q2)}</td>
                    <td className="max-w-xs text-xs">{interpretacion(x.q1, x.q3, x.q2)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Fila({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <tr className="border-b border-gray-100 dark:border-white/5"><td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{k}</td><td className="text-right tabular-nums">{v}</td></tr>;
}
