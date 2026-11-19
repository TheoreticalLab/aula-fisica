-- Maratón: jornadas a elegir dentro de un plazo (pedido del profesor, 18-nov-2026, para Física General 1-A).
--
-- Nueva clave opcional de la configuración: programacion.requeridas (entero). Si falta o es null, TODO funciona como
-- antes (un maratón como el de FG1 no cambia). Si vale R, las «jornadas» de la programación son los DÍAS del plazo
-- (por ejemplo, 5 días consecutivos) y el estudiante debe completar R de ellos (por ejemplo, 3), los días que elija:
--   · cada día abre una jornada; el estudiante hace como máximo una por día (la del día);
--   · un día sin jornada no incumple la continuidad;
--   · una jornada empezada y no completada al cierre del día sí la incumple (queda fuera, como en FG1; el profesor
--     puede reincorporarlo);
--   · al cumplir las R jornadas el maratón termina para ese estudiante (no se abren más);
--   · si termina el plazo sin haber completado R, queda fuera por continuidad.
-- Al estudiante se le numeran sus propias jornadas (1.ª, 2.ª, 3.ª de R); los informes del profesor siguen por día.
-- Funciones nuevas: maraton_requeridas, maraton_hoy_insc, maraton_continuidad_falla (internas).
-- Funciones copiadas con cambios acotados (cada cambio solo actúa si requeridas no es null): maraton_jornada_activa,
-- maraton_estado_json, maraton_mis_maratones, maraton_resumen. Validación de la clave: disparador en maraton_actividades.
-- Aditiva: sin tablas ni columnas nuevas, sin tocar datos.

create or replace function public.maraton_requeridas(p_m public.maraton_actividades) returns integer
language sql stable set search_path = '' as $$
  select (public.maraton_cfg(p_m.config) -> 'programacion' ->> 'requeridas')::int
$$;

-- «Hoy» visto por un estudiante: igual que maraton_hoy, salvo con jornadas a elegir, donde añade el día del plazo
-- ('dia'), numera la jornada del estudiante ('numero' = 1.ª, 2.ª…) y da por terminado el maratón al cumplir las requeridas.
create or replace function public.maraton_hoy_insc(p_m public.maraton_actividades, p_insc uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h jsonb := public.maraton_hoy(p_m); v_req integer := public.maraton_requeridas(p_m); i public.maraton_inscripciones;
  j public.maraton_jornadas; v_ok integer; v_tot integer;
begin
  if v_req is null or p_insc is null then return h; end if;
  select * into i from public.maraton_inscripciones where id = p_insc;
  if i.id is null or i.prueba then return h; end if;
  select count(*) filter (where estado in ('completada', 'justificada', 'cerrada_limite')), count(*) into v_ok, v_tot
    from public.maraton_jornadas where inscripcion_id = p_insc;
  if h ->> 'numero' is not null then
    select * into j from public.maraton_jornadas where inscripcion_id = p_insc and numero = (h ->> 'numero')::int;
  end if;
  if v_ok >= v_req and (j.id is null or j.estado <> 'en_curso') then
    return jsonb_build_object('fase', 'finalizado', 'terminado', true, 'requeridas', v_req, 'completadas', v_ok);
  end if;
  if h ->> 'numero' is null then return h || jsonb_build_object('requeridas', v_req, 'completadas', v_ok); end if;
  return h || jsonb_build_object('dia', (h ->> 'numero')::int,
    'numero', case when j.id is not null
                then (select count(*)::int from public.maraton_jornadas x where x.inscripcion_id = p_insc and x.numero <= j.numero)
                else v_tot + 1 end,
    'requeridas', v_req, 'completadas', v_ok);
end $$;

-- Continuidad con jornadas a elegir: null si no hay incumplimiento; si lo hay, el día ('dia'), la jornada (id y número
-- propio) y el motivo. Con requeridas null devuelve null (la continuidad ordinaria sigue en maraton_jornada_activa).
create or replace function public.maraton_continuidad_falla(p_m public.maraton_actividades, p_insc uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); n integer := (c -> 'programacion' ->> 'jornadas')::int;
  v_req integer := public.maraton_requeridas(p_m); v_gracia integer := coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120);
  k integer; cal jsonb; j public.maraton_jornadas; v_ok integer; v_ord integer;
begin
  if v_req is null or p_insc is null then return null; end if;
  for k in 1 .. n loop
    cal := public.maraton_calendario(p_m, k);
    exit when cal is null or now() <= (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia);
    j := null;
    select * into j from public.maraton_jornadas where inscripcion_id = p_insc and numero = k;
    if j.id is not null and j.estado not in ('completada', 'justificada', 'cerrada_limite')
       and (j.reabierta_hasta is null or j.reabierta_hasta < now()) then
      select count(*)::int into v_ord from public.maraton_jornadas x where x.inscripcion_id = p_insc and x.numero <= k;
      return jsonb_build_object('dia', k, 'jornada_id', j.id, 'numero', v_ord,
        'motivo', format('No completó la jornada %s (quedó %s)', v_ord, j.estado));
    end if;
  end loop;
  cal := public.maraton_calendario(p_m, n);
  if cal is not null and now() > (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia) then
    select count(*) into v_ok from public.maraton_jornadas
     where inscripcion_id = p_insc and (estado in ('completada', 'justificada', 'cerrada_limite') or reabierta_hasta >= now());
    if v_ok < v_req then
      return jsonb_build_object('dia', n, 'jornada_id', null, 'numero', null,
        'motivo', format('Completó %s de las %s jornadas requeridas dentro del plazo', v_ok, v_req));
    end if;
  end if;
  return null;
end $$;

-- La clave nueva se valida al guardar el maratón (entero entre 1 y el número de días de la programación)
create or replace function public.maraton_requeridas_valida() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb := new.config -> 'programacion' -> 'requeridas'; v integer; n integer;
begin
  if r is null or r = 'null'::jsonb then return new; end if;
  begin
    v := (r #>> '{}')::int;
  exception when others then
    raise exception 'Las jornadas requeridas deben ser un número entero' using errcode = 'P0001';
  end;
  n := (public.maraton_cfg(new.config) -> 'programacion' ->> 'jornadas')::int;
  if v < 1 or v > n then
    raise exception 'Las jornadas requeridas deben estar entre 1 y %', n using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists maraton_requeridas_valida on public.maraton_actividades;
create trigger maraton_requeridas_valida before insert or update of config on public.maraton_actividades
  for each row execute function public.maraton_requeridas_valida();

-- maraton_jornada_activa (copia de 20261116300000_maraton_permanencia.sql + jornadas a elegir)
create or replace function public.maraton_jornada_activa(p_m public.maraton_actividades, p_insc public.maraton_inscripciones, p_crear boolean)
returns public.maraton_jornadas language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); v_gracia integer := coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120);
  n integer := (c -> 'programacion' ->> 'jornadas')::int; j public.maraton_jornadas; cal jsonb; h jsonb; v_num integer; v_k integer;
  v_req integer := public.maraton_requeridas(p_m); v_ok integer; v_falla jsonb;
begin
  -- 1) jornadas en curso cuyo plazo terminó (y no están reabiertas) → incompletas
  if not p_insc.prueba then
    for j in select * from public.maraton_jornadas where inscripcion_id = p_insc.id and estado = 'en_curso' loop
      cal := public.maraton_calendario(p_m, j.numero);
      if (j.reabierta_hasta is null or j.reabierta_hasta < now())
         and (cal is null or now() > (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia)) then
        perform public.maraton_cerrar_jornada(p_insc.id, j.id, 'incompleta', 'Terminó el plazo de la jornada sin cumplir los requisitos');
      end if;
    end loop;
  end if;
  -- permanencia (migración 98): continuidad. Toda jornada cuyo plazo ya terminó debe estar completada, justificada o
  -- cerrada para revisión; si falta o quedó incompleta (y no está reabierta), el estudiante queda fuera del maratón
  if not p_insc.prueba and coalesce((c -> 'permanencia' ->> 'fuera_por_continuidad')::boolean, false)
     and not exists (select 1 from public.maraton_inscripciones where id = p_insc.id and fuera_at is not null) then
    if v_req is null then
    for v_k in 1 .. n loop
      cal := public.maraton_calendario(p_m, v_k);
      exit when cal is null or now() <= (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia);
      select * into j from public.maraton_jornadas where inscripcion_id = p_insc.id and numero = v_k;
      if j.id is null or (j.estado not in ('completada', 'justificada', 'cerrada_limite') and (j.reabierta_hasta is null or j.reabierta_hasta < now())) then
        perform public.maraton_fuera(p_insc.id, j.id, 'continuidad',
          format('No completó la jornada %s (%s)', v_k, case when j.id is null then 'no la inició' else 'quedó ' || j.estado end), v_k);
        exit;
      end if;
    end loop;
    else
      -- jornadas a elegir (migración 106): un día sin jornada no incumple; sí una jornada empezada y no completada,
      -- y no llegar a las requeridas cuando termina el plazo del maratón
      v_falla := public.maraton_continuidad_falla(p_m, p_insc.id);
      if v_falla is not null then
        perform public.maraton_fuera(p_insc.id, (v_falla ->> 'jornada_id')::uuid, 'continuidad', v_falla ->> 'motivo', (v_falla ->> 'numero')::int);
      end if;
    end if;
  end if;
  -- fuera del maratón: no hay jornada en la que trabajar (el profesor puede reincorporarlo)
  if exists (select 1 from public.maraton_inscripciones where id = p_insc.id and fuera_at is not null) then return null; end if;
  -- 2) reapertura administrativa vigente (tiene prioridad)
  select * into j from public.maraton_jornadas
   where inscripcion_id = p_insc.id and reabierta_hasta >= now() and estado in ('pendiente', 'en_curso', 'incompleta', 'justificada')
   order by numero limit 1;
  if j.id is not null then
    if j.estado <> 'en_curso' and p_crear then
      update public.maraton_jornadas set estado = 'en_curso', iniciada_at = coalesce(iniciada_at, now()), cerrada_at = null
       where id = j.id returning * into j;
      perform public.maraton_log(p_m.id, p_insc.user_id, j.numero, 'jornada_reanudada_por_reapertura', '{}', p_insc.user_id);
    end if;
    return j;
  end if;
  -- 3) recorrido de prueba del profesor: jornadas seguidas sin esperar al calendario
  if p_insc.prueba then
    select * into j from public.maraton_jornadas where inscripcion_id = p_insc.id order by numero desc limit 1;
    if j.id is not null and j.estado = 'en_curso' then return j; end if;
    v_num := coalesce(j.numero, 0) + 1;
    if p_crear and v_num <= n then
      insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, iniciada_at)
      values (p_insc.id, p_m.id, v_num, (now() at time zone (c -> 'programacion' ->> 'zona'))::date, now()) returning * into j;
    end if;
    return j;
  end if;
  -- jornadas a elegir (migración 106): con las requeridas ya cumplidas no se abre otra
  if v_req is not null then
    select count(*) into v_ok from public.maraton_jornadas
     where inscripcion_id = p_insc.id and estado in ('completada', 'justificada', 'cerrada_limite');
    if v_ok >= v_req then return null; end if;
  end if;
  -- 4) la jornada de hoy
  h := public.maraton_hoy(p_m);
  if h ->> 'numero' is null then return null; end if;
  select * into j from public.maraton_jornadas where inscripcion_id = p_insc.id and numero = (h ->> 'numero')::int;
  if j.id is null and p_crear and h ->> 'fase' = 'abierta' then
    insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, iniciada_at)
    values (p_insc.id, p_m.id, (h ->> 'numero')::int, (h ->> 'fecha')::date, now())
    on conflict (inscripcion_id, numero) do nothing returning * into j;
    if j.id is not null then
      perform public.maraton_log(p_m.id, p_insc.user_id, j.numero, 'jornada_iniciada', '{}', p_insc.user_id);
      if c -> 'dificultad' ->> 'nivel_al_iniciar_jornada' = 'inicial' then
        update public.maraton_inscripciones set nivel = (c -> 'dificultad' ->> 'nivel_inicial')::int where id = p_insc.id;
      end if;
    end if;
  end if;
  return j;
end $$;

-- maraton_estado_json (copia de 20261117100000_maraton_progresion_avanzada.sql + numeración propia y fin personal)
create or replace function public.maraton_estado_json(p_m public.maraton_actividades, p_insc uuid, p_aviso text default null, p_ultimo jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; j public.maraton_jornadas; x public.maraton_presentaciones;
  v_var public.maraton_variantes; h jsonb := public.maraton_hoy_insc(p_m, p_insc); v_total integer := (c -> 'comodines' ->> 'total')::int;
  v_pj integer; v_disp integer; v_problema jsonb; v_jornada jsonb; v_curso text; v_req integer := public.maraton_requeridas(p_m);
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  select title into v_curso from public.courses where id = (select course_id from public.classes where id = p_m.class_id);
  if i.id is not null then
    if i.presentacion_actual is not null then
      select * into x from public.maraton_presentaciones where id = i.presentacion_actual;
      select * into j from public.maraton_jornadas where id = x.jornada_id;
    else
      select * into j from public.maraton_jornadas where inscripcion_id = i.id
       order by (estado = 'en_curso') desc, (reabierta_hasta >= now()) desc nulls last,
                (numero = coalesce((h ->> 'dia')::int, (h ->> 'numero')::int, -1)) desc, numero desc limit 1;
    end if;
  end if;
  v_disp := greatest(0, v_total - coalesce(i.comodines_usados, 0));
  v_pj := (c -> 'comodines' ->> 'por_jornada')::int;
  if v_pj is not null and j.id is not null then v_disp := least(v_disp, greatest(0, v_pj - j.cambios)); end if;
  if x.id is not null then
    select * into v_var from public.maraton_variantes where id = x.variante_id;
    -- problema por etapas (migración 99): contexto, etapas ya entregadas (con lo que respondió, sin decir si acertó) y la
    -- etapa actual. Nunca se envía el número total de etapas, el nivel ni si es una comprobación.
    v_problema := jsonb_build_object('presentacion_id', x.id, 'presentada_at', x.presentada_at, 'numero', j.presentados,
      'etapa', x.etapa_actual, 'contexto', v_var.enunciado,
      'actual', case when x.etapa_actual > 1 then (select e.enunciado from public.maraton_etapas e where e.variante_id = x.variante_id and e.numero = x.etapa_actual) end,
      'previas', (select coalesce(jsonb_agg(jsonb_build_object('etapa', r.etapa, 'enunciado', e.enunciado,
                    'partes', (select jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', p ->> 'unidad'))
                               from jsonb_array_elements(coalesce(e.partes, v_var.partes)) p),
                    'respuesta', r.respuesta -> 'partes') order by r.etapa), '[]')
                  from public.maraton_respuestas_etapa r
                  left join public.maraton_etapas e on e.variante_id = x.variante_id and e.numero = r.etapa
                 where r.presentacion_id = x.id),
      -- compatibilidad: el texto completo hasta la etapa actual y las casillas de la etapa actual
      'enunciado', v_var.enunciado || coalesce((select string_agg(E'\n\n**Etapa ' || e.numero || '.** ' || e.enunciado, '' order by e.numero)
                                                 from public.maraton_etapas e where e.variante_id = x.variante_id and e.numero between 2 and x.etapa_actual), ''),
      'partes', (select jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', p ->> 'unidad'))
                 from jsonb_array_elements(case when x.etapa_actual = 1 then v_var.partes
                   else (select e.partes from public.maraton_etapas e where e.variante_id = x.variante_id and e.numero = x.etapa_actual) end) p));
  end if;
  if j.id is not null then
    -- jornadas a elegir (migración 106): al estudiante se le numeran sus propias jornadas (1.ª, 2.ª, …), no los días
    v_jornada := jsonb_build_object('numero', case when v_req is null then j.numero
        else (select count(*)::int from public.maraton_jornadas jj where jj.inscripcion_id = j.inscripcion_id and jj.numero <= j.numero) end,
      'fecha', j.fecha,
      'estado', case j.estado when 'pendiente' then 'sin_iniciar' when 'cerrada_limite' then 'cerrada' else j.estado end,
      'respondidos', j.intentos_validos, 'minutos', floor(j.segundos / 60), 'segundos', j.segundos,
      'reabierta_hasta', case when j.reabierta_hasta >= now() then j.reabierta_hasta end,
      'cierra', coalesce(case when j.reabierta_hasta >= now() then j.reabierta_hasta end, (public.maraton_calendario(p_m, j.numero) ->> 'cierra')::timestamptz));
  end if;
  return jsonb_build_object(
    'maraton', jsonb_build_object('id', p_m.id, 'titulo', p_m.titulo, 'asignatura', v_curso, 'descripcion', p_m.descripcion,
       'instrucciones', p_m.instrucciones, 'jornadas', coalesce(v_req, (c -> 'programacion' ->> 'jornadas')::int),
       'dias', case when v_req is not null then (c -> 'programacion' ->> 'jornadas')::int end, 'fecha_inicio', p_m.fecha_inicio,
       'zona', c -> 'programacion' ->> 'zona', 'apertura', c -> 'programacion' ->> 'apertura', 'cierre', c -> 'programacion' ->> 'cierre',
       'tiempo_orientativo', jsonb_build_array((c -> 'carga' ->> 'objetivo_min')::int, (c -> 'carga' ->> 'objetivo_max')::int),
       'limite_minutos', (c -> 'carga' ->> 'limite_minutos')::int,
       'comodines_total', v_total, 'comodines_por_jornada', v_pj, 'no_puedo', (c -> 'comodines' ->> 'no_puedo')::boolean,
       'estado', p_m.estado,
       -- reglas de permanencia que el estudiante debe conocer (migración 98); sin niveles ni parámetros internos
       'permanencia', jsonb_build_object('min_correctas', coalesce((c -> 'permanencia' ->> 'min_correctas')::int, 0),
         'presentados_max', case when (c -> 'permanencia' ->> 'fuera_por_presentados')::boolean then (c -> 'carga' ->> 'presentados_max')::int end,
         'continuidad', coalesce((c -> 'permanencia' ->> 'fuera_por_continuidad')::boolean, false),
         'rapido_segundos', case when coalesce(c -> 'permanencia' -> 'fuera_rapido_nivel', 'null'::jsonb) <> 'null'::jsonb
                                 then (c -> 'permanencia' ->> 'fuera_rapido_segundos')::int end)),
    'prueba', coalesce(i.prueba, false),
    'hoy', h,
    'finalizado', public.maraton_finalizado(p_m) or coalesce((h ->> 'terminado')::boolean, false),
    'aceptado', i.aceptado_at is not null,
    'jornada', v_jornada,
    'comodines_disponibles', v_disp,
    'problema', v_problema,
    'aviso', p_aviso,
    'ultimo', case when c -> 'seguridad' ->> 'retroalimentacion' = 'correcto_incorrecto' then p_ultimo end,
    'informe_disponible', public.maraton_informe_visible(p_m),
    'fuera', case when i.fuera_at is not null then jsonb_build_object('tipo', i.fuera_tipo, 'jornada', i.fuera_jornada, 'desde', i.fuera_at) end);
end $$;

-- maraton_mis_maratones (copia de 20261114160000_maraton_adaptativo.sql + estado personal del día)
create or replace function public.maraton_mis_maratones() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'descripcion', m.descripcion,
      'asignatura', co.title, 'jornadas', coalesce(public.maraton_requeridas(m), (public.maraton_cfg(m.config) -> 'programacion' ->> 'jornadas')::int),
      'fecha_inicio', m.fecha_inicio, 'hoy', public.maraton_hoy_insc(m, i.id),
      'finalizado', public.maraton_finalizado(m) or coalesce((public.maraton_hoy_insc(m, i.id) ->> 'terminado')::boolean, false),
      'aceptado', i.aceptado_at is not null,
      'jornada_hoy', (select case j.estado when 'cerrada_limite' then 'cerrada' when 'pendiente' then 'sin_iniciar' else j.estado end
                        from public.maraton_jornadas j where j.inscripcion_id = i.id and j.numero = coalesce((public.maraton_hoy_insc(m, i.id) ->> 'dia')::int, (public.maraton_hoy(m) ->> 'numero')::int)),
      'informe_disponible', public.maraton_informe_visible(m)) order by m.fecha_inicio), '[]'::jsonb)
  from public.maraton_actividades m
  join public.enrollments e on e.class_id = m.class_id and e.user_id = auth.uid() and (m.group_id is null or m.group_id = e.group_id)
  join public.classes cl on cl.id = m.class_id
  join public.courses co on co.id = cl.course_id
  left join public.maraton_inscripciones i on i.maraton_id = m.id and i.user_id = auth.uid()
  where m.estado = 'publicado' and public.account_ok(auth.uid())
$$;

-- maraton_resumen (copia de 20261116300000_maraton_permanencia.sql + continuidad con jornadas a elegir)
create or replace function public.maraton_resumen(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); c jsonb := public.maraton_cfg(m.config);
  n integer := (c -> 'programacion' ->> 'jornadas')::int;
begin
  return jsonb_build_object(
    'maraton', public.maraton_json_docente(m),
    'calendario', (select jsonb_agg(public.maraton_calendario(m, k) order by k) from generate_series(1, n) k),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'nombre', pr.full_name, 'login_id', pr.login_id,
        'matriculado', u.matriculado, 'participa', i.id is not null, 'nivel_actual', i.nivel, 'comodines_usados', i.comodines_usados,
        'aceptado_at', i.aceptado_at,
        'fuera', case when i.fuera_at is not null then jsonb_build_object('tipo', i.fuera_tipo, 'motivo', i.fuera_motivo, 'jornada', i.fuera_jornada, 'desde', i.fuera_at) end,
        -- jornada pasada que incumple la continuidad y aún no se aplicó (se aplica cuando el estudiante vuelve a entrar)
        'continuidad_pendiente', case when i.id is not null and i.fuera_at is null and coalesce((c -> 'permanencia' ->> 'fuera_por_continuidad')::boolean, false) then
          case when public.maraton_requeridas(m) is not null then (public.maraton_continuidad_falla(m, i.id) ->> 'dia')::int else
          (select min(k) from generate_series(1, n) k
            where now() > (public.maraton_calendario(m, k) ->> 'cierra')::timestamptz + make_interval(secs => coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120))
              and not exists (select 1 from public.maraton_jornadas jj where jj.inscripcion_id = i.id and jj.numero = k
                                and (jj.estado in ('completada', 'justificada', 'cerrada_limite') or jj.reabierta_hasta >= now()))) end end,
        'resumen', case when i.id is not null then public.maraton_resumen_inscripcion(i.id) end) order by pr.full_name), '[]')
      from (select e.user_id as id, true as matriculado from public.enrollments e
             where e.class_id = m.class_id and (m.group_id is null or m.group_id = e.group_id)
               and not exists (select 1 from public.profiles p2 where p2.id = e.user_id and p2.role <> 'student')
            union
            select ii.user_id, false from public.maraton_inscripciones ii
             where ii.maraton_id = m.id and not ii.prueba
               and not exists (select 1 from public.enrollments e2 where e2.class_id = m.class_id and e2.user_id = ii.user_id)) u
      join public.profiles pr on pr.id = u.id
      left join public.maraton_inscripciones i on i.maraton_id = m.id and i.user_id = u.id and not i.prueba
      where not public.fuera_de_seccion(m.class_id, u.id)));
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer)
  foreach f in array array['maraton_requeridas(public.maraton_actividades)', 'maraton_hoy_insc(public.maraton_actividades, uuid)',
    'maraton_continuidad_falla(public.maraton_actividades, uuid)', 'maraton_requeridas_valida()',
    'maraton_jornada_activa(public.maraton_actividades, public.maraton_inscripciones, boolean)',
    'maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamables con sesión (como antes)
  foreach f in array array['maraton_mis_maratones()', 'maraton_resumen(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
