import { Link, useParams } from 'react-router-dom';
import { getClass, gradebook } from '@/api/docente';
import { conceptMastery, getLessonList, getUnits, lessonProgress } from '@/api/estudiante';
import { puntaje, useAsync } from '@/lib/util';
import { Card, ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { COMO_SE_CALCULA, VistaDominio } from '../estudiante/Progreso';

export default function EstudianteDetalle() {
  const { classId = '', userId = '' } = useParams();
  const st = useAsync(async () => {
    const cls = await getClass(classId);
    const [units, lessons, progress, mastery, gb] = await Promise.all([
      getUnits(cls.course_id), getLessonList(cls.course_id), lessonProgress(cls.course_id, userId), conceptMastery(cls.course_id, userId), gradebook(classId),
    ]);
    return { cls, units, lessons, progress, mastery, gb };
  }, [classId, userId]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} />;
  const { cls, units, lessons, progress, mastery, gb } = st.data!;
  const student = gb.students.find((s) => s.user_id === userId);
  return (
    <div>
      <PageTitle title={student?.full_name ?? 'Estudiante'} subtitle={<>ID {student?.login_id ?? '—'} {student?.student_code && `· ${student.student_code}`} · {cls.name}</>}
        back={{ to: `/docente/clases/${classId}`, label: cls.name }} />
      <Card title="Actividades" className="mb-5">
        <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {gb.activities.map((a) => {
            const g = student?.grades[a.id];
            return (
              <li key={a.id} className="flex justify-between gap-2 py-2">
                <span>{a.title}</span>
                {g ? <Link className="enlace tabular-nums" to={`/docente/intentos/${g.last_attempt_id}`}>{g.best !== null ? puntaje(g.best, a.max_score) : 'en curso'}</Link> : <span className="text-gray-400">sin intentos</span>}
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="mb-4">{COMO_SE_CALCULA}</div>
      <VistaDominio units={units} lessons={lessons} progress={progress} mastery={mastery} courseId={cls.course_id} linkLessons={false} />
    </div>
  );
}
