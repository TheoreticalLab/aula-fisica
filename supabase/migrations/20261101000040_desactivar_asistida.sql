-- =============================================================================
-- Práctica con aprendizaje asistido: desactivar el modo asistido de una práctica (volver a la tradicional).
-- Solo si ningún estudiante ha registrado pasos (no se pierde evidencia ni cambian notas). Borra únicamente la
-- configuración de la actividad (assisted_settings y assisted_transfer), nunca datos de estudiantes.
-- Aditiva: una función nueva.
-- =============================================================================

create or replace function public.assisted_settings_disable(p_activity uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from public.assisted_steps x join public.attempts a on a.id = x.attempt_id where a.activity_id = p_activity) then
    raise exception 'No se puede desactivar: ya hay estudiantes con pasos registrados. Cree una práctica tradicional nueva.' using errcode = 'P0001';
  end if;
  delete from public.assisted_transfer where activity_id = p_activity;
  delete from public.assisted_settings where activity_id = p_activity;
  return public.assisted_settings_get(p_activity);
end;
$$;

do $$
begin
  execute 'revoke all on function public.assisted_settings_disable(uuid) from public, anon';
  execute 'grant execute on function public.assisted_settings_disable(uuid) to authenticated';
end $$;
