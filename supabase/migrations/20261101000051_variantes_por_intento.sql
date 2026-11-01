-- =============================================================================
-- Variantes por intento: cada estudiante recibe sus propios números en las preguntas cuya clave declara una plantilla.
--
-- La clave (exercise_keys.answer) puede llevar «variante: { plantilla, respuesta, unidad, errores }». La función de
-- calificación (servidor) decide los parámetros con una semilla derivada del intento y la pregunta, calcula la respuesta
-- con el motor físico y califica con ella. El navegador solo pide los PARÁMETROS (números del enunciado) a la función
-- de calificación, que antes comprueba aquí que quien pregunta es el dueño del intento o su profesorado.
-- No hay que guardar nada por intento: la semilla es determinista y se puede reconstruir para auditoría.
-- Aditiva: una función nueva, solo para el servidor (service_role).
-- =============================================================================

create or replace function public.svc_variante_info(p_user uuid, p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare t public.attempts; v_class uuid;
begin
  select * into t from public.attempts where id = p_attempt;
  if t.id is null then raise exception 'Intento no encontrado' using errcode = 'P0002'; end if;
  select class_id into v_class from public.activities where id = t.activity_id;
  if not public.account_ok(p_user) or not (
       t.user_id = p_user
       or (v_class is not null and exists (select 1 from public.class_teachers ct where ct.class_id = v_class and ct.user_id = p_user))
       or exists (select 1 from public.course_staff s where s.course_id = t.course_id and s.user_id = p_user)
       or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) then
    raise exception 'No tiene acceso a este intento' using errcode = '42501';
  end if;
  -- la pregunta es del intento, o es el ejercicio de transferencia (práctica asistida) de una pregunta del intento
  if public.attempt_item_points(p_attempt, p_exercise) is null and not exists (
       select 1 from public.assisted_transfer at where at.activity_id = t.activity_id and at.transfer_exercise_id = p_exercise
         and public.attempt_item_points(p_attempt, at.exercise_id) is not null) then
    raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501';
  end if;
  -- solo el nombre de la plantilla: la respuesta y los errores típicos no salen de aquí
  return (select case when k.answer ? 'variante' then jsonb_build_object('plantilla', k.answer -> 'variante' ->> 'plantilla') end
          from public.exercise_keys k where k.exercise_id = p_exercise);
end;
$$;

revoke all on function public.svc_variante_info(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_variante_info(uuid, uuid, uuid) to service_role;
