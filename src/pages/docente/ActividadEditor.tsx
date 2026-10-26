import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  activityAttempts,
  activityItems,
  activityStats,
  copyActivityToClasses,
  deleteActivity,
  finalizeActivity,
  getActivity,
  getClass,
  listExercises,
  listGroups,
  roster,
  setActivityItems,
  teacherOverview,
  updateActivity,
} from '@/api/docente';
import { getLessonList } from '@/api/estudiante';
import type { Activity, Exercise, RevealPolicy } from '@/api/tipos';
import { aInputFecha, CATEGORIA, deInputFecha, DIFICULTAD, downloadText, fecha, porcentaje, puntaje, toCsv, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { EditorMarkdown } from '@/components/EditorMarkdown';
import { analizarTexto, formatoTiempo, MAX_SEGUNDOS, MIN_SEGUNDOS, segundosSugeridos } from '@/lib/lectura';

/** Lectura cronometrada previa a los ejercicios: texto y tiempo mínimo (con sugerencia según el texto). */
function LecturaEditor({ draft, set }: { draft: Activity; set: (p: Partial<Activity>) => void }) {
  const activa = !!draft.reading_min_seconds;
  const texto = draft.reading_text ?? '';
  const sugerido = texto.trim() ? segundosSugeridos(texto) : null;
  const { palabras, formulasBloque } = analizarTexto(texto);
  return (
    <div className="my-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={activa} onChange={(e) => set({ reading_min_seconds: e.target.checked ? sugerido ?? 300 : null })} />
        Lectura cronometrada antes de los ejercicios
      </label>
      {activa && (
        <>
          <p className="mt-1 text-xs text-gray-500">
            El estudiante debe leer durante el tiempo mínimo antes de poder empezar los ejercicios. Si sale de la plataforma, el tiempo se detiene.
          </p>
          <EditorMarkdown label="Texto de la lectura" value={texto} onChange={(v) => set({ reading_text: v })} rows={12} />
          <Field label="Tiempo mínimo de lectura (minutos)"
            hint={sugerido ? `Sugerido: ${formatoTiempo(sugerido)} min (${palabras} palabras, ${formulasBloque} fórmulas destacadas, a 130 palabras por minuto).` : 'Escriba el texto para ver una sugerencia.'}>
            {(id) => (
              <div className="flex items-center gap-2">
                <input id={id} type="number" min={0.5} max={120} step={0.5} className="campo w-28"
                  value={(draft.reading_min_seconds ?? 0) / 60}
                  onChange={(e) => set({ reading_min_seconds: Math.round(Number(e.target.value) * 60) || null })} />
                {sugerido && <button type="button" className="btn-texto text-xs" onClick={() => set({ reading_min_seconds: sugerido })}>Usar el sugerido</button>}
              </div>
            )}
          </Field>
        </>
      )}
    </div>
  );
}

type Tab = 'config' | 'ejercicios' | 'resultados';

const CODE_LABEL: Record<string, string> = {
  unit_mismatch: 'unidad de otra magnitud',
  missing_unit: 'sin unidad',
  sign: 'signo cambiado',
  kmh: 'conversión km/h–m/s',
  time_conversion: 'conversión de tiempo',
  power_of_ten: 'potencia de 10',
  factor_two: 'factor 2',
  mass_weight: 'masa/peso',
  common_error: 'error típico previsto',
  wrong_value: 'valor incorrecto',
  wrong_option: 'opción incorrecta',
  sig_figs: 'cifras significativas',
  blank: 'sin responder',
  expected_unit: 'unidad no pedida',
};

export default function ActividadEditor() {
  const { activityId = '' } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('config');
  const st = useAsync(async () => {
    const act = await getActivity(activityId);
    const cls = await getClass(act.class_id);
    const [items, groups, lessons] = await Promise.all([activityItems(activityId), listGroups(cls.id), getLessonList(cls.course_id)]);
    const exercises = items.length ? await listExercises({ courseId: cls.course_id }) : [];
    return { act, cls, items, groups, lessons, exercises };
  }, [activityId]);
  const [draft, setDraft] = useState<Activity | null>(null);
  const action = useAction();
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (st.data) setDraft(st.data.act); }, [st.data]);
  if (st.loading || !draft) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const { act, cls, groups, lessons } = st.data!;
  const set = (p: Partial<Activity>) => { setSaved(false); setDraft({ ...draft, ...p }); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(act);
  async function guardar() {
    const d = draft!;
    if (d.mode === 'exam' && d.reveal_policy === 'immediate') return action.setError('En una evaluación no puede mostrarse la solución de inmediato.');
    if (d.opens_at && d.closes_at && new Date(d.closes_at) <= new Date(d.opens_at)) return action.setError('El cierre debe ser posterior a la apertura.');
    if (d.reveal_policy === 'after_close' && !d.closes_at) return action.setError('Para mostrar las respuestas después del cierre, indique una fecha de cierre.');
    if (d.reading_min_seconds && !d.reading_text?.trim()) return action.setError('Escriba el texto de la lectura o desactive la lectura cronometrada.');
    if (d.reading_min_seconds && (d.reading_min_seconds < MIN_SEGUNDOS || d.reading_min_seconds > MAX_SEGUNDOS)) return action.setError('El tiempo de lectura debe estar entre 30 segundos y 2 horas.');
    const { title, instructions, mode, opens_at, closes_at, max_attempts, max_tries_per_item, reveal_policy, hints_enabled, published, grades_published, group_id, lesson_id } = d;
    // solo se envían las columnas de lectura si se usan, para no fallar antes de aplicar la migración 10
    const lectura = d.reading_min_seconds || act.reading_min_seconds
      ? { reading_text: d.reading_min_seconds ? d.reading_text : null, reading_min_seconds: d.reading_min_seconds || null }
      : {};
    const r = await action.run(() => updateActivity(activityId, {
      title, instructions, mode, opens_at, closes_at, max_attempts, max_tries_per_item, reveal_policy,
      hints_enabled: mode === 'exam' ? false : hints_enabled, published, grades_published, group_id, lesson_id, ...lectura,
    }));
    if (r) { setSaved(true); st.setData({ ...st.data!, act: r }); }
  }
  return (
    <div>
      <PageTitle title={act.title} subtitle={<>{cls.name} · <Badge tone={act.mode === 'exam' ? 'purple' : 'blue'}>{act.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge> {act.published ? <Badge tone="green">Visible para estudiantes</Badge> : <Badge>Borrador</Badge>}</>}
        back={{ to: `/docente/clases/${cls.id}?t=actividades`, label: cls.name }} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to={`/docente/actividades/${activityId}/vista-previa`} className="btn-secundario">👁 Vista previa como estudiante</Link>
        {dirty && <span className="text-xs text-amber-700 dark:text-amber-300">Guarde los cambios para verlos en la vista previa.</span>}
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'config', label: 'Configuración' }, { id: 'ejercicios', label: `Ejercicios (${st.data!.items.length})` }, { id: 'resultados', label: 'Resultados y estadísticas' }]} />
      <ErrorBox error={action.error} />
      {tab === 'config' && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título">{(id) => <input id={id} className="campo" value={draft.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
            <Field label="Modalidad">
              {(id) => (
                <select id={id} className="campo" value={draft.mode} onChange={(e) => {
                  const mode = e.target.value as Activity['mode'];
                  set({ mode, reveal_policy: mode === 'exam' && draft.reveal_policy === 'immediate' ? 'after_close' : draft.reveal_policy, hints_enabled: mode === 'practice' });
                }}>
                  <option value="practice">Práctica de aprendizaje (varios intentos, pistas, retroalimentación)</option>
                  <option value="exam">Evaluación calificable (sin pistas, se califica al entregar)</option>
                </select>
              )}
            </Field>
            <Field label="Apertura">{(id) => <input id={id} type="datetime-local" className="campo" value={aInputFecha(draft.opens_at)} onChange={(e) => set({ opens_at: deInputFecha(e.target.value) })} />}</Field>
            <Field label="Cierre (fecha de entrega)">{(id) => <input id={id} type="datetime-local" className="campo" value={aInputFecha(draft.closes_at)} onChange={(e) => set({ closes_at: deInputFecha(e.target.value) })} />}</Field>
            <Field label="Intentos permitidos" hint="Vacío = ilimitados">
              {(id) => <input id={id} type="number" min={1} max={50} className="campo" value={draft.max_attempts ?? ''} onChange={(e) => set({ max_attempts: e.target.value === '' ? null : Number(e.target.value) })} />}
            </Field>
            {draft.mode === 'practice' && (
              <Field label="Intentos por ejercicio (práctica)">
                {(id) => <input id={id} type="number" min={1} max={20} className="campo" value={draft.max_tries_per_item} onChange={(e) => set({ max_tries_per_item: Number(e.target.value) })} />}
              </Field>
            )}
            <Field label="Visualización de respuestas correctas">
              {(id) => (
                <select id={id} className="campo" value={draft.reveal_policy} onChange={(e) => set({ reveal_policy: e.target.value as RevealPolicy })}>
                  {draft.mode === 'practice' && <option value="immediate">Inmediata, al comprobar cada ejercicio</option>}
                  <option value="after_submit">Al entregar el intento</option>
                  <option value="after_close">Después del cierre</option>
                  <option value="never">Nunca</option>
                </select>
              )}
            </Field>
            <Field label="Destinatarios">
              {(id) => (
                <select id={id} className="campo" value={draft.group_id ?? ''} onChange={(e) => set({ group_id: e.target.value || null })}>
                  <option value="">Toda la clase</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>Solo el grupo {g.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Lección asociada (opcional)">
              {(id) => (
                <select id={id} className="campo" value={draft.lesson_id ?? ''} onChange={(e) => set({ lesson_id: e.target.value || null })}>
                  <option value="">—</option>
                  {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              )}
            </Field>
          </div>
          {draft.mode === 'practice' && draft.reveal_policy === 'immediate' && (
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hints_enabled} onChange={(e) => set({ hints_enabled: e.target.checked })} /> Permitir pistas</label>
          )}
          {draft.mode === 'practice' && draft.reveal_policy !== 'immediate' && (
            <Notice>Sin retroalimentación inmediata, la práctica funciona como una tarea: el estudiante guarda y entrega, y se califica al entregar.</Notice>
          )}
          <EditorMarkdown label="Instrucciones para el estudiante" value={draft.instructions} onChange={(v) => set({ instructions: v })} rows={4} />
          <LecturaEditor draft={draft} set={set} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.published} onChange={(e) => set({ published: e.target.checked })} /> Visible para los estudiantes</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.grades_published} onChange={(e) => set({ grades_published: e.target.checked })} /> Calificaciones publicadas</label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-primario" disabled={!dirty || action.busy} onClick={guardar}>Guardar</button>
            {saved && !dirty && <span className="text-sm text-emerald-700">Guardado ✓</span>}
            <button className="btn-peligro ml-auto" onClick={async () => {
              if (!window.confirm('¿Borrar la actividad con todos sus intentos y respuestas? Esta acción no se puede deshacer.')) return;
              if (await action.run(async () => { await deleteActivity(activityId); return true; })) nav(`/docente/clases/${cls.id}?t=actividades`);
            }}>Borrar actividad</button>
          </div>
        </Card>
      )}
      {tab === 'config' && <CopiarASecciones activityId={activityId} courseId={cls.course_id} classId={cls.id} />}
      {tab === 'ejercicios' && <TabEjercicios activityId={activityId} courseId={cls.course_id} lessons={lessons} initial={st.data!.items} initialExercises={st.data!.exercises} onSaved={st.reload} />}
      {tab === 'resultados' && <TabResultados act={act} classId={cls.id} />}
    </div>
  );
}

/** Comparte la actividad con otras secciones de la misma asignatura: cada una recibe una copia con sus propias notas. */
function CopiarASecciones({ activityId, courseId, classId }: { activityId: string; courseId: string; classId: string }) {
  const secs = useAsync(teacherOverview, []);
  const [sel, setSel] = useState<string[]>([]);
  const [hecho, setHecho] = useState<number | null>(null);
  const action = useAction();
  const otras = (secs.data ?? []).filter((s) => s.course_id === courseId && s.class_id !== classId && !s.archived);
  if (!otras.length) return null;
  return (
    <Card title="Usar esta actividad en otras secciones" className="mt-4">
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
        Se crea una copia en cada sección elegida, con los mismos ejercicios y fechas. Las copias quedan como borrador: revíselas
        (por ejemplo, el grupo destinatario) y publíquelas. Cada sección mantiene sus propias calificaciones.
      </p>
      <div className="mb-3 flex flex-wrap gap-3">
        {otras.map((s) => (
          <label key={s.class_id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sel.includes(s.class_id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.class_id] : sel.filter((x) => x !== s.class_id))} />
            {s.name} <span className="text-gray-500">({s.students} est.)</span>
          </label>
        ))}
      </div>
      <ErrorBox error={action.error} />
      <button className="btn-secundario" disabled={!sel.length || action.busy} onClick={async () => {
        const r = await action.run(() => copyActivityToClasses(activityId, sel));
        if (r) {
          setHecho(r.length);
          setSel([]);
        }
      }}>Copiar a {sel.length || ''} {sel.length === 1 ? 'sección' : 'secciones'}</button>
      {hecho !== null && <p className="mt-2 text-sm text-emerald-700">✔ Se crearon {hecho} copias como borrador. Están en la pestaña «Actividades» de cada sección.</p>}
    </Card>
  );
}

function TabEjercicios({ activityId, courseId, lessons, initial, initialExercises, onSaved }: {
  activityId: string; courseId: string; lessons: { id: string; title: string }[];
  initial: { exercise_id: string; points: number | null }[]; initialExercises: Exercise[]; onSaved: () => void;
}) {
  const [items, setItems] = useState(initial.map((i) => ({ exercise_id: i.exercise_id, points: i.points })));
  const [lessonF, setLessonF] = useState('');
  const [diffF, setDiffF] = useState('');
  const pool = useAsync(() => listExercises({ courseId, lessonId: lessonF || undefined, difficulty: diffF || undefined }), [courseId, lessonF, diffF]);
  const known = useMemo(() => {
    const m = new Map<string, Exercise>();
    initialExercises.forEach((e) => m.set(e.id, e));
    pool.data?.forEach((e) => m.set(e.id, e));
    return m;
  }, [initialExercises, pool.data]);
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial.map((i) => ({ exercise_id: i.exercise_id, points: i.points })));
  const total = items.reduce((s, it) => s + Number(it.points ?? known.get(it.exercise_id)?.points ?? 1), 0);
  const inSet = new Set(items.map((i) => i.exercise_id));
  const mv = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    setItems(n);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`Ejercicios de la actividad · ${total} puntos`}>
        <Notice tone="warn">Si ya hay intentos, cambiar los ejercicios afecta a la calificación de los intentos nuevos; los entregados conservan sus respuestas.</Notice>
        {items.length ? (
          <ol className="space-y-2">
            {items.map((it, i) => {
              const e = known.get(it.exercise_id);
              return (
                <li key={it.exercise_id} className="rounded border border-gray-200 p-2 text-sm dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{i + 1}.</span>
                    <Link className="enlace font-mono" to={`/docente/ejercicios/${it.exercise_id}`}>{e?.slug ?? it.exercise_id.slice(0, 8)}</Link>
                    {e && <Badge>{DIFICULTAD[e.difficulty]}</Badge>}
                    {e?.format === 'open' && <Badge tone="blue">Revisión manual</Badge>}
                    <label className="ml-auto flex items-center gap-1 text-xs">Puntos
                      <input type="number" min={0.25} step={0.25} className="campo w-20 px-2 py-0.5" value={it.points ?? e?.points ?? 1}
                        onChange={(ev) => setItems(items.map((x, j) => (j === i ? { ...x, points: Number(ev.target.value) } : x)))} />
                    </label>
                    <button className="btn-texto px-1 text-xs" onClick={() => mv(i, -1)} aria-label="Subir">↑</button>
                    <button className="btn-texto px-1 text-xs" onClick={() => mv(i, 1)} aria-label="Bajar">↓</button>
                    <button className="btn-texto px-1 text-xs text-red-700" onClick={() => setItems(items.filter((_, j) => j !== i))}>Quitar</button>
                  </div>
                  {e && <p className="mt-1 line-clamp-2 text-gray-600 dark:text-gray-400">{e.prompt.replace(/[#*$\\]/g, '').slice(0, 160)}</p>}
                </li>
              );
            })}
          </ol>
        ) : (
          <Empty>Añada ejercicios desde el banco.</Empty>
        )}
        <ErrorBox error={action.error} />
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primario" disabled={!dirty || action.busy} onClick={async () => {
            const ok = await action.run(async () => { await setActivityItems(activityId, items); return true; });
            if (ok) { setSaved(true); onSaved(); }
          }}>Guardar ejercicios</button>
          {saved && !dirty && <span className="text-sm text-emerald-700">Guardado ✓</span>}
        </div>
      </Card>
      <Card title="Banco de ejercicios">
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <select className="campo" value={lessonF} onChange={(e) => setLessonF(e.target.value)} aria-label="Lección">
            <option value="">Todas las lecciones</option>
            <option value="none">Sin lección</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <select className="campo" value={diffF} onChange={(e) => setDiffF(e.target.value)} aria-label="Dificultad">
            <option value="">Toda dificultad</option>
            {Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {pool.loading ? <Spinner /> : (
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
            {pool.data?.filter((e) => e.published).map((e) => (
              <li key={e.id} className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                <button className="btn-secundario min-h-[32px] px-2 py-0 text-xs" disabled={inSet.has(e.id)} onClick={() => setItems([...items, { exercise_id: e.id, points: null }])}>
                  {inSet.has(e.id) ? 'Añadido' : 'Añadir'}
                </button>
                <span className="flex-1">
                  <span className="font-mono text-xs">{e.slug}</span> · {DIFICULTAD[e.difficulty]} · {CATEGORIA[e.category]}
                  <span className="block line-clamp-1 text-gray-600 dark:text-gray-400">{e.prompt.replace(/[#*$\\]/g, '').slice(0, 120)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TabResultados({ act, classId }: { act: Activity; classId: string }) {
  const st = useAsync(async () => {
    const [attempts, students, stats] = await Promise.all([activityAttempts(act.id), roster(classId), activityStats(act.id)]);
    return { attempts, students, stats };
  }, [act.id]);
  const action = useAction();
  const [msg, setMsg] = useState<string | null>(null);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const { attempts, students, stats } = st.data!;
  const name = (u: string) => students.find((s) => s.user_id === u)?.profiles?.full_name ?? 'Estudiante dado de baja';
  const open = attempts.filter((a) => a.status === 'in_progress');
  const closed = act.closes_at && new Date(act.closes_at) <= new Date();
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-sm text-gray-500">Matriculados</p><p className="text-2xl font-semibold">{stats.summary.enrolled}</p></Card>
        <Card><p className="text-sm text-gray-500">Entregaron</p><p className="text-2xl font-semibold">{stats.summary.students_submitted}</p></Card>
        <Card><p className="text-sm text-gray-500">Intentos entregados</p><p className="text-2xl font-semibold">{stats.summary.attempts}</p></Card>
        <Card><p className="text-sm text-gray-500">Media (mejor intento)</p><p className="text-2xl font-semibold">{stats.summary.mean_best ?? '—'}</p></Card>
      </div>
      {open.length > 0 && (
        <Notice tone={closed ? 'warn' : 'info'}>
          Hay {open.length} intentos sin entregar.{' '}
          {closed ? 'La actividad ya cerró: puede entregarlos y calificarlos con lo que guardaron a tiempo.' : 'Si los entrega ahora, los estudiantes no podrán seguir respondiendo en ese intento.'}{' '}
          <button className="btn-secundario ml-2 text-sm" disabled={action.busy} onClick={async () => {
            if (!window.confirm(`¿Entregar y calificar los ${open.length} intentos abiertos?`)) return;
            const r = await action.run(() => finalizeActivity(act.id));
            if (r) { setMsg(`Se calificaron ${r.finalized} intentos.${r.errors.length ? ' Errores: ' + r.errors.join('; ') : ''}`); await st.reload(); }
          }}>Entregar y calificar</button>
        </Notice>
      )}
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={action.error} />
      <Card title="Análisis por pregunta">
        {stats.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">#</th><th className="py-1 pr-2">Ejercicio</th><th className="py-1 pr-2">Respondida</th><th className="py-1 pr-2">Correctas</th><th className="py-1 pr-2">Crédito medio</th><th className="py-1">Errores más frecuentes</th></tr></thead>
              <tbody>
                {stats.items.map((it, i) => (
                  <tr key={it.exercise_id} className="border-t border-gray-100 align-top dark:border-white/10">
                    <td className="py-2 pr-2">{i + 1}</td>
                    <td className="py-2 pr-2"><Link className="enlace font-mono text-xs" to={`/docente/ejercicios/${it.exercise_id}`}>{it.slug}</Link><span className="block text-xs text-gray-500">{DIFICULTAD[it.difficulty]}</span></td>
                    <td className="py-2 pr-2 tabular-nums">{it.answered}</td>
                    <td className="py-2 pr-2 tabular-nums">{it.answered ? `${it.correct} (${porcentaje(it.correct / it.answered)})` : '—'}{act.mode === 'practice' && it.answered > 0 && <span className="block text-xs text-gray-500">1.er intento: {porcentaje(it.first_try / it.answered)}</span>}</td>
                    <td className="py-2 pr-2 tabular-nums">{porcentaje(it.mean_credit)}</td>
                    <td className="py-2 text-xs">{Object.entries(it.codes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${CODE_LABEL[c] ?? c} (${n})`).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>La actividad no tiene ejercicios.</Empty>}
      </Card>
      <Card title="Intentos" actions={attempts.length > 0 && (
        <button className="btn-texto text-sm" onClick={() => downloadText(`intentos-${act.title}.csv`, toCsv([
          ['Estudiante', 'Intento', 'Estado', 'Inicio', 'Entrega', 'Puntaje', 'Máximo', 'Revisión pendiente'],
          ...attempts.map((a) => [name(a.user_id), a.attempt_number, a.status === 'submitted' ? 'entregado' : 'en curso', fecha(a.started_at), fecha(a.submitted_at),
            a.score === null ? '' : String(a.score).replace('.', ','), a.max_score === null ? '' : String(a.max_score).replace('.', ','), a.needs_review ? 'sí' : 'no']),
        ]))}>Exportar CSV</button>
      )}>
        {attempts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">Estudiante</th><th className="py-1 pr-2">Intento</th><th className="py-1 pr-2">Entrega</th><th className="py-1 pr-2">Puntaje</th><th /></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-2 pr-2">{name(a.user_id)}</td>
                    <td className="py-2 pr-2">{a.attempt_number}</td>
                    <td className="py-2 pr-2">{a.status === 'submitted' ? fecha(a.submitted_at) : <Badge tone="amber">En curso</Badge>}</td>
                    <td className="py-2 pr-2 tabular-nums">{puntaje(a.score, a.max_score)} {a.needs_review && <Badge tone="red">Revisar</Badge>}</td>
                    <td className="py-2 text-right"><Link className="enlace" to={`/docente/intentos/${a.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nadie ha empezado esta actividad.</Empty>}
      </Card>
    </div>
  );
}
