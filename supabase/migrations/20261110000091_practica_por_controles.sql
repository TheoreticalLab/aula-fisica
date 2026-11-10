-- =============================================================================
-- Migración 91 · Laboratorio: la PRÁCTICA se calcula con los CONTROLES entregados.
--
-- En una asignatura de laboratorio, cada control que «cuenta para la Práctica» (upload_boxes.cuenta_en_practica)
-- vale lo mismo: el peso de los controles dividido entre los controles que cuentan. Con 7 que cuentan y la Práctica
-- entera para ellos, 30/7 ≈ 4,29 cada uno. Suma el control cuya entrega vigente está entregada (sin revisar) o
-- aprobada; «requiere corrección» no suma hasta que el estudiante sube otra. El control 6 de las secciones de
-- laboratorio existentes queda fuera (decisión del profesor, 10-nov-2026); se cambia en «Controles de laboratorio».
--
-- Los controles entran en la Práctica como una actividad vinculada más «sin valor fijo»: se reparten con las
-- actividades sin valor fijo lo que dejan la parte manual y las de valor fijo (hoy no hay ninguna: valen los 30).
-- Una nota escrita a mano en la Práctica sigue mandando, como siempre.
--
--  · upload_boxes.cuenta_en_practica (aditiva, por defecto sí) y lab_control_cuenta(sección, número, cuenta).
--  · lab_controles_cuentan(sección) y lab_controles_ok(sección): internas.
--  · Copias LITERALES de su versión vigente con los controles añadidos:
--      official_scores, class_activity_links y my_grade_breakdown (de 20261106000090_registro_laboratorio.sql);
--      lab_control_json y lab_controles_seccion (de 20261105000084_laboratorio_controles.sql), con el campo «cuenta».
-- Ninguna nota escrita se modifica. Reversión: supabase/reversion/20261110000091_practica_por_controles_revertir.sql
-- =============================================================================

set local lock_timeout = '5s';

alter table public.upload_boxes add column if not exists cuenta_en_practica boolean not null default true;
comment on column public.upload_boxes.cuenta_en_practica is
  'Control de laboratorio: si su entrega suma en la Práctica del Registro de Calificaciones (migración 91).';

-- el control 6 no cuenta en las secciones de laboratorio que ya existen
update public.upload_boxes b set cuenta_en_practica = false, updated_at = now()
  from public.classes c join public.courses k on k.id = c.course_id
  where b.class_id = c.id and k.laboratorio_controles is not null and b.control_number = 6;

-- controles que cuentan en una sección (0 si no es de laboratorio) — interna
create or replace function public.lab_controles_cuentan(p_class uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.upload_boxes b
  join public.classes c on c.id = b.class_id join public.courses k on k.id = c.course_id
  where b.class_id = p_class and k.laboratorio_controles is not null
    and b.control_number between 1 and k.laboratorio_controles and b.cuenta_en_practica
$$;

-- por estudiante, cuántos de esos controles tienen la entrega vigente entregada o aprobada — interna
create or replace function public.lab_controles_ok(p_class uuid)
returns table (user_id uuid, ok integer) language sql stable security definer set search_path = ''
as $$
  select u.user_id, count(*)::integer from public.upload_boxes b
  join public.classes c on c.id = b.class_id join public.courses k on k.id = c.course_id
  cross join lateral (select distinct on (f.user_id) f.user_id, f.status from public.upload_files f where f.box_id = b.id
                      order by f.user_id, f.uploaded_at desc, f.id desc) u
  where b.class_id = p_class and k.laboratorio_controles is not null
    and b.control_number between 1 and k.laboratorio_controles and b.cuenta_en_practica
    and u.status in ('recibido', 'aceptado')
  group by u.user_id
$$;

-- profesorado: un control cuenta o no para la Práctica
create or replace function public.lab_control_cuenta(p_class uuid, p_numero integer, p_cuenta boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer; v integer;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select co.laboratorio_controles into n from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  if p_numero is null or p_numero < 1 or p_numero > n then raise exception 'Control inexistente' using errcode = '22023'; end if;
  if p_cuenta is null then raise exception 'Indique si el control cuenta' using errcode = '22023'; end if;
  perform public.lab_asegurar_controles(p_class);
  update public.upload_boxes set cuenta_en_practica = p_cuenta, updated_at = now()
    where class_id = p_class and control_number = p_numero;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- class_activity_links (copia de 20261106000090_registro_laboratorio.sql; los controles cuentan como una actividad
-- más sin valor fijo en la Práctica)
create or replace function public.class_activity_links(p_class uuid)
returns table (activity_id uuid, title text, mode text, closes_at timestamptz, category text, points numeric, peso_efectivo numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  with l as (select * from public.activity_grade_links where class_id = p_class),
  f as (select l.category, coalesce(sum(l.points), 0) fijos,
          count(*) filter (where l.points is null)
            + case when l.category = 'practica' and public.lab_controles_cuentan(p_class) > 0 then 1 else 0 end n
        from l group by l.category)
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

-- official_scores (copia de 20261106000090_registro_laboratorio.sql; + los controles en la Práctica)
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
  ctl as (select public.lab_controles_cuentan(p_class) n),   -- laboratorio: controles que cuentan en la Práctica
  f as (select l.category, coalesce(sum(l.points), 0) fijos,
          count(*) filter (where l.points is null) + case when l.category = 'practica' and (select ctl.n from ctl) > 0 then 1 else 0 end n
        from l group by l.category),
  w as (select l.activity_id, l.category, l.closes_at,
          coalesce(l.points, greatest(0, public.grade_category_max(p_class, l.category) - coalesce(pt.max, 0) - f.fijos) / nullif(f.n, 0)) peso
        from l join f on f.category = l.category left join partes pt on pt.category = l.category),
  pc as (   -- los controles: una actividad más sin valor fijo de la Práctica; cada control que cuenta, la misma fracción
    select ctl.n, greatest(0, public.grade_category_max(p_class, 'practica')
                              - coalesce((select pt.max from partes pt where pt.category = 'practica'), 0)
                              - coalesce((select f.fijos from f where f.category = 'practica'), 0))
                  / (coalesce((select f.n from f where f.category = 'practica'), 1)) peso
    from ctl where ctl.n > 0 and public.grade_category_max(p_class, 'practica') is not null
  ),
  mejor as (select t.user_id, t.activity_id, max(t.score / nullif(t.max_score, 0)) * public.control_factor(t.activity_id, t.user_id) pct
            from public.attempts t join w on w.activity_id = t.activity_id
            where t.status = 'submitted' group by t.user_id, t.activity_id),
  aporte as (
    select a.user_id, w.category,
      coalesce(m.pct, case when w.closes_at is not null and w.closes_at < now() then 0 end) pct, w.peso
    from alumnos a cross join w left join mejor m on m.user_id = a.user_id and m.activity_id = w.activity_id
    union all
    select a.user_id, 'practica', coalesce(ok.ok, 0)::numeric / pc.n, pc.peso
    from alumnos a cross join pc left join public.lab_controles_ok(p_class) ok on ok.user_id = a.user_id
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

-- my_grade_breakdown (copia de 20261106000090_registro_laboratorio.sql; + los controles en la Práctica)
create or replace function public.my_grade_breakdown()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  r record;
  v_pub boolean;
  v_cats jsonb;
  v_ctl integer;
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
    v_ctl := public.lab_controles_cuentan(r.class_id);
    with cats(category, orden) as (select v.category, v.orden from (values ('parcial1', 1), ('parcial2', 2), ('parcial3', 3), ('practica', 4), ('final', 5)) v(category, orden)
                                 where public.grade_category_max(r.class_id, v.category) is not null),   -- laboratorio: sin examen final
    l as (select k.*, a.title, a.closes_at, a.mode from public.activity_grade_links k join public.activities a on a.id = k.activity_id
          where k.class_id = r.class_id),
    f as (select l.category, coalesce(sum(l.points), 0) fijos,
            count(*) filter (where l.points is null) + case when l.category = 'practica' and v_ctl > 0 then 1 else 0 end n
          from l group by l.category),
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
                  from public.grade_parts gp where gp.class_id = r.class_id and gp.category = cats.category),
        -- laboratorio: los controles que cuentan, cuántos tiene entregados o aprobados y cuánto valen en conjunto
        'controles', case when cats.category = 'practica' and v_ctl > 0 then jsonb_build_object(
                    'cuentan', v_ctl,
                    'entregados', coalesce((select ok.ok from public.lab_controles_ok(r.class_id) ok where ok.user_id = v_uid), 0),
                    'peso', round(greatest(0, public.grade_category_max(r.class_id, 'practica') - public.grade_part_max(r.class_id, 'practica')
                                              - coalesce((select f.fijos from f where f.category = 'practica'), 0))
                                  / coalesce((select f.n from f where f.category = 'practica'), 1), 2)) end
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

-- lab_control_json (copia de 20261105000084_laboratorio_controles.sql; + «cuenta»)
create or replace function public.lab_control_json(p_box uuid, p_user uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'box_id', b.id, 'numero', b.control_number, 'titulo', b.title, 'instrucciones', b.instructions,
    'abre', coalesce(x.opens_at, b.opens_at), 'cierra', coalesce(x.closes_at, b.closes_at), 'fecha_individual', x.box_id is not null,
    'cuenta', b.cuenta_en_practica,
    'estado', case when u.id is null then 'pendiente' when u.status = 'recibido' then 'entregado'
                   when u.status = 'aceptado' then 'aprobado' else 'requiere_correccion' end,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'subido', f.uploaded_at, 'estado', f.status, 'nota', f.review_note,
                    'revisado', f.reviewed_at, 'bytes', f.size_bytes, 'mime', f.mime, 'ancho', f.ancho, 'alto', f.alto,
                    'revisiones', (select coalesce(jsonb_agg(jsonb_build_object('de', r.estado_anterior, 'a', r.estado_nuevo, 'nota', r.nota, 'en', r.revisado_at)
                                     order by r.revisado_at), '[]') from public.upload_file_revisiones r where r.file_id = f.id))
                    order by f.uploaded_at desc, f.id desc), '[]')
                  from public.upload_files f where f.box_id = b.id and f.user_id = p_user),
    'puede_subir', public.upload_block_reason(p_user, b.id) is null,
    'motivo', public.upload_block_reason(p_user, b.id))
  from public.upload_boxes b
  left join public.upload_box_extensions x on x.box_id = b.id and x.user_id = p_user
  left join lateral (select f.id, f.status from public.upload_files f where f.box_id = b.id and f.user_id = p_user
                     order by f.uploaded_at desc, f.id desc limit 1) u on true
  where b.id = p_box
$$;

-- lab_controles_seccion (copia de 20261105000084_laboratorio_controles.sql; + «cuenta» de cada control y, por
-- estudiante, cuántos de los que cuentan tiene entregados o aprobados)
create or replace function public.lab_controles_seccion(p_class uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n integer; v_curso text; v_sec text;
begin
  if not public.grades_teacher(p_class) then raise exception 'No tiene acceso a esta sección' using errcode = '42501'; end if;
  select co.laboratorio_controles, co.title, c.name into n, v_curso, v_sec
    from public.classes c join public.courses co on co.id = c.course_id where c.id = p_class;
  if n is null then raise exception 'Esta sección no es de una asignatura de laboratorio' using errcode = 'P0001'; end if;
  perform public.lab_asegurar_controles(p_class);
  return jsonb_build_object('controles', n, 'curso', v_curso, 'seccion', v_sec,
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object('box_id', b.id, 'numero', b.control_number, 'abre', b.opens_at, 'cierra', b.closes_at,
                'archivado', b.archived, 'cuenta', b.cuenta_en_practica) order by b.control_number), '[]')
              from public.upload_boxes b where b.class_id = p_class and b.control_number between 1 and n),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', p.student_code, 'login', p.login_id,
        'estados', z.estados, 'entregados', z.entregados, 'aprobados', z.aprobados, 'por_corregir', z.por_corregir, 'sin_revisar', z.sin_revisar,
        'en_practica', z.en_practica)
        order by p.full_name), '[]')
      from public.enrollments e
      join public.profiles p on p.id = e.user_id and p.role = 'student'
      cross join lateral (
        select jsonb_agg(s.estado order by s.numero) estados,
          count(*) filter (where s.estado in ('entregado', 'aprobado')) entregados,
          count(*) filter (where s.estado = 'aprobado') aprobados,
          count(*) filter (where s.estado = 'requiere_correccion') por_corregir,
          count(*) filter (where s.estado = 'entregado') sin_revisar,
          count(*) filter (where s.estado in ('entregado', 'aprobado') and s.cuenta) en_practica
        from (select b.control_number numero, b.cuenta_en_practica cuenta,
                case when u.id is null then 'pendiente' when u.status = 'recibido' then 'entregado'
                     when u.status = 'aceptado' then 'aprobado' else 'requiere_correccion' end estado
              from public.upload_boxes b
              left join lateral (select f.id, f.status from public.upload_files f where f.box_id = b.id and f.user_id = p.id
                                 order by f.uploaded_at desc, f.id desc limit 1) u on true
              where b.class_id = p_class and b.control_number between 1 and n) s) z
      where e.class_id = p_class));
end;
$$;

revoke all on function public.lab_controles_cuentan(uuid) from public, anon, authenticated;
revoke all on function public.lab_controles_ok(uuid) from public, anon, authenticated;
revoke all on function public.lab_control_cuenta(uuid, integer, boolean) from public, anon;
grant execute on function public.lab_control_cuenta(uuid, integer, boolean) to authenticated;
