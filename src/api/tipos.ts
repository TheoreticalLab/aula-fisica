/** Tipos de las filas de la base de datos y de las respuestas de las funciones RPC. */
import type { AnswerKey, GradeResult, StudentAnswer } from '@calif/tipos.ts';

export type { AnswerKey, GradeResult, StudentAnswer };

export type Role = 'student' | 'teacher' | 'admin';
export type Difficulty = 'basico' | 'intermedio' | 'desafiante';
export type Format = 'choice' | 'truefalse' | 'numeric' | 'text' | 'open';
export type Category = 'seleccion' | 'vf_justificacion' | 'numerica' | 'grafica' | 'conceptual' | 'error' | 'desarrollo' | 'experimento';
export type ExerciseRole = 'practice' | 'reinforcement' | 'bank';
export type Mode = 'practice' | 'exam';
export type RevealPolicy = 'immediate' | 'after_submit' | 'after_close' | 'never';
export type ResponseStatus = 'draft' | 'correct' | 'partial' | 'incorrect' | 'invalid' | 'pending_review' | 'revealed' | 'submitted';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  student_code: string | null;
  role: Role;
  created_at: string;
  login_id: string | null;
  active: boolean;
  must_change_password: boolean;
}

/** Fila del panel de cuentas (admin_list_users). */
export interface CuentaAdmin extends Profile {
  last_sign_in_at: string | null;
  failed_logins_24h: number;
  classes: string[];
}

export interface IntentoSospechoso {
  login_id: string;
  fallos: number;
  ips: number;
  ultimo: string;
  existe: boolean;
  bloqueos: number;
}

/** Aviso de una sección (tabla announcements / my_announcements). */
export interface Aviso {
  id: string;
  class_id: string;
  class_name?: string;
  course_title?: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  visible_until?: string | null;
  author?: string | null;
}

/** Resumen de una sección para el panel docente (teacher_overview). */
export interface SeccionResumen {
  class_id: string;
  name: string;
  term: string;
  archived: boolean;
  join_code: string;
  join_open: boolean;
  course_id: string;
  course_title: string;
  students: number;
  groups: number;
  activities: number;
  open_activities: number;
  pending_review: number;
  mean_pct: number | null;
}

export interface Course {
  id: string;
  title: string;
  code: string | null;
  description: string;
  created_by: string | null;
  created_at: string;
  archived?: boolean;
}

export interface Unit {
  id: string;
  course_id: string;
  slug: string;
  position: number;
  title: string;
  summary: string;
  hidden: boolean;
  coming_soon: boolean;
  planned_topics: string[];
}

export interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit: string;
}
export interface Formula {
  name: string;
  latex: string;
  description: string;
  variables: FormulaVariable[];
  notes?: string;
}
export interface WorkedExample {
  title: string;
  statement: string;
  steps: string[];
  result: string;
  interpretation?: string;
}
export interface LessonSimulation {
  key: string;
  params?: Record<string, number>;
  guide: string;
}

export interface Lesson {
  id: string;
  unit_id: string;
  course_id: string;
  slug: string;
  position: number;
  title: string;
  summary: string;
  hidden: boolean;
  theory: string;
  formulas: Formula[];
  examples: WorkedExample[];
  simulation: LessonSimulation | null;
  practice_config: Record<Difficulty, number>;
  updated_at: string;
}

export interface Concept {
  id: string;
  course_id: string;
  lesson_id: string | null;
  slug: string;
  name: string;
}

export interface Figure {
  kind: 'line' | 'scatter';
  title?: string;
  x: { label: string; unit?: string };
  y: { label: string; unit?: string };
  series: { name: string; points: [number, number][] }[];
}

export interface Exercise {
  id: string;
  course_id: string;
  lesson_id: string | null;
  slug: string;
  position: number;
  category: Category;
  difficulty: Difficulty;
  role: ExerciseRole;
  format: Format;
  concepts: string[];
  prompt: string;
  options: string[] | null;
  multiple: boolean;
  figure: Figure | null;
  simulation: { key: string; params?: Record<string, number> } | null;
  unit_hint: string | null;
  points: number;
  published: boolean;
  updated_at: string;
}

export interface ExerciseKeyRow {
  exercise_id: string;
  answer: AnswerKey;
  hints: string[];
  explanation: string;
}

export interface ClassRow {
  id: string;
  course_id: string;
  name: string;
  term: string;
  join_code: string;
  join_open: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GroupRow {
  id: string;
  class_id: string;
  name: string;
  join_code: string;
}

export interface Activity {
  id: string;
  class_id: string;
  group_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string;
  mode: Mode;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number | null;
  max_tries_per_item: number;
  reveal_policy: RevealPolicy;
  hints_enabled: boolean;
  published: boolean;
  grades_published: boolean;
  created_at: string;
  /** Lectura cronometrada previa a los ejercicios (Markdown) y su tiempo mínimo en segundos. */
  reading_text?: string | null;
  reading_min_seconds?: number | null;
}

/** Estado de la lectura cronometrada de un estudiante (lo cuenta el servidor). */
export interface ReadingState {
  seconds_read: number;
  min_seconds: number;
  completed: boolean;
  pauses: number;
}

export interface ActivityItem {
  activity_id: string;
  exercise_id: string;
  position: number;
  points: number | null;
}

// ---------------------------------------------------------------------------
// Respuestas de RPC
// ---------------------------------------------------------------------------
export interface MyClass {
  class_id: string;
  name: string;
  term: string;
  archived: boolean;
  course_id: string;
  course_title: string;
  group_name: string | null;
  teachers: string[];
}

export interface MyActivity {
  id: string;
  title: string;
  mode: Mode;
  opens_at: string | null;
  closes_at: string | null;
  class_id: string;
  class_name: string;
  course_id: string;
  lesson_id: string | null;
  max_attempts: number | null;
  grades_published: boolean;
  items: number;
  attempts_used: number;
  in_progress: string | null;
  submitted: boolean;
  last_attempt_id: string | null;
  best_score: number | null;
  max_score: number;
  /** Solo en actividades con lectura cronometrada (migración 10). */
  reading_min_seconds?: number | null;
  reading_done?: boolean;
}

export interface MyGrade {
  activity_id: string;
  title: string;
  mode: Mode;
  class_id: string;
  class_name: string;
  closes_at: string | null;
  best_score: number | null;
  max_score: number;
  attempts: number;
  pending_review: boolean;
  last_attempt_id: string | null;
}

export interface PendingPractice {
  attempt_id: string;
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  started_at: string;
  total: number;
  solved: number;
}

export type MasteryLevel = 'dominado' | 'en_progreso' | 'dificultad' | 'pocos_datos';

export interface ConceptMastery {
  concept_slug: string;
  concept_name: string;
  lesson_id: string | null;
  evidence: number;
  score: number | null;
  level: MasteryLevel;
}

export interface LessonProgress {
  lesson_id: string;
  unit_id: string;
  practice_total: number;
  practice_solved: number;
  mastery: number | null;
  evidence: number;
}

export interface Solution {
  answer: AnswerKey;
  explanation: string;
}

export interface AttemptItemResponse {
  id: string;
  answer: StudentAnswer;
  status: ResponseStatus;
  credit: number | null;
  messages: string[];
  tries: number;
  hints_used: number;
  solution_revealed: boolean;
  teacher_feedback: string | null;
  manual_credit: number | null;
  updated_at: string;
}

export interface AttemptItem {
  exercise: Pick<
    Exercise,
    'id' | 'slug' | 'lesson_id' | 'category' | 'difficulty' | 'role' | 'format' | 'concepts' | 'prompt' | 'options' | 'multiple' | 'figure' | 'simulation' | 'unit_hint'
  >;
  points: number;
  response: AttemptItemResponse | null;
  hints: string[] | null;
  hints_total: number;
  locked: boolean;
  solution: Solution | null;
}

export interface AttemptView {
  attempt: {
    id: string;
    status: 'in_progress' | 'submitted';
    mode: Mode;
    attempt_number: number;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    max_score: number | null;
    needs_review: boolean;
    lesson_id: string | null;
    activity_id: string | null;
    course_id: string;
  };
  activity: (Pick<Activity, 'id' | 'title' | 'instructions' | 'mode' | 'opens_at' | 'closes_at' | 'max_attempts' | 'max_tries_per_item' | 'reveal_policy' | 'hints_enabled' | 'grades_published' | 'class_id'>) | null;
  lesson: { id: string; title: string; unit_id: string } | null;
  student: { id: string; full_name: string; email: string | null; student_code: string | null } | null;
  flags: {
    is_owner: boolean;
    is_reviewer: boolean;
    editable: boolean;
    correctness_visible: boolean;
    score_visible: boolean;
    feedback_visible: boolean;
    max_tries: number;
    hints_enabled: boolean;
    reveal_allowed: boolean;
  };
  items: AttemptItem[];
}

export interface CheckResponse {
  result: GradeResult;
  recorded: boolean;
  state?: {
    status: ResponseStatus;
    credit: number | null;
    tries: number;
    max_tries: number;
    locked: boolean;
    solution: Solution | null;
  };
}

export interface Gradebook {
  activities: { id: string; title: string; mode: Mode; closes_at: string | null; published: boolean; grades_published: boolean; group_id: string | null; max_score: number }[];
  students: {
    user_id: string;
    full_name: string;
    login_id: string | null;
    email: string | null;
    student_code: string | null;
    active?: boolean;
    group_id: string | null;
    group_name: string | null;
    grades: Record<string, { best: number | null; submitted: number; in_progress: boolean; needs_review: boolean; last_attempt_id: string }>;
  }[];
}

export interface ReviewItem {
  response_id: string;
  attempt_id: string;
  activity_id: string;
  activity_title: string;
  student: string;
  student_id: string;
  exercise_slug: string;
  prompt: string;
  format: Format;
  status: ResponseStatus;
  updated_at: string;
}

export interface ActivityStats {
  summary: {
    enrolled: number;
    students_started: number;
    students_submitted: number;
    attempts: number;
    mean_best: number | null;
    scores: number[];
  };
  items: {
    exercise_id: string;
    slug: string;
    prompt: string;
    format: Format;
    difficulty: Difficulty;
    concepts: string[];
    answered: number;
    correct: number;
    first_try: number;
    mean_credit: number | null;
    codes: Record<string, number>;
  }[];
}

export interface ClassConceptStat {
  concept_slug: string;
  concept_name: string;
  lesson_id: string | null;
  students: number;
  with_data: number;
  mean: number | null;
  dominado: number;
  en_progreso: number;
  dificultad: number;
}
