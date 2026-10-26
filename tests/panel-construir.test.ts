import { describe, expect, it } from 'vitest';
import type { Lesson, LessonProgress, MyActivity, MyClass, Unit } from '@/api/tipos';
import { construirDatosPanel } from '@/lib/panel';

const ahora = Date.parse('2026-10-26T12:00:00Z');
const clase: MyClass = { class_id: 'c1', name: 'Física Básica', term: '', archived: false, course_id: 'k1', course_title: 'Física Básica', group_name: null, teachers: ['F. Orbe'] };
const units = [{ id: 'u1', course_id: 'k1', position: 1, title: 'Bloque I' }] as unknown as Unit[];
const lecciones = [
  { id: 'l1', unit_id: 'u1', title: 'Magnitudes', hidden: false },
  { id: 'l2', unit_id: 'u1', title: 'Oculta', hidden: true },
  { id: 'l3', unit_id: 'u1', title: 'Vectores', hidden: false },
] as unknown as Lesson[];
const progreso = [
  { lesson_id: 'l1', practice_total: 5, practice_solved: 0, mastery: null, evidence: 0 },
  { lesson_id: 'l3', practice_total: 5, practice_solved: 0, mastery: null, evidence: 0 },
] as unknown as LessonProgress[];
const actividad = (p: Partial<MyActivity>): MyActivity => ({
  id: 'a1', title: 'Tarea', mode: 'practice', opens_at: null, closes_at: null, class_id: 'c1', class_name: 'Física Básica', course_id: 'k1',
  lesson_id: null, max_attempts: null, grades_published: false, items: 4, attempts_used: 0, in_progress: null, submitted: false,
  last_attempt_id: null, best_score: null, max_score: 4, ...p,
});

describe('panel de inicio (construcción compartida por el estudiante y la vista previa)', () => {
  const base = { nombre: 'Estudiante', esProfesor: false, clases: [clase], pendientes: [], notas: [], ultima: null, ahora,
    porCurso: new Map([['k1', { units, lecciones, progreso, dominio: [] }]]) };

  it('un estudiante recién inscrito ve su curso, sin progreso y con la primera lección como siguiente', () => {
    const d = construirDatosPanel({ ...base, actividades: [], avisos: [] });
    expect(d.cursos).toHaveLength(1);
    expect(d.cursos[0]).toMatchObject({ lecciones: 2, practicaResuelta: 0, practicaTotal: 10, dominio: null, siguiente: { lessonId: 'l1' } });
    expect(d.continuar).toEqual([]);
  });

  it('la vista previa del profesor lleva las actividades a su vista previa, también desde los avisos', () => {
    const pronto = new Date(ahora + 5 * 3600_000).toISOString();
    const d = construirDatosPanel({ ...base, actividades: [actividad({ closes_at: pronto })], avisos: [], rutaActividad: (id) => `/docente/actividades/${id}/vista-previa` });
    expect(d.avisos[0].enlace).toBe('/docente/actividades/a1/vista-previa');
  });

  it('por defecto (estudiante real) los enlaces van a la actividad', () => {
    const pronto = new Date(ahora + 5 * 3600_000).toISOString();
    const d = construirDatosPanel({ ...base, actividades: [actividad({ closes_at: pronto })], avisos: [] });
    expect(d.avisos[0].enlace).toBe('/actividad/a1');
  });

  it('los avisos fijados del profesor van primero', () => {
    const d = construirDatosPanel({
      ...base, actividades: [],
      avisos: [
        { id: 'n', class_id: 'c1', title: 'Normal', body: '', pinned: false, created_at: '2026-10-25T00:00:00Z' },
        { id: 'f', class_id: 'c1', title: 'Fijado', body: '', pinned: true, created_at: '2026-10-20T00:00:00Z' },
      ],
    });
    expect(d.avisos.map((a) => a.id)).toEqual(['f', 'n']);
  });
});
