-- =============================================================================
-- Migración 72 · Programa académico: consulta del estudiante más ligera (para asignaturas grandes como Física
-- General I, con 134 capítulos) y consulta de UN capítulo para la página de la lección. Solo funciones.
--
--  · programa_json: arma el programa con consultas agregadas (una pasada por tabla) en lugar de subconsultas por
--    capítulo. Mismo contenido que la migración 71, sin los objetivos (la lección ya los muestra).
--  · programa_mio (misma firma) usa programa_json para toda la asignatura.
--  · programa_mio_capitulo(p_lesson): solo el capítulo pedido (lo usa la página de la lección).
-- =============================================================================

create or replace function public.programa_json(p_course uuid, p_lesson uuid, p_uid uuid, p_clases uuid[], p_doc boolean)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with u as (
    select un.id, un.title, un.summary, un.position, un.status from public.units un
    where un.course_id = p_course and not un.hidden
      and (un.status in ('preparado', 'publicado') or (p_doc and un.status <> 'archivado'))
      and (p_lesson is null or un.id = (select l0.unit_id from public.lessons l0 where l0.id = p_lesson))
  ),
  l as (
    select le.id, le.unit_id, le.title, le.summary, le.position, public.lesson_visible_to_me(le.id) disp
    from public.lessons le join u on u.id = le.unit_id
    where not le.hidden and (p_lesson is null or le.id = p_lesson)
  ),
  c as (select co.id, co.lesson_id, co.slug, co.name, co.nivel, co.descripcion, co.position from public.concepts co join l on l.id = co.lesson_id where not co.hidden),
  cov as (
    select pc.concept_id, jsonb_agg(distinct pc.fecha) fechas from public.program_coverage pc join c on c.id = pc.concept_id
    where pc.class_id = any (p_clases) and pc.anulado_at is null group by pc.concept_id
  ),
  ses as (
    select s.id, s.fecha, s.title from public.class_sessions s
    where s.class_id = any (p_clases) and (s.fotos_estado = 'aprobada' or s.version_publicada is not null)
  ),
  ses_l as (
    select c.lesson_id, ses.id, ses.fecha, ses.title from public.program_coverage pc join c on c.id = pc.concept_id join ses on ses.id = pc.session_id
    where pc.anulado_at is null
    union
    select k.lesson_id, ses.id, ses.fecha, ses.title from public.program_links k join l on l.id = k.lesson_id join ses on ses.id = k.session_id
    where k.publicado and k.retirado_at is null
  ),
  enl as (
    select k.* from public.program_links k join l on l.id = k.lesson_id and l.disp
    where k.publicado and k.retirado_at is null and (k.class_id is null or k.class_id = any (p_clases))
      and (k.activity_id is null or public.activity_visible_to_me(k.activity_id))
  ),
  acts as (select a.id, a.title, a.mode from public.activities a where a.class_id = any (p_clases) and public.activity_visible_to_me(a.id)),
  pr as (
    select distinct c.lesson_id, acts.id, acts.title, acts.mode
    from acts join public.activity_items i on i.activity_id = acts.id join public.exercises e on e.id = i.exercise_id
    join c on c.slug = any (e.concepts)
  ),
  mins as (
    select v.lesson_id, round(sum(v.effective_seconds) / 60.0) m from public.study_visits v join l on l.id = v.lesson_id
    where v.user_id = p_uid group by v.lesson_id
  )
  select jsonb_build_object('unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'titulo', u.title, 'resumen', u.summary, 'position', u.position, 'estado', u.status,
      'capitulos', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'resumen', l.summary, 'position', l.position, 'disponible', l.disp,
          'subtemas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.name, 'nivel', c.nivel, 'descripcion', c.descripcion,
              'impartido', coalesce(cov.fechas, '[]'::jsonb)) order by c.position, c.name), '[]'::jsonb)
            from c left join cov on cov.concept_id = c.id where c.lesson_id = l.id),
          'clases', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'fecha', s.fecha, 'titulo', s.title) order by s.fecha), '[]'::jsonb) from ses_l s where s.lesson_id = l.id),
          'enlaces', (select coalesce(jsonb_agg(jsonb_build_object('tipo', k.tipo, 'titulo', k.titulo, 'descripcion', k.descripcion, 'url', k.url, 'sim_key', k.sim_key,
              'activity_id', k.activity_id, 'exercise_id', k.exercise_id, 'session_id', k.session_id, 'concept_id', k.concept_id) order by k.position, k.created_at), '[]'::jsonb)
            from enl k where k.lesson_id = l.id),
          'practicas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.title, 'modo', p.mode) order by p.title), '[]'::jsonb) from pr p where p.lesson_id = l.id),
          'minutos', coalesce((select m.m from mins m where m.lesson_id = l.id), 0))
        order by l.position, l.title), '[]'::jsonb) from l where l.unit_id = u.id))
    order by u.position, u.title) from u), '[]'::jsonb))
$$;

create or replace function public.programa_contexto(p_course uuid, out v_clases uuid[], out v_doc boolean, out v_ok boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  v_ok := auth.uid() is not null and public.my_account_ok() and exists (select 1 from public.courses where id = p_course and programa);
  if not v_ok then return; end if;
  select coalesce(array_agg(e.class_id), '{}') into v_clases from public.enrollments e join public.classes c on c.id = e.class_id
    where e.user_id = auth.uid() and c.course_id = p_course;
  v_doc := public.programa_docente_curso(p_course);
  v_ok := cardinality(v_clases) > 0 or v_doc;
end;
$$;

-- programa_mio (migración 71, misma firma): ahora con programa_json
create or replace function public.programa_mio(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare x record;
begin
  select * into x from public.programa_contexto(p_course);
  if not coalesce(x.v_ok, false) then return null; end if;
  return public.programa_json(p_course, null, auth.uid(), x.v_clases, x.v_doc);
end;
$$;

-- Un solo capítulo (página de la lección); null si la asignatura no usa programa o el capítulo no es visible
create or replace function public.programa_mio_capitulo(p_lesson uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_course uuid; x record;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null then return null; end if;
  select * into x from public.programa_contexto(v_course);
  if not coalesce(x.v_ok, false) then return null; end if;
  return (select cap from jsonb_array_elements(public.programa_json(v_course, p_lesson, auth.uid(), x.v_clases, x.v_doc) -> 'unidades') un,
                         jsonb_array_elements(un -> 'capitulos') cap limit 1);
end;
$$;

revoke all on function public.programa_json(uuid, uuid, uuid, uuid[], boolean) from public, anon, authenticated;
revoke all on function public.programa_contexto(uuid) from public, anon, authenticated;
revoke all on function public.programa_mio(uuid) from public, anon;
grant execute on function public.programa_mio(uuid) to authenticated;
revoke all on function public.programa_mio_capitulo(uuid) from public, anon;
grant execute on function public.programa_mio_capitulo(uuid) to authenticated;
