import { Link, useParams } from 'react-router-dom';
import { getCourse, getLessonList, getUnits, lessonProgress } from '@/api/estudiante';
import { useAsync } from '@/lib/util';
import { Badge, ErrorBox, PageTitle, ProgressBar, Spinner } from '@/components/ui';
import { getSimulation } from '@/sims/catalogo';

export default function Temario() {
  const { courseId = '' } = useParams();
  const { data, loading, error, reload } = useAsync(async () => {
    const [course, units, lessons, progress] = await Promise.all([getCourse(courseId), getUnits(courseId), getLessonList(courseId), lessonProgress(courseId)]);
    return { course, units, lessons, progress };
  }, [courseId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { course, units, lessons, progress } = data!;
  const prog = new Map(progress.map((p) => [p.lesson_id, p]));
  return (
    <div>
      <PageTitle title={course.title} subtitle="Temario" actions={<Link to={`/curso/${courseId}/progreso`} className="btn-secundario">Mi progreso</Link>} />
      <p className="mb-5 max-w-3xl text-sm text-gray-700 dark:text-gray-300">{course.description}</p>
      <div className="space-y-5">
        {units.filter((u) => !u.hidden).map((u) => {
          const ls = lessons.filter((l) => l.unit_id === u.id && !l.hidden);
          return (
            <section key={u.id} id={`u-${u.id}`} className="tarjeta">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl font-semibold text-primario-900 dark:text-primario-100">{u.title}</h2>
                {u.coming_soon && <Badge>En preparación</Badge>}
              </div>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{u.summary}</p>
              {ls.length > 0 && (
                <ol className="divide-y divide-gray-100 dark:divide-white/10">
                  {ls.map((l, i) => {
                    const p = prog.get(l.id);
                    const sim = l.simulation?.key ? getSimulation(l.simulation.key) : null;
                    return (
                      <li key={l.id} className="py-3">
                        <Link to={`/curso/${courseId}/leccion/${l.id}`} className="group flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primario-100 text-xs font-semibold text-primario-800 dark:bg-primario-800 dark:text-primario-100">{i + 1}</span>
                          <span className="font-medium group-hover:underline">{l.title}</span>
                          {sim && <Badge tone="blue">Simulación</Badge>}
                          {p && p.practice_total > 0 && p.practice_solved === p.practice_total && <Badge tone="green">Práctica completa</Badge>}
                        </Link>
                        <p className="ml-10 mt-0.5 text-sm text-gray-600 dark:text-gray-400">{l.summary}</p>
                        {p && p.practice_total > 0 && (
                          <div className="ml-10 mt-2 max-w-sm">
                            <ProgressBar value={p.practice_solved / p.practice_total} label={`Práctica ${p.practice_solved}/${p.practice_total}`} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {u.coming_soon && u.planned_topics.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Temas previstos:</p>
                  <ul className="grid list-disc gap-x-6 pl-5 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                    {u.planned_topics.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
