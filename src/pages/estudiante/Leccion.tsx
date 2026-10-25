import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { guardarUltimaLeccion } from '@/lib/ultimaLeccion';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getExercise, getLesson, getLessonList, getUnits, restartLessonPractice, startLessonPractice, getAttempt } from '@/api/estudiante';
import type { AttemptItem, AttemptView, Formula, Lesson, WorkedExample } from '@/api/tipos';
import { useAsync } from '@/lib/util';
import { Markdown, Tex } from '@/components/Markdown';
import { Badge, Card, Empty, ErrorBox, PageTitle, ProgressBar, Spinner, Tabs } from '@/components/ui';
import { Ejercicio } from '@/components/Ejercicio';
import { Simulador } from '@/sims/Simulador';

type Seccion = 'teoria' | 'formulas' | 'ejemplos' | 'simulacion' | 'practica';

export function FormulaCard({ f }: { f: Formula }) {
  return (
    <Card>
      <h3 className="mb-1 font-semibold">{f.name}</h3>
      <div className="my-2 overflow-x-auto rounded-lg bg-primario-50 py-3 text-center dark:bg-white/5">
        <Tex display>{f.latex}</Tex>
      </div>
      <Markdown className="text-sm">{f.description}</Markdown>
      {f.variables.length > 0 && (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-1 pr-2">Símbolo</th>
              <th className="py-1 pr-2">Significado</th>
              <th className="py-1">Unidad SI</th>
            </tr>
          </thead>
          <tbody>
            {f.variables.map((v, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-white/10">
                <td className="py-1 pr-2"><Tex>{v.symbol}</Tex></td>
                <td className="py-1 pr-2">{v.meaning}</td>
                <td className="py-1">{v.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {f.notes && <Markdown className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.notes}</Markdown>}
    </Card>
  );
}

export function EjemploResuelto({ ex, n }: { ex: WorkedExample; n: number }) {
  const [shown, setShown] = useState(0);
  const all = shown >= ex.steps.length;
  return (
    <Card title={`Ejemplo ${n}. ${ex.title}`}>
      <Markdown>{ex.statement}</Markdown>
      {shown === 0 && <p className="mt-2 text-sm text-gray-500">Intente plantearlo antes de ver la solución.</p>}
      <ol className="mt-3 space-y-2">
        {ex.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento-200 text-xs font-semibold text-acento-700">{i + 1}</span>
            <Markdown className="flex-1">{s}</Markdown>
          </li>
        ))}
      </ol>
      {all ? (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <p className="text-sm font-semibold">Resultado</p>
          <Markdown>{ex.result}</Markdown>
          {ex.interpretation && (
            <>
              <p className="mt-2 text-sm font-semibold">Interpretación</p>
              <Markdown>{ex.interpretation}</Markdown>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secundario" onClick={() => setShown((s) => s + 1)}>Ver paso {shown + 1} de {ex.steps.length}</button>
          <button className="btn-texto" onClick={() => setShown(ex.steps.length)}>Ver la solución completa</button>
        </div>
      )}
    </Card>
  );
}

function PracticaLeccion({ lesson }: { lesson: Lesson }) {
  const [params] = useSearchParams();
  const refuerzo = params.get('refuerzo');
  const [restarting, setRestarting] = useState(false);
  const st = useAsync(async () => {
    const id = await startLessonPractice(lesson.id);
    const view = await getAttempt(id);
    if (refuerzo && !view.items.some((i) => i.exercise.id === refuerzo)) {
      try {
        const ex = await getExercise(refuerzo);
        if (ex.lesson_id === lesson.id) {
          view.items.push({ exercise: ex, points: ex.points, response: null, hints: null, hints_total: 1, locked: false, solution: null });
        }
      } catch {
        /* el ejercicio de refuerzo no está disponible */
      }
    }
    return view;
  }, [lesson.id, refuerzo]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const view = st.data as AttemptView;
  const update = (i: number) => (it: AttemptItem) => {
    const items = [...view.items];
    items[i] = it;
    st.setData({ ...view, items });
  };
  const cerrados = view.items.filter((i) => i.locked || i.response?.status === 'correct').length;
  const correctos = view.items.filter((i) => i.response?.status === 'correct').length;
  async function reiniciar() {
    if (!window.confirm('Se abrirá una práctica nueva con los ejercicios en blanco. Su historial se conserva para el seguimiento del progreso. ¿Continuar?')) return;
    setRestarting(true);
    try {
      await restartLessonPractice(lesson.id);
      await st.reload();
    } finally {
      setRestarting(false);
    }
  }
  if (!view.items.length) return <Empty>Esta lección todavía no tiene ejercicios de práctica.</Empty>;
  return (
    <div className="space-y-4">
      <div className="tarjeta">
        <ProgressBar value={cerrados / view.items.length} label={`Ejercicios cerrados: ${cerrados} de ${view.items.length} · correctos: ${correctos}`} />
        <p className="mt-2 text-xs text-gray-500">
          Tiene {view.flags.max_tries} intentos por ejercicio. Las pistas y los reintentos reducen un poco el puntaje del ejercicio, y ver la
          solución lo cierra. Si falla, se le ofrecerán problemas similares de refuerzo.
        </p>
        {cerrados === view.items.length && (
          <button className="btn-secundario mt-3" onClick={reiniciar} disabled={restarting}>Practicar de nuevo desde cero</button>
        )}
      </div>
      {view.items.map((it, i) => (
        <Ejercicio key={it.exercise.id} index={i} item={it} view={view} onChange={update(i)} onReload={st.reload} />
      ))}
    </div>
  );
}

export default function Leccion() {
  const { courseId = '', lessonId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const sec = (params.get('s') as Seccion) || 'teoria';
  const { data, loading, error, reload } = useAsync(async () => {
    const [lesson, lessons, units] = await Promise.all([getLesson(lessonId), getLessonList(courseId), getUnits(courseId)]);
    return { lesson, lessons, units };
  }, [lessonId, courseId]);
  const { profile } = useAuth();
  useEffect(() => {
    if (!data) return;
    guardarUltimaLeccion(profile?.id, {
      courseId,
      lessonId,
      titulo: data.lesson.title,
      bloque: data.units.find((u) => u.id === data.lesson.unit_id)?.title,
      seccion: sec,
    });
  }, [data, sec, profile?.id, courseId, lessonId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { lesson, lessons, units } = data!;
  const unit = units.find((u) => u.id === lesson.unit_id);
  const ordered = units.flatMap((u) => lessons.filter((l) => l.unit_id === u.id && !l.hidden));
  const idx = ordered.findIndex((l) => l.id === lesson.id);
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];
  const setSec = (s: Seccion) => {
    const p = new URLSearchParams(params);
    p.set('s', s);
    p.delete('refuerzo');
    setParams(p, { replace: true });
    window.scrollTo({ top: 0 });
  };
  return (
    <div>
      <PageTitle title={lesson.title} subtitle={<>{unit?.title} {lesson.hidden && <Badge tone="amber">Oculta para estudiantes</Badge>}</>} back={{ to: `/curso/${courseId}`, label: 'Temario' }} />
      <Tabs<Seccion>
        value={sec}
        onChange={setSec}
        tabs={[
          { id: 'teoria', label: '1. Teoría' },
          { id: 'formulas', label: '2. Fórmulas' },
          { id: 'ejemplos', label: '3. Ejemplos' },
          { id: 'simulacion', label: '4. Simulación', disabled: !lesson.simulation },
          { id: 'practica', label: '5. Práctica' },
        ]}
      />
      {sec === 'teoria' && (
        <article className="tarjeta">
          <p className="mb-2 text-sm italic text-gray-600 dark:text-gray-400">{lesson.summary}</p>
          <Markdown>{lesson.theory}</Markdown>
        </article>
      )}
      {sec === 'formulas' && (
        <div className="grid gap-4 md:grid-cols-2">
          {lesson.formulas.length ? lesson.formulas.map((f, i) => <FormulaCard key={i} f={f} />) : <Empty>Sin fórmulas.</Empty>}
        </div>
      )}
      {sec === 'ejemplos' && (
        <div className="space-y-4">
          {lesson.examples.length ? lesson.examples.map((e, i) => <EjemploResuelto key={i} ex={e} n={i + 1} />) : <Empty>Sin ejemplos.</Empty>}
        </div>
      )}
      {sec === 'simulacion' && lesson.simulation && (
        <div className="space-y-4">
          {lesson.simulation.guide && (
            <Card title="Actividad guiada">
              <Markdown>{lesson.simulation.guide}</Markdown>
            </Card>
          )}
          <div className="tarjeta">
            <Simulador simKey={lesson.simulation.key} params={lesson.simulation.params} />
          </div>
        </div>
      )}
      {sec === 'practica' && <PracticaLeccion lesson={lesson} />}

      <nav className="mt-6 flex justify-between gap-2" aria-label="Lecciones">
        {prev ? <Link to={`/curso/${courseId}/leccion/${prev.id}`} className="btn-secundario">← {prev.title}</Link> : <span />}
        {sec !== 'practica' ? (
          <button className="btn-primario" onClick={() => setSec(nextSection(sec, !!lesson.simulation))}>Siguiente sección →</button>
        ) : next ? (
          <Link to={`/curso/${courseId}/leccion/${next.id}`} className="btn-primario">{next.title} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function nextSection(s: Seccion, hasSim: boolean): Seccion {
  const order: Seccion[] = hasSim ? ['teoria', 'formulas', 'ejemplos', 'simulacion', 'practica'] : ['teoria', 'formulas', 'ejemplos', 'practica'];
  return order[Math.min(order.length - 1, order.indexOf(s) + 1)];
}
