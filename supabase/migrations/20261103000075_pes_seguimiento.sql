-- =============================================================================
-- Migración 75 · PRÁCTICA EXTRAORDINARIA SECUENCIAL · seguimiento docente (requiere la 74). Solo añade.
--  · Monitor por práctica (avance, tiempos, anticipaciones, omisiones, puntuaciones, pendientes, actividad) e
--    historial de un estudiante (respuestas, tiempos, decisiones, incidencias, controles).
--  · Calibración de tiempos: tiempos medidos en pruebas piloto (en papel o en el simulador) e informe que compara el
--    tiempo de resolución esperado con la espera impuesta; en borrador, la mediana puede pasar a ser el T_ref.
--  · Simulador docente: el profesorado recorre la práctica con una asignación de PRUEBA (también en borrador), puede
--    adelantar su propio reloj, inspeccionar las calificaciones y reiniciar. Nada de eso cuenta en listas ni puntuaciones.
--  · Control presencial de comprensión: sobre un ejercicio ya realizado, el profesor prepara uno equivalente (números
--    nuevos para las variantes o preguntas del banco de la misma lección), lo aplica en persona y registra el resultado.
--    Su efecto lo fija la política anunciada antes de publicar (pes_practicas.control_politica).
--  Los indicadores (tiempos breves, pegados bloqueados) son para revisión docente, no pruebas de fraude.
-- =============================================================================

create table if not exists public.pes_calibraciones (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  apartado_id uuid not null references public.pes_apartados (id) on delete cascade,
  segundos numeric(8, 1) not null check (segundos > 0 and segundos <= 21600),
  fuente text not null default 'papel' check (fuente in ('papel', 'simulador')),
  nota text check (nota is null or char_length(nota) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pes_calibraciones_idx on public.pes_calibraciones (practica_id, apartado_id);
alter table public.pes_calibraciones enable row level security;
revoke all on public.pes_calibraciones from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Monitor e historial
-- -----------------------------------------------------------------------------
create or replace function public.pes_monitor(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('ahora', now(),
    'practica', jsonb_build_object('id', p.id, 'titulo', p.titulo, 'estado', p.estado, 'cierra_at', p.cierra_at, 'resultados_publicados', p.resultados_publicados,
      'ejercicios', (select count(*) from public.pes_ejercicios e where e.practica_id = p.id),
      'apartados', (select count(*) from public.pes_apartados a where a.practica_id = p.id), 'control_politica', p.control_politica),
    'estudiantes', coalesce((select jsonb_agg(x order by x ->> 'nombre') from (
      select jsonb_build_object('user_id', s.user_id, 'nombre', pr.full_name, 'codigo', pr.student_code, 'estado', coalesce(st.estado, 'no_iniciada'),
        'cierre', public.pes_cierre(p.id, s.user_id), 'aceptado_at', s.aceptado_at,
        'adaptacion', jsonb_build_object('tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera, 'pegado_permitido', s.pegado_permitido),
        'actual', case when st.estado = 'apartado_abierto' then jsonb_build_object('ejercicio', ea.posicion, 'letra', chr(64 + aa.posicion),
          'revelado_at', st.revelado_at, 't_min_s', public.pes_t_min(aa.id, s.user_id)) end,
        'cerrados', r.cerrados, 'omitidos', r.omitidos, 'anticipados', r.anticipados, 'validadas', r.validadas, 'pendientes_revision', r.pendientes,
        'breves', r.breves, 'tiempo_total_s', r.tiempo,
        'ejercicios_completos', (select count(*) from (select a.ejercicio_id from public.pes_apartados a
            left join public.pes_respuestas x on x.apartado_id = a.id and x.user_id = s.user_id
            where a.practica_id = p.id group by a.ejercicio_id having count(*) = count(x.id)) z),
        'ultima_actividad', (select max(ev.at) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id),
        'pegados_bloqueados', (select count(*) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id and ev.tipo in ('pegado_bloqueado', 'arrastre_bloqueado')),
        'reconexiones', (select count(*) from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = s.user_id and ev.tipo = 'reconexion'),
        'controles', (select count(*) from public.pes_controles c where c.practica_id = p.id and c.user_id = s.user_id and c.estado = 'realizado'),
        'puntaje', public.pes_puntaje(p.id, s.user_id)) x
      from public.pes_asignaciones s join public.profiles pr on pr.id = s.user_id
      left join public.pes_estado st on st.practica_id = s.practica_id and st.user_id = s.user_id
      left join public.pes_apartados aa on aa.id = st.apartado_id
      left join public.pes_ejercicios ea on ea.id = aa.ejercicio_id
      cross join lateral (select count(*) cerrados, count(*) filter (where x.accion = 'omitida') omitidos, count(*) filter (where x.accion = 'anticipada') anticipados,
          count(*) filter (where x.validada) validadas, count(*) filter (where x.revision = 'pendiente') pendientes,
          count(*) filter (where x.accion <> 'omitida' and x.segundos < 0.5 * x.t_min_s) breves, coalesce(sum(x.segundos), 0) tiempo
        from public.pes_respuestas x where x.practica_id = p.id and x.user_id = s.user_id) r
      where s.practica_id = p.id and not s.prueba) q), '[]'::jsonb));
end $$;

create or replace function public.pes_historial(p_practica uuid, p_user uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = p_user) then
    raise exception 'El estudiante no tiene asignada esta práctica' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'estudiante', (select jsonb_build_object('user_id', pr.id, 'nombre', pr.full_name, 'codigo', pr.student_code) from public.profiles pr where pr.id = p_user),
    'respuestas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ejercicio', e.posicion, 'ejercicio_id', e.id, 'letra', chr(64 + a.posicion), 'etapa', a.etapa,
        'enunciado', a.enunciado, 'formato', a.formato, 'opciones', a.opciones, 'respuesta', x.respuesta, 'accion', x.accion, 'revelado_at', x.revelado_at,
        'cerrado_at', x.cerrado_at, 'segundos', x.segundos, 't_min_s', x.t_min_s, 'm', x.m, 'q', x.q, 'revision', x.revision, 'validada', x.validada,
        'codigo', x.resultado ->> 'code', 'nota_revision', x.nota_revision) order by e.posicion, a.posicion)
      from public.pes_respuestas x join public.pes_apartados a on a.id = x.apartado_id join public.pes_ejercicios e on e.id = a.ejercicio_id
      where x.practica_id = p_practica and x.user_id = p_user), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('tipo', ev.tipo, 'at', ev.at, 'ejercicio', e.posicion, 'letra', chr(64 + a.posicion), 'detalle', ev.detalle) order by ev.at)
      from (select * from public.pes_eventos where practica_id = p_practica and user_id = p_user order by at desc limit 500) ev
      left join public.pes_apartados a on a.id = ev.apartado_id left join public.pes_ejercicios e on e.id = a.ejercicio_id), '[]'::jsonb),
    'controles', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'ejercicio', e.posicion, 'estado', c.estado, 'resultado', c.resultado, 'nota', c.nota,
        'preparado_at', c.preparado_at, 'cerrado_at', c.cerrado_at) order by c.preparado_at)
      from public.pes_controles c join public.pes_ejercicios e on e.id = c.ejercicio_id where c.practica_id = p_practica and c.user_id = p_user), '[]'::jsonb),
    'puntaje', public.pes_puntaje(p_practica, p_user));
end $$;

-- -----------------------------------------------------------------------------
-- Calibración de tiempos e informe comparativo
-- -----------------------------------------------------------------------------
create or replace function public.pes_calibrar(p_apartado uuid, p_segundos numeric, p_fuente text, p_nota text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.pes_apartados; v uuid;
begin
  select * into a from public.pes_apartados where id = p_apartado;
  if a.id is null or not public.pes_docente(a.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_segundos is null or p_segundos <= 0 or p_segundos > 21600 then raise exception 'El tiempo medido va de 1 s a 6 h' using errcode = '22023'; end if;
  insert into public.pes_calibraciones (practica_id, apartado_id, segundos, fuente, nota, created_by)
  values (a.practica_id, a.id, round(p_segundos, 1), coalesce(nullif(p_fuente, ''), 'papel'), left(nullif(btrim(p_nota), ''), 300), auth.uid()) returning id into v;
  return v;
end $$;

create or replace function public.pes_calibracion_borrar(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pes_calibraciones;
begin
  select * into c from public.pes_calibraciones where id = p_id;
  if c.id is null or not public.pes_docente(c.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  delete from public.pes_calibraciones where id = p_id;
end $$;

-- por apartado: T_ref, espera mínima (sin adaptaciones), tiempos medidos y el del simulador docente (si no se adelantó)
create or replace function public.pes_informe_tiempos(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.pes_practicas;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('incremento', p.incremento, 'estado', p.estado,
    'apartados', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ejercicio', e.posicion, 'letra', chr(64 + a.posicion), 'formato', a.formato,
        't_ref_s', a.t_ref_s, 't_min_s', round((1 + p.incremento) * a.t_ref_s, 2),
        'calibraciones', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'segundos', c.segundos, 'fuente', c.fuente, 'nota', c.nota, 'at', c.created_at) order by c.created_at)
          from public.pes_calibraciones c where c.apartado_id = a.id), '[]'::jsonb),
        'piloto_s', (select x.segundos from public.pes_respuestas x join public.pes_asignaciones s on s.practica_id = x.practica_id and s.user_id = x.user_id and s.prueba
          where x.apartado_id = a.id and x.user_id = auth.uid() and x.accion <> 'omitida'
            and not exists (select 1 from public.pes_eventos ev where ev.practica_id = p.id and ev.user_id = auth.uid() and ev.apartado_id = a.id and ev.tipo = 'piloto_adelanto')))
      order by e.posicion, a.posicion)
      from public.pes_apartados a join public.pes_ejercicios e on e.id = a.ejercicio_id where a.practica_id = p.id), '[]'::jsonb));
end $$;

-- en borrador: T_ref = mediana de los tiempos medidos de cada apartado (entre 10 s y 2 h)
create or replace function public.pes_aplicar_calibracion(p_practica uuid) returns integer language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if (select estado from public.pes_practicas where id = p_practica) <> 'borrador' then
    raise exception 'La práctica ya está publicada: sus tiempos de referencia no se modifican' using errcode = 'P0001'; end if;
  update public.pes_apartados a set t_ref_s = least(7200, greatest(10, round(m.med)::integer))
    from (select apartado_id, percentile_cont(0.5) within group (order by segundos) med from public.pes_calibraciones where practica_id = p_practica group by apartado_id) m
    where a.id = m.apartado_id and a.practica_id = p_practica and a.t_ref_s <> least(7200, greatest(10, round(m.med)::integer));
  get diagnostics v = row_count;
  perform public.pes_log(p_practica, auth.uid(), null, 'calibracion_aplicada', jsonb_build_object('apartados', v));
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Simulador docente (asignación de prueba)
-- -----------------------------------------------------------------------------
create or replace function public.pes_piloto_resumen(p_practica uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'titulo', p.titulo, 'descripcion', p.descripcion, 'instrucciones', p.instrucciones,
      'abre_at', p.abre_at, 'cierra_at', p.cierra_at, 'cierre', public.pes_cierre(p.id, s.user_id), 'estado_practica', 'publicada',
      'p_max', p.p_max, 'alfa', p.alfa, 'factor_anticipado', p.factor_anticipado, 'incremento', p.incremento,
      'ejercicios', (select count(*) from public.pes_ejercicios e where e.practica_id = p.id),
      'apartados', (select count(*) from public.pes_apartados a where a.practica_id = p.id),
      'cerrados', (select count(*) from public.pes_respuestas r where r.practica_id = p.id and r.user_id = s.user_id),
      'minutos_espera', (select round(sum((1 + p.incremento) * a.t_ref_s * s.factor_espera) / 60) from public.pes_apartados a where a.practica_id = p.id),
      'minutos_referencia', (select round(sum(a.t_ref_s) / 60.0) from public.pes_apartados a where a.practica_id = p.id),
      'liberacion', p.liberacion, 'control_politica', p.control_politica,
      'estado', st.estado, 'aceptado_at', s.aceptado_at, 'tiempo_extra_min', s.tiempo_extra_min, 'factor_espera', s.factor_espera,
      'pegado_permitido', s.pegado_permitido, 'resultado', public.pes_puntaje(p.id, s.user_id), 'prueba', true)
  from public.pes_asignaciones s join public.pes_practicas p on p.id = s.practica_id
  left join public.pes_estado st on st.practica_id = s.practica_id and st.user_id = s.user_id
  where s.practica_id = p_practica and s.user_id = auth.uid() and s.prueba and public.pes_docente(p_practica)
$$;

create or replace function public.pes_piloto_iniciar(p_practica uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; v_uid uuid := auth.uid();
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.clase_es_docente(p.class_id, v_uid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p.estado not in ('borrador', 'publicada') then raise exception 'La práctica no está abierta' using errcode = 'P0001'; end if;
  if exists (select 1 from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = v_uid and not s.prueba) then
    raise exception 'Tiene una asignación real en esta práctica' using errcode = 'P0001'; end if;
  insert into public.pes_asignaciones (practica_id, user_id, prueba, version) values (p_practica, v_uid, true, p.version) on conflict do nothing;
  insert into public.pes_estado (practica_id, user_id) values (p_practica, v_uid) on conflict do nothing;
  perform public.pes_log(p_practica, v_uid, null, 'piloto_iniciado');
  return public.pes_piloto_resumen(p_practica);
end $$;

create or replace function public.pes_piloto_reiniciar(p_practica uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = v_uid and s.prueba) or not public.pes_docente(p_practica) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  perform 1 from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  delete from public.pes_respuestas where practica_id = p_practica and user_id = v_uid;
  update public.pes_estado set estado = 'no_iniciada', apartado_id = null, revelado_at = null, borrador = null, borrador_rev = 0, updated_at = now()
    where practica_id = p_practica and user_id = v_uid;
  update public.pes_asignaciones set aceptado_at = null where practica_id = p_practica and user_id = v_uid;
  perform public.pes_log(p_practica, v_uid, null, 'piloto_reiniciado');
  return public.pes_piloto_resumen(p_practica);
end $$;

-- adelanta el reloj del apartado abierto del PROPIO simulador (para recorrer la práctica sin esperar)
create or replace function public.pes_piloto_adelantar(p_practica uuid, p_segundos integer) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.pes_estado;
begin
  if not exists (select 1 from public.pes_asignaciones a where a.practica_id = p_practica and a.user_id = v_uid and a.prueba) or not public.pes_docente(p_practica) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_segundos is null or p_segundos < 1 or p_segundos > 86400 then raise exception 'Entre 1 s y 24 h' using errcode = '22023'; end if;
  select * into s from public.pes_estado where practica_id = p_practica and user_id = v_uid for update;
  if s.estado <> 'apartado_abierto' or s.revelado_at is null then raise exception 'No hay un apartado abierto' using errcode = 'P0001'; end if;
  update public.pes_estado set revelado_at = revelado_at - make_interval(secs => p_segundos) where practica_id = p_practica and user_id = v_uid;
  perform public.pes_log(p_practica, v_uid, s.apartado_id, 'piloto_adelanto', jsonb_build_object('segundos', p_segundos));
end $$;

-- calificaciones del simulador, apartado por apartado (solo las propias de prueba)
create or replace function public.pes_piloto_detalle(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.pes_asignaciones a where a.practica_id = p_practica and a.user_id = v_uid and a.prueba) or not public.pes_docente(p_practica) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('puntaje', public.pes_puntaje(p_practica, v_uid),
    'respuestas', coalesce((select jsonb_agg(jsonb_build_object('ejercicio', e.posicion, 'letra', chr(64 + a.posicion), 'respuesta', x.respuesta, 'accion', x.accion,
        'segundos', x.segundos, 't_min_s', x.t_min_s, 'm', x.m, 'q', x.q, 'revision', x.revision, 'estado', x.resultado ->> 'status', 'codigo', x.resultado ->> 'code',
        'adelantado', exists (select 1 from public.pes_eventos ev where ev.practica_id = p_practica and ev.user_id = v_uid and ev.apartado_id = a.id and ev.tipo = 'piloto_adelanto'))
      order by e.posicion, a.posicion)
      from public.pes_respuestas x join public.pes_apartados a on a.id = x.apartado_id join public.pes_ejercicios e on e.id = a.ejercicio_id
      where x.practica_id = p_practica and x.user_id = v_uid), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- Control presencial de comprensión
-- -----------------------------------------------------------------------------
create or replace function public.pes_politica_control(p_practica uuid, p jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p ->> 'modo' not in ('informativo', 'ajuste') then raise exception 'Modo: informativo o ajuste' using errcode = '22023'; end if;
  if coalesce((p ->> 'peso')::numeric, 0) < 0 or coalesce((p ->> 'peso')::numeric, 0) > 0.3 then raise exception 'El peso del control va de 0 a 0,3' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p ->> 'descripcion', ''))) < 20 then raise exception 'Describa cómo será el control y sus consecuencias (se muestra al estudiante)' using errcode = '22023'; end if;
  update public.pes_practicas set control_politica = jsonb_build_object('modo', p ->> 'modo', 'peso', case when p ->> 'modo' = 'ajuste' then coalesce((p ->> 'peso')::numeric, 0) else 0 end,
    'descripcion', left(btrim(p ->> 'descripcion'), 2000)), updated_at = now() where id = p_practica;
end $$;

-- Prepara un control sobre un ejercicio que el estudiante ya realizó: el original (con sus respuestas) y una propuesta
-- equivalente: si el apartado tiene variante, números nuevos (semilla del control); además, preguntas del banco de la
-- misma lección y formato que no estén en la práctica. Todo para el profesor (incluye claves): nunca para el estudiante.
create or replace function public.pes_control_preparar(p_practica uuid, p_user uuid, p_ejercicio uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pes_practicas; e public.pes_ejercicios; v_id uuid; v_semilla uuid; v_prop jsonb;
begin
  select * into p from public.pes_practicas where id = p_practica;
  if p.id is null or not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.pes_asignaciones s where s.practica_id = p_practica and s.user_id = p_user and not s.prueba) then
    raise exception 'El estudiante no tiene asignada esta práctica' using errcode = 'P0001'; end if;
  select * into e from public.pes_ejercicios where id = p_ejercicio and practica_id = p_practica;
  if e.id is null then raise exception 'Ese ejercicio no es de esta práctica' using errcode = '22023'; end if;
  if not exists (select 1 from public.pes_respuestas x join public.pes_apartados a on a.id = x.apartado_id
                 where a.ejercicio_id = e.id and x.user_id = p_user and x.accion <> 'omitida') then
    raise exception 'El estudiante no ha respondido ningún apartado de ese ejercicio' using errcode = 'P0001'; end if;
  v_prop := jsonb_build_object('ejercicio', jsonb_build_object('posicion', e.posicion, 'titulo', e.titulo, 'contexto', e.contexto, 'origen', e.origen),
    'apartados', (select jsonb_agg(jsonb_build_object('id', a.id, 'letra', chr(64 + a.posicion), 'etapa', a.etapa, 'enunciado', a.enunciado, 'formato', a.formato,
        'opciones', a.opciones, 'clave', k.clave, 'rubrica', k.rubrica, 'explicacion', k.explicacion, 'variante', coalesce(k.clave ? 'variante', false),
        'respuesta', x.respuesta, 'accion', x.accion, 'q', x.q, 'segundos', x.segundos) order by a.posicion)
      from public.pes_apartados a left join public.pes_claves k on k.apartado_id = a.id
      left join public.pes_respuestas x on x.apartado_id = a.id and x.user_id = p_user where a.ejercicio_id = e.id),
    'candidatos', coalesce((select jsonb_agg(c) from (
      select jsonb_build_object('exercise_id', ex.id, 'enunciado', ex.prompt, 'formato', ex.format, 'opciones', ex.options, 'clave', ek.answer, 'leccion', l.title) c
      from public.exercises ex join public.exercise_keys ek on ek.exercise_id = ex.id left join public.lessons l on l.id = ex.lesson_id
      where ex.course_id = p.course_id and ex.published
        and ex.lesson_id in (select o.lesson_id from public.pes_apartados a join public.exercises o on o.id = a.origen_exercise_id where a.ejercicio_id = e.id)
        and ex.format in (select a.formato from public.pes_apartados a where a.ejercicio_id = e.id)
        and not exists (select 1 from public.pes_apartados a2 where a2.practica_id = p_practica and a2.origen_exercise_id = ex.id)
      order by random() limit 8) z), '[]'::jsonb));
  insert into public.pes_controles (practica_id, user_id, ejercicio_id, propuesta, preparado_por) values (p_practica, p_user, e.id, v_prop, auth.uid())
    returning id, semilla into v_id, v_semilla;
  perform public.pes_log(p_practica, p_user, null, 'control_preparado', jsonb_build_object('control', v_id, 'ejercicio', e.posicion, 'por', auth.uid()));
  return jsonb_build_object('id', v_id, 'semilla', v_semilla, 'propuesta', v_prop, 'politica', p.control_politica);
end $$;

create or replace function public.pes_control_registrar(p_control uuid, p_resultado numeric, p_nota text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.pes_controles;
begin
  select * into c from public.pes_controles where id = p_control for update;
  if c.id is null or not public.pes_docente(c.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if c.estado <> 'preparado' then raise exception 'Ese control ya está cerrado (anúlelo y prepare otro para corregir)' using errcode = 'P0001'; end if;
  if p_resultado is null or p_resultado < 0 or p_resultado > 1 then raise exception 'El resultado va de 0 a 1' using errcode = '22023'; end if;
  if nullif(btrim(p_nota), '') is null then raise exception 'Escriba qué se comprobó y cómo respondió' using errcode = '22023'; end if;
  update public.pes_controles set estado = 'realizado', resultado = round(p_resultado, 3), nota = left(btrim(p_nota), 2000), cerrado_por = auth.uid(), cerrado_at = now()
    where id = p_control;
  perform public.pes_log(c.practica_id, c.user_id, null, 'control_realizado', jsonb_build_object('control', c.id, 'resultado', p_resultado, 'por', auth.uid()));
  return public.pes_puntaje(c.practica_id, c.user_id);
end $$;

create or replace function public.pes_control_anular(p_control uuid, p_motivo text) returns void language plpgsql security definer set search_path = '' as $$
declare c public.pes_controles;
begin
  select * into c from public.pes_controles where id = p_control for update;
  if c.id is null or not public.pes_docente(c.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if c.estado = 'anulado' then return; end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'Indique el motivo de la anulación' using errcode = '22023'; end if;
  update public.pes_controles set estado = 'anulado', nota = left(concat_ws(' · ', nota, 'Anulado: ' || btrim(p_motivo)), 2000), cerrado_por = auth.uid(), cerrado_at = now()
    where id = p_control;
  perform public.pes_log(c.practica_id, c.user_id, null, 'control_anulado', jsonb_build_object('control', c.id, 'motivo', left(btrim(p_motivo), 300), 'por', auth.uid()));
end $$;

create or replace function public.pes_controles_lista(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'nombre', pr.full_name, 'ejercicio', e.posicion, 'estado', c.estado,
      'resultado', c.resultado, 'nota', c.nota, 'semilla', c.semilla, 'preparado_at', c.preparado_at, 'cerrado_at', c.cerrado_at) order by c.preparado_at desc)
    from public.pes_controles c join public.profiles pr on pr.id = c.user_id join public.pes_ejercicios e on e.id = c.ejercicio_id
    where c.practica_id = p_practica), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['pes_monitor(uuid)', 'pes_historial(uuid, uuid)', 'pes_calibrar(uuid, numeric, text, text)', 'pes_calibracion_borrar(uuid)',
    'pes_informe_tiempos(uuid)', 'pes_aplicar_calibracion(uuid)', 'pes_piloto_resumen(uuid)', 'pes_piloto_iniciar(uuid)', 'pes_piloto_reiniciar(uuid)',
    'pes_piloto_adelantar(uuid, integer)', 'pes_piloto_detalle(uuid)', 'pes_politica_control(uuid, jsonb)', 'pes_control_preparar(uuid, uuid, uuid)',
    'pes_control_registrar(uuid, numeric, text)', 'pes_control_anular(uuid, text)', 'pes_controles_lista(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
