-- =============================================================================
-- Aula Virtual · 5. Varias asignaturas y secciones desde un único panel docente
-- =============================================================================
-- Migración ADITIVA. Lo que ya existía y se reutiliza:
--   courses  = asignaturas (contenido: bloques, lecciones, ejercicios)
--   classes  = secciones (cada una de una asignatura; con profesores, grupos y matrícula)
--   activities / attempts / responses: ya son independientes por sección.
-- Lo nuevo:
--   * archivar asignaturas;
--   * matricular por ID de estudiante en una o varias secciones;
--   * copiar una actividad a otras secciones de la misma asignatura (cada copia tiene sus propias notas);
--   * resumen de todas las secciones del profesor para el panel.

alter table public.courses add column if not exists archived boolean not null default false;

-- -----------------------------------------------------------------------------
-- Matrícula por ID (profesores de la sección o administradores)
-- -----------------------------------------------------------------------------
create or replace function public.enroll_students_by_login(p_class uuid, p_logins text[], p_group uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_login text;
  v_user uuid;
  v_role public.app_role;
  v_ok text[] := '{}';
  v_ya text[] := '{}';
  v_no text[] := '{}';
  v_prof text[] := '{}';
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if exists (select 1 from public.classes where id = p_class and archived) then
    raise exception 'La sección está archivada' using errcode = 'P0001';
  end if;
  if p_group is not null and not exists (select 1 from public.class_groups where id = p_group and class_id = p_class) then
    raise exception 'El grupo no pertenece a la sección' using errcode = '22023';
  end if;
  if coalesce(array_length(p_logins, 1), 0) > 500 then raise exception 'Máximo 500 IDs por vez' using errcode = '22023'; end if;
  foreach v_login in array coalesce(p_logins, '{}') loop
    v_login := public.normalize_login(v_login);
    continue when v_login = '';
    select id, role into v_user, v_role from public.profiles where login_id = v_login;
    if v_user is null then
      v_no := v_no || v_login;
    elsif v_role <> 'student' then
      v_prof := v_prof || v_login;
    elsif exists (select 1 from public.enrollments where class_id = p_class and user_id = v_user) then
      if p_group is not null then
        update public.enrollments set group_id = p_group where class_id = p_class and user_id = v_user;
      end if;
      v_ya := v_ya || v_login;
    else
      insert into public.enrollments (class_id, user_id, group_id) values (p_class, v_user, p_group);
      insert into public.account_events (actor_id, target_id, action, detail)
        values (auth.uid(), v_user, 'enroll', jsonb_build_object('class', p_class));
      v_ok := v_ok || v_login;
    end if;
    v_user := null;
  end loop;
  return jsonb_build_object('matriculados', to_jsonb(v_ok), 'ya_estaban', to_jsonb(v_ya), 'no_encontrados', to_jsonb(v_no), 'no_son_estudiantes', to_jsonb(v_prof));
end;
$$;

-- -----------------------------------------------------------------------------
-- Copiar una actividad a otras secciones de la misma asignatura
-- -----------------------------------------------------------------------------
create or replace function public.copy_activity_to_classes(p_activity uuid, p_classes uuid[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_act public.activities;
  v_course uuid;
  v_class uuid;
  v_new uuid;
  v_out jsonb := '[]'::jsonb;
begin
  select * into v_act from public.activities where id = p_activity;
  if v_act.id is null or not public.is_class_teacher(v_act.class_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select course_id into v_course from public.classes where id = v_act.class_id;
  foreach v_class in array coalesce(p_classes, '{}') loop
    continue when v_class = v_act.class_id;
    if not public.is_class_teacher(v_class) then raise exception 'No es profesor de una de las secciones elegidas' using errcode = '42501'; end if;
    if not exists (select 1 from public.classes where id = v_class and course_id = v_course and not archived) then
      raise exception 'Solo se puede copiar a secciones activas de la misma asignatura' using errcode = 'P0001';
    end if;
    insert into public.activities (class_id, group_id, lesson_id, title, instructions, mode, opens_at, closes_at, max_attempts,
                                   max_tries_per_item, reveal_policy, hints_enabled, published, grades_published, created_by)
      values (v_class, null, v_act.lesson_id, v_act.title, v_act.instructions, v_act.mode, v_act.opens_at, v_act.closes_at, v_act.max_attempts,
              v_act.max_tries_per_item, v_act.reveal_policy, v_act.hints_enabled, false, false, auth.uid())
      returning id into v_new;
    insert into public.activity_items (activity_id, exercise_id, position, points)
      select v_new, i.exercise_id, i.position, i.points from public.activity_items i where i.activity_id = p_activity;
    v_out := v_out || jsonb_build_object('class_id', v_class, 'activity_id', v_new);
  end loop;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen de todas las secciones del profesor (o todas, para el administrador)
-- -----------------------------------------------------------------------------
create or replace function public.teacher_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'class_id', c.id, 'name', c.name, 'term', c.term, 'archived', c.archived, 'join_code', c.join_code, 'join_open', c.join_open,
      'course_id', co.id, 'course_title', co.title,
      'students', (select count(*) from public.enrollments e where e.class_id = c.id),
      'groups', (select count(*) from public.class_groups g where g.class_id = c.id),
      'activities', (select count(*) from public.activities a where a.class_id = c.id),
      'open_activities', (select count(*) from public.activities a where a.class_id = c.id and a.published
                          and (a.opens_at is null or a.opens_at <= now()) and (a.closes_at is null or a.closes_at > now())),
      'pending_review', (select count(*) from public.responses r join public.attempts t on t.id = r.attempt_id
                         join public.activities a on a.id = t.activity_id
                         where a.class_id = c.id and t.status = 'submitted' and r.status = 'pending_review' and r.manual_credit is null),
      'mean_pct', (select round(avg(b.best / nullif(b.max, 0)), 3) from (
                     select max(t.score) as best, max(t.max_score) as max
                     from public.attempts t join public.activities a on a.id = t.activity_id
                     where a.class_id = c.id and t.status = 'submitted' group by t.user_id, t.activity_id) b)
    ) order by c.archived, co.title, c.name), '[]'::jsonb)
    from public.classes c join public.courses co on co.id = c.course_id
    where public.is_admin() or exists (select 1 from public.class_teachers t where t.class_id = c.id and t.user_id = auth.uid()));
end;
$$;

-- -----------------------------------------------------------------------------
-- Colegas por ID (o por correo, como antes): las cuentas creadas en el panel no tienen correo real
-- -----------------------------------------------------------------------------
create or replace function public.add_class_teacher_by_email(p_class uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_user from public.profiles
    where (login_id = public.normalize_login(p_email) or lower(email) = lower(trim(p_email))) and role in ('teacher', 'admin') and active;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No existe un profesor activo con ese ID.'); end if;
  insert into public.class_teachers (class_id, user_id) values (p_class, v_user) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_course_staff_by_email(p_course uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_course_staff(p_course) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_user from public.profiles
    where (login_id = public.normalize_login(p_email) or lower(email) = lower(trim(p_email))) and role in ('teacher', 'admin') and active;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No existe un profesor activo con ese ID.'); end if;
  insert into public.course_staff (course_id, user_id) values (p_course, v_user) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Libro de calificaciones: ahora incluye el ID de acceso de cada estudiante
-- -----------------------------------------------------------------------------
create or replace function public.gradebook(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'activities', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'mode', a.mode, 'closes_at', a.closes_at, 'published', a.published,
        'grades_published', a.grades_published, 'group_id', a.group_id,
        'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                      join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id)
      ) order by a.closes_at nulls last, a.created_at), '[]'::jsonb)
      from public.activities a where a.class_id = p_class),
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'login_id', p.login_id, 'email', p.email, 'student_code', p.student_code,
        'active', p.active, 'group_id', en.group_id, 'group_name', g.name,
        'grades', (select coalesce(jsonb_object_agg(x.activity_id, jsonb_build_object(
              'best', x.best, 'submitted', x.submitted, 'in_progress', x.in_progress, 'needs_review', x.needs_review,
              'last_attempt_id', x.last_attempt_id)), '{}'::jsonb)
            from (
              select t.activity_id,
                     max(t.score) filter (where t.status = 'submitted') as best,
                     count(*) filter (where t.status = 'submitted') as submitted,
                     bool_or(t.status = 'in_progress') as in_progress,
                     bool_or(t.needs_review) as needs_review,
                     (array_agg(t.id order by t.started_at desc))[1] as last_attempt_id
              from public.attempts t join public.activities a on a.id = t.activity_id
              where t.user_id = p.id and a.class_id = p_class
              group by t.activity_id
            ) x)
      ) order by p.full_name), '[]'::jsonb)
      from public.enrollments en
      join public.profiles p on p.id = en.user_id
      left join public.class_groups g on g.id = en.group_id
      where en.class_id = p_class)
  );
end;
$$;

revoke execute on function
  public.enroll_students_by_login(uuid, text[], uuid), public.copy_activity_to_classes(uuid, uuid[]), public.teacher_overview()
  from public, anon;
grant execute on function
  public.enroll_students_by_login(uuid, text[], uuid), public.copy_activity_to_classes(uuid, uuid[]), public.teacher_overview()
  to authenticated;
