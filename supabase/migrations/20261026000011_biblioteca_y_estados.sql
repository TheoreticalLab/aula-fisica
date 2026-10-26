-- Biblioteca académica, estados de publicación y presentación de asignaturas. Migración ADITIVA.
--
-- 1. Estado de cada unidad: borrador · preparado · publicado · archivado. Los estudiantes solo ven las unidades
--    PUBLICADAS (y sus lecciones). Que un contenido exista en la base no significa que esté publicado.
--    Las unidades existentes (Física Básica) quedan «publicado»: nada cambia para ellas.
-- 2. Estructura de estudio de cada minicapítulo (lessons.study): objetivos, errores frecuentes, preguntas
--    conceptuales, autoevaluación y conexiones. Física Básica la deja vacía y se ve igual que antes.
-- 3. Presentación y objetivos generales de cada asignatura (courses.presentation / objectives).
-- 4. «customized»: marca lo que el profesor editó desde el panel. Al instalar una versión nueva de la biblioteca,
--    el instalador solo actualiza filas no personalizadas (identifica sus escrituras con aula.origen = 'biblioteca').

-- 1. estados -------------------------------------------------------------------------------------------------
alter table public.units add column if not exists status text not null default 'publicado';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'units_status_check') then
    alter table public.units add constraint units_status_check check (status in ('borrador', 'preparado', 'publicado', 'archivado'));
  end if;
end $$;

-- 2. estructura de estudio ----------------------------------------------------------------------------------
alter table public.lessons add column if not exists study jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lessons_study_check') then
    alter table public.lessons add constraint lessons_study_check check (jsonb_typeof(study) = 'object');
  end if;
end $$;

-- 3. presentación de la asignatura --------------------------------------------------------------------------
alter table public.courses add column if not exists presentation text not null default '';
alter table public.courses add column if not exists objectives jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'courses_objectives_check') then
    alter table public.courses add constraint courses_objectives_check check (jsonb_typeof(objectives) = 'array');
  end if;
end $$;

-- 4. personalizaciones del profesor -------------------------------------------------------------------------
alter table public.units add column if not exists customized boolean not null default false;
alter table public.lessons add column if not exists customized boolean not null default false;
alter table public.exercises add column if not exists customized boolean not null default false;
alter table public.exercise_keys add column if not exists customized boolean not null default false;

create or replace function public.mark_customized()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('aula.origen', true), '') <> 'biblioteca' then
    new.customized := true;
  end if;
  return new;
end;
$$;

-- solo cuentan los cambios de CONTENIDO (no publicar, ocultar ni cambiar el estado)
drop trigger if exists units_customized on public.units;
create trigger units_customized before update of title, summary, planned_topics on public.units
  for each row when (old.title is distinct from new.title or old.summary is distinct from new.summary
                     or old.planned_topics is distinct from new.planned_topics)
  execute function public.mark_customized();
drop trigger if exists lessons_customized on public.lessons;
create trigger lessons_customized before update of title, summary, theory, formulas, examples, simulation, study on public.lessons
  for each row when (old.title is distinct from new.title or old.summary is distinct from new.summary or old.theory is distinct from new.theory
                     or old.formulas is distinct from new.formulas or old.examples is distinct from new.examples
                     or old.simulation is distinct from new.simulation or old.study is distinct from new.study)
  execute function public.mark_customized();
drop trigger if exists exercises_customized on public.exercises;
create trigger exercises_customized before update of prompt, options, figure, simulation, unit_hint, points, concepts, difficulty, format, multiple on public.exercises
  for each row when (old.prompt is distinct from new.prompt or old.options is distinct from new.options or old.figure is distinct from new.figure
                     or old.simulation is distinct from new.simulation or old.unit_hint is distinct from new.unit_hint
                     or old.points is distinct from new.points or old.concepts is distinct from new.concepts
                     or old.difficulty is distinct from new.difficulty or old.format is distinct from new.format
                     or old.multiple is distinct from new.multiple)
  execute function public.mark_customized();
drop trigger if exists keys_customized on public.exercise_keys;
create trigger keys_customized before update of answer, hints, explanation on public.exercise_keys
  for each row when (old.answer is distinct from new.answer or old.hints is distinct from new.hints or old.explanation is distinct from new.explanation)
  execute function public.mark_customized();

-- visibilidad para estudiantes: solo unidades publicadas -----------------------------------------------------
-- lesson_visible_to_me (copia de 20261025000002_seguridad.sql) + la unidad debe estar publicada
create or replace function public.lesson_visible_to_me(p_lesson uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l join public.units u on u.id = l.unit_id
    where l.id = p_lesson and not l.hidden and not u.hidden and u.status = 'publicado' and public.is_enrolled_course(l.course_id)
  )
$$;

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
  using (public.is_teacher() or (not hidden and status = 'publicado' and public.is_enrolled_course(course_id)));

revoke execute on function public.mark_customized() from public, anon, authenticated;
revoke execute on function public.lesson_visible_to_me(uuid) from public, anon;
grant execute on function public.lesson_visible_to_me(uuid) to authenticated;
