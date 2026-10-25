import { Link, Navigate } from 'react-router-dom';
import { myClasses } from '@/api/estudiante';
import { useAsync } from '@/lib/util';
import { Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';

export default function ElegirCurso() {
  const { data, loading, error } = useAsync(myClasses, []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const courses = [...new Map(data!.map((c) => [c.course_id, c.course_title])).entries()];
  if (courses.length === 1) return <Navigate to={`/curso/${courses[0][0]}`} replace />;
  return (
    <div>
      <PageTitle title="Temario" subtitle="Elija la asignatura" />
      {courses.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map(([id, t]) => (
            <li key={id}><Link to={`/curso/${id}`} className="tarjeta block hover:border-primario-400">{t}</Link></li>
          ))}
        </ul>
      ) : (
        <Empty>No está matriculado en ninguna clase. <Link to="/unirse" className="enlace">Unirme con un código</Link></Empty>
      )}
    </div>
  );
}
