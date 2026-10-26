-- =============================================================================
-- Vincular actividades (calificadas sobre su propio máximo) a los apartados del Registro de Calificaciones.
--   · Sin vínculo: la actividad no cuenta para el registro.
--   · points = N: la actividad vale N puntos del apartado (p. ej. 5 de los 30 de Práctica; 15 = el parcial entero).
--   · points = NULL («por definir»): los puntos del apartado que no tienen asignados las actividades de valor fijo
--     se reparten a partes iguales entre las actividades «por definir».
-- Aporte de una actividad = peso × (mejor intento entregado / máximo). Sin entrega: pendiente mientras la actividad
-- está abierta; 0 cuando ya cerró.
-- Una nota escrita a mano por el profesor en un apartado tiene prioridad sobre el cálculo automático.
-- No modifica tablas existentes; redefine gradebook_official y my_official_grades (mismas firmas).
-- =============================================================================

create table if not exists public.activity_grade_links (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  category text not null check (category in ('parcial1', 'parcial2', 'parcial3', 'practica', 'final')),
  points numeric(5, 2) check (points is null or (points > 0 and points <= public.grade_category_max(category))),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.activity_grade_links enable row level security;
revoke all on public.activity_grade_links from anon, authenticated;

-- p_category NULL = quitar el vínculo (la actividad deja de contar). p_points NULL = valor por definir.
create or replace function public.set_activity_grade_link(p_activity uuid, p_category text, p_points numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_fijos numeric;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null then raise exception 'Actividad no encontrada' using errcode = 'P0002'; end if;
  perform public.grades_assert_teacher(v_class);
  if p_category is null then
    delete from public.activity_grade_links where activity_id = p_activity;
    return;
  end if;
  if public.grade_category_max(p_category) is null then raise exception 'Apartado no válido' using errcode = '22023'; end if;
  if p_points is not null and (p_points <= 0 or p_points > public.grade_category_max(p_category)) then
    raise exception 'El valor debe estar entre 0 y %', public.grade_category_max(p_category) using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vinculos:' || v_class::text || p_category, 0));
  select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links
    where class_id = v_class and category = p_category and activity_id <> p_activity and points is not null;
  if v_fijos + coalesce(p_points, 0) > public.grade_category_max(p_category) then
    raise exception 'Las actividades de este apartado sumarían % puntos y el máximo es %', v_fijos + p_points, public.grade_category_max(p_category)
      using errcode = 'P0001';
  end if;
  insert into public.activity_grade_links (activity_id, class_id, category, points, updated_by)
    values (p_activity, v_class, p_category, round(p_points, 2), auth.uid())
    on conflict (activity_id) do update set category = excluded.category, points = excluded.points,
      updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- Actividades de la sección con su vínculo y el peso efectivo (incluido el reparto de las «por definir»).
create or replace function public.class_activity_links(p_class uuid)
returns table (activity_id uuid, title text, mode text, closes_at timestamptz, category text, points numeric, peso_efectivo numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  with l as (select * from public.activity_grade_links where class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category)
  select a.id, a.title, a.mode::text, a.closes_at, l.category, l.points,
    case when l.category is null then null
         when l.points is not null then l.points
         else round(greatest(0, public.grade_category_max(l.category) - f.fijos) / nullif(f.n, 0), 2) end
  from public.activities a
  left join l on l.activity_id = a.id
  left join f on f.category = l.category
  where a.class_id = p_class
  order by a.created_at;
end;
$$;

-- Nota de cada estudiante en cada apartado: manual si el profesor la escribió; si no, la de sus actividades.
-- Uso interno (las funciones públicas comprueban la autorización antes de llamarla).
create or replace function public.official_scores(p_class uuid)
returns table (user_id uuid, category text, score numeric, source text, pendientes integer)
language sql stable security definer set search_path = ''
as $$
  with cats(category) as (values ('parcial1'), ('parcial2'), ('parcial3'), ('practica'), ('final')),
  alumnos as (select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
              where e.class_id = p_class),
  l as (select k.*, a.closes_at from public.activity_grade_links k join public.activities a on a.id = k.activity_id
        where k.class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
  w as (select l.activity_id, l.category, l.closes_at,
          coalesce(l.points, greatest(0, public.grade_category_max(l.category) - f.fijos) / nullif(f.n, 0)) peso
        from l join f on f.category = l.category),
  mejor as (select t.user_id, t.activity_id, max(t.score / nullif(t.max_score, 0)) pct
            from public.attempts t join w on w.activity_id = t.activity_id
            where t.status = 'submitted' group by t.user_id, t.activity_id),
  aporte as (
    select a.user_id, w.category,
      coalesce(m.pct, case when w.closes_at is not null and w.closes_at < now() then 0 end) pct, w.peso
    from alumnos a cross join w left join mejor m on m.user_id = a.user_id and m.activity_id = w.activity_id
  ),
  auto as (
    select x.user_id, x.category,
      case when count(x.pct) = 0 then null
           else least(public.grade_category_max(x.category), round(sum(x.peso * x.pct), 2)) end score,
      count(*) filter (where x.pct is null)::integer pend
    from aporte x group by x.user_id, x.category
  )
  select a.user_id, c.category,
    coalesce(g.score, au.score),
    case when g.score is not null then 'manual' when au.score is not null then 'actividades' end,
    case when g.score is not null then 0 else coalesce(au.pend, 0) end
  from alumnos a cross join cats c
  left join public.grade_entries g on g.class_id = p_class and g.user_id = a.user_id and g.category = c.category
  left join auto au on au.user_id = a.user_id and au.category = c.category
$$;

-- Origen de cada nota (para que el profesor vea qué es manual y qué viene de actividades)
create or replace function public.gradebook_sources(p_class uuid)
returns table (user_id uuid, category text, score numeric, source text, pendientes integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query select * from public.official_scores(p_class);
end;
$$;

-- gradebook_official: igual que en la migración 15, pero con las notas de official_scores
create or replace function public.gradebook_official(p_class uuid)
returns table (user_id uuid, full_name text, student_code text, parcial1 numeric, parcial2 numeric, parcial3 numeric,
  practica numeric, final numeric, extras numeric, extras_pendientes numeric, bruto numeric, nota_final numeric,
  pendientes integer, es_monitor boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  with alumnos as (
    select e.user_id, p.full_name, p.student_code from public.enrollments e
    join public.profiles p on p.id = e.user_id and p.role = 'student' where e.class_id = p_class
  ), notas as (
    select s.user_id,
      max(s.score) filter (where s.category = 'parcial1') p1, max(s.score) filter (where s.category = 'parcial2') p2,
      max(s.score) filter (where s.category = 'parcial3') p3, max(s.score) filter (where s.category = 'practica') pr,
      max(s.score) filter (where s.category = 'final') fi
    from public.official_scores(p_class) s group by s.user_id
  ), ext as (
    select x.user_id, coalesce(sum(x.points) filter (where x.status = 'aprobado'), 0) ap,
      coalesce(sum(x.points) filter (where x.status = 'pendiente'), 0) pe
    from public.extra_points x where x.class_id = p_class group by x.user_id
  )
  select a.user_id, a.full_name, a.student_code, n.p1, n.p2, n.p3, n.pr, n.fi,
    coalesce(x.ap, 0), coalesce(x.pe, 0),
    coalesce(n.p1, 0) + coalesce(n.p2, 0) + coalesce(n.p3, 0) + coalesce(n.pr, 0) + coalesce(n.fi, 0) + coalesce(x.ap, 0),
    least(100, coalesce(n.p1, 0) + coalesce(n.p2, 0) + coalesce(n.p3, 0) + coalesce(n.pr, 0) + coalesce(n.fi, 0) + coalesce(x.ap, 0)),
    ((n.p1 is null)::int + (n.p2 is null)::int + (n.p3 is null)::int + (n.pr is null)::int + (n.fi is null)::int),
    exists (select 1 from public.class_monitors m where m.class_id = p_class and m.user_id = a.user_id and m.revoked_at is null)
  from alumnos a left join notas n on n.user_id = a.user_id left join ext x on x.user_id = a.user_id
  order by a.full_name;
end;
$$;

-- my_official_grades: igual que en la migración 15, con las notas de official_scores (solo las propias)
create or replace function public.my_official_grades()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', c.id, 'class_name', c.name, 'course_title', k.title,
    'published', coalesce(s.published, false),
    'notas', case when coalesce(s.published, false) then (
       select jsonb_object_agg(o.category, o.score) from public.official_scores(c.id) o
       where o.user_id = auth.uid() and o.score is not null)
     end,
    'extras', case when coalesce(s.published, false) then (
       select coalesce(jsonb_agg(jsonb_build_object('points', x.points, 'reason', x.reason, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
       from public.extra_points x where x.class_id = c.id and x.user_id = auth.uid() and x.status = 'aprobado')
     end
  ) order by k.title), '[]'::jsonb)
  from public.enrollments e
  join public.classes c on c.id = e.class_id and not c.archived
  join public.courses k on k.id = c.course_id
  left join public.grade_settings s on s.class_id = c.id
  where e.user_id = auth.uid() and public.my_account_ok()
$$;

revoke all on function public.official_scores(uuid) from public, anon, authenticated;
revoke all on function public.set_activity_grade_link(uuid, text, numeric) from public, anon;
revoke all on function public.class_activity_links(uuid) from public, anon;
revoke all on function public.gradebook_sources(uuid) from public, anon;
grant execute on function public.set_activity_grade_link(uuid, text, numeric) to authenticated;
grant execute on function public.class_activity_links(uuid) to authenticated;
grant execute on function public.gradebook_sources(uuid) to authenticated;
