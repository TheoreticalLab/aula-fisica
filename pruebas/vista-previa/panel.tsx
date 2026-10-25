/**
 * Vista previa del panel del estudiante con DATOS DE EJEMPLO (sin base de datos), solo para desarrollo y capturas.
 *   http://127.0.0.1:5173/pruebas/vista-previa/panel.html            (estudiante con dos cursos)
 *   http://127.0.0.1:5173/pruebas/vista-previa/panel.html?vacio=1    (recién activado, sin sección)
 *   ...&tema=oscuro
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/index.css';
import type { MyActivity, MyGrade } from '../../src/api/tipos';
import { PanelEstudiante, type DatosPanel } from '../../src/pages/estudiante/PanelEstudiante';
import { avisosAutomaticos } from '../../src/lib/avisos';

const ahora = Date.now();
const h = (horas: number) => new Date(ahora + horas * 3600_000).toISOString();

const actividad = (p: Partial<MyActivity>): MyActivity => ({
  id: crypto.randomUUID(), title: '', mode: 'practice', opens_at: null, closes_at: null, class_id: 'c1', class_name: 'Física Básica',
  course_id: 'fb', lesson_id: null, max_attempts: null, grades_published: false, items: 6, attempts_used: 0, in_progress: null,
  submitted: false, last_attempt_id: null, best_score: null, max_score: 10, ...p,
});

const actividades: MyActivity[] = [
  actividad({ title: 'Tarea 3 · Movimiento rectilíneo', closes_at: h(20), in_progress: 'i1', attempts_used: 1 }),
  actividad({ title: 'Quiz de vectores', mode: 'exam', closes_at: h(96), max_attempts: 1 }),
  actividad({ title: 'Taller de conversión de unidades', closes_at: h(24 * 9), class_name: 'Física General 1-A', course_id: 'fg1' }),
];
const notas: MyGrade[] = [
  { activity_id: 'g1', title: 'Quiz 1 · Magnitudes y unidades', mode: 'exam', class_id: 'c1', class_name: 'Física Básica', closes_at: h(-72), best_score: 8.5, max_score: 10, attempts: 1, pending_review: false, last_attempt_id: 'a1' },
  { activity_id: 'g2', title: 'Tarea 2 · Cifras significativas', mode: 'practice', class_id: 'c1', class_name: 'Física Básica', closes_at: h(-200), best_score: 6, max_score: 10, attempts: 2, pending_review: true, last_attempt_id: 'a2' },
];

const lleno: DatosPanel = {
  nombre: 'Valentina',
  esProfesor: false,
  cursos: [
    { classId: 'c1', courseId: 'fb', curso: 'Física Básica', seccion: 'Física Básica', profesores: ['Francisco Orbe'], lecciones: 26, practicaResuelta: 34, practicaTotal: 80, dominio: 0.72, dominados: 9, dificultad: 2, siguiente: { lessonId: 'l5', titulo: 'Movimiento rectilíneo uniformemente acelerado' } },
    { classId: 'c2', courseId: 'fg1', curso: 'Física General I', seccion: 'Física General 1-A', profesores: ['Francisco Orbe'], lecciones: 0, practicaResuelta: 0, practicaTotal: 0, dominio: null, dominados: 0, dificultad: 0, siguiente: null },
  ],
  continuar: [
    { tipo: 'actividad', titulo: 'Tarea 3 · Movimiento rectilíneo', detalle: 'Intento sin entregar · cierra en 20 horas', enlace: '/intento/i1' },
    { tipo: 'leccion', titulo: 'Movimiento rectilíneo uniforme', detalle: 'Ejemplos · Bloque II · Cinemática · hoy', enlace: '/curso/fb/leccion/l4?s=ejemplos' },
    { tipo: 'practica', titulo: 'Vectores en el plano', detalle: 'Práctica: 3 de 5 ejercicios cerrados', enlace: '/curso/fb/leccion/l3?s=practica' },
  ],
  actividades,
  avisos: [
    { id: 'a1', titulo: 'Parcial 1 el lunes 3 de noviembre', cuerpo: 'Entra hasta MRUA. Traigan calculadora científica.', origen: 'Física Básica · Francisco Orbe', fecha: h(-5), fijado: true, automatico: false },
    ...avisosAutomaticos(actividades, notas, ahora),
  ],
  notas,
};

const vacio: DatosPanel = { nombre: 'Andrés', esProfesor: false, cursos: [], continuar: [], actividades: [], avisos: [], notas: [] };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PanelEstudiante d={new URLSearchParams(location.search).get('vacio') ? vacio : lleno} />
      </main>
    </MemoryRouter>
  </StrictMode>,
);
