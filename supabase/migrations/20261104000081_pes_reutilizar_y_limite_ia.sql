-- =============================================================================
-- Migración 81 · PES: reutilizar problemas ya hechos y límite de salida propio para la generación con IA.
--
-- 1) Reutilizar: el profesorado puede copiar a una práctica en borrador cualquier ejercicio de OTRA práctica
--    extraordinaria suya (también de otra sección o asignatura), tal como quedó: apartados, etapas, pesos, tiempos,
--    claves, rúbricas, explicaciones y figuras. La copia es independiente (editarla no cambia el original) y pasa por
--    pes_ejercicio_redactado, con todas sus validaciones. Nunca copia nada de estudiantes.
-- 2) Generación con IA (auditoría del 4-nov): la reserva de cada llamada calculaba el límite de salida de «generar»
--    como least(max_output_tokens, 4000), y max_output_tokens (3000) es el ajuste de los CHISTES. Las 13 llamadas
--    fallidas de la PES terminaron exactamente en 3000 tokens: la respuesta se cortaba (5 apartados, nivel
--    desafiante, tipos «errores» y «transferencia»). Ahora «generar» tiene su propio límite (12 000). Solo se paga
--    lo que el modelo escribe, no el límite.
--    Además, el presupuesto mensual contaba solo las llamadas «ok»: las fallidas (que la API cobra) quedaban fuera
--    (1,13 USD en 16 llamadas hasta el 4-nov). Ahora cuentan también.
-- Aditiva: dos funciones nuevas y una copia ampliada de svc_orbe_ia_reservar_uso (migración 66).
-- =============================================================================

-- Problemas de otras prácticas extraordinarias del profesor, para copiarlos a esta
create or replace function public.pes_reutilizables(p_practica uuid)
returns table (ejercicio_id uuid, practica_id uuid, practica_titulo text, practica_estado text, seccion text, asignatura text,
  titulo text, contexto text, apartados integer, formatos text[], tipo text, dificultad text, leccion text, origen_ref text, ya_en_esta boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_practica is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
  select e.id, p.id, p.titulo, p.estado, c.name, k.title, e.titulo, left(e.contexto, 600),
    (select count(*)::integer from public.pes_apartados a where a.ejercicio_id = e.id),
    (select array_agg(a.formato::text order by a.posicion) from public.pes_apartados a where a.ejercicio_id = e.id),
    pr.tipo, pr.dificultad, l.title, e.origen_ref,
    exists (select 1 from public.pes_ejercicios d where d.practica_id = p_practica and d.titulo = e.titulo and d.contexto = e.contexto)
  from public.pes_ejercicios e
  join public.pes_practicas p on p.id = e.practica_id
  join public.classes c on c.id = p.class_id
  join public.courses k on k.id = p.course_id
  left join public.pes_propuestas_ia pr on pr.ejercicio_id = e.id
  left join public.lessons l on l.id = pr.leccion_id
  where p.id <> p_practica and public.pes_docente(p.id)
  order by (p.course_id = (select course_id from public.pes_practicas where id = p_practica)) desc, p.created_at desc, e.posicion;
end $$;

-- Copia un ejercicio de otra práctica (del mismo profesor) al final de esta, que debe estar en borrador
create or replace function public.pes_ejercicio_reutilizar(p_practica uuid, p_ejercicio uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  e public.pes_ejercicios; dst public.pes_practicas; src public.pes_practicas; v_json jsonb; v_suma numeric; v_nuevo uuid;
begin
  select * into dst from public.pes_practicas where id = p_practica;
  select * into e from public.pes_ejercicios where id = p_ejercicio;
  select * into src from public.pes_practicas where id = e.practica_id;
  if dst.id is null or e.id is null or not public.pes_docente(dst.id) or not public.pes_docente(src.id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if src.id = dst.id then raise exception 'El ejercicio ya está en esta práctica' using errcode = 'P0001'; end if;
  if dst.estado <> 'borrador' then raise exception 'Solo se añaden ejercicios a una práctica en borrador' using errcode = 'P0001'; end if;
  select jsonb_build_object('titulo', e.titulo, 'contexto', e.contexto, 'apartados', jsonb_agg(jsonb_build_object(
      'enunciado', a.enunciado, 'formato', a.formato::text, 'opciones', a.opciones, 'multiple', a.multiple, 'unidad_sugerida', a.unidad_sugerida,
      'etapa', a.etapa, 'peso', a.peso, 't_ref_s', a.t_ref_s, 'clave', k.clave, 'rubrica', coalesce(k.rubrica, ''), 'explicacion', coalesce(k.explicacion, ''))
      order by a.posicion)),
    sum(a.peso)
    into v_json, v_suma
  from public.pes_apartados a left join public.pes_claves k on k.apartado_id = a.id
  where a.ejercicio_id = e.id;
  if v_json is null then raise exception 'El ejercicio no tiene apartados' using errcode = 'P0001'; end if;
  -- pesos que no suman exactamente 1 (redondeos antiguos): se reparten por igual
  if abs(coalesce(v_suma, 0) - 1) > 1e-6 then
    v_json := jsonb_set(v_json, '{apartados}', (select jsonb_agg(x - 'peso') from jsonb_array_elements(v_json -> 'apartados') x));
  end if;
  v_nuevo := public.pes_ejercicio_redactado(dst.id, v_json);
  -- figuras (pes_ejercicio_redactado no las recibe)
  update public.pes_apartados n set figura = o.figura
    from public.pes_apartados o
    where n.ejercicio_id = v_nuevo and o.ejercicio_id = e.id and o.posicion = n.posicion and o.figura is not null;
  update public.pes_ejercicios set origen_ref = left(format('Reutilizado de «%s»%s', src.titulo,
      case when e.origen_ref is not null then ' · ' || e.origen_ref else '' end), 200)
    where id = v_nuevo;
  return v_nuevo;
end $$;

-- svc_orbe_ia_reservar_uso: copia de la migración 66 + límite de salida propio para «generar»
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
  if p_purpose is null or p_purpose not in ('mensaje', 'pulso', 'pregunta', 'lieia', 'generar', 'asistente', 'clase') then return jsonb_build_object('ok', false, 'motivo', 'proposito'); end if;
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
                          when 'generar' then 12000   /* migración 81: propio, no el de los chistes */ when 'clase' then 16000 else least(c.max_output_tokens, 2000) end;
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(case p_purpose when 'lieia' then 8000 when 'generar' then 6000 when 'asistente' then 12000 when 'clase' then 20000 else 4000 end, v_max) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status in ('ok', 'error') and not simulated;   -- migración 81: las fallidas también se cobran
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

do $$ declare f text; begin
  foreach f in array array['pes_reutilizables(uuid)', 'pes_ejercicio_reutilizar(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
