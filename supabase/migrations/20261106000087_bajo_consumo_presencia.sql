-- =============================================================================
-- Migración 87 · Modo de bajo consumo: presencia sin escrituras innecesarias.
--
-- Contexto: reducir las escrituras pequeñas y repetidas, que son la mayor parte de la escritura en disco de la base.
--
--  1) presence_ping (copia de la migración 33): no escribe un latido duplicado (misma visibilidad y señal de < 5 s,
--     p. ej. varios eventos del navegador seguidos); el borrado de conexiones viejas, solo al abrir una conexión nueva.
--     El umbral es corto a propósito: con el aula anterior (latido de 25 s) cada latido sigue escribiendo, así que la
--     antigüedad de la señal es la misma que antes y el Orbe Control anterior (que caduca a los 75 s) no ve
--     desconexiones falsas mientras convivan versiones. El ahorro de latidos lo da el aula nueva (50 s).
--  2) inactividad_registrar_uso (copia de la migración 79): con un uso registrado hace < 5 min no hace NADA. Antes el
--     «insert … on conflict do update … where» bloqueaba la fila de cuenta_actividad en cada latido (un bloqueo de fila
--     escribe la página y genera WAL aunque el WHERE sea falso).
--  3) control_online y live_presence (copias de la migración 18): una conexión caduca a los 150 s sin latido
--     (antes 75 s), porque el aula late cada 50 s (antes 25 s). Misma firma, mismas columnas, mismos permisos.
--     (ficha_estudiante sigue con 75 s: con latidos de 50 s sigue siendo correcta y no hace falta copiarla.)
--
-- Aditiva: solo «create or replace function» con las mismas firmas y permisos. Compatible en cualquier orden con el
-- frontend antiguo (latido de 25 s) y el nuevo (50 s). Reversión: supabase/reversion/20261106000087_bajo_consumo_presencia_revertir.sql
-- =============================================================================

-- 1) Latido de conexión: escribe solo si aporta algo
create or replace function public.presence_ping(p_conn uuid, p_visible boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_dueno uuid; v_visible boolean; v_ultimo timestamptz;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.my_account_ok() or coalesce((select role from public.profiles where id = v_uid), 'student') <> 'student' then
    return jsonb_build_object('tracked', false, 'server_now', now());
  end if;
  if p_conn is null then raise exception 'Falta la conexión' using errcode = '22023'; end if;
  select user_id, visible, last_seen into v_dueno, v_visible, v_ultimo from public.presence_connections where conn_id = p_conn;
  if v_dueno is not null and v_dueno <> v_uid then raise exception 'Conexión ajena' using errcode = '42501'; end if;
  if v_dueno is null then
    insert into public.presence_connections (conn_id, user_id, visible) values (p_conn, v_uid, coalesce(p_visible, true))
      on conflict (conn_id) do update set last_seen = now(), visible = excluded.visible;
    -- conexiones viejas de este estudiante (solo al abrir una nueva: antes, en cada latido)
    delete from public.presence_connections where user_id = v_uid and last_seen < now() - interval '10 minutes';
  elsif v_visible is distinct from coalesce(p_visible, true) or v_ultimo < now() - interval '5 seconds' then
    update public.presence_connections set last_seen = now(), visible = coalesce(p_visible, true) where conn_id = p_conn;
  end if;
  if not coalesce(p_visible, true) then perform public.poll_lock_if_left(v_uid, null); end if;
  return jsonb_build_object('tracked', true, 'server_now', now());
end;
$$;

-- 2) Registro de uso para la suspensión por inactividad: sin bloqueo de fila si no toca escribir
create or replace function public.inactividad_registrar_uso(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.cuenta_actividad (user_id, ultimo_uso)
    select p_user, now()
    where not exists (select 1 from public.cuenta_actividad a where a.user_id = p_user and a.ultimo_uso >= now() - interval '5 minutes')
  on conflict (user_id) do update set ultimo_uso = now() where public.cuenta_actividad.ultimo_uso < now() - interval '5 minutes'
$$;

-- 3) Estudiantes EN LÍNEA: caducidad de 150 s (copia de la migración 18; solo cambia el intervalo)
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
    where c.last_seen > now() - interval '150 seconds' and c.user_id in (select m.user_id from mis m)
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

create or replace function public.live_presence()
returns table (user_id uuid, estado text, last_seen timestamptz, section text, lesson_title text, unit_title text,
  activity_title text, course_title text)
language sql stable security definer set search_path = ''
as $$
  with mis as (select distinct s.user_id from public.my_messageable_students() s),
  con as (select c.user_id, max(c.last_seen) ult, bool_or(c.visible and c.last_seen > now() - interval '150 seconds') vis
          from public.presence_connections c join mis on mis.user_id = c.user_id group by c.user_id),
  ult as (
    select distinct on (v.user_id) v.user_id, v.last_beat_at, v.section, v.lesson_id, v.unit_id, v.activity_id, v.course_id
    from public.study_visits v join mis on mis.user_id = v.user_id
    where v.last_beat_at > now() - interval '1 day'
    order by v.user_id, v.last_beat_at desc
  )
  select mis.user_id,
    case when con.ult > now() - interval '150 seconds' and con.vis then 'conectado'
         when con.ult > now() - interval '150 seconds' then 'no_confirmado'
         else 'desconectado' end,
    greatest(con.ult, u.last_beat_at), u.section, l.title, un.title, a.title, k.title
  from mis left join con on con.user_id = mis.user_id left join ult u on u.user_id = mis.user_id
  left join public.lessons l on l.id = u.lesson_id
  left join public.units un on un.id = u.unit_id
  left join public.activities a on a.id = u.activity_id
  left join public.courses k on k.id = u.course_id
  where public.is_teacher()
$$;

-- Permisos (los mismos que tenían)
revoke all on function public.presence_ping(uuid, boolean) from public, anon;
grant execute on function public.presence_ping(uuid, boolean) to authenticated;
revoke all on function public.inactividad_registrar_uso(uuid) from public, anon, authenticated, service_role;
revoke all on function public.control_online() from public, anon;
grant execute on function public.control_online() to authenticated;
revoke all on function public.live_presence() from public, anon;
grant execute on function public.live_presence() to authenticated;
