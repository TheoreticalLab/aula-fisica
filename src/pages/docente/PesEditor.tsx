/**
 * Editor docente de una Práctica Extraordinaria Secuencial: datos y fechas, contenido (problemas por etapas del banco,
 * composición docente con situación común o apartados redactados), carga temporal, publicación, estudiantes
 * (adaptaciones, validación, puntuaciones) y revisión. El monitor en vivo y Orbe Control llegan en la etapa 3.
 */
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { describeKey } from '@calif/calificar.ts';
import type { AnswerKey } from '@calif/tipos.ts';
import {
  pesAdaptacion, pesBancoProblemas, pesBorrar, pesBorrarEjercicio, pesCambiarEstado, pesDesdeBanco, pesDesdeProblema, pesDetalle, pesEditar,
  pesPublicar, pesPublicarResultados, pesRedactado, pesRespuestasDocente, pesRevisar, pesValidar,
  type ApartadoRedactado, type AsignacionPes, type DetallePes, type EtapaPes, type FormatoPes, type ProblemaBanco, type RespuestaDocente,
} from '@/api/pes';
import { listExercises, roster } from '@/api/docente';
import { getLessonList } from '@/api/estudiante';
import { analizarCarga, pesosIguales, type BloqueLiberacion } from '@/lib/pes';
import { construirEjercicio, formVacio, type FormApartado } from '@/lib/pesRedaccion';
import { fecha, FORMATO, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Modal, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { InlineMd } from '@/components/Markdown';
import { ESTADO_PES, TABLA } from './PesTab';
import { MonitorPes, PanelTiempos, PoliticaControl } from './PesSeguimiento';
import { GenerarConIA } from './PesGenerarIA';

type Tab = 'datos' | 'contenido' | 'carga' | 'monitor' | 'estudiantes' | 'revision';
const ETAPAS: { id: EtapaPes; t: string }[] = [
  { id: 'prediccion', t: 'Predicción cualitativa' }, { id: 'formulacion', t: 'Formulación de leyes y ecuaciones' }, { id: 'resolucion', t: 'Resolución matemática' },
  { id: 'interpretacion', t: 'Interpretación física' }, { id: 'transferencia', t: 'Transferencia / variación de condiciones' }, { id: 'otra', t: 'Otra' },
];
const ORIGEN = { problema_banco: 'Problema por etapas del banco', composicion_docente: 'Composición docente', redactado: 'Redactado' } as const;
const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const deLocal = (s: string) => (s ? new Date(s).toISOString() : null);
const pts = (x: number) => x.toFixed(2).replace('.', ',');
const min = (s: number) => `${(s / 60).toFixed(s % 60 ? 1 : 0).replace('.', ',')} min`;

export default function PesEditor() {
  const { practicaId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('t') as Tab) || 'contenido';
  const d = useAsync(() => pesDetalle(practicaId), [practicaId]);
  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const det = d.data!;
  const p = det.practica;
  const borrador = p.estado === 'borrador';
  const pendientes = det.asignaciones.reduce((s, a) => s + a.puntaje.pendientes_revision, 0);
  return (
    <div className="space-y-4">
      <PageTitle title={p.titulo} subtitle={<><Badge tone={ESTADO_PES[p.estado].tono}>{ESTADO_PES[p.estado].t}</Badge> · Práctica extraordinaria secuencial · cierre {fecha(p.cierra_at)}</>}
        back={{ to: `/docente/clases/${p.class_id}?t=pes`, label: 'Sección' }}
        actions={(borrador || p.estado === 'publicada') && <Link className="btn-secundario" to={`/docente/pes/${p.id}/simulador`}>🧪 Simulador docente</Link>} />
      <Tabs<Tab> value={tab} onChange={(t) => setParams({ t })} tabs={[
        { id: 'contenido', label: `Contenido (${det.ejercicios.length})` }, { id: 'datos', label: 'Datos y fechas' }, { id: 'carga', label: 'Carga temporal' },
        { id: 'monitor', label: 'Monitor', disabled: borrador }, { id: 'estudiantes', label: 'Estudiantes', disabled: borrador }, { id: 'revision', label: `Revisión${pendientes ? ` (${pendientes})` : ''}`, disabled: borrador },
      ]} />
      {tab === 'contenido' && <TabContenido d={det} recargar={d.reload} />}
      {tab === 'datos' && <><TabDatos d={det} recargar={d.reload} /><PoliticaControl d={det} recargar={d.reload} /></>}
      {tab === 'carga' && <><PanelCarga d={det} /><PanelTiempos d={det} recargar={d.reload} /></>}
      {tab === 'monitor' && !borrador && <MonitorPes practica={p.id} />}
      {tab === 'estudiantes' && !borrador && <TabEstudiantes d={det} recargar={d.reload} />}
      {tab === 'revision' && !borrador && <TabRevision practica={p.id} recargar={d.reload} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Datos y fechas
// ---------------------------------------------------------------------------------------------------------------
function TabDatos({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const p = d.practica;
  const borrador = p.estado === 'borrador';
  const [f, setF] = useState({
    titulo: p.titulo, descripcion: p.descripcion, instrucciones: p.instrucciones, abre: aLocal(p.abre_at), cierra: aLocal(p.cierra_at),
    p_max: String(p.p_max), alfa: String(p.alfa), factor: String(p.factor_anticipado), incremento: String(p.incremento),
    liberacion: p.liberacion as BloqueLiberacion[],
  });
  const act = useAction();
  const [ok, setOk] = useState(false);
  const guardar = async () => {
    setOk(false);
    const datos = borrador ? {
      titulo: f.titulo, descripcion: f.descripcion, instrucciones: f.instrucciones, abre_at: deLocal(f.abre), cierra_at: deLocal(f.cierra),
      p_max: Number(f.p_max), alfa: Number(f.alfa), factor_anticipado: Number(f.factor), incremento: Number(f.incremento),
      liberacion: f.liberacion.filter((b) => b.desde && b.ejercicios > 0),
    } : { titulo: f.titulo, descripcion: f.descripcion, instrucciones: f.instrucciones, ...(f.cierra !== aLocal(p.cierra_at) ? { cierra_at: deLocal(f.cierra) } : {}) };
    if ((await act.run(() => pesEditar(p.id, datos))) !== undefined) { setOk(true); await recargar(); }
  };
  const num = (k: 'p_max' | 'alfa' | 'factor' | 'incremento', label: string, hint: string) => (
    <Field label={label} hint={hint}>{(id) => <input id={id} className="campo" inputMode="decimal" value={f[k]} disabled={!borrador} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Field>
  );
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">{(id) => <input id={id} className="campo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={160} />}</Field>
        <div />
        <Field label="Descripción (la ve el estudiante antes de empezar)">{(id) => <textarea id={id} className="campo min-h-[80px]" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} maxLength={4000} />}</Field>
        <Field label="Instrucciones adicionales">{(id) => <textarea id={id} className="campo min-h-[80px]" value={f.instrucciones} onChange={(e) => setF({ ...f, instrucciones: e.target.value })} maxLength={8000} />}</Field>
        <Field label="Apertura (opcional)">{(id) => <input id={id} type="datetime-local" className="campo" value={f.abre} disabled={!borrador} onChange={(e) => setF({ ...f, abre: e.target.value })} />}</Field>
        <Field label="Fecha límite" hint={borrador ? undefined : 'Publicada: solo se puede ampliar.'}>{(id) => <input id={id} type="datetime-local" className="campo" value={f.cierra} onChange={(e) => setF({ ...f, cierra: e.target.value })} />}</Field>
        {num('p_max', 'Puntuación máxima (P_max)', 'Por defecto 8')}
        {num('alfa', 'Exponente de la curva (α)', '2: dominar la mitad da la cuarta parte')}
        {num('factor', 'Factor de avance anticipado (m)', '0,5: la puntuación del apartado se reduce al 50 %')}
        {num('incremento', 'Incremento de la espera mínima', '0,2: espera = 1,20 × tiempo de referencia')}
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Liberación por bloques (opcional)</h3>
        <p className="text-xs text-gray-500">Número ACUMULADO de ejercicios disponibles desde cada fecha. Sin bloques, todos están disponibles desde el inicio.</p>
        {f.liberacion.map((b, i) => (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input type="date" className="campo w-44" value={b.desde} disabled={!borrador} onChange={(e) => setF({ ...f, liberacion: f.liberacion.map((x, j) => (j === i ? { ...x, desde: e.target.value } : x)) })} />
            <span>hasta el ejercicio</span>
            <input type="number" min={1} className="campo w-24" value={b.ejercicios} disabled={!borrador} onChange={(e) => setF({ ...f, liberacion: f.liberacion.map((x, j) => (j === i ? { ...x, ejercicios: Number(e.target.value) } : x)) })} />
            {borrador && <button type="button" className="enlace" onClick={() => setF({ ...f, liberacion: f.liberacion.filter((_, j) => j !== i) })}>Quitar</button>}
          </div>
        ))}
        {borrador && <button type="button" className="btn-secundario mt-2" onClick={() => setF({ ...f, liberacion: [...f.liberacion, { desde: '', ejercicios: (f.liberacion.at(-1)?.ejercicios ?? 0) + 1 }] })}>Añadir bloque</button>}
      </div>
      {!borrador && <Notice>Publicada: la calificación, la apertura y la liberación están congeladas.</Notice>}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primario" disabled={act.busy} onClick={guardar}>Guardar</button>
        {ok && <span className="text-sm text-emerald-700">Guardado.</span>}
      </div>
      <ErrorBox error={act.error} />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Carga temporal
// ---------------------------------------------------------------------------------------------------------------
function cargaDe(d: DetallePes, horasDiarias: number) {
  const p = d.practica;
  return analizarCarga({
    tRefs: d.ejercicios.map((e) => e.apartados.map((a) => a.t_ref_s)), incremento: Number(p.incremento),
    abre: p.abre_at ? new Date(p.abre_at) : null, cierra: p.cierra_at ? new Date(p.cierra_at) : null, liberacion: p.liberacion, ahora: new Date(), horasDiarias,
  });
}

function PanelCarga({ d }: { d: DetallePes }) {
  const [h, setH] = useState(3);
  const c = cargaDe(d, h);
  const fh = (x: number) => `${x.toFixed(1).replace('.', ',')} h`;
  return (
    <Card title="Carga temporal frente al plazo">
      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <div><span className="text-gray-500">Contenido</span><br />{c.ejercicios} ejercicios · {c.apartados} apartados</div>
        <div><span className="text-gray-500">Trabajo estimado (Σ T_ref)</span><br /><strong>{fh(c.referenciaH)}</strong></div>
        <div><span className="text-gray-500">Espera mínima total</span><br /><strong>{fh(c.esperaH)}</strong> <span className="text-xs text-gray-500">para crédito completo</span></div>
        <div><span className="text-gray-500">Plazo</span><br />{c.dias === null ? '—' : `${c.dias.toFixed(1).replace('.', ',')} días · ${fh(c.horasPorDia ?? 0)}/día`}</div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">Horas diarias razonables para esta práctica:
        <input type="number" min={0.5} step={0.5} className="campo w-24" value={h} onChange={(e) => setH(Math.max(0.5, Number(e.target.value) || 3))} />
      </label>
      {c.bloques.length > 0 && (
        <table className={`${TABLA} mt-3`}>
          <thead><tr><th>Bloque</th><th>Ejercicios</th><th>Espera mínima</th><th>Días hasta el siguiente</th><th>Horas/día</th></tr></thead>
          <tbody>{c.bloques.map((b, i) => (
            <tr key={i}><td>{fecha(b.desde.toISOString())}</td><td>{b.ejercicios[0]}–{b.ejercicios[1]}</td><td>{fh(b.esperaH)}</td><td>{b.dias.toFixed(1).replace('.', ',')}</td>
              <td>{Number.isFinite(b.horasPorDia) ? fh(b.horasPorDia) : '—'}</td></tr>
          ))}</tbody>
        </table>
      )}
      <div className="mt-3 space-y-2">
        {c.avisos.length === 0 ? <Notice tone="ok">La carga cabe en el plazo con margen.</Notice>
          : c.avisos.map((a, i) => <Notice key={i} tone={a.nivel === 'info' ? 'info' : 'warn'}>{a.nivel === 'error' ? '⛔ ' : a.nivel === 'aviso' ? '⚠️ ' : ''}{a.texto}</Notice>)}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------------------------------------------
function resumenClave(a: DetallePes['ejercicios'][number]['apartados'][number]): string {
  if (a.formato === 'open') return a.rubrica ? `Rúbrica: ${a.rubrica.slice(0, 80)}${a.rubrica.length > 80 ? '…' : ''}` : '⚠ sin rúbrica';
  if (!a.clave) return '⚠ sin clave';
  try { return describeKey(a.clave as unknown as AnswerKey, a.opciones ?? undefined); } catch { return 'clave no legible'; }
}

function TabContenido({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const p = d.practica;
  const borrador = p.estado === 'borrador';
  const [agregar, setAgregar] = useState<'problema' | 'composicion' | 'redactar' | 'ia'>('problema');
  const act = useAction();
  return (
    <div className="space-y-4">
      {d.ejercicios.length === 0 && <Empty>Todavía no hay ejercicios. Añada problemas por etapas del banco, componga o redacte apartados.</Empty>}
      {d.ejercicios.map((e) => (
        <Card key={e.id} title={<>Ejercicio {e.posicion}{e.titulo ? ` · ${e.titulo}` : ''} <Badge>{ORIGEN[e.origen]}</Badge>{e.origen_ref && <span className="ml-1 text-xs text-gray-500">{e.origen_ref}</span>}</>}
          actions={borrador && <button type="button" className="enlace text-sm" disabled={act.busy} onClick={async () => { if (confirm(`¿Quitar el ejercicio ${e.posicion}?`)) { await act.run(() => pesBorrarEjercicio(e.id)); await recargar(); } }}>Quitar</button>}>
          {e.contexto && <p className="mb-2 text-sm text-gray-600 dark:text-gray-300"><InlineMd>{e.contexto}</InlineMd></p>}
          <table className={TABLA}>
            <thead><tr><th /><th>Enunciado</th><th>Etapa</th><th>Formato</th><th>Peso</th><th>T_ref</th><th>Clave / rúbrica</th></tr></thead>
            <tbody>{e.apartados.map((a) => (
              <tr key={a.id}><td className="font-semibold">{a.letra}</td><td className="max-w-md"><InlineMd>{a.enunciado.length > 220 ? `${a.enunciado.slice(0, 220)}…` : a.enunciado}</InlineMd></td>
                <td>{ETAPAS.find((x) => x.id === a.etapa)?.t ?? a.etapa}</td><td>{FORMATO[a.formato] ?? a.formato}</td><td>{Number(a.peso).toFixed(3)}</td><td>{min(a.t_ref_s)}</td>
                <td className="text-xs">{resumenClave(a)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      ))}
      <ErrorBox error={act.error} />
      {borrador && (
        <Card title="Añadir un ejercicio">
          <Tabs value={agregar} onChange={setAgregar} tabs={[
            { id: 'problema', label: 'Problema por etapas del banco' }, { id: 'composicion', label: 'Composición docente' }, { id: 'redactar', label: 'Redactar apartados' },
            { id: 'ia', label: '✨ Generar con IA' },
          ]} />
          <div className="mt-3">
            {agregar === 'problema' && <AgregarProblema d={d} recargar={recargar} />}
            {agregar === 'composicion' && <AgregarComposicion d={d} recargar={recargar} />}
            {agregar === 'redactar' && <AgregarRedactado d={d} recargar={recargar} />}
            {agregar === 'ia' && <GenerarConIA d={d} recargar={recargar} />}
          </div>
        </Card>
      )}
      {borrador ? <Publicar d={d} recargar={recargar} /> : <AccionesPublicada d={d} recargar={recargar} />}
    </div>
  );
}

function AgregarProblema({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const inf = useAsync(() => pesBancoProblemas(d.practica.class_id), [d.practica.class_id]);
  if (inf.loading && !inf.data) return <Spinner />;
  if (inf.error) return <ErrorBox error={inf.error} onRetry={inf.reload} />;
  const r = inf.data!;
  return (
    <div className="space-y-3">
      <Notice tone={r.listos + r.requieren_seleccion === 0 ? 'warn' : 'info'}>
        El banco de esta asignatura tiene <strong>{r.listos}</strong> problema(s) por etapas listos (3 a 5 etapas), <strong>{r.requieren_seleccion}</strong> que requieren
        elegir de 3 a 5 etapas, y <strong>{r.preguntas_sueltas}</strong> preguntas sueltas. Una pregunta suelta no se convierte en varios apartados:
        para usarlas, componga un ejercicio con una situación común o redacte los apartados.
        {r.listos + r.requieren_seleccion === 0 && <> <strong>El contenido secuencial del banco es insuficiente: requiere preparación docente.</strong></>}
      </Notice>
      {r.problemas.map((pb) => <FilaProblema key={pb.id} pb={pb} practica={d.practica.id} recargar={recargar} />)}
    </div>
  );
}

function FilaProblema({ pb, practica, recargar }: { pb: ProblemaBanco; practica: string; recargar: () => Promise<void> }) {
  const [desde, setDesde] = useState(1);
  const [hasta, setHasta] = useState(Math.min(pb.total, 5));
  const act = useAction();
  const n = hasta - desde + 1;
  const depende = desde > 1 && pb.etapas.find((e) => e.etapa === desde)?.depende_de_la_anterior;
  const problema = pb.estado === 'requiere_seleccion' && (n < 3 || n > 5 ? 'Elija de 3 a 5 etapas consecutivas.' : depende ? `La etapa ${desde} usa el resultado de la ${desde - 1}: empiece antes.` : null);
  const usable = pb.estado === 'listo' || pb.estado === 'requiere_seleccion';
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{pb.titulo ?? pb.id}</span>
        <Badge tone={pb.estado === 'listo' ? 'green' : pb.estado === 'requiere_seleccion' ? 'blue' : 'amber'}>{pb.total} etapas</Badge>
        <span className="text-xs text-gray-500">{pb.motivo}</span>
      </div>
      <ol className="mt-2 space-y-1 text-xs">
        {pb.etapas.map((e) => (
          <li key={e.etapa} className={pb.estado === 'requiere_seleccion' && (e.etapa < desde || e.etapa > hasta) ? 'opacity-50' : ''}>
            <strong>{e.etapa}.</strong> {FORMATO[e.formato] ?? e.formato} · {e.extracto}{e.extracto.length >= 160 ? '…' : ''}
            {e.depende_de_la_anterior && <Badge tone="purple">usa la etapa anterior</Badge>}{!e.con_clave && <Badge tone="red">sin clave</Badge>}{!e.publicado && <Badge tone="amber">no publicada</Badge>}
          </li>
        ))}
      </ol>
      {usable && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {pb.estado === 'requiere_seleccion' && (
            <>
              Etapas <select className="campo w-20" value={desde} onChange={(e) => setDesde(Number(e.target.value))}>{pb.etapas.map((e) => <option key={e.etapa}>{e.etapa}</option>)}</select>
              a <select className="campo w-20" value={hasta} onChange={(e) => setHasta(Number(e.target.value))}>{pb.etapas.map((e) => <option key={e.etapa}>{e.etapa}</option>)}</select>
            </>
          )}
          <button type="button" className="btn-secundario" disabled={act.busy || !!problema}
            onClick={async () => { if ((await act.run(() => pesDesdeProblema(practica, pb.id, pb.estado === 'listo' ? 1 : desde, pb.estado === 'listo' ? pb.total : hasta))) !== undefined) await recargar(); }}>
            Añadir ({pb.estado === 'listo' ? pb.total : n} apartados)
          </button>
          {problema && <span className="text-xs text-acento-700">{problema}</span>}
        </div>
      )}
      <ErrorBox error={act.error} />
    </div>
  );
}

function AgregarComposicion({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const courseId = d.practica.course_id;
  const lecciones = useAsync(() => getLessonList(courseId), [courseId]);
  const [leccion, setLeccion] = useState('');
  const [buscar, setBuscar] = useState('');
  const ejercicios = useAsync(() => (leccion || buscar.trim().length >= 3 ? listExercises({ courseId, lessonId: leccion || undefined, search: buscar.trim() || undefined }) : Promise.resolve([])), [courseId, leccion, buscar]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [contexto, setContexto] = useState('');
  const act = useAction();
  const listo = elegidos.length >= 3 && elegidos.length <= 5 && contexto.trim().length >= 20;
  return (
    <div className="space-y-3">
      <Notice>Elija de 3 a 5 preguntas del banco en el orden en que se presentarán y <strong>escriba la situación común</strong> que las convierte en un problema.
        La plataforma no agrupa preguntas automáticamente.</Notice>
      <div className="flex flex-wrap gap-2">
        <select className="campo w-auto" value={leccion} onChange={(e) => setLeccion(e.target.value)}>
          <option value="">Todas las lecciones</option>
          {(lecciones.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <input className="campo flex-1" placeholder="Buscar en el enunciado (3 letras o más)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      <div className="max-h-72 overflow-y-auto rounded border border-gray-200 dark:border-white/10">
        {(ejercicios.data ?? []).length === 0 ? <p className="p-3 text-sm text-gray-500">Elija una lección o busque para ver preguntas.</p> : (ejercicios.data ?? []).map((x) => {
          const i = elegidos.indexOf(x.id);
          return (
            <label key={x.id} className="flex cursor-pointer items-start gap-2 border-b border-gray-100 p-2 text-sm dark:border-white/5">
              <input type="checkbox" className="mt-1" checked={i >= 0} disabled={i < 0 && elegidos.length >= 5}
                onChange={() => setElegidos(i >= 0 ? elegidos.filter((y) => y !== x.id) : [...elegidos, x.id])} />
              {i >= 0 && <Badge tone="blue">{String.fromCharCode(65 + i)}</Badge>}
              <span className="flex-1"><InlineMd>{x.prompt.length > 200 ? `${x.prompt.slice(0, 200)}…` : x.prompt}</InlineMd></span>
              <span className="text-xs text-gray-500">{FORMATO[x.format] ?? x.format}</span>
            </label>
          );
        })}
      </div>
      <Field label="Título del ejercicio">{(id) => <input id={id} className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />}</Field>
      <Field label="Situación común (se muestra con cada apartado)" hint={`${contexto.trim().length}/20 caracteres como mínimo`}>
        {(id) => <textarea id={id} className="campo min-h-[90px]" value={contexto} onChange={(e) => setContexto(e.target.value)} maxLength={8000} />}
      </Field>
      <button type="button" className="btn-primario" disabled={!listo || act.busy}
        onClick={async () => { if ((await act.run(() => pesDesdeBanco(d.practica.id, elegidos, titulo, contexto))) !== undefined) { setElegidos([]); setTitulo(''); setContexto(''); await recargar(); } }}>
        Añadir ejercicio ({elegidos.length} apartados)
      </button>
      <ErrorBox error={act.error} />
    </div>
  );
}

/** Redactar apartados. Con `inicial` y `guardar` sirve para editar una propuesta generada con IA antes de añadirla. */
export function AgregarRedactado({ d, recargar, inicial, guardar, textoBoton = 'Comprobar claves y añadir' }: {
  d: DetallePes; recargar: () => Promise<void>;
  inicial?: { titulo: string; contexto: string; aps: FormApartado[] };
  guardar?: (datos: { titulo: string; contexto: string; apartados: ApartadoRedactado[] }) => Promise<unknown>;
  textoBoton?: string;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [contexto, setContexto] = useState(inicial?.contexto ?? '');
  const [aps, setAps] = useState<FormApartado[]>(inicial?.aps ?? [formVacio('prediccion'), formVacio('resolucion'), formVacio('interpretacion')]);
  const [errores, setErrores] = useState<string[]>([]);
  const act = useAction();
  const cambiar = (i: number, x: Partial<FormApartado>) => setAps(aps.map((a, j) => (j === i ? { ...a, ...x } : a)));
  const enviar = async () => {
    const r = construirEjercicio(aps);
    if (!r.ok) { setErrores(r.errores); return; }
    setErrores([]);
    const datos = { titulo, contexto, apartados: r.apartados };
    if ((await act.run(() => (guardar ? guardar(datos) : pesRedactado(d.practica.id, datos)))) !== undefined) {
      setTitulo(''); setContexto(''); setAps([formVacio('prediccion'), formVacio('resolucion'), formVacio('interpretacion')]); await recargar();
    }
  };
  const iguales = pesosIguales(aps.length);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título del ejercicio">{(id) => <input id={id} className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />}</Field>
        <Field label="Situación común (opcional)">{(id) => <textarea id={id} className="campo" value={contexto} onChange={(e) => setContexto(e.target.value)} maxLength={8000} />}</Field>
      </div>
      {aps.map((a, i) => (
        <fieldset key={i} className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <legend className="px-1 font-semibold">Apartado {String.fromCharCode(65 + i)}</legend>
          <textarea className="campo min-h-[70px]" placeholder="Enunciado (admite Markdown y LaTeX)" value={a.enunciado} onChange={(e) => cambiar(i, { enunciado: e.target.value })} maxLength={8000} />
          <div className="flex flex-wrap gap-2 text-sm">
            <select className="campo w-auto" value={a.formato} onChange={(e) => cambiar(i, { formato: e.target.value as FormatoPes })}>
              {(['numeric', 'choice', 'truefalse', 'text', 'open'] as FormatoPes[]).map((x) => <option key={x} value={x}>{FORMATO[x] ?? x}</option>)}
            </select>
            <select className="campo w-auto" value={a.etapa} onChange={(e) => cambiar(i, { etapa: e.target.value as EtapaPes })}>{ETAPAS.map((x) => <option key={x.id} value={x.id}>{x.t}</option>)}</select>
            <label className="flex items-center gap-1">T_ref <input type="number" min={0.5} step={0.5} className="campo w-20" value={a.minutos} onChange={(e) => cambiar(i, { minutos: Number(e.target.value) })} /> min</label>
            <label className="flex items-center gap-1">Peso <input className="campo w-20" placeholder={iguales[i].toFixed(3)} value={a.peso} onChange={(e) => cambiar(i, { peso: e.target.value })} /></label>
          </div>
          {a.formato === 'numeric' && (
            <div className="flex flex-wrap gap-2 text-sm">
              <input className="campo flex-1 font-mono" placeholder="Valor correcto con unidad, p. ej. 9.8 m/s^2" value={a.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} />
              <label className="flex items-center gap-1">Tolerancia <input className="campo w-16" value={a.tolerancia} onChange={(e) => cambiar(i, { tolerancia: e.target.value })} /> %</label>
            </div>
          )}
          {a.formato === 'choice' && (
            <div className="space-y-1 text-sm">
              <textarea className="campo" placeholder="Una opción por línea" value={a.opciones} onChange={(e) => cambiar(i, { opciones: e.target.value, correctas: [] })} />
              <div className="flex flex-wrap gap-3">
                {a.opciones.split('\n').map((o) => o.trim()).filter(Boolean).map((_, k) => (
                  <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={a.correctas.includes(k)}
                    onChange={() => cambiar(i, { correctas: a.correctas.includes(k) ? a.correctas.filter((x) => x !== k) : [...a.correctas, k] })} />{String.fromCharCode(97 + k)}) correcta</label>
                ))}
                <label className="flex items-center gap-1"><input type="checkbox" checked={a.multiple} onChange={(e) => cambiar(i, { multiple: e.target.checked })} />varias respuestas</label>
              </div>
            </div>
          )}
          {a.formato === 'truefalse' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="radio" checked={a.verdadero === true} onChange={() => cambiar(i, { verdadero: true })} />Verdadera</label>
              <label className="flex items-center gap-1"><input type="radio" checked={a.verdadero === false} onChange={() => cambiar(i, { verdadero: false })} />Falsa</label>
              <input className="campo flex-1" placeholder="Justificación modelo (para la revisión)" value={a.justificacion} onChange={(e) => cambiar(i, { justificacion: e.target.value })} />
            </div>
          )}
          {a.formato === 'text' && <textarea className="campo text-sm" placeholder="Respuestas aceptadas, una por línea" value={a.aceptadas} onChange={(e) => cambiar(i, { aceptadas: e.target.value })} />}
          <textarea className="campo text-sm" placeholder={a.formato === 'open' ? 'Rúbrica (obligatoria; privada)' : 'Rúbrica u observaciones para la revisión (privada, opcional)'}
            value={a.rubrica} onChange={(e) => cambiar(i, { rubrica: e.target.value })} maxLength={4000} />
          <textarea className="campo text-sm" placeholder="Explicación o solución (privada)" value={a.explicacion} onChange={(e) => cambiar(i, { explicacion: e.target.value })} maxLength={8000} />
          {aps.length > 3 && <button type="button" className="enlace text-sm" onClick={() => setAps(aps.filter((_, j) => j !== i))}>Quitar apartado</button>}
        </fieldset>
      ))}
      {aps.length < 5 && <button type="button" className="btn-secundario" onClick={() => setAps([...aps, formVacio('transferencia')])}>Añadir apartado</button>}
      {errores.length > 0 && <Notice tone="warn"><ul className="list-disc pl-4">{errores.map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
      <div><button type="button" className="btn-primario" disabled={act.busy} onClick={enviar}>{textoBoton}</button></div>
      <ErrorBox error={act.error} />
    </div>
  );
}

function Publicar({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const p = d.practica;
  const carga = cargaDe(d, 3);
  const errores = carga.avisos.filter((a) => a.nivel === 'error');
  const [abierto, setAbierto] = useState(false);
  const [algunos, setAlgunos] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const lista = useAsync(() => (algunos ? roster(p.class_id) : Promise.resolve([])), [algunos, p.class_id]);
  const act = useAction();
  const borrarAct = useAction();
  return (
    <Card title="Publicar">
      {errores.length > 0 ? <Notice tone="warn">No se puede publicar todavía: {errores.map((e) => e.texto).join(' ')}</Notice>
        : <p className="text-sm">Al publicar se asigna a los estudiantes y se <strong>congelan</strong> el contenido, las claves, los pesos, los parámetros, la apertura y la liberación.
          La fecha límite solo podrá ampliarse; las adaptaciones individuales se ajustan después.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primario" disabled={errores.length > 0 || d.ejercicios.length === 0} onClick={() => setAbierto(true)}>Publicar…</button>
        <button type="button" className="btn-secundario" disabled={borrarAct.busy} onClick={async () => {
          if (confirm('¿Borrar este borrador? No tiene estudiantes ni respuestas.') && (await borrarAct.run(() => pesBorrar(p.id))) !== undefined) window.location.hash = `#/docente/clases/${p.class_id}?t=pes`;
        }}>Borrar borrador</button>
      </div>
      <ErrorBox error={borrarAct.error} />
      <Modal open={abierto} onClose={() => setAbierto(false)} title="Publicar la práctica">
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={!algunos} onChange={() => setAlgunos(false)} />Todos los estudiantes de la sección</label>
          <label className="flex items-center gap-2"><input type="radio" checked={algunos} onChange={() => setAlgunos(true)} />Solo algunos</label>
          {algunos && (
            <div className="max-h-60 overflow-y-auto rounded border border-gray-200 p-2 dark:border-white/10">
              {(lista.data ?? []).map((s) => (
                <label key={s.user_id} className="flex items-center gap-2"><input type="checkbox" checked={sel.includes(s.user_id)}
                  onChange={() => setSel(sel.includes(s.user_id) ? sel.filter((x) => x !== s.user_id) : [...sel, s.user_id])} />{s.profiles?.full_name || s.profiles?.login_id || s.user_id}</label>
              ))}
            </div>
          )}
          <p>Contenido congelado: {d.ejercicios.length} ejercicios, {d.ejercicios.reduce((s, e) => s + e.apartados.length, 0)} apartados. Cierre: {fecha(p.cierra_at)}.</p>
          <ErrorBox error={act.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
            <button type="button" className="btn-primario" disabled={act.busy || (algunos && sel.length === 0)} onClick={async () => {
              if ((await act.run(() => pesPublicar(p.id, algunos ? sel : null))) !== undefined) { setAbierto(false); await recargar(); }
            }}>Publicar</button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function AccionesPublicada({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const p = d.practica;
  const act = useAction();
  const hacer = async (f: () => Promise<unknown>, pregunta?: string) => { if (pregunta && !confirm(pregunta)) return; if ((await act.run(f)) !== undefined) await recargar(); };
  return (
    <Card title="Práctica publicada">
      <div className="flex flex-wrap gap-2">
        {p.estado === 'publicada' && <button type="button" className="btn-secundario" disabled={act.busy} onClick={() => hacer(() => pesCambiarEstado(p.id, 'cerrada'), '¿Cerrar la práctica? Nadie podrá seguir respondiendo.')}>Cerrar práctica</button>}
        {p.estado !== 'archivada' && <button type="button" className="btn-secundario" disabled={act.busy} onClick={() => hacer(() => pesCambiarEstado(p.id, 'archivada'), '¿Archivar la práctica?')}>Archivar</button>}
        <button type="button" className="btn-secundario" disabled={act.busy} onClick={() => hacer(() => pesPublicarResultados(p.id, !p.resultados_publicados))}>
          {p.resultados_publicados ? 'Retirar resultados' : 'Publicar resultados a los estudiantes'}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Versión {p.version}. Los resultados publicados muestran a cada estudiante su puntuación validada, provisional y máxima alcanzable (nunca las claves).</p>
      <ErrorBox error={act.error} />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Estudiantes: adaptaciones, validación y puntuaciones
// ---------------------------------------------------------------------------------------------------------------
const ESTADO_EST: Record<string, string> = {
  no_iniciada: 'Sin empezar', apartado_abierto: 'En curso', esperando_liberacion: 'Esperando bloque', completada: 'Terminada', vencida: 'Plazo terminado',
};

function TabEstudiantes({ d, recargar }: { d: DetallePes; recargar: () => Promise<void> }) {
  const [adaptar, setAdaptar] = useState<AsignacionPes | null>(null);
  const act = useAction();
  const sinValidar = d.asignaciones.reduce((s, a) => s + a.puntaje.sin_validar - a.puntaje.pendientes_revision, 0);
  return (
    <div className="space-y-3">
      <Notice>La <strong>provisional</strong> incluye todo lo calificado (lo pendiente de revisión cuenta 0); la <strong>validada</strong>, solo lo que usted validó o revisó;
        la <strong>máxima alcanzable</strong> suma lo pendiente y lo que el estudiante aún puede responder a tiempo. Tiempos breves o avances anticipados son
        indicadores para revisar, no pruebas de fraude.</Notice>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secundario" disabled={act.busy || sinValidar <= 0}
          onClick={async () => { if ((await act.run(() => pesValidar(d.practica.id))) !== undefined) await recargar(); }}>
          Validar todas las calificaciones automáticas ({Math.max(0, sinValidar)})
        </button>
      </div>
      <ErrorBox error={act.error} />
      <div className="overflow-x-auto">
        <table className={TABLA}>
          <thead><tr><th>Estudiante</th><th>Estado</th><th>Cerrados</th><th>Anticip. / omit.</th><th>Validada</th><th>Provisional</th><th>Máxima</th><th>Adaptación</th><th /></tr></thead>
          <tbody>{d.asignaciones.map((a) => (
            <tr key={a.user_id}>
              <td>{a.nombre || '(sin nombre)'}<span className="block text-xs text-gray-500">{a.codigo ?? ''}</span></td>
              <td>{ESTADO_EST[a.estado ?? 'no_iniciada']}</td>
              <td>{a.puntaje.cerrados}/{a.puntaje.apartados}</td>
              <td>{a.puntaje.anticipados} / {a.puntaje.omitidos}</td>
              <td>{pts(a.puntaje.validada.P)}{a.puntaje.validada.completa && ' ✓'}</td>
              <td>{pts(a.puntaje.provisional.P)}{a.puntaje.pendientes_revision > 0 && <span className="block text-xs text-amber-700">{a.puntaje.pendientes_revision} por revisar</span>}</td>
              <td>{pts(a.puntaje.maxima_alcanzable.P)}</td>
              <td className="text-xs">{[a.tiempo_extra_min ? `+${a.tiempo_extra_min} min de plazo` : '', a.factor_espera < 1 ? `espera × ${a.factor_espera}` : '', a.pegado_permitido ? 'pegado permitido' : ''].filter(Boolean).join(' · ') || '—'}</td>
              <td className="whitespace-nowrap">
                <button type="button" className="enlace text-sm" onClick={() => setAdaptar(a)}>Adaptar</button>{' · '}
                <button type="button" className="enlace text-sm" disabled={act.busy} onClick={async () => { if ((await act.run(() => pesValidar(d.practica.id, a.user_id))) !== undefined) await recargar(); }}>Validar</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {adaptar && <ModalAdaptacion practica={d.practica.id} a={adaptar} onClose={() => setAdaptar(null)} recargar={recargar} />}
    </div>
  );
}

function ModalAdaptacion({ practica, a, onClose, recargar }: { practica: string; a: AsignacionPes; onClose: () => void; recargar: () => Promise<void> }) {
  const [f, setF] = useState({ extra: a.tiempo_extra_min, espera: a.factor_espera, pegado: a.pegado_permitido, nota: a.nota_adaptacion ?? '' });
  const act = useAction();
  return (
    <Modal open onClose={onClose} title={`Adaptación · ${a.nombre}`}>
      <div className="space-y-3 text-sm">
        <Field label="Tiempo adicional (minutos de plazo)" hint="Amplía su fecha límite personal. No cambia la espera mínima de cada apartado.">
          {(id) => <input id={id} type="number" min={0} max={20160} className="campo w-32" value={f.extra} onChange={(e) => setF({ ...f, extra: Math.max(0, Number(e.target.value) || 0) })} />}
        </Field>
        <Field label="Espera mínima por apartado" hint="Una adaptación solo puede reducirla, nunca alargarla.">
          {(id) => (
            <select id={id} className="campo w-auto" value={f.espera} onChange={(e) => setF({ ...f, espera: Number(e.target.value) })}>
              {[1, 0.75, 0.5, 0.25, 0].map((x) => <option key={x} value={x}>{x === 1 ? 'Normal' : x === 0 ? 'Sin espera mínima' : `${x * 100} % de la normal`}</option>)}
            </select>
          )}
        </Field>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.pegado} onChange={(e) => setF({ ...f, pegado: e.target.checked })} />
          Permitir pegar y arrastrar (tecnología de asistencia, dictado externo u otra necesidad acreditada)</label>
        <Field label="Motivo (queda en el registro)">{(id) => <input id={id} className="campo" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} maxLength={500} />}</Field>
        <ErrorBox error={act.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primario" disabled={act.busy} onClick={async () => {
            if ((await act.run(() => pesAdaptacion(practica, a.user_id, { tiempo_extra_min: f.extra, factor_espera: f.espera, pegado: f.pegado, nota: f.nota }))) !== undefined) { onClose(); await recargar(); }
          }}>Guardar adaptación</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Revisión docente
// ---------------------------------------------------------------------------------------------------------------
function textoRespuesta(r: RespuestaDocente): string {
  const a = r.respuesta;
  if (!a) return r.accion === 'omitida' ? '(omitido)' : '—';
  if (a.selected) return `Opción ${a.selected.map((i) => String.fromCharCode(97 + i)).join(', ')}`;
  if (typeof a.value === 'boolean') return `${a.value ? 'Verdadero' : 'Falso'}${a.justification ? ` — ${a.justification}` : ''}`;
  return a.text ?? '—';
}

function TabRevision({ practica, recargar }: { practica: string; recargar: () => Promise<void> }) {
  const [todas, setTodas] = useState(false);
  const rs = useAsync(() => pesRespuestasDocente(practica, !todas), [practica, todas]);
  const xs = useMemo(() => (rs.data ?? []).filter((r) => r.accion !== 'omitida'), [rs.data]);
  if (rs.loading && !rs.data) return <Spinner />;
  if (rs.error) return <ErrorBox error={rs.error} onRetry={rs.reload} />;
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
        Mostrar también las calificadas automáticamente (para una corrección justificada)</label>
      {xs.length === 0 ? <Empty>{todas ? 'No hay respuestas.' : 'No hay respuestas pendientes de revisión.'}</Empty>
        : xs.map((r) => <FilaRevision key={r.id} r={r} onHecho={async () => { await rs.reload(); await recargar(); }} />)}
    </div>
  );
}

function FilaRevision({ r, onHecho }: { r: RespuestaDocente; onHecho: () => Promise<void> }) {
  const [q, setQ] = useState(String(r.revision === 'pendiente' ? '' : r.q));
  const [nota, setNota] = useState(r.nota_revision ?? '');
  const act = useAction();
  return (
    <Card title={<>{r.nombre} · Ejercicio {r.ejercicio}, apartado {r.letra} <Badge tone={r.revision === 'pendiente' ? 'amber' : r.validada ? 'green' : 'gray'}>{r.revision === 'pendiente' ? 'Pendiente' : r.revision === 'revisada' ? 'Revisada' : r.validada ? 'Validada' : 'Automática'}</Badge></>}>
      <p className="text-sm text-gray-600 dark:text-gray-300"><InlineMd>{r.enunciado.length > 300 ? `${r.enunciado.slice(0, 300)}…` : r.enunciado}</InlineMd></p>
      {r.rubrica && <p className="mt-1 text-xs"><strong>Rúbrica:</strong> {r.rubrica}</p>}
      <p className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm dark:bg-white/5">{textoRespuesta(r)}</p>
      <p className="mt-1 text-xs text-gray-500">{Math.round(r.segundos)} s (espera mínima {Math.round(r.t_min_s)} s) · {r.accion === 'anticipada' ? `anticipada, m = ${r.m}` : 'a tiempo'} · calidad actual {r.q}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
        <label>Calidad (0 a 1)<input className="campo w-24" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="flex-1">Justificación<input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} /></label>
        <button type="button" className="btn-primario" disabled={act.busy || q.trim() === '' || !nota.trim()}
          onClick={async () => { if ((await act.run(() => pesRevisar(r.id, Number(q.replace(',', '.')), nota))) !== undefined) await onHecho(); }}>Guardar revisión</button>
      </div>
      <ErrorBox error={act.error} />
    </Card>
  );
}
