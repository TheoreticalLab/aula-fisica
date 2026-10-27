/**
 * Inicio del estudiante: carga los datos (cursos, avisos, actividades, progreso) y los entrega a PanelEstudiante.
 * La construcción del panel está en src/lib/panel.ts (la comparte la vista previa del profesor).
 */
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import {
  conceptMastery,
  getLessonList,
  getUnits,
  lessonProgress,
  myActivities,
  myAnnouncements,
  myClasses,
  myGrades,
  myPendingPractice,
} from '@/api/estudiante';
import { teacherOverview } from '@/api/docente';
import { construirDatosPanel, type DatosCurso } from '@/lib/panel';
import { leerUltimaLeccion } from '@/lib/ultimaLeccion';
import { useAsync } from '@/lib/util';
import { Card, ErrorBox, Spinner } from '@/components/ui';
import { PanelEstudiante, type DatosPanel } from './PanelEstudiante';
import { BotonAsistencia } from '@/components/BotonAsistencia';

export default function Inicio() {
  const { profile, isTeacher } = useAuth();
  const { data, loading, error, reload } = useAsync(async (): Promise<DatosPanel> => {
    const [clases, actividades, pendientes, notas, avisos] = await Promise.all([
      myClasses(),
      myActivities(),
      myPendingPractice(),
      myGrades(),
      myAnnouncements().catch(() => []), // si la migración de avisos aún no está aplicada
    ]);
    const cursosIds = [...new Set(clases.filter((c) => !c.archived).map((c) => c.course_id))];
    const porCurso = new Map<string, DatosCurso>(
      await Promise.all(
        cursosIds.map(async (id) => {
          const [units, lecciones, progreso, dominio] = await Promise.all([getUnits(id), getLessonList(id), lessonProgress(id), conceptMastery(id)]);
          return [id, { units, lecciones, progreso, dominio }] as const;
        }),
      ),
    );
    return construirDatosPanel({
      nombre: profile?.full_name?.split(' ')[0] ?? '',
      esProfesor: isTeacher,
      clases,
      actividades,
      pendientes,
      notas,
      avisos,
      porCurso,
      ultima: leerUltimaLeccion(profile?.id),
    });
  }, [profile?.id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  // Un profesor no inscrito como estudiante vería un panel vacío: se le ofrece el de sus secciones.
  if (isTeacher && data!.cursos.length === 0) return <ElegirSeccionVistaPrevia />;
  return <PanelEstudiante d={data!} asistencia={<BotonAsistencia />} />;
}

function ElegirSeccionVistaPrevia() {
  const st = useAsync(() => teacherOverview(), []);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-serif text-2xl font-semibold">Vista de estudiante</h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        Usted no está inscrito como estudiante, así que su propio panel estaría vacío. Elija una sección para ver el inicio exactamente como lo ve un estudiante de ella.
      </p>
      <Card>
        {st.loading ? <Spinner /> : st.error ? <ErrorBox error={st.error} onRetry={st.reload} /> : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {(st.data ?? []).filter((s) => !s.archived).map((s) => (
              <li key={s.class_id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-gray-500">{s.course_title} · {s.students} estudiantes</span>
                </span>
                <Link className="btn-secundario text-sm" to={`/docente/clases/${s.class_id}/vista-estudiante`}>👁 Ver como estudiante</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
