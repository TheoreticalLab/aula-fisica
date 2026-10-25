-- =============================================================================
-- Aula Virtual de Física Básica · 1. Esquema
-- =============================================================================
-- Contenido (cursos → unidades → lecciones → ejercicios) separado de la docencia
-- (clases → grupos → matrículas → actividades → intentos → respuestas).
-- Las claves de respuesta viven en una tabla aparte (exercise_keys) sin acceso para estudiantes.

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Perfiles y roles
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('student', 'teacher', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  student_code text check (char_length(student_code) <= 40),
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Datos personales. Visibles solo para el propio usuario, sus profesores y los administradores.';

-- -----------------------------------------------------------------------------
-- Contenido
-- -----------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  code text unique check (char_length(code) <= 40),
  description text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.course_staff (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '',
  hidden boolean not null default false,
  coming_soon boolean not null default false,
  planned_topics text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '',
  hidden boolean not null default false,
  theory text not null default '',
  formulas jsonb not null default '[]'::jsonb check (jsonb_typeof(formulas) = 'array'),
  examples jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  simulation jsonb check (simulation is null or jsonb_typeof(simulation) = 'object'),
  practice_config jsonb not null default '{"basico": 3, "intermedio": 1, "desafiante": 1}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null,
  unique (course_id, slug)
);

create type public.exercise_difficulty as enum ('basico', 'intermedio', 'desafiante');
create type public.exercise_format as enum ('choice', 'truefalse', 'numeric', 'text', 'open');
create type public.exercise_role as enum ('practice', 'reinforcement', 'bank');
create type public.exercise_category as enum (
  'seleccion', 'vf_justificacion', 'numerica', 'grafica', 'conceptual', 'error', 'desarrollo', 'experimento'
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  slug text not null,
  position integer not null default 0,
  category public.exercise_category not null,
  difficulty public.exercise_difficulty not null,
  role public.exercise_role not null default 'practice',
  format public.exercise_format not null,
  concepts text[] not null default '{}',
  prompt text not null,
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  multiple boolean not null default false,
  figure jsonb,
  simulation jsonb,
  unit_hint text,
  points numeric(6, 2) not null default 1 check (points > 0),
  published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  check (format <> 'choice' or (options is not null and jsonb_array_length(options) >= 2))
);
create index exercises_lesson_idx on public.exercises (lesson_id, role, difficulty, position);
create index exercises_concepts_idx on public.exercises using gin (concepts);

-- PROTEGIDA: clave, pistas y explicación. Los estudiantes no tienen ningún acceso directo.
create table public.exercise_keys (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  answer jsonb not null check (jsonb_typeof(answer) = 'object' and answer ? 'format'),
  hints jsonb not null default '[]'::jsonb check (jsonb_typeof(hints) = 'array'),
  explanation text not null default '',
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Docencia: clases, grupos, matrículas
-- -----------------------------------------------------------------------------

-- Código de matrícula: 8 caracteres sin ambigüedades (sin 0/O, 1/I/L). ~1.1e12 combinaciones.
create or replace function public.gen_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  term text not null default '',
  join_code text not null unique default public.gen_join_code(),
  join_open boolean not null default true,
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.class_teachers (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (class_id, user_id)
);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique default public.gen_join_code(),
  created_at timestamptz not null default now()
);

create table public.enrollments (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index enrollments_user_idx on public.enrollments (user_id);

-- -----------------------------------------------------------------------------
-- Actividades, intentos y respuestas
-- -----------------------------------------------------------------------------
create type public.activity_mode as enum ('practice', 'exam');
create type public.reveal_policy as enum ('immediate', 'after_submit', 'after_close', 'never');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null default '',
  mode public.activity_mode not null default 'practice',
  opens_at timestamptz,
  closes_at timestamptz,
  max_attempts integer check (max_attempts is null or max_attempts between 1 and 50),
  max_tries_per_item integer not null default 3 check (max_tries_per_item between 1 and 20),
  reveal_policy public.reveal_policy not null default 'immediate',
  hints_enabled boolean not null default true,
  published boolean not null default false,
  grades_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  -- «después del cierre» necesita una fecha de cierre
  check (reveal_policy <> 'after_close' or closes_at is not null),
  -- en evaluación no hay retroalimentación inmediata ni pistas
  check (mode = 'practice' or (reveal_policy <> 'immediate' and hints_enabled = false))
);
create index activities_class_idx on public.activities (class_id);

create table public.activity_items (
  activity_id uuid not null references public.activities (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  points numeric(6, 2) check (points is null or points > 0),
  primary key (activity_id, exercise_id)
);

create type public.attempt_status as enum ('in_progress', 'submitted');

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  mode public.activity_mode not null,
  status public.attempt_status not null default 'in_progress',
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(8, 2),
  max_score numeric(8, 2),
  needs_review boolean not null default false,
  check (activity_id is not null or lesson_id is not null)
);
create index attempts_user_idx on public.attempts (user_id, activity_id);
create index attempts_activity_idx on public.attempts (activity_id);
-- una práctica libre abierta por lección y estudiante
create unique index attempts_one_lesson_practice on public.attempts (user_id, lesson_id)
  where activity_id is null and status = 'in_progress';
-- un intento en curso por actividad y estudiante
create unique index attempts_one_open_per_activity on public.attempts (user_id, activity_id)
  where activity_id is not null and status = 'in_progress';

create type public.response_status as enum (
  'draft', 'correct', 'partial', 'incorrect', 'invalid', 'pending_review', 'revealed'
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  status public.response_status not null default 'draft',
  auto_credit numeric(4, 3) check (auto_credit between 0 and 1),
  manual_credit numeric(4, 3) check (manual_credit between 0 and 1),
  points numeric(6, 2) not null default 1,
  engine_code text,
  engine_messages jsonb not null default '[]'::jsonb,
  tries integer not null default 0,
  hints_used integer not null default 0,
  first_try_correct boolean,
  solution_revealed boolean not null default false,
  teacher_feedback text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (attempt_id, exercise_id)
);
create index responses_exercise_idx on public.responses (exercise_id);
create index responses_user_idx on public.responses (user_id);

-- Registro de cada envío (auditoría de intentos)
create table public.response_events (
  id bigint generated always as identity primary key,
  response_id uuid not null references public.responses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('check', 'submit', 'hint', 'reveal', 'manual_grade')),
  answer jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index response_events_response_idx on public.response_events (response_id);

-- -----------------------------------------------------------------------------
-- Mantenimiento automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger units_touch before update on public.units for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
create trigger exercises_touch before update on public.exercises for each row execute function public.touch_updated_at();
create trigger keys_touch before update on public.exercise_keys for each row execute function public.touch_updated_at();
create trigger activities_touch before update on public.activities for each row execute function public.touch_updated_at();
create trigger responses_touch before update on public.responses for each row execute function public.touch_updated_at();

-- course_id de la lección coherente con su unidad
create or replace function public.lessons_sync_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  select u.course_id into new.course_id from public.units u where u.id = new.unit_id;
  return new;
end;
$$;
create trigger lessons_sync_course before insert or update of unit_id on public.lessons
  for each row execute function public.lessons_sync_course();

-- el ejercicio de una lección pertenece al curso de la lección
create or replace function public.exercises_check_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lesson_id is not null and not exists (
    select 1 from public.lessons l where l.id = new.lesson_id and l.course_id = new.course_id
  ) then
    raise exception 'La lección no pertenece al curso del ejercicio';
  end if;
  return new;
end;
$$;
create trigger exercises_check_course before insert or update of lesson_id, course_id on public.exercises
  for each row execute function public.exercises_check_course();

-- los ejercicios de una actividad deben ser del curso de su clase
create or replace function public.activity_items_check_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.activities a
    join public.classes c on c.id = a.class_id
    join public.exercises e on e.course_id = c.course_id
    where a.id = new.activity_id and e.id = new.exercise_id
  ) then
    raise exception 'El ejercicio no pertenece al curso de la clase';
  end if;
  return new;
end;
$$;
create trigger activity_items_check_course before insert or update on public.activity_items
  for each row execute function public.activity_items_check_course();

-- una clase no cambia de curso (evita obtener acceso a las claves de otro curso)
create or replace function public.classes_lock_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.course_id <> old.course_id then
    raise exception 'No se puede cambiar el curso de una clase existente';
  end if;
  return new;
end;
$$;
create trigger classes_lock_course before update of course_id on public.classes
  for each row execute function public.classes_lock_course();

-- el grupo de una actividad o matrícula debe ser de la misma clase
create or replace function public.check_group_class()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.class_groups g where g.id = new.group_id and g.class_id = new.class_id
  ) then
    raise exception 'El grupo no pertenece a la clase';
  end if;
  return new;
end;
$$;
create trigger activities_check_group before insert or update of group_id, class_id on public.activities
  for each row execute function public.check_group_class();
create trigger enrollments_check_group before insert or update of group_id on public.enrollments
  for each row execute function public.check_group_class();
