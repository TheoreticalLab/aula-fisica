-- =============================================================================
-- Migración 90 · Registro de calificaciones de las asignaturas de LABORATORIO.
--
-- En una asignatura de laboratorio (courses.laboratorio_controles no nulo) el registro es:
--   Primer parcial 20 · Segundo parcial 20 · Tercer parcial 30 · Práctica 30  (total 100)
--   sin Examen final y sin puntos extras.
-- El resto de asignaturas NO cambia (15 · 15 · 15 · 30 · 25 y extras).
--
--  · grade_category_max(p_class, p_category): máximo de un apartado EN ESA SECCIÓN (null = el apartado no existe).
--    La versión de un argumento (migración 15) se conserva y es la que usan las demás asignaturas.
--  · grade_extras_permitidos(p_class): falso en laboratorio; add_extra_points lo comprueba.
--  · Las restricciones de grade_entries, activity_grade_links y grade_parts usan el máximo de la sección
--    (sustituidas en la misma transacción; las filas existentes se validan al añadirlas).
--  · Funciones del registro (copias LITERALES de su versión vigente, generadas con
--    privado/tmp/rend2/generar-migracion-90.py) con el máximo de la sección y, en laboratorio, sin el apartado «final»:
--    set_official_grade, set_grade_part, set_activity_grade_link, class_activity_links, actividad_copiar,
--    official_lost, official_scores, my_grade_breakdown, gradebook_official y add_extra_points.
-- Ninguna nota se modifica. Aditiva salvo la sustitución de tres restricciones CHECK (no borra datos).
-- Reversión: supabase/reversion/20261106000090_registro_laboratorio_revertir.sql
-- =============================================================================

set local lock_timeout = '5s';

create or replace function public.grade_category_max(p_class uuid, p_category text)
returns numeric language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.classes c join public.courses k on k.id = c.course_id
                 where c.id = p_class and k.laboratorio_controles is not null)
      then case p_category when 'parcial1' then 20 when 'parcial2' then 20 when 'parcial3' then 30
                           when 'practica' then 30 end::numeric
    else public.grade_category_max(p_category)
  end
$$;

create or replace function public.grade_extras_permitidos(p_class uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.classes c join public.courses k on k.id = c.course_id
                     where c.id = p_class and k.laboratorio_controles is not null)
$$;

-- Restricciones: el máximo de la SECCIÓN (un apartado inexistente no admite valores)
alter table public.grade_entries drop constraint if exists grade_entries_check;
alter table public.grade_entries add constraint grade_entries_check
  check (score is null or (score >= 0 and score <= coalesce(public.grade_category_max(class_id, category), -1)));
alter table public.activity_grade_links drop constraint if exists activity_grade_links_check;
alter table public.activity_grade_links add constraint activity_grade_links_check
  check (points is null or (points > 0 and points <= coalesce(public.grade_category_max(class_id, category), -1)));
alter table public.grade_parts drop constraint if exists grade_parts_check;
alter table public.grade_parts add constraint grade_parts_check
  check (max > 0 and max < coalesce(public.grade_category_max(class_id, category), 0));

-- set_official_grade (copia de 20261027000015_registro_calificaciones.sql)
create or replace function public.set_official_grade(p_class uuid, p_user uuid, p_category text, p_score numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  if not exists (select 1 from public.enrollments where class_id = p_class and user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  if public.grade_category_max(p_class, p_category) is null then raise exception 'Categoría no válida' using errcode = '22023'; end if;
  if p_score is not null and (p_score < 0 or p_score > public.grade_category_max(p_class, p_category)) then
    raise exception 'La nota de % debe estar entre 0 y %', p_category, public.grade_category_max(p_class, p_category) using errcode = '22023';
  end if;
  insert into public.grade_entries (class_id, user_id, category, score, updated_by)
    values (p_class, p_user, p_category, round(p_score, 2), auth.uid())
    on conflict (class_id, user_id, category) do update
      set score = excluded.score, updated_by = excluded.updated_by, updated_at = now()
      where public.grade_entries.score is distinct from excluded.score;
end;
$$;

-- set_grade_part (copia de 20261102000069_partes_de_apartado.sql)
create or replace function public.set_grade_part(p_class uuid, p_category text, p_label text, p_max numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_fijos numeric;
begin
  perform public.grades_assert_teacher(p_class);
  if public.grade_category_max(p_class, p_category) is null then raise exception 'Apartado no válido' using errcode = '22023'; end if;
  if p_max is null then
    delete from public.grade_parts where class_id = p_class and category = p_category;
    return;
  end if;
  if p_max <= 0 or p_max >= public.grade_category_max(p_class, p_category) then
    raise exception 'La parte debe valer más de 0 y menos de %', public.grade_category_max(p_class, p_category) using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_label, '')), '') is null then raise exception 'Escriba el nombre de la parte' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vinculos:' || p_class::text || p_category, 0));
  select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links where class_id = p_class and category = p_category and points is not null;
  if v_fijos + p_max > public.grade_category_max(p_class, p_category) then
    raise exception 'Las actividades de valor fijo ya suman % puntos: la parte puede valer como máximo %', v_fijos, public.grade_category_max(p_class, p_category) - v_fijos
      using errcode = 'P0001';
  end if;
  insert into public.grade_parts (class_id, category, label, max, updated_by) values (p_class, p_category, left(btrim(p_label), 80), round(p_max, 2), auth.uid())
    on conflict (class_id, category) do update set label = excluded.label, max = excluded.max, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- set_activity_grade_link (copia de 20261102000069_partes_de_apartado.sql)
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
  if public.grade_category_max(v_class, p_category) is null then raise exception 'Apartado no válido' using errcode = '22023'; end if;
  v_disp := public.grade_category_max(v_class, p_category) - public.grade_part_max(v_class, p_category);
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

-- class_activity_links (copia de 20261102000069_partes_de_apartado.sql)
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
         else round(greatest(0, public.grade_category_max(p_class, l.category) - public.grade_part_max(p_class, l.category) - f.fijos) / nullif(f.n, 0), 2) end
  from public.activities a
  left join l on l.activity_id = a.id
  left join f on f.category = l.category
  where a.class_id = p_class
  order by a.created_at;
end;
$$;

-- actividad_copiar (copia de 20261104000078_tiempo_minimo_practica.sql)
create or replace function public.actividad_copiar(p_activity uuid, p_class uuid, p_fechas boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  a public.activities; v_src uuid; v_dst uuid; v_new uuid := gen_random_uuid(); v_lesson uuid;
  r record; v_ex uuid; v_map jsonb := '{}'::jsonb; v_enl integer := 0; v_cop integer := 0;
  g public.activity_grade_links; v_fijos numeric; v_disp numeric; v_reg text := null; v_patch jsonb;
begin
  select * into a from public.activities where id = p_activity;
  if a.id is null or not public.is_class_teacher(a.class_id) or p_class is null or not public.is_class_teacher(p_class) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from public.control_sessions s where s.control_activity_id = a.id) then
    raise exception 'Una Práctica de Control no se copia: se genera en clase desde Orbe Control' using errcode = 'P0001'; end if;
  select course_id into v_src from public.classes where id = a.class_id;
  select course_id into v_dst from public.classes where id = p_class and not archived;
  if v_dst is null then raise exception 'Sección de destino no válida' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('copiar-actividad:' || v_dst::text, 0));

  -- 1) ejercicios: misma asignatura → los mismos; otra → el del mismo identificador, o una copia
  for r in
    select ex.* from public.exercises ex where ex.id in (
      select i.exercise_id from public.activity_items i where i.activity_id = a.id
      union select d.exercise_id from public.exam_design_items d where d.activity_id = a.id
      union select t.exercise_id from public.assisted_transfer t where t.activity_id = a.id
      union select t.transfer_exercise_id from public.assisted_transfer t where t.activity_id = a.id)
  loop
    if v_src = v_dst then
      v_ex := r.id;
    else
      v_ex := (select e.id from public.exercises e where e.course_id = v_dst and e.slug = r.slug);
      if v_ex is not null then
        v_enl := v_enl + 1;
      else
        v_ex := gen_random_uuid();
        insert into public.exercises
          select (jsonb_populate_record(null::public.exercises, to_jsonb(r) || jsonb_build_object(
            'id', v_ex, 'course_id', v_dst, 'created_by', auth.uid(), 'updated_at', now(),
            'lesson_id', (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = r.lesson_id))))).*;
        insert into public.exercise_keys
          select (jsonb_populate_record(null::public.exercise_keys, to_jsonb(k) || jsonb_build_object('exercise_id', v_ex))).*
          from public.exercise_keys k where k.exercise_id = r.id;
        insert into public.exercise_bank_meta (exercise_id, course_id, meta)
          select v_ex, v_dst, m.meta from public.exercise_bank_meta m where m.exercise_id = r.id;
        v_cop := v_cop + 1;
      end if;
    end if;
    v_map := v_map || jsonb_build_object(r.id::text, v_ex);
  end loop;

  -- 2) la actividad (oculta; sin grupo; lección equivalente en la asignatura de destino)
  v_lesson := case when v_src = v_dst then a.lesson_id
                   else (select l.id from public.lessons l where l.course_id = v_dst and l.slug = (select l0.slug from public.lessons l0 where l0.id = a.lesson_id)) end;
  v_patch := jsonb_build_object('id', v_new, 'class_id', p_class, 'group_id', null, 'lesson_id', v_lesson, 'published', false, 'grades_published', false,
                                'created_by', auth.uid(), 'created_at', now(), 'updated_at', now());
  if not coalesce(p_fechas, true) then
    v_patch := v_patch || jsonb_build_object('opens_at', null, 'closes_at', null)
      -- «después del cierre» necesita una fecha de cierre
      || case when a.reveal_policy = 'after_close' then jsonb_build_object('reveal_policy', 'after_submit') else '{}'::jsonb end;
  end if;
  insert into public.activities select (jsonb_populate_record(null::public.activities, to_jsonb(a) || v_patch)).*;

  insert into public.activity_items (activity_id, exercise_id, position, points)
    select v_new, (v_map ->> i.exercise_id::text)::uuid, i.position, i.points from public.activity_items i where i.activity_id = a.id;

  -- 3) configuración asociada (cada tabla, si la actividad la tiene)
  insert into public.exam_settings
    select (jsonb_populate_record(null::public.exam_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_settings x where x.activity_id = a.id;
  insert into public.exam_designs
    select (jsonb_populate_record(null::public.exam_designs, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_designs x where x.activity_id = a.id;
  insert into public.exam_design_items
    select (jsonb_populate_record(null::public.exam_design_items, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'exercise_id', v_map ->> x.exercise_id::text))).*
    from public.exam_design_items x where x.activity_id = a.id;
  insert into public.exam_adaptive
    select (jsonb_populate_record(null::public.exam_adaptive, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now()))).*
    from public.exam_adaptive x where x.activity_id = a.id;
  -- la actividad de verificación de la práctica asistida es de la sección de origen: en la copia se elige de nuevo
  insert into public.assisted_settings
    select (jsonb_populate_record(null::public.assisted_settings, to_jsonb(x) || jsonb_build_object('activity_id', v_new, 'updated_by', auth.uid(), 'updated_at', now(),
      'verificacion_actividad', null))).*
    from public.assisted_settings x where x.activity_id = a.id;
  insert into public.assisted_transfer (activity_id, exercise_id, transfer_exercise_id)
    select v_new, (v_map ->> t.exercise_id::text)::uuid, (v_map ->> t.transfer_exercise_id::text)::uuid from public.assisted_transfer t where t.activity_id = a.id;

  -- tiempo mínimo de realización (migración 78): misma regla; cuenta desde la copia
  insert into public.activity_min_time (activity_id, minutos, activo, activado_at, updated_by, updated_at)
    select v_new, x.minutos, x.activo, now(), auth.uid(), now() from public.activity_min_time x where x.activity_id = a.id;

  -- 4) Registro de Calificaciones: el mismo apartado; el valor fijo solo si cabe en el destino
  select * into g from public.activity_grade_links where activity_id = a.id;
  if g.activity_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('vinculos:' || p_class::text || g.category, 0));
    v_disp := public.grade_category_max(p_class, g.category) - public.grade_part_max(p_class, g.category);
    select coalesce(sum(points), 0) into v_fijos from public.activity_grade_links where class_id = p_class and category = g.category and points is not null;
    insert into public.activity_grade_links (activity_id, class_id, category, points, updated_by)
      values (v_new, p_class, g.category, case when g.points is not null and v_fijos + g.points <= v_disp then g.points end, auth.uid());
    v_reg := g.category;
  end if;

  return jsonb_build_object('id', v_new, 'misma_asignatura', v_src = v_dst, 'ejercicios', (select count(*) from public.activity_items where activity_id = v_new),
    'ejercicios_enlazados', v_enl, 'ejercicios_copiados', v_cop, 'registro', v_reg,
    'registro_por_definir', coalesce(g.points is not null and not exists (select 1 from public.activity_grade_links k where k.activity_id = v_new and k.points is not null), false));
end;
$$;

-- official_lost (copia de 20261103000070_puntos_perdidos.sql)
create or replace function public.official_lost(p_class uuid)
returns table (user_id uuid, category text, perdidos numeric, etiqueta text)
language sql stable security definer set search_path = ''
as $$
  with solo_parte as (
    select gp.category, gp.max, gp.label from public.grade_parts gp
    join public.lost_alert_settings s on s.class_id = gp.class_id
    where gp.class_id = p_class and s.parte_hasta is not null and (now() at time zone 'America/Santo_Domingo')::date < s.parte_hasta
  )
  select o.user_id, o.category,
    case when sp.category is not null then
           case when ps.score is null then 0 else round(greatest(0, sp.max - least(ps.score, sp.max)), 2) end
         when o.score is null then 0
         else round(greatest(0, public.grade_category_max(p_class, o.category) - o.score), 2) end,
    coalesce(sp.label, case o.category when 'parcial1' then 'Primer parcial' when 'parcial2' then 'Segundo parcial' when 'parcial3' then 'Tercer parcial'
                                       when 'practica' then 'Práctica' else 'Examen final' end)
  from public.official_scores(p_class) o
  left join solo_parte sp on sp.category = o.category
  left join public.grade_part_scores ps on ps.class_id = p_class and ps.user_id = o.user_id and ps.category = o.category
$$;

-- official_scores (copia de 20261102000069_partes_de_apartado.sql)
create or replace function public.official_scores(p_class uuid)
returns table (user_id uuid, category text, score numeric, source text, pendientes integer)
language sql stable security definer set search_path = ''
as $$
  with cats(category) as (select v.category from (values ('parcial1'), ('parcial2'), ('parcial3'), ('practica'), ('final')) v(category)
                         where public.grade_category_max(p_class, v.category) is not null),   -- laboratorio: sin examen final
  alumnos as (select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
              where e.class_id = p_class),
  partes as (select gp.category, gp.max from public.grade_parts gp where gp.class_id = p_class),
  l as (select k.*, a.closes_at from public.activity_grade_links k join public.activities a on a.id = k.activity_id
        where k.class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
  w as (select l.activity_id, l.category, l.closes_at,
          coalesce(l.points, greatest(0, public.grade_category_max(p_class, l.category) - coalesce(pt.max, 0) - f.fijos) / nullif(f.n, 0)) peso
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
           else least(public.grade_category_max(p_class, x.category) - coalesce((select pt.max from partes pt where pt.category = x.category), 0),
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
                           else least(public.grade_category_max(p_class, c.category), coalesce(au.score, 0) + coalesce(pa.score, 0)) end),
    case when g.score is not null then 'manual' when au.score is not null or pa.score is not null then 'actividades' end,
    case when g.score is not null then 0
         else coalesce(au.pend, 0) + case when pt.category is not null and pa.score is null then 1 else 0 end end
  from alumnos a cross join cats c
  left join public.grade_entries g on g.class_id = p_class and g.user_id = a.user_id and g.category = c.category
  left join auto au on au.user_id = a.user_id and au.category = c.category
  left join partes pt on pt.category = c.category
  left join parte pa on pa.user_id = a.user_id and pa.category = c.category
$$;

-- my_grade_breakdown (copia de 20261102000069_partes_de_apartado.sql)
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
    with cats(category, orden) as (select v.category, v.orden from (values ('parcial1', 1), ('parcial2', 2), ('parcial3', 3), ('practica', 4), ('final', 5)) v(category, orden)
                                 where public.grade_category_max(r.class_id, v.category) is not null),   -- laboratorio: sin examen final
    l as (select k.*, a.title, a.closes_at, a.mode from public.activity_grade_links k join public.activities a on a.id = k.activity_id
          where k.class_id = r.class_id),
    f as (select l.category, coalesce(sum(l.points), 0) fijos, count(*) filter (where l.points is null) n from l group by l.category),
    acts as (
      select l.category, jsonb_agg(jsonb_build_object(
          'activity_id', l.activity_id, 'title', l.title, 'mode', l.mode, 'closes_at', l.closes_at,
          'peso', round(coalesce(l.points, greatest(0, public.grade_category_max(r.class_id, l.category) - public.grade_part_max(r.class_id, l.category) - f.fijos) / nullif(f.n, 0)), 2),
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
        'category', cats.category, 'max', public.grade_category_max(r.class_id, cats.category),
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

-- gradebook_official (copia de 20261027000016_actividades_en_registro.sql)
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
    ((n.p1 is null)::int + (n.p2 is null)::int + (n.p3 is null)::int + (n.pr is null)::int
     + (n.fi is null and public.grade_category_max(p_class, 'final') is not null)::int),   -- laboratorio: sin examen final
    exists (select 1 from public.class_monitors m where m.class_id = p_class and m.user_id = a.user_id and m.revoked_at is null)
  from alumnos a left join notas n on n.user_id = a.user_id left join ext x on x.user_id = a.user_id
  order by a.full_name;
end;
$$;

-- add_extra_points (copia de 20261027000015_registro_calificaciones.sql)
create or replace function public.add_extra_points(p_request uuid, p_class uuid, p_user uuid, p_points numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof boolean;
  v_s public.grade_settings;
  v_ya numeric;
  v_row public.extra_points;
  v_hoy date := (now() at time zone 'America/Santo_Domingo')::date;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_request is null then raise exception 'Falta el identificador de la solicitud' using errcode = '22023'; end if;
  if not public.grade_extras_permitidos(p_class) then
    raise exception 'Esta asignatura no tiene puntos extras' using errcode = '22023';
  end if;
  select * into v_row from public.extra_points where request_id = p_request;
  if found then
    if v_row.assigned_by <> v_uid then raise exception 'Solicitud ajena' using errcode = '42501'; end if;
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true);
  end if;
  v_prof := public.grades_teacher(p_class);
  if not v_prof and not public.is_class_monitor(p_class) then
    raise exception 'Solo el monitor o el profesor de la sección' using errcode = '42501';
  end if;
  if p_user = v_uid then raise exception 'No puede asignarse puntos a sí mismo' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments e join public.profiles p on p.id = e.user_id and p.role = 'student'
                 where e.class_id = p_class and e.user_id = p_user) then
    raise exception 'El estudiante no pertenece a la sección' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 300 then
    raise exception 'Escriba el motivo (3 a 300 caracteres)' using errcode = '22023';
  end if;
  if p_points is null or p_points <= 0 then raise exception 'La cantidad debe ser positiva' using errcode = '22023'; end if;

  -- serializa las asignaciones al mismo estudiante (evita superar el máximo con peticiones simultáneas)
  perform pg_advisory_xact_lock(hashtextextended('extras:' || p_class::text || p_user::text, 0));
  select * into v_s from public.grade_settings where class_id = p_class;
  if not v_prof then
    if v_s.extra_from is not null and v_hoy < v_s.extra_from or v_s.extra_to is not null and v_hoy > v_s.extra_to then
      raise exception 'Las asignaciones de extras no están habilitadas en esta fecha' using errcode = 'P0001';
    end if;
    if p_points > coalesce(v_s.extra_max_per_operation, 2) then
      raise exception 'Máximo % puntos por asignación', coalesce(v_s.extra_max_per_operation, 2) using errcode = 'P0001';
    end if;
  end if;
  select coalesce(sum(points), 0) into v_ya from public.extra_points
    where class_id = p_class and user_id = p_user and status in ('pendiente', 'aprobado');
  if v_ya + p_points > coalesce(v_s.extra_max_per_student, 5) then
    raise exception 'Superaría el máximo de % puntos extras por estudiante (ya tiene %)', coalesce(v_s.extra_max_per_student, 5), v_ya
      using errcode = 'P0001';
  end if;

  insert into public.extra_points (request_id, class_id, user_id, assigned_by, assigner_role, points, reason, status,
      reviewed_by, reviewed_at)
    values (p_request, p_class, p_user, v_uid, case when v_prof then 'profesor' else 'monitor' end, round(p_points, 2), btrim(p_reason),
      case when v_prof or not coalesce(v_s.extra_requires_approval, true) then 'aprobado' else 'pendiente' end,
      case when v_prof then v_uid end, case when v_prof then now() end)
    returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
end;
$$;

revoke all on function public.grade_category_max(uuid, text) from public, anon;
grant execute on function public.grade_category_max(uuid, text) to authenticated;
revoke all on function public.grade_extras_permitidos(uuid) from public, anon;
grant execute on function public.grade_extras_permitidos(uuid) to authenticated;
