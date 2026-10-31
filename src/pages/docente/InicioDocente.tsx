/**
 * Panel docente: lo de cada día arriba (crear actividad, revisar, próximos cierres), las secciones con accesos
 * directos, y las herramientas agrupadas y explicadas abajo.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { createClass, gradebook, isCourseStaff, listCourses, teacherOverview, upcomingActivities } from '@/api/docente';
import { seguimientoSeccion } from '@/lib/seguimiento';
import { fecha, porcentaje, relativo, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, PageTitle, Spinner } from '@/components/ui';

export default function InicioDocente() {
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [secciones, courses] = await Promise.all([teacherOverview(), listCourses()]);
    // solo el equipo docente de una asignatura puede abrir secciones con ella
    const flags = await Promise.all(courses.map((c) => isCourseStaff(c.id)));
    const ownCourses = courses.filter((c, i) => flags[i] && !c.archived);
    const activas = secciones.filter((s) => !s.archived);
    const [cierres, apoyo] = await Promise.all([
      upcomingActivities(activas.map((s) => s.class_id)).catch(() => []),
      Promise.all(activas.map((s) => gradebook(s.class_id).then((gb) => ({ class_id: s.class_id, n: seguimientoSeccion(gb).length })).catch(() => ({ class_id: s.class_id, n: 0 })))),
    ]);
    return { secciones, courses, ownCourses, cierres, apoyo };
  }, [profile?.id]);
  const [form, setForm] = useState({ course_id: '', name: '', term: '' });
  const [verArchivadas, setVerArchivadas] = useState(false);
  const action = useAction();
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { secciones, courses, ownCourses, cierres, apoyo } = data!;
  const conApoyo = apoyo.filter((x) => x.n > 0);
  async function crear(e: FormEvent) {
    e.preventDefault();
    const c = await action.run(() => createClass({ course_id: form.course_id || ownCourses[0]?.id, name: form.name.trim(), term: form.term.trim() }));
    if (c) nav(`/docente/clases/${c.id}`);
  }
  const activas = secciones.filter((s) => !s.archived);
  const visibles = secciones.filter((s) => verArchivadas || !s.archived);
  const porAsignatura = new Map<string, typeof visibles>();
  for (const s of visibles) porAsignatura.set(s.course_title, [...(porAsignatura.get(s.course_title) ?? []), s]);
  const total = (k: 'students' | 'pending_review' | 'open_activities') => activas.reduce((a, s) => a + Number(s[k]), 0);
  const porRevisar = activas.filter((s) => s.pending_review > 0).sort((a, b) => b.pending_review - a.pending_review);
  const nombreSeccion = new Map(secciones.map((s) => [s.class_id, s.name]));

  return (
    <div className="space-y-6">
      <PageTitle title="Panel docente" subtitle={`${profile?.full_name ?? ''}${isAdmin ? ' · administrador' : ''}`} />
      {!courses.length && <Notice tone="warn">No hay ninguna asignatura. Cargue la semilla del curso inicial o cree una en «Asignaturas y contenido».</Notice>}

      {/* Lo de hoy: dos acciones principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="tarjeta">
          <p className="font-semibold">➕ Crear una actividad</p>
          <p className="mb-2 text-sm text-gray-500">Práctica, tarea, quiz o examen en 4 pasos.</p>
          {activas.length === 1 ? (
            <Link className="btn-primario min-h-[44px]" to={`/docente/clases/${activas[0].class_id}/nueva-actividad`}>+ Crear actividad</Link>
          ) : activas.length ? (
            <div className="flex flex-wrap gap-2">
              {activas.map((s) => <Link key={s.class_id} className="btn-secundario min-h-[40px] text-sm" to={`/docente/clases/${s.class_id}/nueva-actividad`}>+ {s.name}</Link>)}
            </div>
          ) : <p className="text-sm text-gray-500">Primero cree una sección.</p>}
        </div>
        <div className="tarjeta">
          <p className="font-semibold">✍️ Respuestas por revisar <span className={total('pending_review') ? 'text-red-700 dark:text-red-300' : 'text-gray-400'}>({total('pending_review')})</span></p>
          <p className="mb-2 text-sm text-gray-500">Desarrollos y respuestas que el motor no puede calificar solo.</p>
          {porRevisar.length ? (
            <div className="flex flex-wrap gap-2">
              {porRevisar.map((s) => <Link key={s.class_id} className="btn-secundario min-h-[40px] text-sm" to={`/docente/clases/${s.class_id}?t=revision`}>{s.name} <Badge tone="red">{s.pending_review}</Badge></Link>)}
            </div>
          ) : <p className="text-sm text-emerald-700 dark:text-emerald-300">Nada pendiente. ✓</p>}
        </div>
        <div className="tarjeta">
          <p className="font-semibold">🤝 Pueden necesitar apoyo <span className="text-gray-400">({conApoyo.reduce((s, x) => s + x.n, 0)})</span></p>
          <p className="mb-2 text-sm text-gray-500">Entregas que faltan, cierres próximos o notas bajas.</p>
          {conApoyo.length ? (
            <div className="flex flex-wrap gap-2">
              {conApoyo.map((x) => <Link key={x.class_id} className="btn-secundario min-h-[40px] text-sm" to={`/docente/clases/${x.class_id}?t=seguimiento`}>{nombreSeccion.get(x.class_id)} <Badge tone="amber">{x.n}</Badge></Link>)}
            </div>
          ) : <p className="text-sm text-emerald-700 dark:text-emerald-300">Nadie con avisos. ✓</p>}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card><p className="text-xs text-gray-500 sm:text-sm">Secciones activas</p><p className="text-2xl font-semibold sm:text-3xl">{activas.length}</p></Card>
        <Card><p className="text-xs text-gray-500 sm:text-sm">Estudiantes</p><p className="text-2xl font-semibold sm:text-3xl">{total('students')}</p></Card>
        <Card><p className="text-xs text-gray-500 sm:text-sm">Actividades abiertas</p><p className="text-2xl font-semibold sm:text-3xl">{total('open_activities')}</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mis secciones</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Ver archivadas</label>
          </div>
          {porAsignatura.size ? [...porAsignatura.entries()].map(([asig, lista]) => (
            <section key={asig}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-acento-600">{asig}</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {lista.map((s) => (
                  <li key={s.class_id} className="tarjeta">
                    <Link to={`/docente/clases/${s.class_id}`} className="block">
                      <p className="font-semibold hover:underline">{s.name} {s.archived && <Badge tone="amber">Archivada</Badge>}</p>
                      <p className="text-sm text-gray-500">{s.term || 'Sin periodo'}</p>
                      <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                        <div><dt className="text-gray-500">Estudiantes</dt><dd className="text-lg font-semibold">{s.students}</dd></div>
                        <div><dt className="text-gray-500">Abiertas</dt><dd className="text-lg font-semibold">{s.open_activities}</dd></div>
                        <div><dt className="text-gray-500">Media</dt><dd className="text-lg font-semibold">{porcentaje(s.mean_pct)}</dd></div>
                      </dl>
                    </Link>
                    {!s.archived && (
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                        <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}/nueva-actividad`}>+ Actividad</Link>
                        <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}?t=estudiantes`}>Estudiantes</Link>
                        <Link className="rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5" to={`/docente/clases/${s.class_id}?t=calificaciones`}>Notas</Link>
                        {s.pending_review > 0 && <Link className="rounded-lg border border-red-300 px-2 py-1.5 text-red-700 dark:border-red-500/40 dark:text-red-300" to={`/docente/clases/${s.class_id}?t=revision`}>{s.pending_review} por revisar</Link>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )) : <Empty>Todavía no tiene secciones. Cree la primera con el formulario.</Empty>}
        </div>

        <div className="space-y-4">
          <Card title="Próximos cierres">
            {cierres.length ? (
              <ul className="space-y-2 text-sm">
                {cierres.map((a) => {
                  const pronto = a.closes_at && new Date(a.closes_at).getTime() - Date.now() < 48 * 3600_000;
                  return (
                    <li key={a.id}>
                      <Link className="enlace font-medium" to={`/docente/actividades/${a.id}`}>{a.title}</Link> <Badge tone={a.mode === 'exam' ? 'purple' : 'blue'}>{a.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge>
                      <span className={`block text-xs ${pronto ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500'}`}>{nombreSeccion.get(a.class_id)} · cierra {relativo(a.closes_at)} ({fecha(a.closes_at)})</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-gray-500">Ninguna actividad publicada con fecha de cierre próxima.</p>}
          </Card>

          <Card title="Crear una sección">
            <form onSubmit={crear}>
              <Field label="Asignatura">
                {(id) => (
                  <select id={id} className="campo" value={form.course_id || ownCourses[0]?.id || ''} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
                    {ownCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Nombre de la sección">{(id) => <input id={id} className="campo" placeholder="FIS-0180 Sección 11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />}</Field>
              <Field label="Periodo">{(id) => <input id={id} className="campo" placeholder="2026-2" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} maxLength={40} />}</Field>
              <ErrorBox error={action.error} />
              <button className="btn-primario w-full" disabled={action.busy || !ownCourses.length}>Crear sección</button>
              {courses.length > 0 && !ownCourses.length && (
                <p className="mt-2 text-xs text-acento-700">No forma parte del equipo docente de ninguna asignatura activa. Pida a un administrador que lo añada.</p>
              )}
              <p className="mt-2 text-xs text-gray-500">Después podrá matricular a los estudiantes por su ID (o compartir el código de la sección).</p>
            </form>
          </Card>
        </div>
      </div>

      {/* Herramientas, agrupadas y explicadas */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Herramientas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Herramienta to="/docente/cursos" icono="📚" titulo="Asignaturas y contenido" texto="Lecciones, teoría y su orden." />
          <Herramienta to="/docente/ejercicios" icono="🗂️" titulo="Banco de ejercicios" texto="Preguntas, claves y dificultad." />
          <Herramienta to="/docente/comunicacion" icono="📢" titulo="Comunicación en vivo" texto="Mensajes a la sección o a un estudiante." />
          <Herramienta href={`${import.meta.env.BASE_URL}control/`} icono="📱" titulo="Orbe Control" texto="El aula desde el teléfono: pulso, preguntas y datos." />
          <Herramienta to="/docente/analitica" icono="⏱" titulo="Analítica de tiempo" texto="Tiempo efectivo de estudio por estudiante." />
          <Herramienta to="/docente/telemetria" icono="🔭" titulo="Telemetría" texto="Activar la Telemetría V2 por asignatura y vigilar su calidad. La reconstrucción de cada intento está en su revisión." />
          <Herramienta to="/ayuda" icono="❓" titulo="Ayuda" texto="Guía breve: crear exámenes, prórrogas, revisar y seguimiento." />
          <Herramienta to="/" icono="👁" titulo="Vista de estudiante" texto="Vea la plataforma como la ve un estudiante." />
          <Herramienta to="/docente/lieia" icono="🔬" titulo="Laboratorio LIEIA" texto="Investigación de integridad (indicadores experimentales: no son pruebas)." />
          {isAdmin && <Herramienta to="/docente/orbe-ia" icono="🤖" titulo="Orbe IA" texto="Humor contextual con Claude: banco y límites." />}
          {isAdmin && <Herramienta to="/docente/cuentas" icono="👥" titulo="Cuentas" texto="Alta de estudiantes y profesores, accesos." />}
        </div>
      </section>
    </div>
  );
}

function Herramienta({ to, href, icono, titulo, texto }: { to?: string; href?: string; icono: string; titulo: string; texto: string }) {
  const cuerpo = (
    <>
      <span className="text-2xl" aria-hidden>{icono}</span>
      <span><span className="block font-medium">{titulo}</span><span className="block text-xs text-gray-500">{texto}</span></span>
    </>
  );
  const cls = 'tarjeta flex min-h-[72px] items-center gap-3 hover:border-primario-400';
  return href ? <a href={href} className={cls}>{cuerpo}</a> : <Link to={to!} className={cls}>{cuerpo}</Link>;
}
