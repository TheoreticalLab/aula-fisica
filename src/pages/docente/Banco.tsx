import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listCourses, listExercises } from '@/api/docente';
import { getLessonList } from '@/api/estudiante';
import { CATEGORIA, DIFICULTAD, FORMATO, useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';

export default function Banco() {
  const [params, setParams] = useSearchParams();
  const courses = useAsync(listCourses, []);
  const courseId = params.get('curso') || courses.data?.[0]?.id || '';
  const f = {
    lessonId: params.get('leccion') || '',
    difficulty: params.get('dificultad') || '',
    category: params.get('categoria') || '',
    role: params.get('rol') || '',
    search: params.get('q') || '',
  };
  const [search, setSearch] = useState(f.search);
  useEffect(() => setSearch(f.search), [f.search]);
  const lessons = useAsync(() => (courseId ? getLessonList(courseId) : Promise.resolve([])), [courseId]);
  const list = useAsync(
    () => (courseId ? listExercises({ courseId, lessonId: f.lessonId || undefined, difficulty: f.difficulty || undefined, category: f.category || undefined, role: f.role || undefined, search: f.search || undefined }) : Promise.resolve([])),
    [courseId, f.lessonId, f.difficulty, f.category, f.role, f.search],
  );
  const setP = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k === 'curso') p.delete('leccion');
    setParams(p, { replace: true });
  };
  if (courses.loading) return <Spinner />;
  const lessonTitle = (id: string | null) => lessons.data?.find((l) => l.id === id)?.title ?? 'Sin lección (banco)';
  return (
    <div>
      <PageTitle title="Banco de ejercicios" subtitle="Filtre, revise y edite los ejercicios y sus claves."
        actions={courseId && <Link className="btn-primario" to={`/docente/ejercicios/nuevo?curso=${courseId}${f.lessonId && f.lessonId !== 'none' ? `&leccion=${f.lessonId}` : ''}`}>+ Nuevo ejercicio</Link>} />
      <div className="tarjeta mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select className="campo" value={courseId} onChange={(e) => setP('curso', e.target.value)} aria-label="Curso">
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="campo" value={f.lessonId} onChange={(e) => setP('leccion', e.target.value)} aria-label="Lección">
          <option value="">Todas las lecciones</option>
          <option value="none">Sin lección</option>
          {lessons.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <select className="campo" value={f.difficulty} onChange={(e) => setP('dificultad', e.target.value)} aria-label="Dificultad">
          <option value="">Toda dificultad</option>
          {Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" value={f.category} onChange={(e) => setP('categoria', e.target.value)} aria-label="Tipo">
          <option value="">Todo tipo</option>
          {Object.entries(CATEGORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" value={f.role} onChange={(e) => setP('rol', e.target.value)} aria-label="Rol">
          <option value="">Todo rol</option>
          <option value="practice">Práctica</option>
          <option value="reinforcement">Refuerzo</option>
          <option value="bank">Banco</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setP('q', search.trim()); }}>
          <input className="campo" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
        </form>
      </div>
      <ErrorBox error={list.error} />
      {list.loading ? <Spinner /> : list.data?.length ? (
        <>
          <p className="mb-2 text-sm text-gray-500">{list.data.length} ejercicios</p>
          <ul className="space-y-2">
            {list.data.map((e) => (
              <li key={e.id} className="tarjeta py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link className="enlace font-mono" to={`/docente/ejercicios/${e.id}`}>{e.slug}</Link>
                  <Badge tone={e.role === 'practice' ? 'blue' : e.role === 'reinforcement' ? 'purple' : 'gray'}>{e.role === 'practice' ? 'Práctica' : e.role === 'reinforcement' ? 'Refuerzo' : 'Banco'}</Badge>
                  <Badge tone={e.difficulty === 'basico' ? 'green' : e.difficulty === 'intermedio' ? 'amber' : 'red'}>{DIFICULTAD[e.difficulty]}</Badge>
                  <Badge>{CATEGORIA[e.category]}</Badge>
                  <span className="text-gray-500">{FORMATO[e.format]} · {e.points} pt</span>
                  {!e.published && <Badge tone="amber">No publicado</Badge>}
                  <span className="ml-auto text-xs text-gray-500">{lessonTitle(e.lesson_id)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{e.prompt.replace(/[#*$\\]/g, '').slice(0, 220)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty>No hay ejercicios con esos filtros.</Empty>
      )}
    </div>
  );
}
