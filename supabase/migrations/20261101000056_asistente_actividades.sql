-- =============================================================================
-- Asistente de actividades con IA (migración 56): el profesor describe en lenguaje corriente la práctica o el examen
-- que necesita («10 problemas de choques, mitad intermedios, que abra el lunes a las 8 y cierre a las 10») y Claude,
-- con preguntas y respuestas, completa un BORRADOR. Claude NO crea nada: la actividad la construye el aula con las
-- mismas reglas del asistente «+ Crear actividad» y solo cuando el profesor confirma.
--  - propósito «asistente» en Orbe IA (mismo interruptor, presupuesto, límite diario y simulador)
--  - svc_asistente_contexto: hora local, secciones del profesor y lecciones de sus asignaturas con cuántas preguntas
--    PUBLICADAS hay por nivel (sin enunciados ni claves; nada de estudiantes)
-- Aditiva: un propósito más y una función nueva; svc_orbe_ia_reservar_uso se copia de la migración 55.
-- =============================================================================

alter table public.orbe_ia_usage drop constraint if exists orbe_ia_usage_purpose_check;
alter table public.orbe_ia_usage add constraint orbe_ia_usage_purpose_check check (purpose in ('chistes', 'mensaje', 'pulso', 'pregunta', 'lieia', 'generar', 'asistente'));

create or replace function public.svc_asistente_contexto(p_actor uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_admin boolean; v_secciones jsonb; v_cursos uuid[];
begin
  select p.role = 'admin' into v_admin from public.profiles p where p.id = p_actor and p.role in ('teacher', 'admin') and p.active and p.suspended_at is null;
  if v_admin is null then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'nombre', cl.name, 'asignatura', co.title, 'course_id', co.id) order by co.title, cl.name), '[]'::jsonb),
         coalesce(array_agg(distinct co.id), '{}')
    into v_secciones, v_cursos
    from public.classes cl join public.courses co on co.id = cl.course_id
    where not cl.archived and (exists (select 1 from public.class_teachers ct where ct.class_id = cl.id and ct.user_id = p_actor)
                               or (v_admin and not co.archived));
  return jsonb_build_object(
    'ahora', to_char(now() at time zone 'America/Santo_Domingo', 'YYYY-MM-DD"T"HH24:MI'),
    'dia_semana', (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from now() at time zone 'America/Santo_Domingo')::int + 1],
    'secciones', v_secciones,
    'asignaturas', (select coalesce(jsonb_agg(jsonb_build_object('id', co.id, 'titulo', co.title,
        'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'unidad', u.title,
            'publicadas', (select jsonb_build_object('basico', count(*) filter (where e.difficulty = 'basico'), 'intermedio', count(*) filter (where e.difficulty = 'intermedio'),
                'desafiante', count(*) filter (where e.difficulty = 'desafiante'))
              from public.exercises e where e.lesson_id = l.id and e.published and e.format in ('numeric', 'choice', 'truefalse', 'text')))
          order by u.position, l.position), '[]'::jsonb)
          from (select * from public.lessons l2 where l2.course_id = co.id and not l2.hidden order by l2.position limit 250) l join public.units u on u.id = l.unit_id))
      order by co.title), '[]'::jsonb)
      from public.courses co where co.id = any (v_cursos)));
end;
$$;

-- reserva de Orbe IA (copia de la migración 55) + propósito «asistente»
create or replace function public.svc_orbe_ia_reservar_uso(p_actor uuid, p_purpose text, p_lesson uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.orbe_ia_config;
  v_max integer; v_est numeric; v_gastado numeric; v_reservado numeric; v_llamadas integer; v_usage bigint;
  v_ctx jsonb := null; v_course uuid := null; v_admin boolean;
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform pg_advisory_xact_lock(hashtextextended('orbe-ia-presupuesto', 0));
  select * into c from public.orbe_ia_config where id = 1;
  if not c.enabled then return jsonb_build_object('ok', false, 'motivo', 'apagado'); end if;
  if p_purpose is null or p_purpose not in ('mensaje', 'pulso', 'pregunta', 'lieia', 'generar', 'asistente') then return jsonb_build_object('ok', false, 'motivo', 'proposito'); end if;
  select p.role = 'admin' into v_admin from public.profiles p
    where p.id = p_actor and p.role in ('teacher', 'admin') and p.active and p.suspended_at is null;
  if v_admin is null then return jsonb_build_object('ok', false, 'motivo', 'permiso'); end if;

  -- preguntas sobre una lección: solo de asignaturas que imparte (o cualquiera si es administrador)
  if p_lesson is not null then
    select l.course_id into v_course from public.lessons l where l.id = p_lesson;
    if v_course is null then return jsonb_build_object('ok', false, 'motivo', 'leccion'); end if;
    if not v_admin and not exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_actor)
       and not exists (select 1 from public.classes cl join public.class_teachers ct on ct.class_id = cl.id where cl.course_id = v_course and ct.user_id = p_actor) then
      return jsonb_build_object('ok', false, 'motivo', 'permiso');
    end if;
    select jsonb_build_object('asignatura', co.title, 'unidad', u.title, 'leccion', l.title, 'resumen', left(coalesce(l.summary, ''), 400),
        'apartados', to_jsonb(public.orbe_ia_apartados(l.id)))
      into v_ctx from public.lessons l join public.units u on u.id = l.unit_id join public.courses co on co.id = l.course_id where l.id = p_lesson;
  end if;

  v_max := case p_purpose when 'pregunta' then c.max_output_tokens when 'lieia' then least(c.max_output_tokens, 3000)
                          when 'generar' then least(c.max_output_tokens, 4000) else least(c.max_output_tokens, 2000) end;
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(case p_purpose when 'lieia' then 8000 when 'generar' then 6000 when 'asistente' then 12000 else 4000 end, v_max) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated;
    select coalesce(sum(reserved_usd), 0) into v_reservado from public.orbe_ia_usage
      where status = 'reservado' and not simulated and created_at > now() - interval '15 minutes';
    if v_gastado + v_reservado + v_est > c.monthly_budget_usd then return jsonb_build_object('ok', false, 'motivo', 'presupuesto'); end if;
  end if;

  insert into public.orbe_ia_usage (actor_id, trigger, course_id, lesson_id, model, simulated, reserved_usd, purpose)
  values (p_actor, 'profesor', v_course, p_lesson, c.model, not c.api_real, v_est, p_purpose) returning id into v_usage;
  return jsonb_build_object('ok', true, 'usage_id', v_usage, 'api_real', c.api_real, 'model', c.model, 'max_tokens', v_max, 'contexto', v_ctx,
    'precio_entrada', c.price_input_per_mtok, 'precio_salida', c.price_output_per_mtok);
end;
$$;

revoke all on function public.svc_asistente_contexto(uuid) from public, anon, authenticated;
grant execute on function public.svc_asistente_contexto(uuid) to service_role;
revoke all on function public.svc_orbe_ia_reservar_uso(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_orbe_ia_reservar_uso(uuid, text, uuid) to service_role;
