import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  addClassTeacher,
  classConceptStats,
  classTeachers,
  createActivity,
  createAnnouncement,
  createGroup,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  deleteGroup,
  enrollByLogin,
  getClass,
  teacherOverview,
  gradebook,
  listActivities,
  listGroups,
  regenerateJoinCode,
  removeStudent,
  reviewQueue,
  roster,
  setStudentGroup,
  updateActivity,
  updateClass,
} from '@/api/docente';
import { getCourse } from '@/api/estudiante';
import type { ClassRow, Mode } from '@/api/tipos';
import { downloadText, fecha, porcentaje, puntaje, toCsv, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { TabAsistencia } from './AsistenciaTab';
import { TabEntregas } from './EntregasPdf';

type Tab = 'estudiantes' | 'asistencia' | 'avisos' | 'actividades' | 'entregas' | 'calificaciones' | 'revision' | 'estadisticas';

export default function Clase() {
  const { classId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('t') as Tab) || 'estudiantes';
  const nav = useNavigate();
  const cls = useAsync(async () => {
    const c = await getClass(classId);
    const [course, secciones] = await Promise.all([getCourse(c.course_id), teacherOverview()]);
    return { c, course, secciones };
  }, [classId]);
  if (cls.loading) return <Spinner />;
  if (cls.error) return <ErrorBox error={cls.error} />;
  const { c, course, secciones } = cls.data!;
  return (
    <div>
      <PageTitle title={c.name} subtitle={<>{c.term} · {course.title} {c.archived && <Badge tone="amber">Archivada</Badge>}</>} back={{ to: '/docente', label: 'Panel docente' }}
        actions={<>
          <Link to={`/docente/clases/${classId}/vista-estudiante`} className="btn-secundario">👁 Ver como estudiante</Link>
          <Link to={`/docente/clases/${classId}/registro`} className="btn-secundario">📒 Registro de calificaciones</Link>
          {secciones.length > 1 && (
            <select className="campo w-auto" value={classId} aria-label="Cambiar de sección"
              onChange={(e) => nav(`/docente/clases/${e.target.value}${tab !== 'estudiantes' ? `?t=${tab}` : ''}`)}>
              {secciones.filter((s) => !s.archived || s.class_id === classId).map((s) => (
                <option key={s.class_id} value={s.class_id}>{s.course_title} · {s.name}</option>
              ))}
            </select>
          )}
        </>} />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams({ t }, { replace: true })}
        tabs={[
          { id: 'estudiantes', label: 'Estudiantes y grupos' },
          { id: 'asistencia', label: 'Asistencia' },
          { id: 'avisos', label: 'Avisos' },
          { id: 'actividades', label: 'Actividades' },
          { id: 'entregas', label: 'Entregas en PDF' },
          { id: 'calificaciones', label: 'Calificaciones' },
          { id: 'revision', label: 'Revisión manual' },
          { id: 'estadisticas', label: 'Estadísticas' },
        ]}
      />
      {tab === 'estudiantes' && <TabEstudiantes c={c} onChange={(nc) => cls.setData({ c: nc, course, secciones })} />}
      {tab === 'asistencia' && <TabAsistencia classId={c.id} nombre={c.name} />}
      {tab === 'entregas' && <TabEntregas classId={c.id} />}
      {tab === 'avisos' && <TabAvisos c={c} />}
      {tab === 'actividades' && <TabActividades c={c} />}
      {tab === 'calificaciones' && <TabCalificaciones c={c} />}
      {tab === 'revision' && <TabRevision c={c} />}
      {tab === 'estadisticas' && <TabEstadisticas c={c} />}
    </div>
  );
}

function TabEstudiantes({ c, onChange }: { c: ClassRow; onChange: (c: ClassRow) => void }) {
  const data = useAsync(async () => {
    const [r, g, t] = await Promise.all([roster(c.id), listGroups(c.id), classTeachers(c.id)]);
    return { roster: r, groups: g, teachers: t };
  }, [c.id]);
  const action = useAction();
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: c.name, term: c.term });
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const { roster: rs, groups, teachers } = data.data!;
  const sorted = [...rs].sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''));
  const patch = async (p: Partial<ClassRow>) => {
    const r = await action.run(() => updateClass(c.id, p));
    if (r) onChange(r);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title={`Estudiantes matriculados (${rs.length})`}
          actions={rs.length > 0 && (
            <button className="btn-texto text-sm" onClick={() => downloadText(`estudiantes-${c.name}.csv`, toCsv([
              ['Nombre', 'ID', 'Matrícula', 'Grupo', 'Fecha de matrícula'],
              ...sorted.map((s) => [s.profiles?.full_name, s.profiles?.login_id, s.profiles?.student_code, groups.find((g) => g.id === s.group_id)?.name, fecha(s.enrolled_at)]),
            ]))}>Exportar CSV</button>
          )}>
          {rs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">Nombre</th><th className="py-1 pr-2">Matrícula</th><th className="py-1 pr-2">Grupo</th><th /></tr></thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.user_id} className="border-t border-gray-100 dark:border-white/10">
                      <td className="py-2 pr-2">
                        <Link className="enlace" to={`/docente/clases/${c.id}/estudiantes/${s.user_id}`}>{s.profiles?.full_name || '(sin nombre)'}</Link>
                        <span className="block text-xs text-gray-500">ID {s.profiles?.login_id ?? '—'}{s.profiles && !s.profiles.active ? ' · suspendida' : ''}</span>
                      </td>
                      <td className="py-2 pr-2">{s.profiles?.student_code}</td>
                      <td className="py-2 pr-2">
                        <select className="campo py-1 text-sm" value={s.group_id ?? ''} aria-label="Grupo"
                          onChange={async (e) => { await action.run(() => setStudentGroup(c.id, s.user_id, e.target.value || null)); await data.reload(); }}>
                          <option value="">—</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 text-right">
                        <button className="btn-texto text-xs text-red-700" onClick={async () => {
                          if (!window.confirm(`¿Dar de baja a ${s.profiles?.full_name}? Sus intentos se conservan.`)) return;
                          await action.run(() => removeStudent(c.id, s.user_id));
                          await data.reload();
                        }}>Dar de baja</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nadie se ha matriculado todavía. Comparta el código de la clase.</Empty>
          )}
        </Card>
        <ErrorBox error={action.error} />
        <MatricularPorId classId={c.id} groups={groups} onDone={data.reload} />
      </div>
      <div className="space-y-5">
        <Card title="Clave de la sección">
          <p className={`text-center font-mono text-3xl tracking-[0.25em] ${c.join_open ? 'text-primario-900 dark:text-white' : 'text-gray-400 line-through'}`}>{c.join_code}</p>
          <p className="mt-1 text-center text-sm">{c.join_open ? <span className="text-emerald-700 dark:text-emerald-300">Activación abierta</span> : <span className="text-acento-700">Activación cerrada</span>}</p>
          <p className="mt-2 text-xs text-gray-500">
            Entregue esta clave a toda la sección. Cada estudiante entra en «Activar mi cuenta», escribe la clave, su ID, su nombre y elige su
            contraseña: queda matriculado solo aquí. Los que ya tienen cuenta la usan en «Unirme a una clase». Cuando todos estén dentro,
            cierre la activación. Un código de grupo, además, asigna el grupo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secundario text-sm" onClick={() => navigator.clipboard?.writeText(c.join_code)}>Copiar</button>
            <button className="btn-secundario text-sm" onClick={async () => {
              if (!window.confirm('La clave actual dejará de funcionar (las cuentas ya activadas no se ven afectadas). ¿Generar una nueva?')) return;
              const code = await action.run(() => regenerateJoinCode(c.id));
              if (code) onChange({ ...c, join_code: code });
            }}>Generar otra</button>
            <button className="btn-secundario text-sm" onClick={() => patch({ join_open: !c.join_open })}>{c.join_open ? 'Cerrar activación' : 'Abrir activación'}</button>
          </div>
        </Card>
        <Card title="Grupos">
          {groups.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <span>{g.name} <span className="font-mono text-xs text-gray-500">{g.join_code}</span></span>
                  <button className="btn-texto text-xs text-red-700" onClick={async () => { if (window.confirm(`¿Borrar el grupo ${g.name}?`)) { await action.run(() => deleteGroup(g.id)); await data.reload(); } }}>Borrar</button>
                </li>
              ))}
            </ul>
          ) : <p className="mb-2 text-sm text-gray-500">Sin grupos.</p>}
          <form className="flex gap-2" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await action.run(() => createGroup(c.id, groupName.trim()))) { setGroupName(''); await data.reload(); } }}>
            <input className="campo" placeholder="Nombre del grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} required maxLength={80} aria-label="Nombre del grupo" />
            <button className="btn-secundario">Añadir</button>
          </form>
        </Card>
        <Card title="Profesores de la clase">
          <ul className="mb-3 space-y-1 text-sm">{teachers.map((t) => <li key={t.user_id}>{t.profiles?.full_name || t.profiles?.login_id}</li>)}</ul>
          <form className="flex gap-2" onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            const r = await action.run(() => addClassTeacher(c.id, email));
            if (r) { setInfo(r.ok ? 'Profesor añadido.' : r.error ?? null); if (r.ok) { setEmail(''); await data.reload(); } }
          }}>
            <input className="campo" placeholder="ID del colega" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="ID del profesor" />
            <button className="btn-secundario">Añadir</button>
          </form>
          {info && <p className="mt-1 text-xs">{info}</p>}
        </Card>
        <Card title="Datos de la clase">
          <Field label="Nombre">{(id) => <input id={id} className="campo" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
          <Field label="Periodo">{(id) => <input id={id} className="campo" value={edit.term} onChange={(e) => setEdit({ ...edit, term: e.target.value })} />}</Field>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario text-sm" onClick={() => patch(edit)}>Guardar</button>
            <button className="btn-secundario text-sm" onClick={() => patch({ archived: !c.archived })}>{c.archived ? 'Desarchivar' : 'Archivar'}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Matrícula de estudiantes existentes por su ID (uno por línea, o separados por comas o espacios). */
function MatricularPorId({ classId, groups, onDone }: { classId: string; groups: { id: string; name: string }[]; onDone: () => void }) {
  const [texto, setTexto] = useState('');
  const [grupo, setGrupo] = useState('');
  const [res, setRes] = useState<Awaited<ReturnType<typeof enrollByLogin>> | null>(null);
  const action = useAction();
  const ids = [...new Set(texto.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
  return (
    <Card title="Matricular por ID">
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
        Escriba o pegue los IDs de estudiantes que ya tienen cuenta (uno por línea). Para crear cuentas nuevas use «Cuentas» (administrador).
      </p>
      <textarea className="campo font-mono text-sm" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'100-12345\n100-12346'} aria-label="IDs de estudiantes" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {groups.length > 0 && (
          <select className="campo w-auto" value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo">
            <option value="">Sin grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>Grupo {g.name}</option>)}
          </select>
        )}
        <button className="btn-primario" disabled={!ids.length || action.busy} onClick={async () => {
          const r = await action.run(() => enrollByLogin(classId, ids, grupo || null));
          if (r) {
            setRes(r);
            if (r.matriculados.length) setTexto([...r.no_encontrados, ...r.no_son_estudiantes].join('\n'));
            onDone();
          }
        }}>Matricular {ids.length || ''}</button>
      </div>
      <ErrorBox error={action.error} />
      {res && (
        <div className="mt-3 space-y-1 text-sm">
          {res.matriculados.length > 0 && <p className="text-emerald-700 dark:text-emerald-300">✔ Matriculados ({res.matriculados.length}): {res.matriculados.join(', ')}</p>}
          {res.ya_estaban.length > 0 && <p>Ya estaban: {res.ya_estaban.join(', ')}</p>}
          {res.no_encontrados.length > 0 && <p className="text-red-700 dark:text-red-300">No existen: {res.no_encontrados.join(', ')}</p>}
          {res.no_son_estudiantes.length > 0 && <p className="text-acento-700">No son cuentas de estudiante: {res.no_son_estudiantes.join(', ')}</p>}
        </div>
      )}
    </Card>
  );
}

/** Avisos de la sección: los ven solo sus estudiantes, en su panel de inicio. */
function TabAvisos({ c }: { c: ClassRow }) {
  const lista = useAsync(() => listAnnouncements(c.id), [c.id]);
  const action = useAction();
  const [f, setF] = useState({ title: '', body: '', pinned: false, hasta: '' });
  async function publicar(e: FormEvent) {
    e.preventDefault();
    const r = await action.run(() =>
      createAnnouncement({ class_id: c.id, title: f.title.trim(), body: f.body.trim(), pinned: f.pinned, visible_until: f.hasta ? new Date(f.hasta).toISOString() : null }),
    );
    if (r) {
      setF({ title: '', body: '', pinned: false, hasta: '' });
      await lista.reload();
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card title="Nuevo aviso">
        <form onSubmit={publicar}>
          <Field label="Título">{(id) => <input id={id} className="campo" required maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Examen parcial el lunes 3" />}</Field>
          <Field label="Mensaje (opcional)">{(id) => <textarea id={id} className="campo" rows={4} maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Entra hasta la lección de MRUA. Traigan calculadora." />}</Field>
          <Field label="Visible hasta (opcional)" hint="Después de esa fecha deja de mostrarse.">{(id) => <input id={id} type="datetime-local" className="campo" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />}</Field>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Fijar arriba</label>
          <ErrorBox error={action.error} />
          <button className="btn-primario" disabled={action.busy || !f.title.trim()}>Publicar aviso</button>
          <p className="mt-2 text-xs text-gray-500">Lo verán solo los estudiantes de {c.name}, en su página de inicio.</p>
        </form>
      </Card>
      <Card title="Avisos publicados">
        {lista.loading ? <Spinner /> : lista.data?.length ? (
          <ul className="space-y-3">
            {lista.data.map((a) => (
              <li key={a.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{a.pinned && '📌 '}{a.title}</p>
                  <span className="shrink-0 text-xs text-gray-500">{fecha(a.created_at)}</span>
                </div>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{a.body}</p>}
                {a.visible_until && <p className="mt-1 text-xs text-gray-500">Visible hasta {fecha(a.visible_until)}</p>}
                <div className="mt-2 flex gap-2">
                  <button className="btn-texto text-xs" onClick={async () => { await action.run(() => updateAnnouncement(a.id, { pinned: !a.pinned })); await lista.reload(); }}>
                    {a.pinned ? 'Desfijar' : 'Fijar'}
                  </button>
                  <button className="btn-texto text-xs text-red-700" onClick={async () => {
                    if (window.confirm('¿Borrar este aviso? Los estudiantes dejarán de verlo.')) { await action.run(() => deleteAnnouncement(a.id)); await lista.reload(); }
                  }}>Borrar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>Todavía no ha publicado avisos en esta sección.</Empty>}
      </Card>
    </div>
  );
}

function TabActividades({ c }: { c: ClassRow }) {
  const nav = useNavigate();
  const list = useAsync(() => listActivities(c.id), [c.id]);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('practice');
  const action = useAction();
  async function crear(e: FormEvent) {
    e.preventDefault();
    const a = await action.run(() =>
      createActivity({
        class_id: c.id,
        title: title.trim(),
        mode,
        // sin fecha de cierre todavía: la política «después del cierre» se elige al configurar
        reveal_policy: mode === 'exam' ? 'after_submit' : 'immediate',
        hints_enabled: mode === 'practice',
        max_attempts: mode === 'exam' ? 1 : null,
      }),
    );
    if (a) nav(`/docente/actividades/${a.id}`);
  }
  if (list.loading) return <Spinner />;
  return (
    <div className="space-y-5">
      <Card title="Nueva actividad">
        <form className="flex flex-wrap items-end gap-3" onSubmit={crear}>
          <div className="min-w-[14rem] flex-1">
            <Field label="Título">{(id) => <input id={id} className="campo" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="Práctica 1: MRU" />}</Field>
          </div>
          <Field label="Modalidad">
            {(id) => (
              <select id={id} className="campo" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="practice">Práctica de aprendizaje</option>
                <option value="exam">Evaluación calificable</option>
              </select>
            )}
          </Field>
          <button className="btn-primario mb-3" disabled={action.busy}>Crear y configurar</button>
        </form>
        <ErrorBox error={action.error} />
      </Card>
      {list.data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">Actividad</th><th className="py-1 pr-2">Modalidad</th><th className="py-1 pr-2">Apertura</th><th className="py-1 pr-2">Cierre</th><th className="py-1">Estado</th></tr></thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-2 pr-2">
                    <Link className="enlace" to={`/docente/actividades/${a.id}`}>{a.title}</Link>
                    <Link className="ml-2 text-xs text-gray-500 hover:underline" to={`/docente/actividades/${a.id}/vista-previa`} title="Ver como estudiante">👁 Vista previa</Link>
                  </td>
                  <td className="py-2 pr-2"><Badge tone={a.mode === 'exam' ? 'purple' : 'blue'}>{a.mode === 'exam' ? 'Evaluación' : 'Práctica'}</Badge></td>
                  <td className="py-2 pr-2">{fecha(a.opens_at)}</td>
                  <td className="py-2 pr-2">{fecha(a.closes_at)}</td>
                  <td className="py-2 space-x-1">
                    {a.published ? <Badge tone="green">Visible</Badge> : <Badge>Borrador</Badge>}
                    {a.grades_published && <Badge tone="blue">Notas publicadas</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Sin actividades.</Empty>
      )}
    </div>
  );
}

function TabCalificaciones({ c }: { c: ClassRow }) {
  const gb = useAsync(() => gradebook(c.id), [c.id]);
  const action = useAction();
  if (gb.loading) return <Spinner />;
  if (gb.error) return <ErrorBox error={gb.error} onRetry={gb.reload} />;
  const { activities, students } = gb.data!;
  const totalMax = activities.reduce((s, a) => s + Number(a.max_score), 0);
  const total = (st: (typeof students)[number]) => activities.reduce((s, a) => s + Number(st.grades[a.id]?.best ?? 0), 0);
  function exportar() {
    const header = ['Nombre', 'ID', 'Matrícula', 'Grupo', ...activities.flatMap((a) => [`${a.title} (/${a.max_score})`]), `Total (/${totalMax})`, 'Porcentaje'];
    const rows = students.map((s) => [
      s.full_name, s.login_id, s.student_code, s.group_name,
      ...activities.map((a) => (s.grades[a.id]?.best ?? null) === null ? '' : String(s.grades[a.id].best).replace('.', ',')),
      String(total(s)).replace('.', ','),
      totalMax ? String(Math.round((total(s) / totalMax) * 1000) / 10).replace('.', ',') : '',
    ]);
    downloadText(`calificaciones-${c.name}.csv`, toCsv([header, ...rows]));
  }
  return (
    <div className="space-y-3">
      <Notice>Se muestra el mejor intento entregado de cada estudiante. Los estudiantes solo ven la nota cuando usted la publica. El CSV usa «;» y coma decimal (Excel en español).</Notice>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" onClick={exportar} disabled={!students.length}>Exportar a CSV</button>
      </div>
      <ErrorBox error={action.error} />
      {students.length ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-2 py-2 text-left dark:bg-primario-950">Estudiante</th>
                {activities.map((a) => (
                  <th key={a.id} className="min-w-[8rem] px-2 py-2 text-left align-bottom font-medium">
                    <Link className="enlace" to={`/docente/actividades/${a.id}`}>{a.title}</Link>
                    <span className="block text-xs font-normal text-gray-500">/{a.max_score} · {a.mode === 'exam' ? 'evaluación' : 'práctica'}</span>
                    <label className="mt-1 flex items-center gap-1 text-xs font-normal">
                      <input type="checkbox" checked={a.grades_published} onChange={async (e) => {
                        await action.run(() => updateActivity(a.id, { grades_published: e.target.checked }));
                        await gb.reload();
                      }} /> publicada
                    </label>
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.user_id} className="border-t border-gray-100 dark:border-white/10">
                  <td className="sticky left-0 bg-white px-2 py-2 dark:bg-primario-950">
                    <Link className="enlace" to={`/docente/clases/${c.id}/estudiantes/${s.user_id}`}>{s.full_name || s.login_id}</Link>
                    {s.group_name && <span className="block text-xs text-gray-500">{s.group_name}</span>}
                  </td>
                  {activities.map((a) => {
                    const g = s.grades[a.id];
                    return (
                      <td key={a.id} className="px-2 py-2 tabular-nums">
                        {g ? (
                          <Link to={`/docente/intentos/${g.last_attempt_id}`} className="hover:underline">
                            {g.best !== null ? puntaje(g.best, null) : g.in_progress ? <span className="text-gray-500">en curso</span> : '—'}
                            {g.needs_review && <span title="Pendiente de revisión manual" className="ml-1 text-red-600">●</span>}
                          </Link>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{puntaje(total(s), totalMax)}<span className="block text-xs text-gray-500">{porcentaje(totalMax ? total(s) / totalMax : null)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No hay estudiantes matriculados.</Empty>
      )}
    </div>
  );
}

function TabRevision({ c }: { c: ClassRow }) {
  const q = useAsync(() => reviewQueue(c.id), [c.id]);
  if (q.loading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  return q.data!.length ? (
    <ul className="divide-y divide-gray-100 dark:divide-white/10">
      {q.data!.map((r) => (
        <li key={r.response_id} className="flex flex-wrap items-center gap-2 py-3">
          <span className="font-medium">{r.student}</span>
          <span className="text-sm text-gray-500">{r.activity_title} · {r.exercise_slug}</span>
          <span className="w-full text-sm text-gray-600 dark:text-gray-400">{r.prompt}</span>
          <Link className="btn-secundario ml-auto text-sm" to={`/docente/intentos/${r.attempt_id}#r-${r.response_id}`}>Calificar</Link>
        </li>
      ))}
    </ul>
  ) : (
    <Empty>No hay respuestas pendientes de revisión manual.</Empty>
  );
}

function TabEstadisticas({ c }: { c: ClassRow }) {
  const s = useAsync(() => classConceptStats(c.id), [c.id]);
  if (s.loading) return <Spinner label="Calculando el dominio de cada estudiante…" />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const rows = s.data!.filter((r) => r.with_data > 0).sort((a, b) => (a.mean ?? 1) - (b.mean ?? 1));
  return (
    <div className="space-y-3">
      <Notice>Dominio por concepto en la clase, calculado con respuestas verificables (práctica y evaluaciones). Los conceptos con peores resultados aparecen primero. Para estadísticas por pregunta, abra una actividad.</Notice>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">Concepto</th><th className="py-1 pr-2">Media</th><th className="py-1 pr-2">Distribución</th><th className="py-1">Con datos</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const n = r.dominado + r.en_progreso + r.dificultad || 1;
                return (
                  <tr key={r.concept_slug} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-2 pr-2">{r.concept_name}</td>
                    <td className="py-2 pr-2 tabular-nums">{porcentaje(r.mean)}</td>
                    <td className="py-2 pr-2">
                      <div className="flex h-3 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" title={`Dominado ${r.dominado} · En progreso ${r.en_progreso} · Dificultad ${r.dificultad}`}>
                        <div className="bg-emerald-600" style={{ width: `${(r.dominado / n) * 100}%` }} />
                        <div className="bg-primario-500" style={{ width: `${(r.en_progreso / n) * 100}%` }} />
                        <div className="bg-red-600" style={{ width: `${(r.dificultad / n) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 tabular-nums">{r.with_data}/{r.students}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500"><span className="text-emerald-700">■</span> dominado · <span className="text-primario-600">■</span> en progreso · <span className="text-red-700">■</span> con dificultad</p>
        </div>
      ) : (
        <Empty>Todavía no hay suficientes respuestas para calcular estadísticas.</Empty>
      )}
    </div>
  );
}
