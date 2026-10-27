-- =============================================================================
-- Presencia en tiempo real (para Orbe Control y el Centro de Comunicación).
--
-- Conexión ≠ actividad: cada pestaña abierta del aula (de un estudiante) envía cada ~25 s un latido de CONEXIÓN,
-- esté o no interactuando. El servidor toma el usuario de la sesión (auth.uid()): nadie puede registrar la
-- presencia de otro. Una fila por conexión (pestaña o dispositivo); el estudiante está «en línea» si alguna de
-- sus conexiones dio señal en los últimos 75 s. Al cerrar la pestaña se intenta borrar la conexión
-- (presence_leave); si el navegador se cierra de golpe, expira sola.
-- Los profesores reciben los cambios por Realtime (RLS: solo de sus estudiantes) y consultan con control_online().
-- =============================================================================

create table if not exists public.presence_connections (
  conn_id uuid primary key,                                 -- generado por la pestaña
  user_id uuid not null references public.profiles (id) on delete cascade,
  visible boolean not null default true,                    -- pestaña delante o en segundo plano
  connected_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists presence_connections_user_idx on public.presence_connections (user_id, last_seen desc);
alter table public.presence_connections enable row level security;
drop policy if exists presence_select on public.presence_connections;
create policy presence_select on public.presence_connections for select to authenticated
  using (public.is_teacher() and public.teaches_student(user_id));
revoke all on public.presence_connections from anon, authenticated;
grant select on public.presence_connections to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'presence_connections') then
    alter publication supabase_realtime add table public.presence_connections;
  end if;
end $$;

-- Latido de conexión (solo estudiantes con cuenta habilitada). Limpia de paso las conexiones caducadas propias.
create or replace function public.presence_ping(p_conn uuid, p_visible boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_dueno uuid;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.my_account_ok() or coalesce((select role from public.profiles where id = v_uid), 'student') <> 'student' then
    return jsonb_build_object('tracked', false, 'server_now', now());
  end if;
  if p_conn is null then raise exception 'Falta la conexión' using errcode = '22023'; end if;
  select user_id into v_dueno from public.presence_connections where conn_id = p_conn;
  if v_dueno is not null and v_dueno <> v_uid then raise exception 'Conexión ajena' using errcode = '42501'; end if;
  insert into public.presence_connections (conn_id, user_id, visible) values (p_conn, v_uid, coalesce(p_visible, true))
    on conflict (conn_id) do update set last_seen = now(), visible = excluded.visible;
  delete from public.presence_connections where user_id = v_uid and last_seen < now() - interval '10 minutes';
  return jsonb_build_object('tracked', true, 'server_now', now());
end;
$$;

create or replace function public.presence_leave(p_conn uuid)
returns void language sql security definer set search_path = ''
as $$ delete from public.presence_connections where conn_id = p_conn and user_id = auth.uid() $$;

-- Estudiantes EN LÍNEA (únicos, aunque tengan varias pestañas o dispositivos) de las secciones del profesor,
-- con la hora del servidor para calcular «hace X segundos» sin depender del reloj del teléfono.
create or replace function public.control_online()
returns table (user_id uuid, full_name text, student_code text, class_id uuid, class_name text, course_title text,
  last_seen timestamptz, conexiones integer, visible boolean, section text, lesson_title text, activity_title text,
  server_now timestamptz)
language sql stable security definer set search_path = ''
as $$
  with mis as (select * from public.my_messageable_students()),
  con as (
    select c.user_id, max(c.last_seen) ult, count(*)::integer n, bool_or(c.visible) vis
    from public.presence_connections c
    where c.last_seen > now() - interval '75 seconds' and c.user_id in (select m.user_id from mis m)
    group by c.user_id
  ),
  act as (
    select distinct on (v.user_id) v.user_id, v.section, v.lesson_id, v.activity_id
    from public.study_visits v join con on con.user_id = v.user_id
    where v.last_beat_at > now() - interval '10 minutes'
    order by v.user_id, v.last_beat_at desc
  )
  select m.user_id, m.full_name, m.student_code, m.class_id, m.class_name, m.course_title,
    con.ult, con.n, con.vis, a.section, l.title, ac.title, now()
  from mis m join con on con.user_id = m.user_id
  left join act a on a.user_id = m.user_id
  left join public.lessons l on l.id = a.lesson_id
  left join public.activities ac on ac.id = a.activity_id
  where public.is_teacher()
  order by m.course_title, m.class_name, m.full_name
$$;

-- Acceso a Orbe Control: comprobado en el servidor
create or replace function public.control_access()
returns jsonb language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('ok', public.is_teacher(), 'nombre', (select full_name from public.profiles where id = auth.uid())) $$;

-- Mensaje a los CONECTADOS (de una sección o de todas las mías), con los destinatarios decididos en el servidor.
-- Un estudiante con varias pestañas recibe una sola copia (clave del destinatario).
create or replace function public.send_live_message_online(p_kind text, p_body text, p_class uuid, p_expires_minutes integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ids uuid[];
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado puede enviar mensajes' using errcode = '42501'; end if;
  select array_agg(distinct o.user_id) into v_ids from public.control_online() o where p_class is null or o.class_id = p_class;
  if v_ids is null then raise exception 'No hay estudiantes conectados' using errcode = 'P0001'; end if;
  return public.send_live_message(p_kind, p_body, 'conectados', v_ids, null, p_expires_minutes);
end;
$$;

-- live_presence (migración 14) pasa a usar la conexión real; misma firma y mismos estados
create or replace function public.live_presence()
returns table (user_id uuid, estado text, last_seen timestamptz, section text, lesson_title text, unit_title text,
  activity_title text, course_title text)
language sql stable security definer set search_path = ''
as $$
  with mis as (select distinct s.user_id from public.my_messageable_students() s),
  con as (select c.user_id, max(c.last_seen) ult, bool_or(c.visible and c.last_seen > now() - interval '75 seconds') vis
          from public.presence_connections c join mis on mis.user_id = c.user_id group by c.user_id),
  ult as (
    select distinct on (v.user_id) v.user_id, v.last_beat_at, v.section, v.lesson_id, v.unit_id, v.activity_id, v.course_id
    from public.study_visits v join mis on mis.user_id = v.user_id
    where v.last_beat_at > now() - interval '1 day'
    order by v.user_id, v.last_beat_at desc
  )
  select mis.user_id,
    case when con.ult > now() - interval '75 seconds' and con.vis then 'conectado'
         when con.ult > now() - interval '75 seconds' then 'no_confirmado'
         else 'desconectado' end,
    greatest(con.ult, u.last_beat_at), u.section, l.title, un.title, a.title, k.title
  from mis left join con on con.user_id = mis.user_id left join ult u on u.user_id = mis.user_id
  left join public.lessons l on l.id = u.lesson_id
  left join public.units un on un.id = u.unit_id
  left join public.activities a on a.id = u.activity_id
  left join public.courses k on k.id = u.course_id
  where public.is_teacher()
$$;

revoke all on function public.presence_ping(uuid, boolean) from public, anon;
revoke all on function public.presence_leave(uuid) from public, anon;
revoke all on function public.control_online() from public, anon;
revoke all on function public.control_access() from public, anon;
revoke all on function public.send_live_message_online(text, text, uuid, integer) from public, anon;
grant execute on function public.presence_ping(uuid, boolean) to authenticated;
grant execute on function public.presence_leave(uuid) to authenticated;
grant execute on function public.control_online() to authenticated;
grant execute on function public.control_access() to authenticated;
grant execute on function public.send_live_message_online(text, text, uuid, integer) to authenticated;
