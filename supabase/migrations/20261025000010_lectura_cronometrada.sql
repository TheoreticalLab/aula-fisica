-- Actividades con lectura cronometrada: el estudiante debe leer un texto durante un tiempo mínimo antes de
-- poder empezar los ejercicios. El tiempo lo cuenta el SERVIDOR a partir de «latidos» que el navegador envía
-- mientras la página está visible: solo suma el tiempo real entre latidos seguidos, así que no se puede
-- acelerar, y deja de contar cuando el estudiante sale de la plataforma.
-- Migración aditiva: columnas nuevas, una tabla nueva y funciones nuevas o redefinidas (create or replace).

alter table public.activities add column if not exists reading_text text;
alter table public.activities add column if not exists reading_min_seconds integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'activities_reading_min_seconds_check') then
    alter table public.activities add constraint activities_reading_min_seconds_check
      check (reading_min_seconds is null or (reading_min_seconds between 30 and 7200 and coalesce(reading_text, '') <> ''));
  end if;
end $$;

-- Progreso de lectura de cada estudiante (dato estudiantil: no se borra)
create table if not exists public.reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  seconds_read integer not null default 0 check (seconds_read >= 0),
  last_beat timestamptz,
  pauses integer not null default 0 check (pauses >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, activity_id)
);
create index if not exists reading_progress_activity_idx on public.reading_progress (activity_id);
alter table public.reading_progress enable row level security;

drop policy if exists reading_progress_select on public.reading_progress;
create policy reading_progress_select on public.reading_progress for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.activities a where a.id = activity_id and public.is_class_teacher(a.class_id)));
-- Sin políticas de escritura: solo se modifica mediante reading_beat().
revoke all on public.reading_progress from anon, authenticated;
grant select on public.reading_progress to authenticated;

-- Latido de lectura. p_visible = true mientras el estudiante tiene la página delante; false al salir.
-- Suma el tiempo real desde el latido anterior solo si fue hace ≤ 25 s (si no, el estudiante estuvo fuera).
create or replace function public.reading_beat(p_activity uuid, p_visible boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_min integer;
  v_row public.reading_progress;
  v_gap double precision;
  v_add integer := 0;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.activity_open_to_me(p_activity) then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
  select reading_min_seconds into v_min from public.activities where id = p_activity;
  if v_min is null then raise exception 'Esta actividad no tiene lectura' using errcode = 'P0001'; end if;

  insert into public.reading_progress (user_id, activity_id) values (v_uid, p_activity) on conflict do nothing;
  select * into v_row from public.reading_progress where user_id = v_uid and activity_id = p_activity for update;

  if v_row.completed_at is null then
    if v_row.last_beat is not null then
      v_gap := extract(epoch from (now() - v_row.last_beat));
      if v_gap > 0 and v_gap <= 25 then v_add := floor(v_gap)::integer; end if;
    end if;
    update public.reading_progress set
      seconds_read = least(v_min, seconds_read + v_add),
      last_beat = case when p_visible then now() else null end,
      pauses = pauses + case when not p_visible and v_row.last_beat is not null then 1 else 0 end,
      completed_at = case when seconds_read + v_add >= v_min then now() end
    where user_id = v_uid and activity_id = p_activity
    returning * into v_row;
  end if;
  return jsonb_build_object('seconds_read', v_row.seconds_read, 'min_seconds', v_min,
                            'completed', v_row.completed_at is not null, 'pauses', v_row.pauses);
end;
$$;

-- Estado de lectura sin contar tiempo (al abrir la página)
create or replace function public.my_reading(p_activity uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'seconds_read', coalesce(r.seconds_read, 0), 'min_seconds', a.reading_min_seconds,
    'completed', r.completed_at is not null, 'pauses', coalesce(r.pauses, 0))
  from public.activities a
  left join public.reading_progress r on r.activity_id = a.id and r.user_id = auth.uid()
  where a.id = p_activity and public.activity_visible_to_me(a.id)
$$;

-- start_activity_attempt (copia de 20261025000003_funciones.sql) + exige la lectura completada
create or replace function public.start_activity_attempt(p_activity uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_act public.activities;
  v_course uuid;
  v_id uuid;
  v_used integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.activity_visible_to_me(p_activity) then
    raise exception 'Actividad no disponible' using errcode = '42501';
  end if;
  -- serializa dobles clics y peticiones simultáneas del mismo estudiante
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_activity::text, 0));
  select * into v_act from public.activities where id = p_activity;
  if v_act.opens_at is not null and now() < v_act.opens_at then
    raise exception 'La actividad todavía no está abierta' using errcode = 'P0001';
  end if;
  -- lectura cronometrada: primero hay que completar el tiempo mínimo de lectura
  if v_act.reading_min_seconds is not null and not exists (
      select 1 from public.reading_progress r
      where r.user_id = v_uid and r.activity_id = p_activity and r.completed_at is not null) then
    raise exception 'Primero complete el tiempo de lectura' using errcode = 'P0001';
  end if;
  select id into v_id from public.attempts where user_id = v_uid and activity_id = p_activity and status = 'in_progress';
  if found then return v_id; end if;
  if v_act.closes_at is not null and now() >= v_act.closes_at then
    raise exception 'La actividad está cerrada' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.attempts where user_id = v_uid and activity_id = p_activity;
  if v_act.max_attempts is not null and v_used >= v_act.max_attempts then
    raise exception 'Ya utilizó todos los intentos permitidos' using errcode = 'P0001';
  end if;
  select c.course_id into v_course from public.classes c where c.id = v_act.class_id;
  insert into public.attempts (user_id, course_id, activity_id, lesson_id, mode, attempt_number)
    -- lesson_id queda vacío: borrar una lección no debe borrar intentos calificados de una actividad
    values (v_uid, v_course, p_activity, null, v_act.mode, v_used + 1)
    returning id into v_id;
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    select v_id, i.exercise_id, v_uid, coalesce(i.points, e.points)
    from public.activity_items i join public.exercises e on e.id = i.exercise_id
    where i.activity_id = p_activity;
  perform public.recompute_attempt(v_id);
  return v_id;
end;
$$;

-- my_activities (copia de 20261025000003_funciones.sql) + datos de la lectura
create or replace function public.my_activities()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(s.obj order by (s.obj ->> 'closes_at') nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', a.id, 'title', a.title, 'mode', a.mode, 'opens_at', a.opens_at, 'closes_at', a.closes_at,
      'class_id', c.id, 'class_name', c.name, 'course_id', c.course_id, 'lesson_id', a.lesson_id,
      'max_attempts', a.max_attempts, 'grades_published', a.grades_published,
      'items', (select count(*) from public.activity_items i where i.activity_id = a.id),
      'attempts_used', (select count(*) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid()),
      'in_progress', (select t.id from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'in_progress'),
      'submitted', exists (select 1 from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'),
      'last_attempt_id', (select t.id from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted'
                          order by t.submitted_at desc limit 1),
      'best_score', case when a.grades_published or (a.mode = 'practice' and a.reveal_policy = 'immediate') then
          (select max(t.score) from public.attempts t where t.activity_id = a.id and t.user_id = auth.uid() and t.status = 'submitted') end,
      'max_score', (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                    join public.exercises e on e.id = i.exercise_id where i.activity_id = a.id),
      'reading_min_seconds', a.reading_min_seconds,
      'reading_done', exists (select 1 from public.reading_progress r
                              where r.activity_id = a.id and r.user_id = auth.uid() and r.completed_at is not null)
    ) as obj
    from public.activities a
    join public.classes c on c.id = a.class_id
    where public.activity_visible_to_me(a.id) and not c.archived
  ) s
$$;

-- copy_activity_to_classes (copia de 20261025000005_asignaturas_secciones.sql) + copia la lectura
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
                                   max_tries_per_item, reveal_policy, hints_enabled, published, grades_published, created_by,
                                   reading_text, reading_min_seconds)
      values (v_class, null, v_act.lesson_id, v_act.title, v_act.instructions, v_act.mode, v_act.opens_at, v_act.closes_at, v_act.max_attempts,
              v_act.max_tries_per_item, v_act.reveal_policy, v_act.hints_enabled, false, false, auth.uid(),
              v_act.reading_text, v_act.reading_min_seconds)
      returning id into v_new;
    insert into public.activity_items (activity_id, exercise_id, position, points)
      select v_new, i.exercise_id, i.position, i.points from public.activity_items i where i.activity_id = p_activity;
    v_out := v_out || jsonb_build_object('class_id', v_class, 'activity_id', v_new);
  end loop;
  return v_out;
end;
$$;

revoke execute on function public.reading_beat(uuid, boolean), public.my_reading(uuid), public.start_activity_attempt(uuid),
  public.my_activities(), public.copy_activity_to_classes(uuid, uuid[]) from public, anon;
grant execute on function public.reading_beat(uuid, boolean), public.my_reading(uuid), public.start_activity_attempt(uuid),
  public.my_activities(), public.copy_activity_to_classes(uuid, uuid[]) to authenticated;
