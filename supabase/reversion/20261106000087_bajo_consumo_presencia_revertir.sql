-- =============================================================================
-- REVERSIÓN de la migración 87 (bajo consumo: presencia)
-- =============================================================================
-- Restaura literalmente presence_ping (migración 33), inactividad_registrar_uso (migración 79) y control_online /
-- live_presence (migración 18): vuelve la caducidad de 75 s y la escritura en cada latido. Si el aula publicada late
-- cada 50 s, restaurar 75 s puede mostrar desconexiones intermitentes en Orbe Control: revertir también el frontend
-- (o volver a MODO_BAJO_CONSUMO = false en src/lib/consumo.ts) ANTES de aplicar esta reversión.
-- No borra ni modifica datos. Se aplica como una migración nueva (copiándola a supabase/migrations con una marca de
-- tiempo mayor) por el flujo normal: respaldo → probar → plan → autorización → aplicar.
-- Generado con privado/tmp/rend2/generar-reversion-87.py.

-- copia literal de 20261029000033_orbe_control_ia.sql
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
  if not coalesce(p_visible, true) then perform public.poll_lock_if_left(v_uid, null); end if;
  return jsonb_build_object('tracked', true, 'server_now', now());
end;
$$;

-- copia literal de 20261104000079_suspension_inactividad.sql
create or replace function public.inactividad_registrar_uso(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.cuenta_actividad (user_id, ultimo_uso) values (p_user, now())
  on conflict (user_id) do update set ultimo_uso = now() where public.cuenta_actividad.ultimo_uso < now() - interval '5 minutes'
$$;

-- copia literal de 20261027000018_presencia_orbe_control.sql
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

-- copia literal de 20261027000018_presencia_orbe_control.sql
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
grant execute on function public.presence_ping(uuid, boolean) to authenticated;
revoke all on function public.inactividad_registrar_uso(uuid) from public, anon, authenticated, service_role;
revoke all on function public.control_online() from public, anon;
grant execute on function public.control_online() to authenticated;
revoke all on function public.live_presence() from public, anon;
grant execute on function public.live_presence() to authenticated;
