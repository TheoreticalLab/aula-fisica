-- =============================================================================
-- Regularización obligatoria: bloqueo TOTAL del aula hasta «Terminar la regularización» (migración 64).
-- Decisión del profesor (2 de noviembre de 2026): quien no haya terminado la regularización de prácticas anteriores
-- en una sección donde está abierta y con el bloqueo activado no puede hacer NADA en la plataforma (ni asistencia ni
-- evaluaciones) salvo la propia regularización; al terminarla vuelve a la normalidad.
--  · hist_settings.bloquear (por sección; el profesor lo activa o desactiva). Se activa ya en las secciones con la
--    regularización abierta, que es lo pedido.
--  · Mecanismo: my_account_ok() — la comprobación común de casi todas las funciones y políticas del estudiante — pasa
--    a ser falsa para un estudiante bloqueado. Las funciones de la regularización (hist_*, svc_hist_*) quedan exentas
--    con el parámetro aula.regularizacion = 'on' fijado EN ellas (alter function … set), sin reescribirlas.
--    Ese parámetro no lo puede fijar el estudiante: PostgREST solo expone funciones de «public».
--    IMPORTANTE: si una migración futura redefine una función hist_* con «create or replace», debe volver a fijarlo
--    (este archivo tiene el bloque que lo hace para todas).
--  · Sin bloqueo posible sin salida: si la regularización se cierra en la sección, el bloqueo desaparece.
--  · Terminar no es una calificación (migración 46): el bloqueo tampoco cambia ninguna nota.
-- my_account_ok se copia de la migración 4 con el añadido. Aditiva.
-- =============================================================================

alter table public.hist_settings add column if not exists bloquear boolean not null default false;
update public.hist_settings set bloquear = true where (abierto or libre_habilitado) and not bloquear;

-- Secciones en las que el estudiante tiene la regularización obligatoria pendiente
create or replace function public.hist_bloqueos(p_user uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'class_name', c.name, 'course_title', co.title, 'mensaje', s.mensaje)
           order by co.title, c.name), '[]'::jsonb)
  from public.hist_settings s
  join public.enrollments e on e.class_id = s.class_id and e.user_id = p_user
  join public.classes c on c.id = s.class_id and not c.archived
  join public.courses co on co.id = c.course_id
  join public.profiles pr on pr.id = p_user and pr.role = 'student'
  where s.bloquear and (s.abierto or s.libre_habilitado) and not public.hist_terminado(s.class_id, p_user)
$$;

create or replace function public.hist_bloqueado(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- hist_settings es pequeña (una fila por sección): se filtra primero y luego se busca la matrícula por su clave
  select exists (
    select 1 from public.hist_settings s
    join public.enrollments e on e.class_id = s.class_id and e.user_id = p_user
    join public.classes c on c.id = s.class_id and not c.archived
    join public.profiles pr on pr.id = p_user and pr.role = 'student'
    where s.bloquear and (s.abierto or s.libre_habilitado) and not public.hist_terminado(s.class_id, p_user))
$$;

-- my_account_ok (migración 4) + bloqueo por regularización obligatoria pendiente
create or replace function public.my_account_ok()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.account_ok(auth.uid())
    and (coalesce(current_setting('aula.regularizacion', true), '') = 'on' or not public.hist_bloqueado(auth.uid()))
$$;

-- Para la interfaz del estudiante: ¿estoy bloqueado y por qué secciones?
create or replace function public.hist_mi_bloqueo()
returns jsonb
language sql stable security definer set search_path = ''
as $$ select case when public.account_ok(auth.uid()) then public.hist_bloqueos(auth.uid()) else '[]'::jsonb end $$;

-- Profesor: activar o desactivar el bloqueo en su sección y ver a cuántos afecta
create or replace function public.hist_bloqueo_configurar(p_class uuid, p_bloquear boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_class is null or not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into public.hist_settings (class_id, bloquear, updated_by) values (p_class, coalesce(p_bloquear, false), auth.uid())
    on conflict (class_id) do update set bloquear = coalesce(p_bloquear, false), updated_by = auth.uid(), updated_at = now();
  perform public.hist_log(p_class, null, null, null, 'docente', case when p_bloquear then 'bloqueo_activado' else 'bloqueo_desactivado' end, null, null, null, '{}'::jsonb);
  return public.hist_bloqueo_estado(p_class);
end;
$$;

create or replace function public.hist_bloqueo_estado(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.hist_settings;
begin
  if p_class is null or not public.is_class_teacher(p_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.hist_settings where class_id = p_class;
  return jsonb_build_object('bloquear', coalesce(s.bloquear, false), 'abierta', coalesce(s.abierto or s.libre_habilitado, false),
    'bloqueados', (select count(*) from public.enrollments e join public.profiles pr on pr.id = e.user_id and pr.role = 'student' and pr.active
                   where e.class_id = p_class and coalesce(s.bloquear, false) and coalesce(s.abierto or s.libre_habilitado, false)
                     and not public.hist_terminado(p_class, e.user_id)));
end;
$$;

-- Exención: las funciones de la regularización siguen funcionando para el estudiante bloqueado
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'hist\_%' or p.proname like 'svc\_hist\_%') and p.prokind = 'f'
             -- las que evalúa my_account_ok en cada comprobación no lo necesitan (y así no pagan el cambio de parámetro)
             and p.proname not in ('hist_bloqueado', 'hist_bloqueos', 'hist_terminado') loop
    execute format('alter function %s set aula.regularizacion = %L', f, 'on');
  end loop;
end $$;

revoke all on function public.hist_bloqueos(uuid) from public, anon, authenticated;
revoke all on function public.hist_bloqueado(uuid) from public, anon, authenticated;
revoke all on function public.hist_mi_bloqueo() from public, anon;
grant execute on function public.hist_mi_bloqueo() to authenticated;
revoke all on function public.hist_bloqueo_configurar(uuid, boolean) from public, anon;
grant execute on function public.hist_bloqueo_configurar(uuid, boolean) to authenticated;
revoke all on function public.hist_bloqueo_estado(uuid) from public, anon;
grant execute on function public.hist_bloqueo_estado(uuid) to authenticated;
