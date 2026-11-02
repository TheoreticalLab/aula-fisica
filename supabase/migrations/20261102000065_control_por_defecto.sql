-- =============================================================================
-- Práctica de Control ACTIVADA POR DEFECTO en todas las prácticas (migración 65). Decisión del profesor: «cualquier
-- práctica que yo haga, por defecto, tiene que tener control; si no lo quiero, lo desactivo».
--  · Prácticas NUEVAS (y las que pasan a ser práctica): nacen con la política v1 (w = 20 %, 7 min, alcance «nuevas»),
--    anunciada al crearse, antes de cualquier entrega.
--  · Prácticas EXISTENTES sin política: v1 con alcance «todas» y 24 h de antelación desde ahora (cuenta en controles
--    hechos a partir de mañana a esta hora), y UN aviso fijado por sección que lo explica. Así nadie es sorprendido.
--  · Desactivar = versión vigente con w = 0 (control_politica_retirar / la interfaz); esa práctica deja de ofrecerse en
--    Orbe Control. control_practicas se copia de la 63 con ese filtro. Aditiva.
-- =============================================================================

-- 1) Prácticas existentes: un aviso por sección y la política por defecto con aviso previo
with secciones as (
  select distinct c.id class_id, c.created_by
  from public.activities a join public.classes c on c.id = a.class_id and not c.archived
  where a.mode = 'practice'
    and not exists (select 1 from public.control_sessions s where s.control_activity_id = a.id)
    and not exists (select 1 from public.control_policies p where p.activity_id = a.id)
),
avisos as (
  insert into public.announcements (class_id, title, body, pinned, visible_until, created_by)
  select s.class_id, 'Prácticas de Control en esta sección',
    'Cualquier práctica de esta sección puede comprobarse con una Práctica de Control: una prueba breve (unos 7 minutos), individual y en el aula, '
    || 'con un problema nuevo sobre lo trabajado. Su resultado podrá ajustar hasta un 20 % de la nota de esa práctica: '
    || 'nota final = nota × [1 − 0,20 × (1 − control/100)]. Con 100/100 conservas tu nota. '
    || 'Se aplica también a las prácticas que ya entregaste, en los controles realizados a partir del '
    || to_char((now() + interval '24 hours') at time zone 'America/Santo_Domingo', 'DD/MM/YYYY HH24:MI') || '. '
    || 'No afecta a ausencias justificadas ni a incidencias técnicas, y puedes pedir revisión. En cada práctica verás el aviso y si el profesor la excluye.',
    true, now() + interval '21 days', s.created_by
  from secciones s
  returning id, class_id
)
insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, activa, created_by, alcance, anticipacion_horas, aviso_id)
select a.id, 1, 0.20, 7, 'No se aplica a ausencias justificadas, incidencias técnicas ni mientras la corrección esté pendiente. Con varios controles cuenta el mejor resultado.', 'Puedes usar libros, apuntes, simuladores e inteligencia artificial para aprender; lo que se comprueba después es que puedas resolver solo un problema nuevo.', true, a.created_by, 'todas', 24, v.id
from public.activities a join avisos v on v.class_id = a.class_id
where a.mode = 'practice'
  and not exists (select 1 from public.control_sessions s where s.control_activity_id = a.id)
  and not exists (select 1 from public.control_policies p where p.activity_id = a.id);

-- 2) Prácticas nuevas: política por defecto al crearlas (o al pasar a ser práctica)
create or replace function public.control_politica_por_defecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.mode = 'practice' and (tg_op = 'INSERT' or old.mode is distinct from new.mode)
     and not exists (select 1 from public.control_policies p where p.activity_id = new.id) then
    insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, activa, created_by, alcance, anticipacion_horas)
      values (new.id, 1, 0.20, 7, 'No se aplica a ausencias justificadas, incidencias técnicas ni mientras la corrección esté pendiente. Con varios controles cuenta el mejor resultado.', 'Puedes usar libros, apuntes, simuladores e inteligencia artificial para aprender; lo que se comprueba después es que puedas resolver solo un problema nuevo.', true, coalesce(auth.uid(), new.created_by), 'nuevas', 0);
  end if;
  return new;
end;
$$;
drop trigger if exists control_politica_por_defecto on public.activities;
create trigger control_politica_por_defecto after insert or update of mode on public.activities
  for each row execute function public.control_politica_por_defecto();
revoke all on function public.control_politica_por_defecto() from public, anon, authenticated;

-- 3) control_practicas (63) + no ofrecer las prácticas con el control desactivado
create or replace function public.control_practicas(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'opens_at', a.opens_at, 'closes_at', a.closes_at, 'created_at', a.created_at,
      'curso', k.title, 'seccion', c.name,
      'entregaron', (select count(distinct t.user_id) from public.attempts t where t.activity_id = a.id and t.status = 'submitted'),
      'politica', (select jsonb_build_object('version', p.version, 'w', p.w, 'duracion_min', p.duracion_min, 'announced_at', p.announced_at,
                     'alcance', p.alcance, 'anticipacion_horas', p.anticipacion_horas, 'efectiva_desde', p.announced_at + make_interval(hours => p.anticipacion_horas))
                   from public.control_policies p where p.activity_id = a.id and p.activa order by p.announced_at desc limit 1),
      'abierta', (select s.id from public.control_sessions s where s.practice_activity_id = a.id and s.estado in ('preparado', 'activo'))) order by a.created_at desc), '[]'::jsonb)
    from public.activities a join public.classes c on c.id = a.class_id join public.courses k on k.id = c.course_id
    where a.class_id = p_class and a.mode = 'practice' and a.published
      and not exists (select 1 from public.control_sessions s2 where s2.control_activity_id = a.id)
      -- (65) las prácticas con el control desactivado (versión vigente con w = 0) no se ofrecen
      and coalesce((select p.w from public.control_policies p where p.activity_id = a.id and p.activa order by p.announced_at desc limit 1), 1) > 0);
end;
$$;


-- 4) control_politica_retirar (62) + deja como no vigente la versión anterior (antes podían quedar dos «activas»)
create or replace function public.control_politica_retirar(p_activity uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('control_politica' || p_activity::text, 0));
  update public.control_policies set activa = false where activity_id = p_activity and activa;
  insert into public.control_policies (activity_id, version, w, duracion_min, condiciones, politica_ayudas, activa, created_by)
    select p_activity, coalesce(max(version), 0) + 1, 0, 7, 'Política retirada: los controles posteriores no ajustan la nota de quien entregue desde ahora.', '', true, auth.uid()
    from public.control_policies where activity_id = p_activity;
end;
$$;

