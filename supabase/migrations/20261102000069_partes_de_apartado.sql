-- =============================================================================
-- Migración 69 · Parte manual dentro de un apartado del Registro de Calificaciones (p. ej. Práctica 30 =
-- «Prácticas anteriores» 15 a mano + prácticas del aula 15). Solo añade: dos tablas nuevas y funciones.
--
--  · Por sección y apartado, el profesor puede definir UNA parte manual (nombre y valor, menor que el apartado).
--  · Las actividades vinculadas al apartado reparten lo que queda (apartado − parte); la parte se escribe a mano por
--    estudiante (vacío = pendiente; 0 es una nota).
--  · Nota del apartado = nota a mano del apartado completo (si existe, tiene prioridad, como antes)
--                        o, si no, actividades + parte (con el máximo del apartado).
--  · Cada cambio de la parte queda en grade_history con la categoría «<apartado>:parte».
-- Redefine (mismas firmas): official_scores, set_activity_grade_link, class_activity_links, my_grade_breakdown.
-- Sin partes definidas, todo se calcula exactamente como antes.
-- =============================================================================

create table if not exists public.grade_parts (
  class_id uuid not null references public.classes (id) on delete cascade,
  category text not null check (category in ('parcial1', 'parcial2', 'parcial3', 'practica', 'final')),
  label text not null check (char_length(label) between 1 and 80),
  max numeric(5, 2) not null check (max > 0 and max < public.grade_category_max(category)),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (class_id, category)
);
create table if not exists public.grade_part_scores (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('parcial1', 'parcial2', 'parcial3', 'practica', 'final')),
  score numeric(5, 2) check (score is null or score >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (class_id, user_id, category)
);
alter table public.grade_parts enable row level security;
alter table public.grade_part_scores enable row level security;
revoke all on public.grade_parts, public.grade_part_scores from anon, authenticated;

create or replace function public.grade_part_scores_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.score is distinct from old.score then
    insert into public.grade_history (class_id, user_id, category, old_score, new_score, changed_by)
      values (new.class_id, new.user_id, new.category || ':parte', case when tg_op = 'UPDATE' then old.score end, new.score,
              coalesce(auth.uid(), new.updated_by));
  end if;
  return new;
end;
$$;
drop trigger if exists grade_part_scores_log on public.grade_part_scores;
create trigger grade_part_scores_log after insert or update on public.grade_part_scores
  for each row execute function public.grade_part_scores_log();

-- Valor de la parte manual de un apartado en una sección (0 si no hay)
create or replace function public.grade_part_max(p_class uuid, p_category text)
returns numeric language sql stable security definer set search_path = ''
as $$ select coalesce((select max from public.grade_parts where class_id = p_class and category = p_category), 0)::numeric $$;

-- -----------------------------------------------------------------------------
-- Profesor: definir la parte, escribir sus notas, verla
-- -----------------------------------------------------------------------------

-- p_max NULL = quitar la parte (sus notas se conservan, pero dejan de contar)
create or replace function public.set_grade_part(p_class uuid, p_category text, p_label text, p_max numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_fijos numeric;
begin
  perform public.grades_assert_teacher(p_class);
  if public.grade_category_max(p_category) is null then raise exception 'Apartado no válido' using errcode = '22023'; end if;
  if p_max is null then
    delete from public.grade_parts where class_id = p_class and category = p_category;
    return;
  end if;
  if p_max <= 0 or p_max >= public.grade_category_max(p_category) then
    raise exception 'La parte debe valer más de 0 y menos de %', public.grade_category_max(p_category) using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_label, '')), '') is null then raise exception 'Escriba el nombre de la parte' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vinculos:' || p_class::text || p_category, 0));
  select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links where class_id = p_class and category = p_category and points is not null;
  if v_fijos + p_max > public.grade_category_max(p_category) then
    raise exception 'Las actividades de valor fijo ya suman % puntos: la parte puede valer como máximo %', v_fijos, public.grade_category_max(p_category) - v_fijos
      using errcode = 'P0001';
  end if;
  insert into public.grade_parts (class_id, category, label, max, updated_by) values (p_class, p_category, left(btrim(p_label), 80), round(p_max, 2), auth.uid())
    on conflict (class_id, category) do update set label = excluded.label, max = excluded.max, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- p_score NULL = pendiente
create or replace function public.set_grade_part_score(p_class uuid, p_user uuid, p_category text, p_score numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_max numeric;
begin
  perform public.grades_assert_teacher(p_class);
  if not exists (select 1 from public.enrollments where class_id = p_class and user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  select max into v_max from public.grade_parts where class_id = p_class and category = p_category;
  if v_max is null then raise exception 'Este apartado no tiene una parte manual' using errcode = 'P0001'; end if;
  if p_score is not null and (p_score < 0 or p_score > v_max) then
    raise exception 'La nota debe estar entre 0 y %', v_max using errcode = '22023';
  end if;
  insert into public.grade_part_scores (class_id, user_id, category, score, updated_by)
    values (p_class, p_user, p_category, round(p_score, 2), auth.uid())
    on conflict (class_id, user_id, category) do update
      set score = excluded.score, updated_by = excluded.updated_by, updated_at = now()
      where public.grade_part_scores.score is distinct from excluded.score;
end;
$$;

create or replace function public.class_grade_parts(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return jsonb_build_object(
    'partes', (select coalesce(jsonb_agg(jsonb_build_object('category', p.category, 'label', p.label, 'max', p.max) order by p.category), '[]'::jsonb)
               from public.grade_parts p where p.class_id = p_class),
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'category', s.category, 'score', s.score)), '[]'::jsonb)
              from public.grade_part_scores s join public.grade_parts p on p.class_id = s.class_id and p.category = s.category
              where s.class_id = p_class));
end;
$$;

-- -----------------------------------------------------------------------------
-- Cálculo: las actividades reparten (apartado − parte); la nota suma actividades + parte
-- -----------------------------------------------------------------------------

-- set_activity_grade_link (migración 16) + la parte manual reduce lo que pueden valer las actividades de valor fijo
create or replace function public.set_activity_grade_link(p_activity uuid, p_category text, p_points numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_fijos numeric; v_disp numeric;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null then raise exception 'Actividad no encontrada' using errcode = 'P0002'; end if;
  perform public.grades_assert_teacher(v_class);
  if p_category is null then
    delete from public.activity_grade_links where activity_id = p_activity;
    return;
  end if;
  if public.grade_category_max(p_category) is null then raise exception 'Apartado no válido' using errcode = '22023'; end if;
  v_disp := public.grade_category_max(p_category) - public.grade_part_max(v_class, p_category);
  if p_points is not null and (p_points <= 0 or p_points > v_disp) then
    raise exception 'El valor debe estar entre 0 y %', v_disp using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('vinculos:' || v_class::text || p_category, 0));
  select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links
    where class_id = v_class and category = p_category and activity_id <> p_activity and points is not null;
  if v_fijos + coalesce(p_points, 0) > v_disp then
    raise exception 'Las actividades de este apartado sumarían % puntos y el máximo es %', v_fijos + p_points, v_disp
      using errcode = 'P0001';
  end if;
  insert into public.activity_grade_links (activity_id, class_id, category, points, updated_by)
    values (p_activity, v_class, p_category, round(p_points, 2), auth.uid())
    on conflict (activity_id) do update set category = excluded.category, points = excluded.points,
      updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- class_activity_links (migración 16) + reparto sin la parte manual
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
         else round(greatest(0, public.grade_category_max(l.category) - public.grade_part_max(p_class, l.category) - f.fijos) / nullif(f.n, 0), 2) end
  from public.activities a
  left join l on l.activity_id = a.id
  left join f on f.category = l.category
  where a.class_id = p_class
  order by a.created_at;
end;
$$;

-- official_scores (migración 62, con el factor del control) + parte manual
create or replace function public.official_scores(p_class uuid)
returns table (user_id uuid, category text, score numeric, source text, pendientes integer)
language sql stable security definer set search_path = ''
as $$
  with cats(category) as (values ('parcial1'), ('parcial2'), ('parcial3'), ('practica'), ('final')),
  alumnos as (select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
              where e.class_id = p_class),
  partes as (select gp.category, gp.max from public.grade_parts gp where gp.class_id = p_class),
  l as (select k.*, a.closes_at from public.activity_grade_links k join public.activities a on a.id = k.activity_id
        where k.class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
  w as (select l.activity_id, l.category, l.closes_at,
          coalesce(l.points, greatest(0, public.grade_category_max(l.category) - coalesce(pt.max, 0) - f.fijos) / nullif(f.n, 0)) peso
        from l join f on f.category = l.category left join partes pt on pt.category = l.category),
  mejor as (select t.user_id, t.activity_id, max(t.score / nullif(t.max_score, 0)) * public.control_factor(t.activity_id, t.user_id) pct
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
           else least(public.grade_category_max(x.category) - coalesce((select pt.max from partes pt where pt.category = x.category), 0),
                      round(sum(x.peso * x.pct), 2)) end score,
      count(*) filter (where x.pct is null)::integer pend
    from aporte x group by x.user_id, x.category
  ),
  parte as (
    select s.user_id, s.category, least(s.score, pt.max) score from public.grade_part_scores s join partes pt on pt.category = s.category
    where s.class_id = p_class
  )
  select a.user_id, c.category,
    coalesce(g.score, case when au.score is null and pa.score is null then null
                           else least(public.grade_category_max(c.category), coalesce(au.score, 0) + coalesce(pa.score, 0)) end),
    case when g.score is not null then 'manual' when au.score is not null or pa.score is not null then 'actividades' end,
    case when g.score is not null then 0
         else coalesce(au.pend, 0) + case when pt.category is not null and pa.score is null then 1 else 0 end end
  from alumnos a cross join cats c
  left join public.grade_entries g on g.class_id = p_class and g.user_id = a.user_id and g.category = c.category
  left join auto au on au.user_id = a.user_id and au.category = c.category
  left join partes pt on pt.category = c.category
  left join parte pa on pa.user_id = a.user_id and pa.category = c.category
$$;

-- my_grade_breakdown (migración 62) + reparto sin la parte manual y la parte («parte») en su apartado
create or replace function public.my_grade_breakdown()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  r record;
  v_pub boolean;
  v_cats jsonb;
begin
  if v_uid is null or not public.my_account_ok() then return v_out; end if;
  for r in
    select c.id class_id, c.name class_name, k.title course_title
    from public.enrollments e join public.classes c on c.id = e.class_id and not c.archived
    join public.courses k on k.id = c.course_id
    where e.user_id = v_uid order by k.title
  loop
    select coalesce(published, false) into v_pub from public.grade_settings where class_id = r.class_id;
    v_pub := coalesce(v_pub, false);
    with cats(category, orden) as (values ('parcial1', 1), ('parcial2', 2), ('parcial3', 3), ('practica', 4), ('final', 5)),
    l as (select k.*, a.title, a.closes_at, a.mode from public.activity_grade_links k join public.activities a on a.id = k.activity_id
          where k.class_id = r.class_id),
    f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
    acts as (
      select l.category, jsonb_agg(jsonb_build_object(
          'activity_id', l.activity_id, 'title', l.title, 'mode', l.mode, 'closes_at', l.closes_at,
          'peso', round(coalesce(l.points, greatest(0, public.grade_category_max(l.category) - public.grade_part_max(r.class_id, l.category) - f.fijos) / nullif(f.n, 0)), 2),
          'por_definir', l.points is null,
          'visible', public.activity_visible_to_me(l.activity_id),
          'mejor', case when v_pub then (select round(100 * max(t.score / nullif(t.max_score, 0)), 1) from public.attempts t
                    where t.activity_id = l.activity_id and t.user_id = v_uid and t.status = 'submitted') end,
          'control', case when v_pub and public.control_factor(l.activity_id, v_uid) < 1 then jsonb_build_object(
                    'resultado', round(100 * public.control_resultado(l.activity_id, v_uid), 1),
                    'factor', round(public.control_factor(l.activity_id, v_uid), 4),
                    'ajustada', (select round(100 * max(t.score / nullif(t.max_score, 0)) * public.control_factor(l.activity_id, v_uid), 1) from public.attempts t
                                 where t.activity_id = l.activity_id and t.user_id = v_uid and t.status = 'submitted')) end
        ) order by l.title) lista
      from l join f on f.category = l.category group by l.category
    ),
    sc as (select * from public.official_scores(r.class_id) where user_id = v_uid)
    select jsonb_agg(jsonb_build_object(
        'category', cats.category, 'max', public.grade_category_max(cats.category),
        'score', case when v_pub then sc.score end,
        'source', case when v_pub then sc.source end,
        'pendientes', case when v_pub then sc.pendientes end,
        'actividades', coalesce(acts.lista, '[]'::jsonb),
        'parte', (select jsonb_build_object('label', gp.label, 'max', gp.max,
                    'score', case when v_pub then (select least(s.score, gp.max) from public.grade_part_scores s
                                                    where s.class_id = r.class_id and s.user_id = v_uid and s.category = gp.category) end)
                  from public.grade_parts gp where gp.class_id = r.class_id and gp.category = cats.category)
      ) order by cats.orden)
    into v_cats
    from cats left join sc on sc.category = cats.category left join acts on acts.category = cats.category;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'class_id', r.class_id, 'class_name', r.class_name, 'course_title', r.course_title, 'published', v_pub,
      'categorias', v_cats,
      'extras', case when v_pub then (
        select coalesce(jsonb_agg(jsonb_build_object('points', x.points, 'reason', x.reason, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
        from public.extra_points x where x.class_id = r.class_id and x.user_id = v_uid and x.status = 'aprobado') else '[]'::jsonb end));
  end loop;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.grade_part_scores_log() from public, anon, authenticated;
revoke all on function public.grade_part_max(uuid, text) from public, anon, authenticated;
revoke all on function public.official_scores(uuid) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['set_grade_part(uuid, text, text, numeric)', 'set_grade_part_score(uuid, uuid, text, numeric)', 'class_grade_parts(uuid)',
                           'set_activity_grade_link(uuid, text, numeric)', 'class_activity_links(uuid)', 'my_grade_breakdown()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
