/**
 * Vista previa del PANEL DE INICIO de un estudiante de una sección: el mismo componente (PanelEstudiante) y la
 * misma construcción (construirDatosPanel) que usa el estudiante, con los datos que vería uno recién inscrito.
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { conceptMastery, getLessonList, getUnits, lessonProgress } from '@/api/estudiante';
import { datosPanelSeccion, teacherOverview } from '@/api/docente';
import { construirDatosPanel, type DatosCurso } from '@/lib/panel';
import { useAsync } from '@/lib/util';
import { ErrorBox, Spinner } from '@/components/ui';
import { PanelEstudiante } from '../estudiante/PanelEstudiante';
import { BotonAsistencia } from '@/components/BotonAsistencia';

export default function VistaPanel() {
  const { classId = '' } = useParams();
  const nav = useNavigate();
  const secciones = useAsync(() => teacherOverview(), []);
  const st = useAsync(async () => {
    const s = await datosPanelSeccion(classId);
    const id = s.clase.course_id;
    const [units, lecciones, progreso] = await Promise.all([getUnits(id), getLessonList(id), lessonProgress(id).catch(() => [])]);
    void conceptMastery; // un estudiante recién inscrito todavía no tiene dominio por concepto
    // progreso de un estudiante recién inscrito: los totales del curso, nada resuelto
    const curso: DatosCurso = {
      units,
      lecciones,
      progreso: progreso.map((p) => ({ ...p, practice_solved: 0, mastery: null, evidence: 0 })),
      dominio: [],
    };
    const datos = construirDatosPanel({
      nombre: 'Estudiante',
      esProfesor: false,
      clases: [s.clase],
      actividades: s.actividades,
      pendientes: [],
      notas: [],
      avisos: s.avisos,
      porCurso: new Map([[id, curso]]),
      ultima: null,
      rutaActividad: (a) => `/docente/actividades/${a}/vista-previa`,
    });
    return { datos, seccion: s };
  }, [classId]);

  return (
    <div>
      <div className="sticky top-14 z-40 mb-4 rounded-xl border-2 border-dashed border-acento-500 bg-acento-100/95 p-3 text-sm text-primario-950 shadow backdrop-blur dark:bg-acento-700/30 dark:text-acento-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">👁 Vista previa del panel de un estudiante</span>
          <label className="flex items-center gap-1 text-xs">
            Sección:
            <select className="campo py-1 text-xs" value={classId} onChange={(e) => nav(`/docente/clases/${e.target.value}/vista-estudiante`)}>
              {(secciones.data ?? []).filter((s) => !s.archived || s.class_id === classId).map((s) => (
                <option key={s.class_id} value={s.class_id}>{s.name}</option>
              ))}
              {!secciones.data && <option value={classId}>…</option>}
            </select>
          </label>
          <Link className="btn-texto ml-auto text-xs" to={`/docente/clases/${classId}`}>Volver a la sección</Link>
        </div>
        <p className="mt-1 text-xs">
          Así ve su inicio un estudiante <strong>recién inscrito</strong> en esta sección: sin progreso ni calificaciones todavía.
          {st.data?.seccion.tieneGrupos && ' Se muestra lo de un estudiante sin grupo (las actividades asignadas a un grupo no aparecen).'}
          {' '}Las actividades abren su vista previa; el progreso de un estudiante concreto está en su ficha, dentro de la sección.
        </p>
      </div>
      {st.loading ? <Spinner /> : st.error ? <ErrorBox error={st.error} onRetry={st.reload} /> : (
        <PanelEstudiante d={st.data!.datos} rutaActividad={(a) => `/docente/actividades/${a}/vista-previa`} asistencia={<BotonAsistencia />} />
      )}
    </div>
  );
}
