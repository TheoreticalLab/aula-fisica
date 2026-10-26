import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { createClass, isCourseStaff, listCourses, teacherOverview } from '@/api/docente';
import { porcentaje, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, PageTitle, Spinner } from '@/components/ui';

export default function InicioDocente() {
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [secciones, courses] = await Promise.all([teacherOverview(), listCourses()]);
    // solo el equipo docente de una asignatura puede abrir secciones con ella
    const flags = await Promise.all(courses.map((c) => isCourseStaff(c.id)));
    const ownCourses = courses.filter((c, i) => flags[i] && !c.archived);
    return { secciones, courses, ownCourses };
  }, [profile?.id]);
  const [form, setForm] = useState({ course_id: '', name: '', term: '' });
  const [verArchivadas, setVerArchivadas] = useState(false);
  const action = useAction();
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { secciones, courses, ownCourses } = data!;
  async function crear(e: FormEvent) {
    e.preventDefault();
    const c = await action.run(() => createClass({ course_id: form.course_id || ownCourses[0]?.id, name: form.name.trim(), term: form.term.trim() }));
    if (c) nav(`/docente/clases/${c.id}`);
  }
  const visibles = secciones.filter((s) => verArchivadas || !s.archived);
  const porAsignatura = new Map<string, typeof visibles>();
  for (const s of visibles) porAsignatura.set(s.course_title, [...(porAsignatura.get(s.course_title) ?? []), s]);
  const total = (k: 'students' | 'pending_review' | 'open_activities') => secciones.filter((s) => !s.archived).reduce((a, s) => a + Number(s[k]), 0);

  return (
    <div className="space-y-5">
      <PageTitle title="Panel docente" subtitle={`${profile?.full_name ?? ''}${isAdmin ? ' · administrador' : ''}`}
        actions={<>
          <Link to="/docente/cursos" className="btn-secundario">Asignaturas y contenido</Link>
          <Link to="/docente/ejercicios" className="btn-secundario">Banco de ejercicios</Link>
          <Link to="/" className="btn-secundario">👁 Vista de estudiante</Link>
          <Link to="/docente/analitica" className="btn-secundario">⏱ Analítica de tiempo</Link>
          {isAdmin && <Link to="/docente/cuentas" className="btn-secundario">Cuentas</Link>}
        </>} />
      {!courses.length && <Notice tone="warn">No hay ninguna asignatura. Cargue la semilla del curso inicial o cree una en «Asignaturas y contenido».</Notice>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-sm text-gray-500">Secciones activas</p><p className="text-3xl font-semibold">{secciones.filter((s) => !s.archived).length}</p></Card>
        <Card><p className="text-sm text-gray-500">Estudiantes matriculados</p><p className="text-3xl font-semibold">{total('students')}</p></Card>
        <Card><p className="text-sm text-gray-500">Actividades abiertas</p><p className="text-3xl font-semibold">{total('open_activities')}</p></Card>
        <Card><p className="text-sm text-gray-500">Respuestas por revisar</p><p className={`text-3xl font-semibold ${total('pending_review') ? 'text-red-700 dark:text-red-300' : ''}`}>{total('pending_review')}</p></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
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
                  <li key={s.class_id}>
                    <Link to={`/docente/clases/${s.class_id}`} className="tarjeta block hover:border-primario-400">
                      <p className="font-semibold">{s.name} {s.archived && <Badge tone="amber">Archivada</Badge>}</p>
                      <p className="text-sm text-gray-500">{s.term || 'Sin periodo'}</p>
                      <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                        <div><dt className="text-gray-500">Estudiantes</dt><dd className="text-lg font-semibold">{s.students}</dd></div>
                        <div><dt className="text-gray-500">Abiertas</dt><dd className="text-lg font-semibold">{s.open_activities}</dd></div>
                        <div><dt className="text-gray-500">Media</dt><dd className="text-lg font-semibold">{porcentaje(s.mean_pct)}</dd></div>
                      </dl>
                      {s.pending_review > 0 && <p className="mt-2"><Badge tone="red">{s.pending_review} por revisar</Badge></p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )) : <Empty>Todavía no tiene secciones. Cree la primera con el formulario.</Empty>}
        </div>
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
  );
}
