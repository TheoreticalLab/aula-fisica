-- =============================================================================
-- Desglose del Registro de Calificaciones para el estudiante (solo lo propio).
-- Para cada sección y apartado: lo que vale, su nota (solo si el profesor publicó las notas), de dónde sale
-- (manual / actividades) y las actividades vinculadas que el estudiante puede ver, con su valor y su resultado,
-- para que pueda «revisar» la actividad. La distribución y las actividades se ven aunque no haya notas publicadas.
-- =============================================================================

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
          'peso', round(coalesce(l.points, greatest(0, public.grade_category_max(l.category) - f.fijos) / nullif(f.n, 0)), 2),
          'por_definir', l.points is null,
          'visible', public.activity_visible_to_me(l.activity_id),
          'mejor', case when v_pub then (select round(100 * max(t.score / nullif(t.max_score, 0)), 1) from public.attempts t
                    where t.activity_id = l.activity_id and t.user_id = v_uid and t.status = 'submitted') end
        ) order by l.title) lista
      from l join f on f.category = l.category group by l.category
    ),
    sc as (select * from public.official_scores(r.class_id) where user_id = v_uid)
    select jsonb_agg(jsonb_build_object(
        'category', cats.category, 'max', public.grade_category_max(cats.category),
        'score', case when v_pub then sc.score end,
        'source', case when v_pub then sc.source end,
        'pendientes', case when v_pub then sc.pendientes end,
        'actividades', coalesce(acts.lista, '[]'::jsonb)
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

revoke all on function public.my_grade_breakdown() from public, anon;
grant execute on function public.my_grade_breakdown() to authenticated;
