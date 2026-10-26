-- =============================================================================
-- Centro de Comunicación en Vivo: mensajes emergentes del profesor a sus estudiantes.
--
-- · live_messages: el mensaje (quién lo envía, tipo, texto, a quién iba dirigido, vigencia).
-- · live_message_recipients: una fila por destinatario con su estado verificable:
--     delivered_at  = la aplicación del estudiante lo recibió (recepción técnica);
--     read_at       = el estudiante pulsó «Entendido» (lectura confirmada);
--     dismissed_at  = un aviso informativo se cerró solo o con la ✕ (no cuenta como leído).
--   La clave (message_id, user_id) impide entregas duplicadas.
-- · Envío SOLO con send_live_message(): el servidor deduce el remitente (auth.uid()) y recorta los
--   destinatarios a los estudiantes que ese profesor enseña. Nadie inserta ni modifica filas directamente.
-- · Realtime: live_message_recipients se publica; con RLS, cada estudiante solo recibe los eventos de sus
--   propias filas y cada profesor los de sus estudiantes.
-- · Presencia: se deduce de los latidos del seguimiento de tiempo (study_visits), visibles solo para el
--   profesor. No se usan canales de presencia públicos (revelarían a cada estudiante quién más está conectado).
-- =============================================================================

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('informativo', 'importante', 'urgente')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  audience jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists live_messages_sender_idx on public.live_messages (sender_id, created_at desc);

create table if not exists public.live_message_recipients (
  message_id uuid not null references public.live_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists live_message_recipients_user_idx on public.live_message_recipients (user_id, created_at desc);

alter table public.live_messages enable row level security;
alter table public.live_message_recipients enable row level security;

-- Funciones auxiliares (SECURITY DEFINER) para que las dos políticas no se consulten mutuamente (recursión).
create or replace function public.live_is_recipient(p_message uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.live_message_recipients r where r.message_id = p_message and r.user_id = auth.uid()) $$;
create or replace function public.live_is_sender(p_message uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.live_messages m where m.id = p_message and m.sender_id = auth.uid()) $$;

-- Lectura: el estudiante, solo lo suyo; el profesor, lo que envió y los mensajes de sus estudiantes.
drop policy if exists live_messages_select on public.live_messages;
create policy live_messages_select on public.live_messages for select to authenticated using (
  sender_id = auth.uid() or public.is_admin() or public.live_is_recipient(id)
);
drop policy if exists live_recipients_select on public.live_message_recipients;
create policy live_recipients_select on public.live_message_recipients for select to authenticated using (
  user_id = auth.uid() or public.teaches_student(user_id) or public.live_is_sender(message_id)
);
-- Sin políticas de escritura: todo pasa por las funciones de abajo.
revoke all on public.live_messages, public.live_message_recipients from anon, authenticated;
grant select on public.live_messages, public.live_message_recipients to authenticated;

-- Realtime (si la publicación existe: en Supabase siempre; en la base de pruebas local, no)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_message_recipients') then
    alter publication supabase_realtime add table public.live_message_recipients;
  end if;
end $$;

-- Estudiantes que el usuario actual puede ver y a los que puede escribir
create or replace function public.my_messageable_students()
returns table (user_id uuid, full_name text, student_code text, class_id uuid, class_name text, course_id uuid, course_title text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (e.user_id, e.class_id) e.user_id, p.full_name, p.student_code, c.id, c.name, k.id, k.title
  from public.enrollments e
  join public.classes c on c.id = e.class_id and not c.archived
  join public.courses k on k.id = c.course_id
  join public.profiles p on p.id = e.user_id and p.role = 'student'
  where public.is_teacher()
    and (public.is_admin() or public.is_class_teacher(c.id) or public.is_course_staff(c.course_id))
  order by e.user_id, e.class_id
$$;

-- Envío. p_mode: 'seleccion' (p_users), 'seccion' (p_class), 'todos' (todos mis estudiantes) o
-- 'conectados' (p_users = los que el panel ve conectados; se vuelven a recortar a los autorizados).
create or replace function public.send_live_message(p_kind text, p_body text, p_mode text, p_users uuid[],
  p_class uuid, p_expires_minutes integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_n integer;
begin
  if v_uid is null or not public.is_teacher() then raise exception 'Solo el profesorado puede enviar mensajes' using errcode = '42501'; end if;
  if p_kind not in ('informativo', 'importante', 'urgente') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if p_mode not in ('seleccion', 'seccion', 'todos', 'conectados') then raise exception 'Destinatario no válido' using errcode = '22023'; end if;
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 2000 then
    raise exception 'El mensaje debe tener entre 1 y 2000 caracteres' using errcode = '22023';
  end if;
  if p_mode = 'seccion' and (p_class is null or not (public.is_class_teacher(p_class)
       or public.is_course_staff((select course_id from public.classes where id = p_class)))) then
    raise exception 'No imparte esa sección' using errcode = '42501';
  end if;
  if p_expires_minutes is not null and (p_expires_minutes < 1 or p_expires_minutes > 525600) then
    raise exception 'Vigencia no válida' using errcode = '22023';
  end if;

  insert into public.live_messages (sender_id, kind, body, audience, expires_at)
    values (v_uid, p_kind, btrim(p_body),
      jsonb_build_object('modo', p_mode, 'seccion', p_class, 'seleccionados', coalesce(cardinality(p_users), 0)),
      case when p_expires_minutes is null then null else now() + make_interval(mins => p_expires_minutes) end)
    returning id into v_id;

  insert into public.live_message_recipients (message_id, user_id)
    select distinct v_id, s.user_id
    from public.my_messageable_students() s
    where case p_mode
      when 'seccion' then s.class_id = p_class
      when 'todos' then true
      else s.user_id = any (coalesce(p_users, '{}'::uuid[]))
    end
    on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Ningún destinatario autorizado' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', v_id, 'recipients', v_n);
end;
$$;

-- Mensajes pendientes del estudiante (sin confirmar, sin descartar y vigentes), con el remitente.
create or replace function public.my_pending_messages()
returns table (id uuid, kind text, body text, sender_name text, created_at timestamptz, expires_at timestamptz, delivered_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kind, m.body, coalesce(nullif(p.full_name, ''), 'Profesor'), m.created_at, m.expires_at, r.delivered_at
  from public.live_message_recipients r
  join public.live_messages m on m.id = r.message_id
  left join public.profiles p on p.id = m.sender_id
  where r.user_id = auth.uid() and r.read_at is null and r.dismissed_at is null
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at
  limit 20
$$;

-- Estados que solo el propio destinatario puede marcar, y una sola vez (no se reescriben).
create or replace function public.mark_messages_delivered(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  update public.live_message_recipients set delivered_at = now()
    where user_id = auth.uid() and message_id = any (p_ids) and delivered_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- p_action: 'leido' (pulsó «Entendido») o 'descartado' (aviso informativo cerrado sin confirmar).
create or replace function public.ack_live_message(p_id uuid, p_action text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_action not in ('leido', 'descartado') then raise exception 'Acción no válida' using errcode = '22023'; end if;
  update public.live_message_recipients set
      delivered_at = coalesce(delivered_at, now()),
      read_at = case when p_action = 'leido' then coalesce(read_at, now()) else read_at end,
      dismissed_at = case when p_action = 'descartado' then coalesce(dismissed_at, now()) else dismissed_at end
    where user_id = auth.uid() and message_id = p_id;
  if not found then raise exception 'Mensaje no encontrado' using errcode = 'P0002'; end if;
  return true;
end;
$$;

-- Historial del profesor: sus mensajes con el recuento por estado (o los de un estudiante concreto).
create or replace function public.live_message_history(p_user uuid, p_limit integer default 50)
returns table (id uuid, kind text, body text, sender_name text, audience jsonb, created_at timestamptz, expires_at timestamptz,
  total bigint, pendientes bigint, recibidos bigint, confirmados bigint, expirados bigint)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kind, m.body, coalesce(p.full_name, ''), m.audience, m.created_at, m.expires_at,
    count(r.*),
    count(*) filter (where r.delivered_at is null and r.read_at is null and (m.expires_at is null or m.expires_at > now())),
    count(*) filter (where r.delivered_at is not null and r.read_at is null and (m.expires_at is null or m.expires_at > now())),
    count(*) filter (where r.read_at is not null),
    count(*) filter (where r.read_at is null and m.expires_at is not null and m.expires_at <= now())
  from public.live_messages m
  join public.live_message_recipients r on r.message_id = m.id
  left join public.profiles p on p.id = m.sender_id
  where public.is_teacher()
    and (p_user is null or r.user_id = p_user)
    and (m.sender_id = auth.uid() or public.is_admin() or (p_user is not null and public.teaches_student(p_user)))
  group by m.id, p.full_name
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

-- Estado por destinatario de un mensaje (solo de los estudiantes que el profesor enseña).
create or replace function public.live_message_recipients_status(p_message uuid)
returns table (user_id uuid, full_name text, student_code text, estado text, delivered_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.user_id, p.full_name, p.student_code,
    case when r.read_at is not null then 'confirmado'
         when m.expires_at is not null and m.expires_at <= now() then 'expirado'
         when r.dismissed_at is not null then 'cerrado sin confirmar'
         when r.delivered_at is not null then 'recibido'
         else 'pendiente' end,
    r.delivered_at, r.read_at
  from public.live_message_recipients r
  join public.live_messages m on m.id = r.message_id
  join public.profiles p on p.id = r.user_id
  where r.message_id = p_message and public.is_teacher()
    and (m.sender_id = auth.uid() or public.is_admin() or public.teaches_student(r.user_id))
  order by p.full_name
$$;

-- Presencia y actividad actual, deducidas del último latido del seguimiento de tiempo (solo profesorado).
--  conectado: latido con la página visible hace ≤ 45 s · no_confirmado: ≤ 5 min · desconectado: más.
create or replace function public.live_presence()
returns table (user_id uuid, estado text, last_seen timestamptz, section text, lesson_title text, unit_title text,
  activity_title text, course_title text)
language sql stable security definer set search_path = ''
as $$
  with mis as (select distinct s.user_id from public.my_messageable_students() s),
  ult as (
    select distinct on (v.user_id) v.user_id, v.last_beat_at, v.section, v.lesson_id, v.unit_id, v.activity_id, v.course_id
    from public.study_visits v join mis on mis.user_id = v.user_id
    where v.last_beat_at > now() - interval '1 day'
    order by v.user_id, v.last_beat_at desc
  )
  select mis.user_id,
    case when u.last_beat_at > now() - interval '45 seconds' then 'conectado'
         when u.last_beat_at > now() - interval '5 minutes' then 'no_confirmado'
         else 'desconectado' end,
    u.last_beat_at, u.section, l.title, un.title, a.title, k.title
  from mis left join ult u on u.user_id = mis.user_id
  left join public.lessons l on l.id = u.lesson_id
  left join public.units un on un.id = u.unit_id
  left join public.activities a on a.id = u.activity_id
  left join public.courses k on k.id = u.course_id
  where public.is_teacher()
$$;

revoke all on function public.live_is_recipient(uuid) from public, anon;
revoke all on function public.live_is_sender(uuid) from public, anon;
grant execute on function public.live_is_recipient(uuid) to authenticated;
grant execute on function public.live_is_sender(uuid) to authenticated;
revoke all on function public.my_messageable_students() from public, anon;
revoke all on function public.send_live_message(text, text, text, uuid[], uuid, integer) from public, anon;
revoke all on function public.my_pending_messages() from public, anon;
revoke all on function public.mark_messages_delivered(uuid[]) from public, anon;
revoke all on function public.ack_live_message(uuid, text) from public, anon;
revoke all on function public.live_message_history(uuid, integer) from public, anon;
revoke all on function public.live_message_recipients_status(uuid) from public, anon;
revoke all on function public.live_presence() from public, anon;
grant execute on function public.my_messageable_students() to authenticated;
grant execute on function public.send_live_message(text, text, text, uuid[], uuid, integer) to authenticated;
grant execute on function public.my_pending_messages() to authenticated;
grant execute on function public.mark_messages_delivered(uuid[]) to authenticated;
grant execute on function public.ack_live_message(uuid, text) to authenticated;
grant execute on function public.live_message_history(uuid, integer) to authenticated;
grant execute on function public.live_message_recipients_status(uuid) to authenticated;
grant execute on function public.live_presence() to authenticated;
