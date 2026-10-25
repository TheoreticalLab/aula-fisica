-- =============================================================================
-- Aula Virtual de Física Básica · 2. Seguridad: funciones auxiliares, RLS y privilegios
-- =============================================================================
-- Principios:
--  * Todas las tablas tienen RLS activado; «anon» no tiene acceso a nada.
--  * Los estudiantes NO leen directamente intentos, respuestas ni claves: lo hacen mediante
--    funciones SECURITY DEFINER que aplican las reglas de visibilidad (03_funciones.sql).
--  * Nadie (salvo service_role) escribe calificaciones directamente: la calificación automática
--    la registra la Edge Function «calificar» con funciones svc_* y la manual pasa por grade_response().
--  * El rol de un usuario solo lo cambia un administrador.

-- -----------------------------------------------------------------------------
-- Perfil automático al registrarse (siempre como estudiante)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, student_code, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'student_code', ''), 40), ''),
    'student' -- nunca se toma el rol de los metadatos del cliente
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Funciones auxiliares de autorización (SECURITY DEFINER para evitar recursión de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_teacher_user(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role in ('teacher', 'admin') from public.profiles where id = p_user), false) $$;

create or replace function public.is_course_staff(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.course_staff s where s.course_id = p_course and s.user_id = auth.uid()
  )
$$;

create or replace function public.is_class_teacher(p_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.class_teachers t where t.class_id = p_class and t.user_id = auth.uid()
  )
$$;

create or replace function public.teaches_course(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_teachers t join public.classes c on c.id = t.class_id
    where c.course_id = p_course and t.user_id = auth.uid()
  )
$$;

create or replace function public.can_view_keys(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_course_staff(p_course) or public.teaches_course(p_course) $$;

create or replace function public.is_enrolled_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.enrollments e where e.class_id = p_class and e.user_id = auth.uid()) $$;

create or replace function public.is_enrolled_course(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e join public.classes c on c.id = e.class_id
    where c.course_id = p_course and e.user_id = auth.uid()
  )
$$;

-- ¿Es el usuario actual profesor de alguna clase en la que está matriculado p_user?
create or replace function public.teaches_student(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.enrollments e
    join public.class_teachers t on t.class_id = e.class_id
    where e.user_id = p_user and t.user_id = auth.uid()
  )
$$;

create or replace function public.can_see_profile(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user = auth.uid()
    or public.teaches_student(p_user)
    -- profesores de mis clases
    or exists (
      select 1 from public.enrollments e join public.class_teachers t on t.class_id = e.class_id
      where e.user_id = auth.uid() and t.user_id = p_user
    )
    -- colegas que comparten curso o clase
    or (public.is_teacher() and public.is_teacher_user(p_user))
$$;

create or replace function public.lesson_visible_to_me(p_lesson uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l join public.units u on u.id = l.unit_id
    where l.id = p_lesson and not l.hidden and not u.hidden and public.is_enrolled_course(l.course_id)
  )
$$;

create or replace function public.activity_visible_to_me(p_activity uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    join public.enrollments e on e.class_id = a.class_id and e.user_id = auth.uid()
    where a.id = p_activity and a.published and (a.group_id is null or a.group_id = e.group_id)
  )
$$;

create or replace function public.activity_open_to_me(p_activity uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.activity_visible_to_me(p_activity) and exists (
    select 1 from public.activities a where a.id = p_activity and (a.opens_at is null or a.opens_at <= now())
  )
$$;

create or replace function public.exercise_in_open_activity(p_exercise uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.activity_items i
    where i.exercise_id = p_exercise and public.activity_open_to_me(i.activity_id)
  )
$$;

create or replace function public.exercise_course(p_exercise uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select course_id from public.exercises where id = p_exercise $$;

-- ¿Puede el usuario actual revisar (como profesor) este intento?
create or replace function public.can_review_attempt(p_attempt uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.attempts a
    left join public.activities act on act.id = a.activity_id
    where a.id = p_attempt and (
      (act.id is not null and public.is_class_teacher(act.class_id))
      or (act.id is null and public.teaches_student(a.user_id) and (public.teaches_course(a.course_id) or public.is_admin()))
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- Disparadores de pertenencia
-- -----------------------------------------------------------------------------
create or replace function public.courses_add_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.course_staff (course_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger courses_add_creator after insert on public.courses for each row execute function public.courses_add_creator();

create or replace function public.classes_add_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.class_teachers (class_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger classes_add_creator after insert on public.classes for each row execute function public.classes_add_creator();

-- created_by siempre es quien inserta (no se puede suplantar)
create or replace function public.set_created_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger courses_created_by before insert on public.courses for each row execute function public.set_created_by();
create trigger classes_created_by before insert on public.classes for each row execute function public.set_created_by();
create trigger exercises_created_by before insert on public.exercises for each row execute function public.set_created_by();
create trigger activities_created_by before insert on public.activities for each row execute function public.set_created_by();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_staff enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_keys enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_groups enable row level security;
alter table public.enrollments enable row level security;
alter table public.activities enable row level security;
alter table public.activity_items enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.response_events enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_see_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- courses
create policy courses_select on public.courses for select to authenticated
  using (public.is_teacher() or public.is_enrolled_course(id));
create policy courses_insert on public.courses for insert to authenticated
  with check (public.is_teacher());
create policy courses_update on public.courses for update to authenticated
  using (public.is_course_staff(id)) with check (public.is_course_staff(id));
create policy courses_delete on public.courses for delete to authenticated
  using (public.is_course_staff(id));

-- course_staff
create policy course_staff_select on public.course_staff for select to authenticated
  using (public.is_teacher());
create policy course_staff_insert on public.course_staff for insert to authenticated
  with check (public.is_course_staff(course_id) and public.is_teacher_user(user_id));
create policy course_staff_delete on public.course_staff for delete to authenticated
  using (public.is_course_staff(course_id));

-- units
create policy units_select on public.units for select to authenticated
  using (public.is_teacher() or (not hidden and public.is_enrolled_course(course_id)));
create policy units_write on public.units for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));

-- lessons
create policy lessons_select on public.lessons for select to authenticated
  using (public.is_teacher() or public.lesson_visible_to_me(id));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));

-- concepts
create policy concepts_select on public.concepts for select to authenticated
  using (public.is_teacher() or public.is_enrolled_course(course_id));
create policy concepts_write on public.concepts for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));

-- exercises (enunciados: sin claves)
create policy exercises_select on public.exercises for select to authenticated
  using (
    public.is_teacher()
    or (published and role in ('practice', 'reinforcement') and lesson_id is not null and public.lesson_visible_to_me(lesson_id))
    or public.exercise_in_open_activity(id)
  );
create policy exercises_write on public.exercises for all to authenticated
  using (public.is_course_staff(course_id)) with check (public.is_course_staff(course_id));

-- exercise_keys: SOLO profesorado del curso. Ninguna política para estudiantes.
create policy keys_select on public.exercise_keys for select to authenticated
  using (public.can_view_keys(public.exercise_course(exercise_id)));
create policy keys_insert on public.exercise_keys for insert to authenticated
  with check (public.is_course_staff(public.exercise_course(exercise_id)));
create policy keys_update on public.exercise_keys for update to authenticated
  using (public.is_course_staff(public.exercise_course(exercise_id)))
  with check (public.is_course_staff(public.exercise_course(exercise_id)));
create policy keys_delete on public.exercise_keys for delete to authenticated
  using (public.is_course_staff(public.exercise_course(exercise_id)));

-- classes
-- created_by permite leer la fila recién insertada (INSERT … RETURNING) antes de que el disparador añada al profesor
create policy classes_select on public.classes for select to authenticated
  using (created_by = auth.uid() or public.is_class_teacher(id) or public.is_enrolled_class(id) or public.is_course_staff(course_id));
-- Solo el equipo docente de un curso abre clases con él (abrir una clase da acceso a las claves del curso)
create policy classes_insert on public.classes for insert to authenticated
  with check (public.is_teacher() and public.is_course_staff(course_id));
create policy classes_update on public.classes for update to authenticated
  using (public.is_class_teacher(id)) with check (public.is_class_teacher(id));
create policy classes_delete on public.classes for delete to authenticated
  using (public.is_class_teacher(id));

-- class_teachers
create policy class_teachers_select on public.class_teachers for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_enrolled_class(class_id));
create policy class_teachers_insert on public.class_teachers for insert to authenticated
  with check (public.is_class_teacher(class_id) and public.is_teacher_user(user_id));
create policy class_teachers_delete on public.class_teachers for delete to authenticated
  using (public.is_class_teacher(class_id));

-- class_groups: los códigos de grupo solo los ven los profesores de la clase
create policy class_groups_select on public.class_groups for select to authenticated
  using (public.is_class_teacher(class_id));
create policy class_groups_write on public.class_groups for all to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

-- enrollments: la matrícula se crea solo con join_class(); el profesor puede cambiar de grupo o dar de baja
create policy enrollments_select on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
create policy enrollments_update on public.enrollments for update to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy enrollments_delete on public.enrollments for delete to authenticated
  using (public.is_class_teacher(class_id));

-- activities
create policy activities_select on public.activities for select to authenticated
  using (public.is_class_teacher(class_id) or public.activity_visible_to_me(id));
create policy activities_write on public.activities for all to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

-- activity_items: los estudiantes solo ven los ítems de actividades ya abiertas
create policy activity_items_select on public.activity_items for select to authenticated
  using (
    public.is_class_teacher((select a.class_id from public.activities a where a.id = activity_id))
    or public.activity_open_to_me(activity_id)
  );
create policy activity_items_write on public.activity_items for all to authenticated
  using (public.is_class_teacher((select a.class_id from public.activities a where a.id = activity_id)))
  with check (public.is_class_teacher((select a.class_id from public.activities a where a.id = activity_id)));

-- attempts / responses / response_events: lectura directa solo para el profesorado que puede revisarlos.
-- Los estudiantes consultan lo suyo con get_attempt(), my_grades(), etc., que aplican la política de visibilidad.
create policy attempts_select on public.attempts for select to authenticated
  using (public.can_review_attempt(id));
create policy responses_select on public.responses for select to authenticated
  using (public.can_review_attempt(attempt_id));
create policy response_events_select on public.response_events for select to authenticated
  using (public.can_review_attempt((select r.attempt_id from public.responses r where r.id = response_id)));

-- -----------------------------------------------------------------------------
-- Privilegios por tabla y columna
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, student_code) on public.profiles to authenticated;

grant select, insert, update, delete on
  public.courses, public.course_staff, public.units, public.lessons, public.concepts,
  public.exercises, public.exercise_keys, public.classes, public.class_teachers,
  public.class_groups, public.activities, public.activity_items
  to authenticated;

grant select, delete on public.enrollments to authenticated;
grant update (group_id) on public.enrollments to authenticated;

grant select on public.attempts, public.responses, public.response_events to authenticated;

-- Las tablas que se creen en el futuro no reciben privilegios automáticos para anon/authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
