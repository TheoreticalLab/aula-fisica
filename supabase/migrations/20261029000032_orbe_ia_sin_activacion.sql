-- Orbe IA · sin activación por parte del estudiante (migración 32). Solo redefine funciones; no borra nada.
--
-- Orbe IA se activa exclusivamente desde el panel del profesor (interruptor general + «Mostrar a los estudiantes»
-- + asignatura/lección). El estudiante ya no tiene preferencia propia:
--  · orbe_ia_next deja de consultar orbe_ia_prefs.disabled (antes devolvía {activo:false} para siempre a quien
--    hubiera desmarcado la casilla del perfil o pulsado «No mostrar más»). La tabla se sigue usando para el freno
--    de 30 s entre consultas.
--  · orbe_ia_cerrar sigue registrando cómo se cerró cada mensaje, pero «no_mostrar_mas» ya no desactiva nada.
--  · orbe_ia_set_pref no cambia nada (una página antigua guardada en el navegador no puede volver a desactivarlo).
-- Todo lo demás de orbe_ia_next es idéntico a la migración 30.

create or replace function public.orbe_ia_next(p_lesson uuid, p_section text, p_apartado text default null, p_evento text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.orbe_ia_config;
  v_pref public.orbe_ia_prefs;
  v_course uuid;
  v_apartado text;
  v_ultimo timestamptz;
  v_activo integer;
  v_ultimo_latido timestamptz;
  v_joke public.orbe_ia_jokes;
  v_intervalo integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into c from public.orbe_ia_config where id = 1;
  -- lo único que decide si Orbe IA está activo para un estudiante es el panel del profesor
  if not public.my_account_ok() or coalesce((select role::text from public.profiles where id = v_uid), '') <> 'student'
     or not coalesce(c.enabled, false) or not c.students_enabled then
    return jsonb_build_object('activo', false);
  end if;
  v_intervalo := c.interval_minutes;

  perform pg_advisory_xact_lock(hashtextextended('orbe-ia:' || v_uid::text, 0));
  select * into v_pref from public.orbe_ia_prefs where user_id = v_uid;
  -- protección contra solicitudes excesivas: como mucho una consulta cada 30 s
  if found and v_pref.last_request_at > now() - interval '30 seconds' then
    return jsonb_build_object('activo', true, 'motivo', 'demasiado_pronto', 'espera', 30);
  end if;
  insert into public.orbe_ia_prefs (user_id, last_request_at) values (v_uid, now())
    on conflict (user_id) do update set last_request_at = now();

  -- nunca durante una evaluación en curso (aunque el navegador lo intente desde otra pestaña)
  if exists (select 1 from public.attempts t where t.user_id = v_uid and t.status = 'in_progress' and t.mode = 'exam') then
    return jsonb_build_object('activo', true, 'motivo', 'evaluacion');
  end if;

  if p_lesson is null or not public.lesson_visible_to_me(p_lesson) then
    return jsonb_build_object('activo', true, 'motivo', 'contexto');
  end if;
  select l.course_id into v_course from public.lessons l where l.id = p_lesson;
  if not public.orbe_ia_leccion_habilitada(p_lesson) then
    return jsonb_build_object('activo', true, 'motivo', 'leccion_no_habilitada');
  end if;
  -- evento desactivado o desconocido: se atiende como una consulta normal de la lección
  if p_evento is not null and (not c.events_enabled or p_evento not in ('ejercicio_correcto', 'leccion_terminada', 'actividad_tras_intentos', 'fin_sesion')) then
    p_evento := null;
  end if;
  if p_evento is null and (p_section is null or p_section not in ('teoria', 'formulas', 'ejemplos', 'simulacion', 'comprension', 'practica')) then
    return jsonb_build_object('activo', true, 'motivo', 'contexto');
  end if;

  -- intervalo mínimo entre mensajes
  select max(d.shown_at) into v_ultimo from public.orbe_ia_deliveries d where d.user_id = v_uid;
  if v_ultimo is not null and v_ultimo > now() - make_interval(mins => v_intervalo) then
    return jsonb_build_object('activo', true, 'motivo', 'intervalo', 'intervalo_min', v_intervalo,
      'espera', ceil(extract(epoch from (v_ultimo + make_interval(mins => v_intervalo) - now())))::integer);
  end if;

  -- actividad reciente comprobada con el seguimiento de tiempo (no con lo que diga el navegador)
  select coalesce(sum(v.effective_seconds), 0), max(v.last_beat_at) into v_activo, v_ultimo_latido
    from public.study_visits v where v.user_id = v_uid and v.last_beat_at > now() - interval '20 minutes';
  if v_activo < c.min_activity_seconds or v_ultimo_latido is null or v_ultimo_latido < now() - interval '3 minutes' then
    return jsonb_build_object('activo', true, 'motivo', 'actividad', 'intervalo_min', v_intervalo);
  end if;

  -- apartado: solo si coincide con un encabezado real de la teoría (el texto que se usa es el del profesor)
  if p_apartado is not null and p_evento is null then
    select a into v_apartado from unnest(public.orbe_ia_apartados(p_lesson)) a
      where public.orbe_ia_norm(a) = public.orbe_ia_norm(p_apartado) limit 1;
  end if;

  -- selección: aprobados, nunca vistos por este estudiante; primero el apartado, luego la subsección y la
  -- lección; entre ellos, los menos mostrados (rotación) y al azar
  select j.* into v_joke from public.orbe_ia_jokes j
  where j.status = 'aprobado'
    and not exists (select 1 from public.orbe_ia_deliveries d where d.user_id = v_uid and d.joke_id = j.id)
    and (
      (p_evento is not null and j.evento = p_evento and j.course_id = v_course and (j.lesson_id is null or j.lesson_id = p_lesson))
      or (p_evento is null and j.evento is null and j.lesson_id = p_lesson and (j.section is null or j.section = p_section)
          and (j.apartado is null or (v_apartado is not null and j.apartado = v_apartado)))
    )
  order by (case when j.apartado is not null then 0 when j.section is not null then 1 else 2 end), j.times_shown, random()
  limit 1;

  if not found then
    return jsonb_build_object('activo', true, 'motivo', 'sin_chistes', 'reponer', c.auto_generate, 'intervalo_min', v_intervalo,
      'apartado', v_apartado);
  end if;

  insert into public.orbe_ia_deliveries (user_id, joke_id, lesson_id, section) values (v_uid, v_joke.id, p_lesson, coalesce(p_section, p_evento));
  update public.orbe_ia_jokes set times_shown = times_shown + 1 where id = v_joke.id;
  return jsonb_build_object('activo', true, 'chiste', jsonb_build_object('id', v_joke.id, 'texto', v_joke.text), 'intervalo_min', v_intervalo);
end;
$$;

-- Estudiante: cerró el mensaje. Se registra cómo, sin desactivar nada.
create or replace function public.orbe_ia_cerrar(p_joke uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_action not in ('cerrado', 'no_mostrar_mas', 'caducado') then raise exception 'Acción no válida' using errcode = '22023'; end if;
  update public.orbe_ia_deliveries set closed_at = coalesce(closed_at, now()), action = coalesce(action, p_action)
    where user_id = auth.uid() and joke_id = p_joke;
end;
$$;

-- Ya no hay preferencia del estudiante: se conserva la función (páginas antiguas en caché) pero no cambia nada.
create or replace function public.orbe_ia_set_pref(p_disabled boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  return jsonb_build_object('disabled', false);
end;
$$;
