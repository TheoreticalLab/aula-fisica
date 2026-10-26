/**
 * Página principal de una asignatura: presentación y objetivos, continuar, actividades pendientes y prácticas,
 * progreso, calificaciones autorizadas, avisos y el programa (unidades y minicapítulos).
 * Los estudiantes solo reciben las unidades PUBLICADAS (lo filtra la base de datos); el profesor ve todas con su estado.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { getCourse, getLessonList, getUnits, lessonProgress, myActivities, myAnnouncements, myClasses, myGrades } from '@/api/estudiante';
import type { UnitStatus } from '@/api/tipos';
import { leerUltimaLeccion, NOMBRE_SECCION } from '@/lib/ultimaLeccion';
import { fecha, puntaje, relativo, useAsync } from '@/lib/util';
import { Badge, ErrorBox, PageTitle, ProgressBar, Spinner } from '@/components/ui';
import { InlineMd, Markdown } from '@/components/Markdown';
import { getSimulation } from '@/sims/catalogo';

const ESTADO: Record<UnitStatus, { texto: string; tono: 'gray' | 'amber' | 'green' | 'red' }> = {
  borrador: { texto: 'Borrador', tono: 'gray' },
  preparado: { texto: 'Preparado (no visible)', tono: 'amber' },
  publicado: { texto: 'Publicado', tono: 'green' },
  archivado: { texto: 'Archivado', tono: 'red' },
};

export default function Temario() {
  const { courseId = '' } = useParams();
  const { profile, isTeacher } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [course, units, lessons, progress, clases, actividades, notas, avisos] = await Promise.all([
      getCourse(courseId), getUnits(courseId), getLessonList(courseId), lessonProgress(courseId),
      myClasses().catch(() => []), myActivities().catch(() => []), myGrades().catch(() => []), myAnnouncements().catch(() => []),
    ]);
    const misClases = new Set(clases.filter((c) => c.course_id === courseId).map((c) => c.class_id));
    return {
      course, units, lessons, progress,
      secciones: clases.filter((c) => misClases.has(c.class_id)).map((c) => c.name),
      actividades: actividades.filter((a) => a.course_id === courseId),
      notas: notas.filter((g) => misClases.has(g.class_id) && g.attempts > 0),
      avisos: avisos.filter((a) => misClases.has(a.class_id)),
    };
  }, [courseId]);
  const [verPresentacion, setVerPresentacion] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { course, units, lessons, progress, secciones, actividades, notas, avisos } = data!;
  const prog = new Map(progress.map((p) => [p.lesson_id, p]));
  const visibles = units.filter((u) => !u.hidden || isTeacher);
  const ultima = leerUltimaLeccion(profile?.id);
  const continuar = ultima && ultima.courseId === courseId ? ultima : null;
  const ahora = Date.now();
  const pendientes = actividades.filter((a) => !a.submitted && (!a.closes_at || new Date(a.closes_at).getTime() > ahora));
  const resueltos = progress.reduce((s, p) => s + p.practice_solved, 0);
  const total = progress.reduce((s, p) => s + p.practice_total, 0);
  const objetivos = course.objectives ?? [];
  const tienePresentacion = !!course.presentation?.trim() || objetivos.length > 0;

  return (
    <div>
      <PageTitle title={course.title} subtitle={secciones.length ? `Sección: ${secciones.join(', ')}` : 'Programa del curso'}
        actions={<Link to={`/curso/${courseId}/progreso`} className="btn-secundario">Mi progreso</Link>} />

      {tienePresentacion ? (
        <section className="tarjeta mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">Presentación del curso</h2>
            <button className="btn-texto text-sm" onClick={() => setVerPresentacion((v) => !v)} aria-expanded={verPresentacion}>
              {verPresentacion ? 'Ocultar' : 'Ver presentación y objetivos'}
            </button>
          </div>
          {verPresentacion && (
            <div className="mt-3">
              {course.presentation && <Markdown>{course.presentation}</Markdown>}
              {objetivos.length > 0 && (
                <>
                  <h3 className="mb-1 mt-4 font-semibold">Objetivos generales</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{objetivos.map((o, i) => <li key={i}><InlineMd>{o}</InlineMd></li>)}</ul>
                </>
              )}
            </div>
          )}
        </section>
      ) : course.description ? <p className="mb-5 max-w-3xl text-sm text-gray-700 dark:text-gray-300">{course.description}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 space-y-5 lg:order-1">
          <h2 className="font-serif text-2xl font-semibold">Programa de contenidos</h2>
          {visibles.length === 0 && <p className="tarjeta text-sm text-gray-600">Su profesor todavía no ha publicado unidades de este curso.</p>}
          {visibles.map((u, ui) => {
            const ls = lessons.filter((l) => l.unit_id === u.id && (!l.hidden || isTeacher));
            const st = u.status ?? 'publicado';
            return (
              <details key={u.id} id={`u-${u.id}`} className="tarjeta group" open={ui === 0 || undefined}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">Unidad {u.position}</span>
                  <h3 className="font-serif text-xl font-semibold text-primario-900 dark:text-primario-100">{u.title}</h3>
                  {isTeacher && st !== 'publicado' && <Badge tone={ESTADO[st].tono}>{ESTADO[st].texto}</Badge>}
                  {u.coming_soon && <Badge>En preparación</Badge>}
                  <span className="ml-auto text-xs text-gray-500">{ls.length} {ls.length === 1 ? 'tema' : 'temas'} <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span></span>
                </summary>
                <p className="mb-3 mt-2 text-sm text-gray-600 dark:text-gray-400">{u.summary}</p>
                {ls.length > 0 && (
                  <ol className="divide-y divide-gray-100 dark:divide-white/10">
                    {ls.map((l, i) => {
                      const p = prog.get(l.id);
                      const sim = l.simulation?.key ? getSimulation(l.simulation.key) : null;
                      const integradora = /integradora/i.test(l.title);
                      return (
                        <li key={l.id} className="py-3">
                          <Link to={`/curso/${courseId}/leccion/${l.id}`} className="group/l flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={`flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold ${integradora ? 'bg-acento-200 text-acento-800' : 'bg-primario-100 text-primario-800 dark:bg-primario-800 dark:text-primario-100'}`}>
                              {integradora ? '★' : `${u.position}.${i + 1}`}
                            </span>
                            <span className="font-medium group-hover/l:underline">{l.title}</span>
                            {sim && <Badge tone="blue">Simulación</Badge>}
                            {l.hidden && isTeacher && <Badge tone="amber">Oculta</Badge>}
                            {p && p.practice_total > 0 && p.practice_solved === p.practice_total && <Badge tone="green">Práctica completa</Badge>}
                          </Link>
                          <p className="ml-12 mt-0.5 text-sm text-gray-600 dark:text-gray-400">{l.summary}</p>
                          {p && p.practice_total > 0 && p.practice_solved > 0 && (
                            <div className="ml-12 mt-2 max-w-sm">
                              <ProgressBar value={p.practice_solved / p.practice_total} label={`Práctica ${p.practice_solved}/${p.practice_total}`} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {u.coming_soon && u.planned_topics.length > 0 && (
                  <ul className="grid list-disc gap-x-6 pl-5 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                    {u.planned_topics.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                )}
              </details>
            );
          })}
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          {continuar && (
            <Link to={`/curso/${courseId}/leccion/${continuar.lessonId}?s=${continuar.seccion}`} className="block rounded-2xl bg-acento-100 p-4 hover:-translate-y-0.5 dark:bg-acento-700/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-acento-800 dark:text-acento-200">Continuar donde lo dejé</p>
              <p className="mt-1 font-semibold">{continuar.titulo}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{NOMBRE_SECCION[continuar.seccion] ?? 'Lección'} · {fecha(continuar.fecha)}</p>
            </Link>
          )}
          {total > 0 && (
            <div className="tarjeta">
              <p className="mb-2 text-sm font-semibold">Mi progreso en el curso</p>
              <ProgressBar value={resueltos / total} label={`Ejercicios de práctica resueltos: ${resueltos} de ${total}`} />
            </div>
          )}
          <div className="tarjeta">
            <p className="mb-2 text-sm font-semibold">Actividades y prácticas pendientes</p>
            {pendientes.length ? (
              <ul className="space-y-2 text-sm">
                {pendientes.map((a) => (
                  <li key={a.id}>
                    <Link className="enlace" to={a.in_progress ? `/intento/${a.in_progress}` : `/actividad/${a.id}`}>{a.title}</Link>
                    <span className="block text-xs text-gray-500">
                      {a.mode === 'exam' ? 'Evaluación' : 'Práctica'} · {a.closes_at ? `cierra ${relativo(a.closes_at)}` : 'sin fecha límite'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">No tiene actividades pendientes en este curso.</p>}
          </div>
          {avisos.length > 0 && (
            <div className="tarjeta">
              <p className="mb-2 text-sm font-semibold">Avisos del profesor</p>
              <ul className="space-y-2 text-sm">
                {avisos.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <p className="font-medium">{a.pinned && '📌 '}{a.title}</p>
                    {a.body && <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300">{a.body}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notas.length > 0 && (
            <div className="tarjeta">
              <p className="mb-2 text-sm font-semibold">Calificaciones</p>
              <ul className="space-y-1 text-sm">
                {notas.slice(0, 5).map((g) => (
                  <li key={g.activity_id} className="flex justify-between gap-2">
                    <span className="truncate">{g.title}</span>
                    <span className="font-semibold tabular-nums">{g.best_score !== null ? puntaje(g.best_score, g.max_score) : '—'}</span>
                  </li>
                ))}
              </ul>
              <Link to="/calificaciones" className="enlace mt-2 inline-block text-xs">Ver todas</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
