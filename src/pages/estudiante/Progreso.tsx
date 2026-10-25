import { Link, useParams } from 'react-router-dom';
import { conceptMastery, getLessonList, getUnits, lessonProgress } from '@/api/estudiante';
import type { ConceptMastery, Lesson, LessonProgress, Unit } from '@/api/tipos';
import { porcentaje, useAsync } from '@/lib/util';
import { Card, ErrorBox, MasteryBadge, PageTitle, ProgressBar, Spinner } from '@/components/ui';

export function VistaDominio({ units, lessons, progress, mastery, courseId, linkLessons = true }: {
  units: Unit[]; lessons: Lesson[]; progress: LessonProgress[]; mastery: ConceptMastery[]; courseId: string; linkLessons?: boolean;
}) {
  const prog = new Map(progress.map((p) => [p.lesson_id, p]));
  const dificultad = mastery.filter((m) => m.level === 'dificultad');
  const dominados = mastery.filter((m) => m.level === 'dominado');
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-gray-500">Conceptos dominados</p><p className="text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{dominados.length}</p></Card>
        <Card><p className="text-sm text-gray-500">Con dificultad</p><p className="text-3xl font-semibold text-red-700 dark:text-red-300">{dificultad.length}</p></Card>
        <Card><p className="text-sm text-gray-500">Con pocos datos</p><p className="text-3xl font-semibold text-gray-500">{mastery.filter((m) => m.level === 'pocos_datos').length}</p></Card>
      </div>
      {dificultad.length > 0 && (
        <Card title="Para reforzar">
          <ul className="space-y-1 text-sm">
            {dificultad.map((m) => {
              const l = lessons.find((x) => x.id === m.lesson_id);
              return (
                <li key={m.concept_slug} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.concept_name}</span>
                  <span className="text-gray-500">({porcentaje(m.score)} en {m.evidence} respuestas)</span>
                  {l && linkLessons && <Link className="enlace" to={`/curso/${courseId}/leccion/${l.id}?s=practica`}>Practicar «{l.title}»</Link>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {units.filter((u) => !u.coming_soon).map((u) => (
        <Card key={u.id} title={u.title}>
          <div className="space-y-4">
            {lessons.filter((l) => l.unit_id === u.id).map((l) => {
              const p = prog.get(l.id);
              const cs = mastery.filter((m) => m.lesson_id === l.id);
              return (
                <div key={l.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {linkLessons ? <Link to={`/curso/${courseId}/leccion/${l.id}`} className="font-medium hover:underline">{l.title}</Link> : <span className="font-medium">{l.title}</span>}
                    {p && <span className="text-xs text-gray-500">Práctica {p.practice_solved}/{p.practice_total}{p.mastery !== null ? ` · dominio ${porcentaje(p.mastery)}` : ''}</span>}
                  </div>
                  {p && p.practice_total > 0 && <div className="mt-1 max-w-md"><ProgressBar value={p.practice_solved / p.practice_total} /></div>}
                  {cs.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {cs.map((m) => (
                        <li key={m.concept_slug} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-white/10"
                          title={m.evidence ? `${m.evidence} respuestas · ${porcentaje(m.score)}` : 'Sin respuestas todavía'}>
                          {m.concept_name} <MasteryBadge level={m.level} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

export const COMO_SE_CALCULA = (
  <details className="tarjeta text-sm">
    <summary className="cursor-pointer font-medium">¿Cómo se calcula el dominio?</summary>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li>Se usan solo respuestas verificables: no cuenta cuántas páginas se visitaron.</li>
      <li>En práctica: acertar al primer intento sin pistas vale 100 %; con pistas, 75 %; acertar tras varios intentos, 50 %; ver la solución o no acertar, 0 %.</li>
      <li>En evaluaciones cuenta el crédito obtenido (solo cuando la actividad permite ver los resultados).</li>
      <li>Para cada concepto se promedian sus 10 respuestas más recientes. Hacen falta al menos 2 para clasificarlo: dominado (≥ 80 %), en progreso (≥ 50 %) o con dificultad.</li>
    </ul>
  </details>
);

export default function Progreso() {
  const { courseId = '' } = useParams();
  const { data, loading, error, reload } = useAsync(async () => {
    const [units, lessons, progress, mastery] = await Promise.all([getUnits(courseId), getLessonList(courseId), lessonProgress(courseId), conceptMastery(courseId)]);
    return { units, lessons, progress, mastery };
  }, [courseId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div>
      <PageTitle title="Mi progreso" subtitle="Qué conceptos domina y en cuáles conviene practicar más." back={{ to: `/curso/${courseId}`, label: 'Temario' }} />
      <div className="mb-4">{COMO_SE_CALCULA}</div>
      <VistaDominio {...data!} courseId={courseId} />
    </div>
  );
}
