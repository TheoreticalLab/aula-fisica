/** Operaciones del panel docente. La autorización real la aplican las políticas RLS y las funciones SQL. */
import { calificar, errorMessage, invocar, rpc, supabase } from '@/lib/supabase';
import type {
  Activity,
  ActivityItem,
  ActivityStats,
  Aviso,
  ClassConceptStat,
  ClassRow,
  Concept,
  Course,
  CuentaAdmin,
  Exercise,
  ExerciseKeyRow,
  Gradebook,
  GroupRow,
  IntentoSospechoso,
  Lesson,
  MyActivity,
  Profile,
  ReviewItem,
  Role,
  SeccionResumen,
  Unit,
} from './tipos';

// Sin tipos generados del esquema, supabase-js infiere los «embeds» como arreglos; el tipo real lo fija T.
async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(errorMessage(error));
  return data as T;
}

// --- cursos y contenido -----------------------------------------------------------
export const listCourses = () => q<Course[]>(supabase.from('courses').select('*').order('created_at'));
export const createCourse = (c: Pick<Course, 'title' | 'code' | 'description'>) =>
  q<Course>(supabase.from('courses').insert(c).select().single());
export const updateCourse = (id: string, patch: Partial<Course>) =>
  q<Course>(supabase.from('courses').update(patch).eq('id', id).select().single());
export const isCourseStaff = (courseId: string) => rpc<boolean>('is_course_staff', { p_course: courseId });
export const courseStaff = (courseId: string) =>
  q<{ user_id: string; profiles: { full_name: string; login_id: string | null } | null }[]>(
    supabase.from('course_staff').select('user_id, profiles(full_name, login_id)').eq('course_id', courseId),
  );
export const addCourseStaff = (courseId: string, email: string) =>
  rpc<{ ok: boolean; error?: string }>('add_course_staff_by_email', { p_course: courseId, p_email: email });

export const createUnit = (u: Partial<Unit> & { course_id: string; slug: string; title: string }) =>
  q<Unit>(supabase.from('units').insert(u).select().single());
export const updateUnit = (id: string, patch: Partial<Unit>) => q<Unit>(supabase.from('units').update(patch).eq('id', id).select().single());
export const deleteUnit = (id: string) => q(supabase.from('units').delete().eq('id', id));

export const createLesson = (l: Partial<Lesson> & { unit_id: string; course_id: string; slug: string; title: string }) =>
  q<Lesson>(supabase.from('lessons').insert(l).select().single());
export const updateLesson = (id: string, patch: Partial<Lesson>) =>
  q<Lesson>(supabase.from('lessons').update(patch).eq('id', id).select().single());
export const deleteLesson = (id: string) => q(supabase.from('lessons').delete().eq('id', id));

export const upsertConcept = (c: Omit<Concept, 'id'>) =>
  q<Concept>(supabase.from('concepts').upsert(c, { onConflict: 'course_id,slug' }).select().single());
export const deleteConcept = (id: string) => q(supabase.from('concepts').delete().eq('id', id));

// --- ejercicios y claves -------------------------------------------------------------
export interface ExerciseFilter {
  courseId: string;
  lessonId?: string | 'none';
  difficulty?: string;
  category?: string;
  role?: string;
  search?: string;
}

export function listExercises(f: ExerciseFilter) {
  let query = supabase.from('exercises').select('*').eq('course_id', f.courseId);
  if (f.lessonId === 'none') query = query.is('lesson_id', null);
  else if (f.lessonId) query = query.eq('lesson_id', f.lessonId);
  if (f.difficulty) query = query.eq('difficulty', f.difficulty);
  if (f.category) query = query.eq('category', f.category);
  if (f.role) query = query.eq('role', f.role);
  if (f.search) query = query.or(`prompt.ilike.%${f.search.replace(/[%,()]/g, ' ')}%,slug.ilike.%${f.search.replace(/[%,()]/g, ' ')}%`);
  return q<Exercise[]>(query.order('lesson_id', { nullsFirst: false }).order('position').limit(500));
}

export const getExerciseFull = async (id: string) => {
  const ex = await q<Exercise>(supabase.from('exercises').select('*').eq('id', id).single());
  const { data: key, error } = await supabase.from('exercise_keys').select('*').eq('exercise_id', id).maybeSingle();
  if (error) throw new Error(errorMessage(error));
  return { exercise: ex, key: key as ExerciseKeyRow | null };
};

export async function saveExercise(ex: Partial<Exercise> & { course_id: string }, key: Omit<ExerciseKeyRow, 'exercise_id'>) {
  const { id, updated_at: _u, ...fields } = ex;
  void _u;
  const saved = id
    ? await q<Exercise>(supabase.from('exercises').update(fields).eq('id', id).select().single())
    : await q<Exercise>(supabase.from('exercises').insert(fields).select().single());
  await q(supabase.from('exercise_keys').upsert({ exercise_id: saved.id, ...key }).select('exercise_id'));
  return saved;
}

export const deleteExercise = (id: string) => q(supabase.from('exercises').delete().eq('id', id));

// --- clases, grupos y matrícula -------------------------------------------------------------
export const listMyTeachingClasses = async (userId: string) => {
  const rows = await q<{ class_id: string }[]>(supabase.from('class_teachers').select('class_id').eq('user_id', userId));
  if (!rows.length) return [] as ClassRow[];
  return q<ClassRow[]>(supabase.from('classes').select('*').in('id', rows.map((r) => r.class_id)).order('created_at', { ascending: false }));
};
export const getClass = (id: string) => q<ClassRow>(supabase.from('classes').select('*').eq('id', id).single());
export const createClass = (c: Pick<ClassRow, 'course_id' | 'name' | 'term'>) => q<ClassRow>(supabase.from('classes').insert(c).select().single());
export const updateClass = (id: string, patch: Partial<ClassRow>) =>
  q<ClassRow>(supabase.from('classes').update(patch).eq('id', id).select().single());
export const regenerateJoinCode = (classId: string) => rpc<string>('regenerate_join_code', { p_class: classId });
export const listGroups = (classId: string) => q<GroupRow[]>(supabase.from('class_groups').select('*').eq('class_id', classId).order('name'));
export const createGroup = (classId: string, name: string) =>
  q<GroupRow>(supabase.from('class_groups').insert({ class_id: classId, name }).select().single());
export const deleteGroup = (id: string) => q(supabase.from('class_groups').delete().eq('id', id));
export const classTeachers = (classId: string) =>
  q<{ user_id: string; profiles: { full_name: string; login_id: string | null } | null }[]>(
    supabase.from('class_teachers').select('user_id, profiles(full_name, login_id)').eq('class_id', classId),
  );
export const addClassTeacher = (classId: string, email: string) =>
  rpc<{ ok: boolean; error?: string }>('add_class_teacher_by_email', { p_class: classId, p_email: email });

export interface RosterRow {
  user_id: string;
  group_id: string | null;
  enrolled_at: string;
  profiles: Pick<Profile, 'full_name' | 'login_id' | 'student_code' | 'active'> | null;
}
export const roster = (classId: string) =>
  q<RosterRow[]>(
    supabase.from('enrollments').select('user_id, group_id, enrolled_at, profiles(full_name, login_id, student_code, active)').eq('class_id', classId),
  );
export const setStudentGroup = (classId: string, userId: string, groupId: string | null) =>
  q(supabase.from('enrollments').update({ group_id: groupId }).eq('class_id', classId).eq('user_id', userId).select('user_id'));
export const removeStudent = (classId: string, userId: string) =>
  q(supabase.from('enrollments').delete().eq('class_id', classId).eq('user_id', userId));

// --- actividades ------------------------------------------------------------------------------
export const listActivities = (classId: string) =>
  q<Activity[]>(supabase.from('activities').select('*').eq('class_id', classId).order('created_at', { ascending: false }));
export const getActivity = (id: string) => q<Activity>(supabase.from('activities').select('*').eq('id', id).single());
export const createActivity = (a: Partial<Activity> & { class_id: string; title: string }) =>
  q<Activity>(supabase.from('activities').insert(a).select().single());
export const updateActivity = (id: string, patch: Partial<Activity>) =>
  q<Activity>(supabase.from('activities').update(patch).eq('id', id).select().single());
export const deleteActivity = (id: string) => q(supabase.from('activities').delete().eq('id', id));
/**
 * Datos del panel de inicio tal como los vería un estudiante RECIÉN inscrito en la sección (sin grupo, sin progreso):
 * actividades publicadas, avisos vigentes y el temario visible. Se construye con lo que el profesor ya puede leer.
 */
export async function datosPanelSeccion(classId: string) {
  const cls = await q<ClassRow>(supabase.from('classes').select('*').eq('id', classId).single());
  const [curso, profes, acts, avisos, grupos] = await Promise.all([
    q<{ title: string }>(supabase.from('courses').select('title').eq('id', cls.course_id).single()),
    supabase.from('class_teachers').select('profiles(full_name)').eq('class_id', classId),
    q<Activity[]>(supabase.from('activities').select('*').eq('class_id', classId).eq('published', true).is('group_id', null)),
    supabase.from('announcements').select('*, autor:profiles!announcements_created_by_fkey(full_name)').eq('class_id', classId),
    q<{ id: string }[]>(supabase.from('class_groups').select('id').eq('class_id', classId)),
  ]);
  const nombresProfes = ((profes.data ?? []) as { profiles: { full_name: string } | { full_name: string }[] | null }[])
    .flatMap((r) => (Array.isArray(r.profiles) ? r.profiles : r.profiles ? [r.profiles] : []))
    .map((p) => p.full_name)
    .filter(Boolean);
  const ids = acts.map((a) => a.id);
  const items = ids.length
    ? await q<{ activity_id: string; points: number | null; exercises: { points: number } | { points: number }[] | null }[]>(
        supabase.from('activity_items').select('activity_id, points, exercises(points)').in('activity_id', ids),
      )
    : [];
  const ahora = Date.now();
  const actividades: MyActivity[] = acts
    .map((a) => {
      const suyos = items.filter((i) => i.activity_id === a.id);
      const max = suyos.reduce((s, i) => {
        const e = Array.isArray(i.exercises) ? i.exercises[0] : i.exercises;
        return s + Number(i.points ?? e?.points ?? 0);
      }, 0);
      return {
        id: a.id, title: a.title, mode: a.mode, opens_at: a.opens_at, closes_at: a.closes_at, class_id: cls.id, class_name: cls.name,
        course_id: cls.course_id, lesson_id: a.lesson_id, max_attempts: a.max_attempts, grades_published: a.grades_published,
        items: suyos.length, attempts_used: 0, in_progress: null, submitted: false, last_attempt_id: null, best_score: null, max_score: max,
        reading_min_seconds: a.reading_min_seconds ?? null, reading_done: false,
      };
    })
    .sort((x, y) => (x.closes_at ?? '9999').localeCompare(y.closes_at ?? '9999'));
  // si la migración de avisos no estuviera aplicada, simplemente no hay avisos
  const filas = (avisos.data ?? []) as (Aviso & { autor?: { full_name: string } | null })[];
  const avisosVigentes: Aviso[] = filas
    .filter((a) => (!a.visible_until || new Date(a.visible_until).getTime() > ahora) && new Date(a.created_at).getTime() > ahora - 120 * 86400_000)
    .sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.created_at.localeCompare(x.created_at))
    .map((a) => ({ ...a, class_name: cls.name, course_title: curso.title, author: a.autor?.full_name ?? null }));
  return {
    clase: { class_id: cls.id, name: cls.name, term: cls.term, archived: cls.archived, course_id: cls.course_id, course_title: curso.title, group_name: null, teachers: nombresProfes },
    actividades,
    avisos: avisosVigentes,
    tieneGrupos: grupos.length > 0,
  };
}

/** Todo lo necesario para la vista previa de una actividad «como estudiante» (incluidas las claves, que solo lee el profesorado). */
export async function vistaPreviaActividad(activityId: string) {
  const act = await q<Activity>(supabase.from('activities').select('*').eq('id', activityId).single());
  const [cls, items] = await Promise.all([
    q<{ id: string; name: string; course_id: string }>(supabase.from('classes').select('id, name, course_id').eq('id', act.class_id).single()),
    q<ActivityItem[]>(supabase.from('activity_items').select('*').eq('activity_id', activityId).order('position')),
  ]);
  const ids = items.map((i) => i.exercise_id);
  const [exercises, keys] = ids.length
    ? await Promise.all([
        q<Exercise[]>(supabase.from('exercises').select('*').in('id', ids)),
        q<ExerciseKeyRow[]>(supabase.from('exercise_keys').select('exercise_id, answer, hints, explanation').in('exercise_id', ids)),
      ])
    : [[], []];
  return { act, cls, items, exercises, keys };
}
export const activityItems = (activityId: string) =>
  q<ActivityItem[]>(supabase.from('activity_items').select('*').eq('activity_id', activityId).order('position'));
export async function setActivityItems(activityId: string, items: { exercise_id: string; points: number | null }[]) {
  await q(supabase.from('activity_items').delete().eq('activity_id', activityId));
  if (items.length) {
    await q(
      supabase
        .from('activity_items')
        .insert(items.map((it, i) => ({ activity_id: activityId, exercise_id: it.exercise_id, points: it.points, position: i + 1 })))
        .select('exercise_id'),
    );
  }
}
export const activityAttempts = (activityId: string) =>
  q<
    {
      id: string;
      user_id: string;
      status: string;
      attempt_number: number;
      started_at: string;
      submitted_at: string | null;
      score: number | null;
      max_score: number | null;
      needs_review: boolean;
    }[]
  >(supabase.from('attempts').select('id, user_id, status, attempt_number, started_at, submitted_at, score, max_score, needs_review').eq('activity_id', activityId).order('started_at'));
export const finalizeActivity = (activityId: string) =>
  calificar<{ finalized: number; errors: string[] }>({ action: 'finalize', activity_id: activityId });

// --- calificación, revisión y estadísticas ---------------------------------------------------------
export const gradebook = (classId: string) => rpc<Gradebook>('gradebook', { p_class: classId });
export const reviewQueue = (classId: string) => rpc<ReviewItem[]>('review_queue', { p_class: classId });
export const gradeResponse = (responseId: string, credit: number | null, feedback: string) =>
  rpc<void>('grade_response', { p_response: responseId, p_credit: credit, p_feedback: feedback });
export const activityStats = (activityId: string) => rpc<ActivityStats>('activity_stats', { p_activity: activityId });
export const classConceptStats = (classId: string) => rpc<ClassConceptStat[]>('class_concept_stats', { p_class: classId });
export const responseEvents = (responseId: string) =>
  q<{ id: number; kind: string; answer: unknown; result: unknown; created_at: string }[]>(
    supabase.from('response_events').select('id, kind, answer, result, created_at').eq('response_id', responseId).order('created_at'),
  );

// --- avisos --------------------------------------------------------------------------------------------------
export const listAnnouncements = (classId: string) =>
  q<Aviso[]>(supabase.from('announcements').select('*').eq('class_id', classId).order('pinned', { ascending: false }).order('created_at', { ascending: false }));
export const createAnnouncement = (a: { class_id: string; title: string; body: string; pinned: boolean; visible_until: string | null }) =>
  q<Aviso>(supabase.from('announcements').insert(a).select().single());
export const updateAnnouncement = (id: string, patch: Partial<Pick<Aviso, 'title' | 'body' | 'pinned' | 'visible_until'>>) =>
  q<Aviso>(supabase.from('announcements').update(patch).eq('id', id).select().single());
export const deleteAnnouncement = (id: string) => q(supabase.from('announcements').delete().eq('id', id));

// --- secciones -------------------------------------------------------------------------------------------
export const teacherOverview = () => rpc<SeccionResumen[]>('teacher_overview');
export const enrollByLogin = (classId: string, logins: string[], groupId: string | null) =>
  rpc<{ matriculados: string[]; ya_estaban: string[]; no_encontrados: string[]; no_son_estudiantes: string[] }>('enroll_students_by_login', {
    p_class: classId,
    p_logins: logins,
    p_group: groupId,
  });
export const copyActivityToClasses = (activityId: string, classIds: string[]) =>
  rpc<{ class_id: string; activity_id: string }[]>('copy_activity_to_classes', { p_activity: activityId, p_classes: classIds });

// --- administración de cuentas ------------------------------------------------------------------------------
export const adminListUsers = (query: string) => rpc<CuentaAdmin[]>('admin_list_users', { p_query: query });
export const adminSetRole = (userId: string, role: Role) => rpc<void>('admin_set_role', { p_user: userId, p_role: role });
export const adminSuspiciousLogins = () => rpc<IntentoSospechoso[]>('admin_suspicious_logins');

export interface CuentaNueva {
  login_id: string;
  full_name: string;
  student_code?: string;
  role?: 'student' | 'teacher';
  class_ids?: string[];
}
export interface ResultadoCuenta {
  login_id: string;
  full_name: string;
  password?: string;
  matriculas?: number;
  error?: string;
}
export const crearCuentas = (cuentas: CuentaNueva[]) => invocar<{ resultados: ResultadoCuenta[] }>('admin-cuentas', { accion: 'crear', cuentas });
export const restablecerCuenta = (userId: string) =>
  invocar<{ login_id: string; full_name: string; password: string }>('admin-cuentas', { accion: 'restablecer', user_id: userId });
export const suspenderCuenta = (userId: string, suspender: boolean) => invocar<{ ok: boolean }>('admin-cuentas', { accion: 'suspender', user_id: userId, suspender });
