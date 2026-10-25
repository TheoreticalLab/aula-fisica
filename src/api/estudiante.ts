/** Operaciones de lectura y escritura para estudiantes (y lectura de contenido para cualquiera). */
import { calificar, errorMessage, rpc, supabase } from '@/lib/supabase';
import type {
  AttemptView,
  CheckResponse,
  Concept,
  ConceptMastery,
  Course,
  Exercise,
  Lesson,
  LessonProgress,
  MyActivity,
  MyClass,
  MyGrade,
  PendingPractice,
  Solution,
  StudentAnswer,
  Unit,
} from './tipos';

async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(errorMessage(error));
  return data as T;
}

// --- contenido ---------------------------------------------------------------
export const getCourse = (id: string) => q<Course>(supabase.from('courses').select('*').eq('id', id).single());

export const getUnits = (courseId: string) =>
  q<Unit[]>(supabase.from('units').select('*').eq('course_id', courseId).order('position'));

export const LESSON_LIST_COLUMNS = 'id, unit_id, course_id, slug, position, title, summary, hidden, simulation, updated_at';

export const getLessonList = (courseId: string) =>
  q<Lesson[]>(supabase.from('lessons').select(LESSON_LIST_COLUMNS).eq('course_id', courseId).order('position'));

export const getLesson = (id: string) => q<Lesson>(supabase.from('lessons').select('*').eq('id', id).single());

export const getConcepts = (courseId: string) =>
  q<Concept[]>(supabase.from('concepts').select('*').eq('course_id', courseId));

export const getExercise = (id: string) => q<Exercise>(supabase.from('exercises').select('*').eq('id', id).single());

// --- matrícula y paneles --------------------------------------------------------
export const joinClass = (code: string) =>
  rpc<{ ok: boolean; error?: string; class_id?: string; class_name?: string; group_name?: string | null; already?: boolean }>('join_class', {
    p_code: code,
  });
export const myClasses = () => rpc<MyClass[]>('my_classes');
export const myActivities = () => rpc<MyActivity[]>('my_activities');
export const myGrades = () => rpc<MyGrade[]>('my_grades');
export const myPendingPractice = () => rpc<PendingPractice[]>('my_pending_practice');
export const conceptMastery = (courseId: string, userId?: string) =>
  rpc<ConceptMastery[]>('concept_mastery', { p_course: courseId, p_user: userId ?? null });
export const lessonProgress = (courseId: string, userId?: string) =>
  rpc<LessonProgress[]>('lesson_progress', { p_course: courseId, p_user: userId ?? null });

// --- intentos -------------------------------------------------------------------
export const startLessonPractice = (lessonId: string) => rpc<string>('start_lesson_practice', { p_lesson: lessonId });
export const restartLessonPractice = (lessonId: string) => rpc<string>('restart_lesson_practice', { p_lesson: lessonId });
export const startActivityAttempt = (activityId: string) => rpc<string>('start_activity_attempt', { p_activity: activityId });
export const getAttempt = (attemptId: string) => rpc<AttemptView>('get_attempt', { p_attempt: attemptId });
export const saveResponse = (attemptId: string, exerciseId: string, answer: StudentAnswer) =>
  rpc<void>('save_response', { p_attempt: attemptId, p_exercise: exerciseId, p_answer: answer });
export const getHint = (attemptId: string, exerciseId: string) =>
  rpc<{ hint: string | null; index: number; total: number }>('get_hint', { p_attempt: attemptId, p_exercise: exerciseId });
export const revealSolution = (attemptId: string, exerciseId: string) =>
  rpc<Solution>('reveal_solution', { p_attempt: attemptId, p_exercise: exerciseId });
export const reinforcementFor = (exerciseId: string) =>
  rpc<{ exercise_id: string; lesson_id: string; difficulty: string }[]>('reinforcement_for', { p_exercise: exerciseId, p_limit: 2 });

/** Calificación en el servidor (Edge Function). */
export const checkAnswer = (attemptId: string, exerciseId: string, answer: StudentAnswer) =>
  calificar<CheckResponse>({ action: 'check', attempt_id: attemptId, exercise_id: exerciseId, answer });
export const submitAttempt = (attemptId: string) => calificar<{ state: { status: string } }>({ action: 'submit', attempt_id: attemptId });

// --- perfil ---------------------------------------------------------------------
export async function updateMyProfile(id: string, patch: { full_name?: string; student_code?: string | null }) {
  await q(supabase.from('profiles').update(patch).eq('id', id).select('id'));
}
