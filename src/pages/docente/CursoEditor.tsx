import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addCourseStaff, courseStaff, createLesson, createUnit, deleteLesson, deleteUnit, isCourseStaff, updateCourse, updateLesson, updateUnit } from '@/api/docente';
import { getCourse, getLessonList, getUnits } from '@/api/estudiante';
import type { Lesson, Unit } from '@/api/tipos';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Card, ErrorBox, Field, Notice, PageTitle, Spinner } from '@/components/ui';

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sin-titulo';
}

export default function CursoEditor() {
  const { courseId = '' } = useParams();
  const nav = useNavigate();
  const st = useAsync(async () => {
    const [course, units, lessons, staff, canEdit] = await Promise.all([getCourse(courseId), getUnits(courseId), getLessonList(courseId), courseStaff(courseId), isCourseStaff(courseId)]);
    return { course, units, lessons, staff, canEdit };
  }, [courseId]);
  const action = useAction();
  const [newUnit, setNewUnit] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<{ title: string; description: string; presentation?: string; objetivos?: string } | null>(null);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const { course, units, lessons, staff, canEdit } = st.data!;
  const run = async (fn: () => Promise<unknown>) => {
    const r = await action.run(fn);
    await st.reload();
    return r;
  };

  async function moverUnidad(u: Unit, dir: -1 | 1) {
    const i = units.findIndex((x) => x.id === u.id);
    const other = units[i + dir];
    if (!other) return;
    await run(async () => {
      await updateUnit(u.id, { position: other.position });
      await updateUnit(other.id, { position: u.position === other.position ? u.position + dir : u.position });
    });
  }
  async function moverLeccion(l: Lesson, list: Lesson[], dir: -1 | 1) {
    const i = list.findIndex((x) => x.id === l.id);
    const other = list[i + dir];
    if (!other) return;
    await run(async () => {
      await updateLesson(l.id, { position: other.position });
      await updateLesson(other.id, { position: l.position === other.position ? l.position + dir : l.position });
    });
  }
  async function nuevaLeccion(u: Unit) {
    const title = window.prompt('Título de la nueva lección');
    if (!title?.trim()) return;
    const max = Math.max(0, ...lessons.filter((l) => l.unit_id === u.id).map((l) => l.position));
    const l = await action.run(() =>
      createLesson({ unit_id: u.id, course_id: courseId, title: title.trim(), slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`, position: max + 1, hidden: true }),
    );
    if (l) nav(`/docente/lecciones/${l.id}`);
  }

  return (
    <div className="space-y-5">
      <PageTitle title={course.title} subtitle={course.archived ? 'Asignatura archivada · organización del contenido' : 'Organización del contenido'} back={{ to: '/docente/cursos', label: 'Contenido' }}
        actions={<Link className="btn-secundario" to={`/docente/ejercicios?curso=${courseId}`}>Banco de ejercicios</Link>} />
      {!canEdit && <Notice tone="warn">Puede ver este curso y usarlo en sus clases, pero no editarlo: no forma parte de su equipo docente.</Notice>}
      <ErrorBox error={action.error} />

      {canEdit && (
        <Card title="Datos del curso">
          {info ? (
            <form onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const { objetivos, presentation, ...base } = info;
              // presentación y objetivos solo existen tras la migración 11
              const extra = presentation !== undefined ? { presentation, objectives: (objetivos ?? '').split('\n').map((s) => s.trim()).filter(Boolean) } : {};
              await run(() => updateCourse(courseId, { ...base, ...extra }));
              setInfo(null);
            }}>
              <Field label="Título">{(id) => <input id={id} className="campo" value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />}</Field>
              <Field label="Descripción breve">{(id) => <textarea id={id} className="campo" rows={2} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />}</Field>
              {info.presentation !== undefined && (
                <>
                  <Field label="Presentación del curso (Markdown)">{(id) => <textarea id={id} className="campo font-mono text-sm" rows={8} value={info.presentation} onChange={(e) => setInfo({ ...info, presentation: e.target.value })} />}</Field>
                  <Field label="Objetivos generales" hint="Uno por línea.">{(id) => <textarea id={id} className="campo" rows={5} value={info.objetivos} onChange={(e) => setInfo({ ...info, objetivos: e.target.value })} />}</Field>
                </>
              )}
              <button className="btn-primario">Guardar</button> <button type="button" className="btn-texto" onClick={() => setInfo(null)}>Cancelar</button>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{course.description}</p>
              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn-secundario text-sm" onClick={() => setInfo({
                  title: course.title, description: course.description,
                  ...(course.presentation !== undefined ? { presentation: course.presentation, objetivos: (course.objectives ?? []).join('\n') } : {}),
                })}>Editar</button>
                <button className="btn-texto text-sm" onClick={() => {
                  const msg = course.archived
                    ? '¿Reactivar la asignatura?'
                    : '¿Archivar la asignatura? No se borra nada: deja de ofrecerse para crear secciones nuevas; las secciones existentes, el contenido y las calificaciones se conservan.';
                  if (window.confirm(msg)) void run(() => updateCourse(courseId, { archived: !course.archived }));
                }}>{course.archived ? 'Reactivar asignatura' : 'Archivar asignatura'}</button>
              </div>
            </div>
          )}
        </Card>
      )}

      {units.map((u, ui) => {
        const ls = lessons.filter((l) => l.unit_id === u.id).sort((a, b) => a.position - b.position);
        return (
          <section key={u.id} className="tarjeta">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold">{u.title}</h2>
              {u.status && (
                canEdit ? (
                  <label className="flex items-center gap-1 text-xs">
                    <span className="sr-only">Estado de la unidad</span>
                    <select className={`campo w-auto py-1 text-xs ${u.status === 'publicado' ? 'border-emerald-400' : ''}`} value={u.status}
                      onChange={(e) => {
                        const s = e.target.value as Unit['status'];
                        const aviso = s === 'publicado' ? '¿Publicar la unidad? Sus estudiantes la verán con todos sus temas visibles.'
                          : u.status === 'publicado' ? '¿Retirar la unidad de la vista de los estudiantes? Su trabajo y sus notas se conservan.' : null;
                        if (!aviso || window.confirm(aviso)) void run(() => updateUnit(u.id, { status: s }));
                      }}>
                      <option value="borrador">Borrador</option>
                      <option value="preparado">Preparado</option>
                      <option value="publicado">Publicado</option>
                      <option value="archivado">Archivado</option>
                    </select>
                  </label>
                ) : <Badge tone={u.status === 'publicado' ? 'green' : 'amber'}>{u.status}</Badge>
              )}
              {u.customized && <Badge>Personalizada</Badge>}
              {u.hidden && <Badge tone="amber">Oculto</Badge>}
              {u.coming_soon && <Badge>En preparación</Badge>}
              {canEdit && (
                <div className="ml-auto flex flex-wrap gap-1">
                  <button className="btn-texto text-xs" disabled={ui === 0} onClick={() => moverUnidad(u, -1)} aria-label="Subir bloque">↑</button>
                  <button className="btn-texto text-xs" disabled={ui === units.length - 1} onClick={() => moverUnidad(u, 1)} aria-label="Bajar bloque">↓</button>
                  <button className="btn-texto text-xs" onClick={() => { const t = window.prompt('Título del bloque', u.title); if (t?.trim()) void run(() => updateUnit(u.id, { title: t.trim() })); }}>Renombrar</button>
                  <button className="btn-texto text-xs" onClick={() => { const t = window.prompt('Resumen del bloque', u.summary); if (t !== null) void run(() => updateUnit(u.id, { summary: t })); }}>Resumen</button>
                  <button className="btn-texto text-xs" onClick={() => run(() => updateUnit(u.id, { hidden: !u.hidden }))}>{u.hidden ? 'Mostrar' : 'Ocultar'}</button>
                  <button className="btn-texto text-xs" onClick={() => run(() => updateUnit(u.id, { coming_soon: !u.coming_soon }))}>{u.coming_soon ? 'Marcar como disponible' : 'Marcar «en preparación»'}</button>
                  {ls.length === 0 && <button className="btn-texto text-xs text-red-700" onClick={() => { if (window.confirm('¿Borrar el bloque vacío?')) void run(() => deleteUnit(u.id)); }}>Borrar</button>}
                </div>
              )}
            </div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{u.summary}</p>
            <ol className="divide-y divide-gray-100 dark:divide-white/10">
              {ls.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-6 text-right text-xs text-gray-500">{i + 1}</span>
                  <Link className="enlace" to={`/docente/lecciones/${l.id}`}>{l.title}</Link>
                  {l.hidden && <Badge tone="amber">Oculta</Badge>}
                  {l.simulation && <Badge tone="blue">Simulación</Badge>}
                  {canEdit && (
                    <span className="ml-auto flex gap-1">
                      <button className="btn-texto text-xs" disabled={i === 0} onClick={() => moverLeccion(l, ls, -1)} aria-label="Subir lección">↑</button>
                      <button className="btn-texto text-xs" disabled={i === ls.length - 1} onClick={() => moverLeccion(l, ls, 1)} aria-label="Bajar lección">↓</button>
                      <select className="campo w-auto py-0.5 text-xs" value={l.unit_id} aria-label="Mover a otro bloque"
                        onChange={(e) => run(() => updateLesson(l.id, { unit_id: e.target.value, position: 999 }))}>
                        {units.map((x) => <option key={x.id} value={x.id}>{x.title.slice(0, 28)}</option>)}
                      </select>
                      <button className="btn-texto text-xs" onClick={() => run(() => updateLesson(l.id, { hidden: !l.hidden }))}>{l.hidden ? 'Mostrar' : 'Ocultar'}</button>
                      <button className="btn-texto text-xs text-red-700" onClick={() => {
                        if (window.confirm(`¿Borrar «${l.title}»? Sus ejercicios pasarán al banco sin lección.`)) void run(() => deleteLesson(l.id));
                      }}>Borrar</button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {canEdit && <button className="btn-secundario mt-2 text-sm" onClick={() => nuevaLeccion(u)}>+ Añadir lección</button>}
          </section>
        );
      })}

      {canEdit && (
        <Card title="Nuevo bloque">
          <form className="flex gap-2" onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            await run(() => createUnit({ course_id: courseId, title: newUnit.trim(), slug: `${slugify(newUnit)}-${Date.now().toString(36).slice(-4)}`, position: Math.max(0, ...units.map((u) => u.position)) + 1 }));
            setNewUnit('');
          }}>
            <input className="campo" placeholder="Bloque VII. …" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} required aria-label="Título del bloque" />
            <button className="btn-primario">Añadir</button>
          </form>
        </Card>
      )}

      <Card title="Equipo docente del curso">
        <ul className="mb-3 space-y-1 text-sm">{staff.map((s) => <li key={s.user_id}>{s.profiles?.full_name || s.profiles?.login_id}</li>)}</ul>
        {canEdit && (
          <form className="flex gap-2" onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            const r = await run(() => addCourseStaff(courseId, staffEmail));
            const res = r as { ok: boolean; error?: string } | undefined;
            setMsg(res ? (res.ok ? 'Añadido al equipo.' : res.error ?? null) : null);
            if (res?.ok) setStaffEmail('');
          }}>
            <input className="campo" placeholder="ID del profesor" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required aria-label="ID del profesor" />
            <button className="btn-secundario">Añadir</button>
          </form>
        )}
        {msg && <p className="mt-1 text-xs">{msg}</p>}
        <p className="mt-2 text-xs text-gray-500">El equipo docente puede editar lecciones, ejercicios y claves de este curso.</p>
      </Card>
    </div>
  );
}
