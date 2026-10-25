import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { getLessonList, getUnits, lessonProgress, myActivities, myClasses, myGrades, myPendingPractice } from '@/api/estudiante';
import type { Lesson, LessonProgress, MyActivity, Unit } from '@/api/tipos';
import { fecha, porcentaje, puntaje, relativo, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, ProgressBar, Spinner } from '@/components/ui';
import { SIMULATIONS } from '@/sims/catalogo';

function estadoActividad(a: MyActivity): { label: string; tone: 'green' | 'blue' | 'amber' | 'gray' | 'red' } {
  const now = Date.now();
  if (a.opens_at && new Date(a.opens_at).getTime() > now) return { label: 'Próximamente', tone: 'gray' };
  if (a.closes_at && new Date(a.closes_at).getTime() < now) return { label: 'Cerrada', tone: 'gray' };
  if (a.in_progress) return { label: 'En curso', tone: 'amber' };
  if (a.submitted) return { label: 'Entregada', tone: 'green' };
  return { label: 'Pendiente', tone: 'red' };
}

export function ResumenCurso({ courseId }: { courseId: string }) {
  const { data, loading, error } = useAsync(
    async () => {
      const [units, lessons, progress] = await Promise.all([getUnits(courseId), getLessonList(courseId), lessonProgress(courseId)]);
      return { units, lessons, progress };
    },
    [courseId],
  );
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { units, lessons, progress } = data!;
  return <ProgresoUnidades units={units} lessons={lessons} progress={progress} courseId={courseId} />;
}

export function ProgresoUnidades({ units, lessons, progress, courseId }: { units: Unit[]; lessons: Lesson[]; progress: LessonProgress[]; courseId: string }) {
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  return (
    <ul className="space-y-3">
      {units.map((u) => {
        const ls = lessons.filter((l) => l.unit_id === u.id);
        const ps = ls.map((l) => byLesson.get(l.id)).filter((p): p is LessonProgress => !!p);
        const total = ps.reduce((s, p) => s + p.practice_total, 0);
        const solved = ps.reduce((s, p) => s + p.practice_solved, 0);
        const withM = ps.filter((p) => p.mastery !== null && p.evidence >= 2);
        const mastery = withM.length ? withM.reduce((s, p) => s + Number(p.mastery), 0) / withM.length : null;
        return (
          <li key={u.id}>
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/curso/${courseId}#u-${u.id}`} className="font-medium hover:underline">{u.title}</Link>
              {u.coming_soon ? <Badge>En preparación</Badge> : <span className="text-xs text-gray-500">{ls.length} lecciones</span>}
            </div>
            {!u.coming_soon && total > 0 && (
              <div className="mt-1 grid gap-1 sm:grid-cols-2 sm:gap-4">
                <ProgressBar value={solved / total} label={`Ejercicios resueltos (${solved}/${total})`} />
                <ProgressBar value={mastery ?? 0} tone="green" label={mastery === null ? 'Dominio: sin datos aún' : 'Dominio de conceptos'} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Inicio() {
  const { profile, isTeacher } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [classes, activities, pending, grades] = await Promise.all([myClasses(), myActivities(), myPendingPractice(), myGrades()]);
    return { classes, activities, pending, grades };
  }, []);
  const [courseSel, setCourseSel] = useState<string | null>(null);
  const courses = useMemo(() => {
    const m = new Map<string, string>();
    data?.classes.filter((c) => !c.archived).forEach((c) => m.set(c.course_id, c.course_title));
    return [...m.entries()];
  }, [data]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { classes, activities, pending, grades } = data!;
  const courseId = courseSel ?? courses[0]?.[0] ?? null;
  const now = Date.now();
  const proximas = activities.filter((a) => !a.closes_at || new Date(a.closes_at).getTime() > now).slice(0, 6);
  const enCurso = activities.filter((a) => a.in_progress && (!a.closes_at || new Date(a.closes_at).getTime() > now));
  const nombre = profile?.full_name?.split(' ')[0] || 'estudiante';

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-primario-900 to-primario-700 p-5 text-white">
        <p className="text-sm text-acento-300">Bienvenido al aula</p>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Hola, {nombre}</h1>
        <p className="mt-1 text-sm text-primario-100">
          {classes.length ? `Está matriculado en ${classes.length} ${classes.length === 1 ? 'clase' : 'clases'}.` : 'Todavía no está matriculado en ninguna clase.'}
          {isTeacher && <> · <Link to="/docente" className="underline">Ir al panel docente</Link></>}
        </p>
        {courses.length > 1 && (
          <select className="campo mt-3 max-w-sm text-tinta" value={courseId ?? ''} onChange={(e) => setCourseSel(e.target.value)} aria-label="Asignatura">
            {courses.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
          </select>
        )}
      </section>

      {!classes.length && (
        <Card title="Únase a su clase">
          <p className="mb-3 text-sm">Pida a su profesor el código de la clase (8 caracteres) y escríbalo aquí.</p>
          <Link to="/unirse" className="btn-primario">Ingresar código de clase</Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {courseId && (
            <Card title="Temario y progreso académico" actions={<Link to={`/curso/${courseId}`} className="btn-texto text-sm">Ver temario →</Link>}>
              <ResumenCurso courseId={courseId} />
              <p className="mt-3 text-xs text-gray-500">
                El dominio se calcula con sus respuestas verificables: aciertos al primer intento, uso de pistas y evaluaciones.{' '}
                <Link to={`/curso/${courseId}/progreso`} className="enlace">Ver detalle por concepto</Link>
              </p>
            </Card>
          )}

          <Card title="Próximas actividades">
            {proximas.length ? (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {proximas.map((a) => {
                  const st = estadoActividad(a);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                      <Link to={`/actividad/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                      <Badge tone={a.mode === 'exam' ? 'purple' : 'blue'}>{a.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="ml-auto text-xs text-gray-500">
                        {a.closes_at ? <>Cierra {relativo(a.closes_at)} · {fecha(a.closes_at)}</> : 'Sin fecha de cierre'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No hay actividades abiertas.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Ejercicios pendientes">
            {enCurso.length + pending.length ? (
              <ul className="space-y-2 text-sm">
                {enCurso.map((a) => (
                  <li key={a.id}>
                    <Link to={`/intento/${a.in_progress}`} className="enlace">{a.title}</Link>
                    <span className="block text-xs text-gray-500">Actividad sin entregar</span>
                  </li>
                ))}
                {pending.filter((p) => p.solved < p.total).map((p) => (
                  <li key={p.attempt_id}>
                    <Link to={`/curso/${p.course_id}/leccion/${p.lesson_id}?s=practica`} className="enlace">{p.lesson_title}</Link>
                    <span className="block text-xs text-gray-500">Práctica: {p.solved} de {p.total} ejercicios cerrados</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No tiene ejercicios a medias.</Empty>
            )}
          </Card>

          <Card title="Calificaciones" actions={<Link to="/calificaciones" className="btn-texto text-sm">Todas →</Link>}>
            {grades.length ? (
              <ul className="space-y-1 text-sm">
                {grades.slice(0, 4).map((g) => (
                  <li key={g.activity_id} className="flex justify-between gap-2">
                    <span className="truncate">{g.title}</span>
                    <span className="font-medium tabular-nums">{puntaje(g.best_score, g.max_score)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aún no hay calificaciones publicadas.</Empty>
            )}
          </Card>

          <Card title="Laboratorio virtual" actions={<Link to="/laboratorio" className="btn-texto text-sm">Abrir →</Link>}>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {SIMULATIONS.map((s) => (
                <li key={s.key}>
                  <Link to={`/laboratorio/${s.key}`} className="block rounded-lg bg-primario-50 px-2 py-2 hover:bg-primario-100 dark:bg-white/5 dark:hover:bg-white/10">{s.title}</Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      {grades.length > 0 && <p className="text-center text-xs text-gray-500">Promedio de calificaciones publicadas: {porcentaje(grades.filter((g) => g.max_score > 0 && g.best_score !== null).reduce((s, g, _, arr) => s + Number(g.best_score) / Number(g.max_score) / arr.length, 0))}</p>}
    </div>
  );
}
