-- =============================================================================
-- Mis sesiones abiertas: cada usuario ve sus sesiones (navegador, IP, inicio, última actividad) y puede cerrar
-- una en particular. Solo las propias; la sesión desde la que se consulta no se puede cerrar aquí (para eso
-- está «Salir»). Cerrar una sesión borra su registro en auth.sessions (y, en cascada, sus tokens de renovación):
-- ese dispositivo ya no puede renovar el acceso y queda fuera cuando caduca su token temporal (≤ 1 h).
-- =============================================================================

create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, last_active timestamptz, user_agent text, ip text, current boolean)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.created_at,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
    s.user_agent, host(s.ip),
    s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions s
  where s.user_id = auth.uid()
  order by 3 desc nulls last
$$;

create or replace function public.revoke_my_session(p_session uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_session::text = coalesce(auth.jwt() ->> 'session_id', '') then
    raise exception 'Para cerrar esta sesión use «Salir»' using errcode = 'P0001';
  end if;
  delete from auth.sessions where id = p_session and user_id = v_uid;
  if not found then raise exception 'Sesión no encontrada' using errcode = 'P0002'; end if;
  return true;
end;
$$;

revoke all on function public.my_sessions() from public, anon;
revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
