/**
 * Inicio del estudiante: reúne los datos (cursos, avisos, actividades, progreso) y los entrega a PanelEstudiante.
 */
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
import { avisosAutomaticos, origenAviso } from '@/lib/avisos';
import { leerUltimaLeccion, NOMBRE_SECCION } from '@/lib/ultimaLeccion';
import { fecha, relativo, useAsync } from '@/lib/util';
import { ErrorBox, Spinner } from '@/components/ui';
import { PanelEstudiante, type AvisoPanel, type ContinuarItem, type CursoPanel, type DatosPanel } from './PanelEstudiante';

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
    const activas = clases.filter((c) => !c.archived);
    const cursosIds = [...new Set(activas.map((c) => c.course_id))];
    const porCurso = new Map(
      await Promise.all(
        cursosIds.map(async (id) => {
          const [units, lecciones, progreso, dominio] = await Promise.all([getUnits(id), getLessonList(id), lessonProgress(id), conceptMastery(id)]);
          return [id, { units, lecciones, progreso, dominio }] as const;
        }),
      ),
    );

    const cursos: CursoPanel[] = activas.map((c) => {
      const info = porCurso.get(c.course_id)!;
      const orden = info.units.flatMap((u) => info.lecciones.filter((l) => l.unit_id === u.id && !l.hidden));
      const prog = new Map(info.progreso.map((p) => [p.lesson_id, p]));
      const conDominio = info.progreso.filter((p) => p.mastery !== null && p.evidence >= 2);
      const siguiente = orden.find((l) => {
        const p = prog.get(l.id);
        return !p || p.practice_solved < p.practice_total;
      });
      return {
        classId: c.class_id,
        courseId: c.course_id,
        curso: c.course_title,
        seccion: c.name,
        profesores: c.teachers.filter(Boolean),
        lecciones: orden.length,
        practicaResuelta: info.progreso.reduce((s, p) => s + p.practice_solved, 0),
        practicaTotal: info.progreso.reduce((s, p) => s + p.practice_total, 0),
        dominio: conDominio.length ? conDominio.reduce((s, p) => s + Number(p.mastery), 0) / conDominio.length : null,
        dominados: info.dominio.filter((m) => m.level === 'dominado').length,
        dificultad: info.dominio.filter((m) => m.level === 'dificultad').length,
        siguiente: siguiente ? { lessonId: siguiente.id, titulo: siguiente.title } : null,
      };
    });

    // continuar donde lo dejó: actividades en curso, última lección abierta y prácticas a medias
    const continuar: ContinuarItem[] = [];
    const ahora = Date.now();
    for (const a of actividades) {
      if (a.in_progress && (!a.closes_at || new Date(a.closes_at).getTime() > ahora)) {
        continuar.push({ tipo: 'actividad', titulo: a.title, detalle: `Intento sin entregar${a.closes_at ? ` · cierra ${relativo(a.closes_at)}` : ''}`, enlace: `/intento/${a.in_progress}` });
      }
    }
    const ultima = leerUltimaLeccion(profile?.id);
    if (ultima && cursosIds.includes(ultima.courseId)) {
      continuar.push({
        tipo: 'leccion',
        titulo: ultima.titulo,
        detalle: `${NOMBRE_SECCION[ultima.seccion] ?? 'Lección'}${ultima.bloque ? ` · ${ultima.bloque}` : ''} · ${fecha(ultima.fecha)}`,
        enlace: `/curso/${ultima.courseId}/leccion/${ultima.lessonId}?s=${ultima.seccion}`,
      });
    }
    for (const p of pendientes.filter((x) => x.solved < x.total && x.lesson_id !== ultima?.lessonId).slice(0, 2)) {
      continuar.push({ tipo: 'practica', titulo: p.lesson_title, detalle: `Práctica: ${p.solved} de ${p.total} ejercicios cerrados`, enlace: `/curso/${p.course_id}/leccion/${p.lesson_id}?s=practica` });
    }

    const avisosProfesor: AvisoPanel[] = avisos.map((a) => ({
      id: a.id,
      titulo: a.title,
      cuerpo: a.body,
      origen: origenAviso(a.course_title, a.class_name, a.author),
      fecha: a.created_at,
      fijado: a.pinned,
      automatico: false,
    }));

    return {
      nombre: profile?.full_name?.split(' ')[0] ?? '',
      esProfesor: isTeacher,
      cursos,
      continuar: continuar.slice(0, 3),
      actividades,
      avisos: [...avisosProfesor.filter((a) => a.fijado), ...avisosAutomaticos(actividades, notas), ...avisosProfesor.filter((a) => !a.fijado)].slice(0, 6),
      notas,
    };
  }, [profile?.id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return <PanelEstudiante d={data!} />;
}
