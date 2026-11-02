-- =============================================================================
-- «Aviso del aula» (migración 57): el profesor puede enviar un mensaje en vivo que el estudiante ve como un aviso
-- NEUTRO de la plataforma («🔔 Aviso del aula»), sin «Mensaje del profesor» ni su nombre. Motivo pedagógico: un
-- «mensaje del profesor» en medio de una práctica o un examen alarma y puede alterar el rendimiento. El aviso es
-- veraz: lo entrega la plataforma; no se atribuye a nadie (tampoco a la IA).
--  - live_messages.remitente: 'profesor' (como hasta ahora) o 'aula'
--  - send_live_message_aula / send_live_message_online_aula: mismas reglas y permisos que las de siempre (las llaman)
--  - my_pending_messages_v2: como my_pending_messages, con el remitente; en los avisos del aula NO devuelve el nombre
--  - my_pending_messages (misma firma): en los avisos del aula devuelve «Aula virtual» en vez del nombre del profesor,
--    para que ninguna versión anterior del aula muestre quién lo envió
-- Aditiva: una columna con valor por defecto y funciones; la historia del profesor no cambia.
-- =============================================================================

alter table public.live_messages add column if not exists remitente text not null default 'profesor';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_messages_remitente_check') then
    alter table public.live_messages add constraint live_messages_remitente_check check (remitente in ('profesor', 'aula'));
  end if;
end $$;

create or replace function public.send_live_message_aula(p_kind text, p_body text, p_mode text, p_users uuid[], p_class uuid, p_expires_minutes integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r jsonb;
begin
  r := public.send_live_message(p_kind, p_body, p_mode, p_users, p_class, p_expires_minutes);   -- permisos y validaciones de siempre
  update public.live_messages set remitente = 'aula' where id = (r ->> 'id')::uuid;              -- misma transacción: nunca se ve como del profesor
  return r;
end;
$$;

create or replace function public.send_live_message_online_aula(p_kind text, p_body text, p_class uuid, p_expires_minutes integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r jsonb;
begin
  r := public.send_live_message_online(p_kind, p_body, p_class, p_expires_minutes);
  update public.live_messages set remitente = 'aula' where id = (r ->> 'id')::uuid;
  return r;
end;
$$;

create or replace function public.my_pending_messages_v2()
returns table (id uuid, kind text, body text, sender_name text, remitente text, created_at timestamptz, expires_at timestamptz, delivered_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kind, m.body,
         case when m.remitente = 'aula' then null else coalesce(nullif(p.full_name, ''), 'Profesor') end,
         m.remitente, m.created_at, m.expires_at, r.delivered_at
  from public.live_message_recipients r
  join public.live_messages m on m.id = r.message_id
  left join public.profiles p on p.id = m.sender_id
  where r.user_id = auth.uid() and r.read_at is null and r.dismissed_at is null
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at
  limit 20
$$;

-- versión anterior (misma firma): tampoco revela el nombre en un aviso del aula
create or replace function public.my_pending_messages()
returns table (id uuid, kind text, body text, sender_name text, created_at timestamptz, expires_at timestamptz, delivered_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kind, m.body,
         case when m.remitente = 'aula' then 'Aula virtual' else coalesce(nullif(p.full_name, ''), 'Profesor') end,
         m.created_at, m.expires_at, r.delivered_at
  from public.live_message_recipients r
  join public.live_messages m on m.id = r.message_id
  left join public.profiles p on p.id = m.sender_id
  where r.user_id = auth.uid() and r.read_at is null and r.dismissed_at is null
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at
  limit 20
$$;

do $$ declare f text; begin
  foreach f in array array['send_live_message_aula(text, text, text, uuid[], uuid, integer)', 'send_live_message_online_aula(text, text, uuid, integer)',
                           'my_pending_messages_v2()', 'my_pending_messages()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
