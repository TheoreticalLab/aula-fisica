/**
 * Construye los datos del panel de inicio del estudiante a partir de datos ya cargados (función pura).
 * La usan el inicio real del estudiante y la vista previa del profesor, para que ambos se vean igual.
 */
import type { Aviso, ConceptMastery, Lesson, LessonProgress, MyActivity, MyClass, MyGrade, PendingPractice, Unit } from '@/api/tipos';
import type { AvisoPanel, ContinuarItem, CursoPanel, DatosPanel } from '@/pages/estudiante/PanelEstudiante';
import { avisosAutomaticos, origenAviso } from './avisos';
import { NOMBRE_SECCION, type UltimaLeccion } from './ultimaLeccion';
import { fecha, relativo } from './util';

export interface DatosCurso {
  units: Unit[];
  lecciones: Lesson[];
  progreso: LessonProgress[];
  dominio: ConceptMastery[];
}

export interface EntradaPanel {
  nombre: string;
  esProfesor: boolean;
  clases: MyClass[];
  actividades: MyActivity[];
  pendientes: PendingPractice[];
  notas: MyGrade[];
  avisos: Aviso[];
  porCurso: Map<string, DatosCurso>;
  ultima: UltimaLeccion | null;
  ahora?: number;
  /** Ruta de una actividad (por defecto, la del estudiante). */
  rutaActividad?: (id: string) => string;
}

export function construirDatosPanel(e: EntradaPanel): DatosPanel {
  const ahora = e.ahora ?? Date.now();
  const ruta = e.rutaActividad ?? ((id: string) => `/actividad/${id}`);
  const activas = e.clases.filter((c) => !c.archived);
  const cursosIds = [...new Set(activas.map((c) => c.course_id))];

  const cursos: CursoPanel[] = activas.map((c) => {
    const info = e.porCurso.get(c.course_id) ?? { units: [], lecciones: [], progreso: [], dominio: [] };
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
  for (const a of e.actividades) {
    if (a.in_progress && (!a.closes_at || new Date(a.closes_at).getTime() > ahora)) {
      continuar.push({ tipo: 'actividad', titulo: a.title, detalle: `Intento sin entregar${a.closes_at ? ` · cierra ${relativo(a.closes_at)}` : ''}`, enlace: `/intento/${a.in_progress}` });
    }
  }
  const ultima = e.ultima;
  if (ultima && cursosIds.includes(ultima.courseId)) {
    continuar.push({
      tipo: 'leccion',
      titulo: ultima.titulo,
      detalle: `${NOMBRE_SECCION[ultima.seccion] ?? 'Lección'}${ultima.bloque ? ` · ${ultima.bloque}` : ''} · ${fecha(ultima.fecha)}`,
      enlace: `/curso/${ultima.courseId}/leccion/${ultima.lessonId}?s=${ultima.seccion}`,
    });
  }
  for (const p of e.pendientes.filter((x) => x.solved < x.total && x.lesson_id !== ultima?.lessonId).slice(0, 2)) {
    continuar.push({ tipo: 'practica', titulo: p.lesson_title, detalle: `Práctica: ${p.solved} de ${p.total} ejercicios cerrados`, enlace: `/curso/${p.course_id}/leccion/${p.lesson_id}?s=practica` });
  }

  const avisosProfesor: AvisoPanel[] = e.avisos.map((a) => ({
    id: a.id,
    titulo: a.title,
    cuerpo: a.body,
    origen: origenAviso(a.course_title, a.class_name, a.author),
    fecha: a.created_at,
    fijado: a.pinned,
    automatico: false,
  }));

  return {
    nombre: e.nombre,
    esProfesor: e.esProfesor,
    cursos,
    continuar: continuar.slice(0, 3),
    actividades: e.actividades,
    avisos: [
      ...avisosProfesor.filter((a) => a.fijado),
      ...avisosAutomaticos(e.actividades, e.notas, ahora, ruta),
      ...avisosProfesor.filter((a) => !a.fijado),
    ].slice(0, 6),
    notas: e.notas,
  };
}
