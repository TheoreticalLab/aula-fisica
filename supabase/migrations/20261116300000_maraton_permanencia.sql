-- Maratón adaptativo: reglas de permanencia (decisión del profesor, 16-nov-2026).
--
-- Hasta ahora nada sacaba a un estudiante del maratón: cada jornada quedaba registrada (completada, cerrada para
-- revisión o incompleta) y podía seguir al día siguiente. Reglas nuevas, configurables por maratón (sección
-- «permanencia» de la configuración):
--   min_correctas (5): mínimo de ejercicios bien resueltos por jornada. Es requisito para completarla (por la cuota o por
--     la vía alternativa) y, en cuanto ya no puede alcanzarlo con los problemas e intentos que le quedan (p. ej., 26
--     presentados sin acierto con un máximo de 30), el estudiante queda fuera del maratón.
--   fuera_por_presentados (sí): llegar al máximo de problemas presentados sin completar la jornada deja fuera.
--   fuera_por_continuidad (sí): una jornada cuyo plazo terminó sin completarse (o que no inició) deja fuera, salvo que
--     esté justificada, cerrada para revisión o reabierta por el profesor.
--   fuera_rapido_nivel / fuera_rapido_segundos (6 / 60): resolver correctamente un problema de ese nivel o superior en
--     menos de esos segundos (reloj del servidor) deja fuera. null en el nivel desactiva la regla.
-- Llegar a 18 intentos o a 90 min sigue como antes: cierre seguro para revisión del profesor.
-- «Fuera» se guarda en la inscripción (fuera_at, fuera_tipo, fuera_motivo, fuera_jornada); la jornada en curso se cierra
-- como incompleta y no se abren las siguientes. El profesor puede reincorporarlo con un motivo (maraton_reincorporar):
-- se justifican las jornadas que lo dejaron fuera, queda nota e historial, y puede además reabrir la del día.
-- El estudiante ve las reglas antes de empezar y un aviso genérico (sin niveles ni parámetros internos).
--
-- Cada función redefinida es copia exacta de su versión vigente con solo el cambio señalado (generada por script).

alter table public.maraton_inscripciones add column if not exists fuera_at timestamptz;
alter table public.maraton_inscripciones add column if not exists fuera_tipo text;     -- aciertos | presentados | continuidad | rapidez
alter table public.maraton_inscripciones add column if not exists fuera_motivo text;   -- detalle para el profesor
alter table public.maraton_inscripciones add column if not exists fuera_jornada smallint;

-- Deja al estudiante fuera del maratón (idempotente): lo anota en la inscripción, cierra la jornada en curso como
-- incompleta y lo registra en el historial
create or replace function public.maraton_fuera(p_insc uuid, p_jornada uuid, p_tipo text, p_motivo text, p_numero integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.maraton_inscripciones; j public.maraton_jornadas;
begin
  select * into i from public.maraton_inscripciones where id = p_insc for update;
  if i.id is null or i.fuera_at is not null then return; end if;
  select * into j from public.maraton_jornadas where id = p_jornada;
  update public.maraton_inscripciones set fuera_at = now(), fuera_tipo = p_tipo, fuera_motivo = left(p_motivo, 1000),
         fuera_jornada = coalesce(j.numero, p_numero), updated_at = now()
   where id = p_insc;
  if j.estado = 'en_curso' then perform public.maraton_cerrar_jornada(p_insc, p_jornada, 'incompleta', 'Fuera del maratón: ' || p_motivo); end if;
  perform public.maraton_log(i.maraton_id, i.user_id, coalesce(j.numero, p_numero), 'fuera_del_maraton',
    jsonb_build_object('tipo', p_tipo, 'motivo', p_motivo), i.user_id);
end $$;

create or replace function public.maraton_defaults() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "programacion": {"jornadas": 14, "modo": "consecutivas", "calendario": [], "hora_inicio": "00:00",
                     "apertura": "00:00", "cierre": "23:59", "zona": "America/Santo_Domingo"},
    "carga": {"cuota": 12, "alternativa_activa": true, "alternativa_minutos": 60, "alternativa_intentos": 8,
              "objetivo_min": 60, "objetivo_max": 75, "limite_minutos": 90, "intentos_max": 18, "presentados_max": 30,
              "fraccion_fallo": 0.5, "minutos_minimos": 30},
    "permanencia": {"min_correctas": 5, "fuera_por_presentados": true, "fuera_por_continuidad": true,
                    "fuera_rapido_nivel": 6, "fuera_rapido_segundos": 60},
    "dificultad": {"niveles": 6, "nivel_inicial": 2, "adaptativa": true, "pesos": [1.00, 1.20, 1.40, 1.50, 1.00, 1.00],
                   "ascenso": 1, "descenso": 1, "descenso_no_puedo": 1, "nivel_al_iniciar_jornada": "continuar",
                   "t_min_factor": 1.0, "t_min_nivel_s": null},
    "comodines": {"total": 10, "por_jornada": null, "no_puedo": true},
    "contenido": {"temas": null, "excluir_plantillas": [], "distribucion": {}},
    "informes": {"estudiante": true, "docente": true, "publicacion_estudiante": null,
                 "exportaciones": ["pdf", "csv", "xlsx"], "indicadores": true},
    "seguridad": {"retroalimentacion": "ninguna", "gracia_s": 120, "reanudacion": true}
  }'::jsonb
$$;

create or replace function public.maraton_config_errores(p_config jsonb) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  c jsonb := public.maraton_cfg(p_config);
  pr jsonb := c -> 'programacion'; ca jsonb := c -> 'carga'; di jsonb := c -> 'dificultad';
  co jsonb := c -> 'comodines'; pe jsonb := c -> 'permanencia'; inf jsonb := c -> 'informes'; se jsonb := c -> 'seguridad'; ct jsonb := c -> 'contenido';
  e text[] := '{}'; n integer; i integer; d date; prev date; x numeric;
begin
  begin
    n := (pr ->> 'jornadas')::int;
    if n is null or n < 1 or n > 60 then e := array_append(e, 'El número de jornadas debe estar entre 1 y 60.'); end if;
    if coalesce(pr ->> 'modo', '') not in ('consecutivas', 'calendario') then e := array_append(e, 'El tipo de calendario no es válido.'); end if;
    if pr ->> 'modo' = 'calendario' then
      if jsonb_typeof(pr -> 'calendario') is distinct from 'array' or jsonb_array_length(pr -> 'calendario') <> n then
        e := array_append(e, 'El calendario personalizado debe tener exactamente una fecha por jornada.');
      else
        for i in 0 .. n - 1 loop
          d := (pr -> 'calendario' ->> i)::date;
          if prev is not null and d <= prev then e := array_append(e, 'Las fechas del calendario deben ser crecientes y distintas.'); exit; end if;
          prev := d;
        end loop;
      end if;
    end if;
    if (pr ->> 'apertura')::time >= (pr ->> 'cierre')::time then e := array_append(e, 'La hora de apertura debe ser anterior a la hora límite.'); end if;
    perform (pr ->> 'hora_inicio')::time;
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = pr ->> 'zona') then e := array_append(e, 'Zona horaria desconocida.'); end if;
  exception when others then e := array_append(e, 'Programación no válida (fechas u horas mal escritas).');
  end;
  begin
    x := (ca ->> 'cuota')::numeric;
    if x is null or x <= 0 or x > 100 then e := array_append(e, 'La cuota diaria debe estar entre 0 y 100 unidades.'); end if;
    if jsonb_typeof(ca -> 'alternativa_activa') <> 'boolean' then e := array_append(e, 'Indique si la finalización alternativa está activa.'); end if;
    if (ca ->> 'alternativa_minutos')::numeric not between 1 and 600 then e := array_append(e, 'Los minutos de la finalización alternativa deben estar entre 1 y 600.'); end if;
    if (ca ->> 'alternativa_intentos')::int not between 1 and 100 then e := array_append(e, 'Los intentos de la finalización alternativa deben estar entre 1 y 100.'); end if;
    if (ca ->> 'limite_minutos')::numeric not between 5 and 600 then e := array_append(e, 'El límite máximo de la jornada debe estar entre 5 y 600 minutos.'); end if;
    if (ca ->> 'intentos_max')::int not between 1 and 200 then e := array_append(e, 'El máximo de intentos válidos debe estar entre 1 y 200.'); end if;
    if (ca ->> 'presentados_max')::int < (ca ->> 'intentos_max')::int then e := array_append(e, 'El máximo de problemas presentados no puede ser menor que el máximo de intentos.'); end if;
    if (ca ->> 'objetivo_min')::numeric > (ca ->> 'objetivo_max')::numeric then e := array_append(e, 'El tiempo objetivo mínimo supera al máximo.'); end if;
    if (ca ->> 'alternativa_activa')::boolean and (ca ->> 'alternativa_intentos')::int > (ca ->> 'intentos_max')::int then
      e := array_append(e, 'La finalización alternativa pide más intentos que el máximo permitido.'); end if;
    if (ca ->> 'fraccion_fallo')::numeric not between 0 and 1 then e := array_append(e, 'La fracción de unidades de una respuesta incorrecta debe estar entre 0 y 1.'); end if;
    if (ca ->> 'minutos_minimos')::numeric not between 0 and 600 then e := array_append(e, 'El tiempo mínimo de la jornada debe estar entre 0 y 600 minutos.'); end if;
    if (ca ->> 'minutos_minimos')::numeric > (ca ->> 'limite_minutos')::numeric then
      e := array_append(e, 'El tiempo mínimo de la jornada supera el límite máximo: nunca se completaría por la cuota.'); end if;
  exception when others then e := array_append(e, 'Carga académica no válida.');
  end;
  begin
    n := (di ->> 'niveles')::int;
    if n not between 2 and 6 then e := array_append(e, 'El número de niveles debe estar entre 2 y 6.'); end if;
    if (di ->> 'nivel_inicial')::int not between 1 and n then e := array_append(e, 'El nivel inicial debe estar entre 1 y el número de niveles.'); end if;
    if jsonb_typeof(di -> 'adaptativa') <> 'boolean' then e := array_append(e, 'Indique si la adaptación está activa.'); end if;
    if jsonb_typeof(di -> 'pesos') <> 'array' or jsonb_array_length(di -> 'pesos') <> 6 then e := array_append(e, 'Debe haber una ponderación por cada uno de los seis niveles.');
    else
      for i in 0 .. 5 loop
        if (di -> 'pesos' ->> i)::numeric not between 0.1 and 10 then e := array_append(e, 'Cada ponderación debe estar entre 0.1 y 10.'); exit; end if;
      end loop;
    end if;
    if (di ->> 'ascenso')::int not between 0 and 3 or (di ->> 'descenso')::int not between 0 and 3 or (di ->> 'descenso_no_puedo')::int not between 0 and 3 then
      e := array_append(e, 'Los saltos de ascenso y descenso deben estar entre 0 y 3 niveles.'); end if;
    if coalesce(di ->> 'nivel_al_iniciar_jornada', '') not in ('continuar', 'inicial') then e := array_append(e, 'Regla de nivel al iniciar la jornada no válida.'); end if;
    if (di ->> 't_min_factor')::numeric not between 0.25 and 4 then e := array_append(e, 'El factor de tiempo mínimo debe estar entre 0.25 y 4.'); end if;
    if jsonb_typeof(di -> 't_min_nivel_s') = 'array' then
      if jsonb_array_length(di -> 't_min_nivel_s') <> 6 then e := array_append(e, 'Los tiempos mínimos por nivel deben ser seis.');
      else
        for i in 0 .. 5 loop
          if di -> 't_min_nivel_s' -> i <> 'null'::jsonb and (di -> 't_min_nivel_s' ->> i)::int not between 30 and 3600 then
            e := array_append(e, 'Cada tiempo mínimo por nivel debe estar entre 30 y 3600 s.'); exit; end if;
        end loop;
      end if;
    elsif di -> 't_min_nivel_s' is not null and di -> 't_min_nivel_s' <> 'null'::jsonb then e := array_append(e, 'Tiempos mínimos por nivel no válidos.');
    end if;
  exception when others then e := array_append(e, 'Configuración de dificultad no válida.');
  end;
  begin
    if (pe ->> 'min_correctas')::int not between 0 and 100 then e := array_append(e, 'El mínimo de ejercicios bien resueltos debe estar entre 0 y 100.'); end if;
    if (pe ->> 'min_correctas')::int > least((ca ->> 'intentos_max')::int, (ca ->> 'presentados_max')::int) then
      e := array_append(e, 'El mínimo de ejercicios bien resueltos supera el máximo de intentos o de problemas de la jornada: nadie podría completarla.'); end if;
    if jsonb_typeof(pe -> 'fuera_por_presentados') <> 'boolean' or jsonb_typeof(pe -> 'fuera_por_continuidad') <> 'boolean' then
      e := array_append(e, 'Indique si se aplican las reglas de permanencia (sí o no).'); end if;
    if pe -> 'fuera_rapido_nivel' <> 'null'::jsonb and (pe ->> 'fuera_rapido_nivel')::int not between 1 and 6 then
      e := array_append(e, 'El nivel de la regla de rapidez debe estar entre 1 y 6.'); end if;
    if (pe ->> 'fuera_rapido_segundos')::int not between 1 and 3600 then e := array_append(e, 'Los segundos de la regla de rapidez deben estar entre 1 y 3600.'); end if;
  exception when others then e := array_append(e, 'Reglas de permanencia no válidas.');
  end;
  begin
    if (co ->> 'total')::int not between 0 and 100 then e := array_append(e, 'Los comodines deben estar entre 0 y 100.'); end if;
    if co -> 'por_jornada' <> 'null'::jsonb and (co ->> 'por_jornada')::int not between 0 and 100 then e := array_append(e, 'El límite diario de comodines no es válido.'); end if;
    if jsonb_typeof(co -> 'no_puedo') <> 'boolean' then e := array_append(e, 'Indique si se permite declarar «No puedo resolverlo».'); end if;
  exception when others then e := array_append(e, 'Configuración de comodines no válida.');
  end;
  begin
    if jsonb_typeof(inf -> 'estudiante') <> 'boolean' or jsonb_typeof(inf -> 'docente') <> 'boolean' then e := array_append(e, 'Configuración de informes no válida.'); end if;
    if inf -> 'publicacion_estudiante' <> 'null'::jsonb then perform (inf ->> 'publicacion_estudiante')::date; end if;
  exception when others then e := array_append(e, 'La fecha de publicación del informe no es válida.');
  end;
  begin
    if coalesce(se ->> 'retroalimentacion', '') not in ('ninguna', 'correcto_incorrecto') then e := array_append(e, 'Retroalimentación no válida.'); end if;
    if (se ->> 'gracia_s')::int not between 0 and 600 then e := array_append(e, 'El margen de gracia debe estar entre 0 y 600 s.'); end if;
  exception when others then e := array_append(e, 'Configuración de seguridad no válida.');
  end;
  if ct -> 'temas' <> 'null'::jsonb and jsonb_typeof(ct -> 'temas') <> 'array' then e := array_append(e, 'La selección de temas no es válida.'); end if;
  if jsonb_typeof(ct -> 'excluir_plantillas') <> 'array' then e := array_append(e, 'La lista de exclusiones no es válida.'); end if;
  return e;
end $$;

create or replace function public.maraton_continuar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); ca jsonb := c -> 'carga'; j public.maraton_jornadas; i public.maraton_inscripciones;
  v_motivo text; pe jsonb := c -> 'permanencia'; v_min integer := coalesce((c -> 'permanencia' ->> 'min_correctas')::int, 0);
  x public.maraton_presentaciones;
begin
  select * into j from public.maraton_jornadas where id = p_jornada;
  select * into i from public.maraton_inscripciones where id = p_insc;
  if j.estado <> 'en_curso' then return; end if;
  -- permanencia (migración 98): resolver bien un problema de nivel alto en muy poco tiempo deja fuera del maratón
  if coalesce(pe -> 'fuera_rapido_nivel', 'null'::jsonb) <> 'null'::jsonb then
    select * into x from public.maraton_presentaciones where jornada_id = p_jornada and cerrada_at is not null order by secuencia desc limit 1;
    if x.accion = 'respuesta' and x.resultado = 'correcta' and x.nivel >= (pe ->> 'fuera_rapido_nivel')::int
       and extract(epoch from x.cerrada_at - x.presentada_at) < (pe ->> 'fuera_rapido_segundos')::numeric then
      perform public.maraton_fuera(p_insc, p_jornada, 'rapidez', format('Resolvió correctamente el problema #%s (D%s) en %s s; la regla exige al menos %s s',
        x.secuencia, x.nivel, round(extract(epoch from x.cerrada_at - x.presentada_at)), pe ->> 'fuera_rapido_segundos'));
      return;
    end if;
  end if;
  -- vía A: la cuota solo completa la jornada tras el tiempo mínimo de trabajo efectivo (migración 97)
  if j.unidades >= (ca ->> 'cuota')::numeric and j.segundos >= coalesce((ca ->> 'minutos_minimos')::numeric, 0) * 60
     and j.correctas >= v_min then   -- y el mínimo de ejercicios bien resueltos (migración 98)
    update public.maraton_jornadas set estado = 'completada', via = 'cuota', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'cuota'), i.user_id);
    return;
  end if;
  if (ca ->> 'alternativa_activa')::boolean and j.segundos >= (ca ->> 'alternativa_minutos')::numeric * 60
     and j.intentos_validos >= (ca ->> 'alternativa_intentos')::int and j.correctas >= v_min then
    update public.maraton_jornadas set estado = 'completada', via = 'alternativa', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'alternativa'), i.user_id);
    return;
  end if;
  -- permanencia (migración 98): si ya no puede llegar al mínimo de aciertos con los problemas e intentos que le quedan,
  -- o si agotó los problemas presentados sin completar la jornada, queda fuera del maratón
  if j.correctas + least((ca ->> 'presentados_max')::int - j.presentados, (ca ->> 'intentos_max')::int - j.intentos_validos) < v_min then
    perform public.maraton_fuera(p_insc, p_jornada, 'aciertos', format('Ya no puede llegar al mínimo de %s ejercicios bien resueltos: lleva %s bien con %s problemas presentados y %s respuestas',
      v_min, j.correctas, j.presentados, j.intentos_validos));
    return;
  end if;
  if coalesce((pe ->> 'fuera_por_presentados')::boolean, false) and j.presentados >= (ca ->> 'presentados_max')::int then
    perform public.maraton_fuera(p_insc, p_jornada, 'presentados', format('Llegó al máximo de %s problemas presentados sin completar la jornada', ca ->> 'presentados_max'));
    return;
  end if;
  v_motivo := case
    when j.segundos >= (ca ->> 'limite_minutos')::numeric * 60 then 'Se alcanzó el límite máximo de tiempo de la jornada'
    when j.intentos_validos >= (ca ->> 'intentos_max')::int then 'Se alcanzó el máximo de intentos válidos de la jornada'
    when j.presentados >= (ca ->> 'presentados_max')::int then 'Se alcanzó el máximo de problemas presentados de la jornada'
  end;
  if v_motivo is not null then
    perform public.maraton_cerrar_jornada(p_insc, p_jornada, 'cerrada_limite', v_motivo);
    return;
  end if;
  if i.presentacion_actual is null then perform public.maraton_presentar(p_m, p_insc, p_jornada); end if;
end $$;

create or replace function public.maraton_jornada_activa(p_m public.maraton_actividades, p_insc public.maraton_inscripciones, p_crear boolean)
returns public.maraton_jornadas language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); v_gracia integer := coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120);
  n integer := (c -> 'programacion' ->> 'jornadas')::int; j public.maraton_jornadas; cal jsonb; h jsonb; v_num integer; v_k integer;
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

create or replace function public.maraton_estado_json(p_m public.maraton_actividades, p_insc uuid, p_aviso text default null, p_ultimo jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; j public.maraton_jornadas; x public.maraton_presentaciones;
  v_var public.maraton_variantes; h jsonb := public.maraton_hoy(p_m); v_total integer := (c -> 'comodines' ->> 'total')::int;
  v_pj integer; v_disp integer; v_problema jsonb; v_jornada jsonb; v_curso text;
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
                (numero = coalesce((h ->> 'numero')::int, -1)) desc, numero desc limit 1;
    end if;
  end if;
  v_disp := greatest(0, v_total - coalesce(i.comodines_usados, 0));
  v_pj := (c -> 'comodines' ->> 'por_jornada')::int;
  if v_pj is not null and j.id is not null then v_disp := least(v_disp, greatest(0, v_pj - j.cambios)); end if;
  if x.id is not null then
    select * into v_var from public.maraton_variantes where id = x.variante_id;
    v_problema := jsonb_build_object('presentacion_id', x.id, 'enunciado', v_var.enunciado,
      'partes', (select jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', p ->> 'unidad')) from jsonb_array_elements(v_var.partes) p),
      'presentada_at', x.presentada_at, 'numero', j.presentados);
  end if;
  if j.id is not null then
    v_jornada := jsonb_build_object('numero', j.numero, 'fecha', j.fecha,
      'estado', case j.estado when 'pendiente' then 'sin_iniciar' when 'cerrada_limite' then 'cerrada' else j.estado end,
      'respondidos', j.intentos_validos, 'minutos', floor(j.segundos / 60), 'segundos', j.segundos,
      'reabierta_hasta', case when j.reabierta_hasta >= now() then j.reabierta_hasta end,
      'cierra', coalesce(case when j.reabierta_hasta >= now() then j.reabierta_hasta end, (public.maraton_calendario(p_m, j.numero) ->> 'cierra')::timestamptz));
  end if;
  return jsonb_build_object(
    'maraton', jsonb_build_object('id', p_m.id, 'titulo', p_m.titulo, 'asignatura', v_curso, 'descripcion', p_m.descripcion,
       'instrucciones', p_m.instrucciones, 'jornadas', (c -> 'programacion' ->> 'jornadas')::int, 'fecha_inicio', p_m.fecha_inicio,
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
    'finalizado', public.maraton_finalizado(p_m),
    'aceptado', i.aceptado_at is not null,
    'jornada', v_jornada,
    'comodines_disponibles', v_disp,
    'problema', v_problema,
    'aviso', p_aviso,
    'ultimo', case when c -> 'seguridad' ->> 'retroalimentacion' = 'correcto_incorrecto' then p_ultimo end,
    'informe_disponible', public.maraton_informe_visible(p_m),
    'fuera', case when i.fuera_at is not null then jsonb_build_object('tipo', i.fuera_tipo, 'jornada', i.fuera_jornada, 'desde', i.fuera_at) end);
end $$;

create or replace function public.maraton_historial(p_maraton uuid, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); i public.maraton_inscripciones;
begin
  select * into i from public.maraton_inscripciones where maraton_id = m.id and user_id = p_user;
  return jsonb_build_object(
    'estudiante', (select jsonb_build_object('user_id', id, 'nombre', full_name, 'login_id', login_id) from public.profiles where id = p_user),
    'inscripcion', case when i.id is not null then jsonb_build_object('nivel', i.nivel, 'comodines_usados', i.comodines_usados, 'aceptado_at', i.aceptado_at,
                     'prueba', i.prueba, 'resumen', public.maraton_resumen_inscripcion(i.id),
                     'fuera', case when i.fuera_at is not null then jsonb_build_object('tipo', i.fuera_tipo, 'motivo', i.fuera_motivo, 'jornada', i.fuera_jornada, 'desde', i.fuera_at) end) end,
    'presentaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'secuencia', x.secuencia, 'jornada', j.numero,
        'variante_id', x.variante_id, 'plantilla_id', x.plantilla_id, 'tema', x.tema, 'subtema', pl.subtema, 'titulo', pl.titulo, 'nivel', x.nivel,
        't_min_s', x.t_min_s, 't_max_s', x.t_max_s, 'peso', x.peso, 'presentada_at', x.presentada_at, 'cerrada_at', x.cerrada_at,
        'accion', x.accion, 'resultado', x.resultado, 'respuesta', x.respuesta, 'procedimiento', x.procedimiento, 'detalle', x.detalle,
        'segundos', x.segundos, 'segundos_cliente', x.segundos_cliente, 'anticipada', x.anticipada, 'unidades', x.unidades,
        'nivel_despues', x.nivel_despues, 'comodines_antes', x.comodines_antes, 'comodines_despues', x.comodines_despues,
        'enunciado', v.enunciado, 'partes', v.partes, 'clave', k.clave) order by x.secuencia), '[]')
      from public.maraton_presentaciones x join public.maraton_jornadas j on j.id = x.jornada_id
      join public.maraton_variantes v on v.id = x.variante_id join public.maraton_plantillas pl on pl.id = x.plantilla_id
      left join public.maraton_claves k on k.variante_id = x.variante_id
      where x.inscripcion_id = i.id),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'jornada', e.jornada, 'datos', e.datos, 'actor', e.actor, 'created_at', e.created_at)
                  order by e.id), '[]') from public.maraton_eventos e where e.maraton_id = m.id and e.user_id = p_user),
    'incidencias', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.maraton_incidencias x
                     where x.maraton_id = m.id and x.user_id = p_user));
end $$;

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
          (select min(k) from generate_series(1, n) k
            where now() > (public.maraton_calendario(m, k) ->> 'cierra')::timestamptz + make_interval(secs => coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120))
              and not exists (select 1 from public.maraton_jornadas jj where jj.inscripcion_id = i.id and jj.numero = k
                                and (jj.estado in ('completada', 'justificada', 'cerrada_limite') or jj.reabierta_hasta >= now()))) end,
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

-- El profesor reincorpora a un estudiante que quedó fuera: justifica las jornadas que lo dejaron fuera (la del día en que
-- salió y las vencidas sin completar), borra la marca y deja nota e historial. Para que rehaga la jornada del día,
-- el profesor puede además reabrirla (incidencia «reapertura»).
create or replace function public.maraton_reincorporar(p_maraton uuid, p_user uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); c jsonb := public.maraton_cfg(m.config);
  n integer := (c -> 'programacion' ->> 'jornadas')::int; v_gracia integer := coalesce((c -> 'seguridad' ->> 'gracia_s')::int, 120);
  i public.maraton_inscripciones; j public.maraton_jornadas; cal jsonb; v_k integer; v_just integer[] := '{}'; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if char_length(v_motivo) < 3 then raise exception 'Escriba el motivo' using errcode = '22023'; end if;
  if m.estado <> 'publicado' then raise exception 'Solo en un maratón publicado' using errcode = 'P0001'; end if;
  select * into i from public.maraton_inscripciones where maraton_id = m.id and user_id = p_user and not prueba for update;
  if i.id is null then raise exception 'El estudiante no ha comenzado este maratón' using errcode = 'P0001'; end if;
  for v_k in 1 .. n loop
    cal := public.maraton_calendario(m, v_k);
    continue when cal is null;
    continue when v_k is distinct from i.fuera_jornada and now() <= (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia);
    select * into j from public.maraton_jornadas where inscripcion_id = i.id and numero = v_k for update;
    continue when j.estado in ('completada', 'justificada', 'cerrada_limite') or j.reabierta_hasta >= now();
    if j.id is null then
      insert into public.maraton_jornadas (inscripcion_id, maraton_id, numero, fecha, estado, cerrada_at)
      values (i.id, m.id, v_k, (cal ->> 'fecha')::date, 'justificada', now());
    elsif j.estado = 'en_curso' then
      perform public.maraton_cerrar_jornada(i.id, j.id, 'justificada', 'Reincorporación: ' || v_motivo);
    else
      update public.maraton_jornadas set estado = 'justificada', reabierta_hasta = null, cerrada_at = coalesce(cerrada_at, now()) where id = j.id;
    end if;
    insert into public.maraton_incidencias (maraton_id, user_id, jornada, tipo, motivo)
    values (m.id, p_user, v_k, 'justificacion', left('Reincorporación al maratón: ' || v_motivo, 2000));
    v_just := v_just || v_k;
  end loop;
  if i.fuera_at is null and cardinality(v_just) = 0 then raise exception 'El estudiante no está fuera del maratón' using errcode = 'P0001'; end if;
  update public.maraton_inscripciones set fuera_at = null, fuera_tipo = null, fuera_motivo = null, fuera_jornada = null, updated_at = now()
   where id = i.id;
  insert into public.maraton_incidencias (maraton_id, user_id, jornada, tipo, motivo)
  values (m.id, p_user, coalesce(i.fuera_jornada, v_just[1], 1), 'nota',
          left('Reincorporación al maratón: ' || v_motivo || ' (estaba fuera: ' || coalesce(i.fuera_motivo, 'continuidad pendiente') || ')', 2000));
  perform public.maraton_log(m.id, p_user, i.fuera_jornada, 'reincorporado',
    jsonb_build_object('motivo', v_motivo, 'estaba', i.fuera_motivo, 'justificadas', to_jsonb(v_just)));
  return public.maraton_historial(p_maraton, p_user);
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer), como en la migración 94
  foreach f in array array['maraton_defaults()', 'maraton_config_errores(jsonb)', 'maraton_continuar(public.maraton_actividades, uuid, uuid)',
    'maraton_jornada_activa(public.maraton_actividades, public.maraton_inscripciones, boolean)',
    'maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)', 'maraton_fuera(uuid, uuid, text, text, integer)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamables con sesión (cada una comprueba que quien llama es profesor de la sección)
  foreach f in array array['maraton_resumen(uuid)', 'maraton_historial(uuid, uuid)', 'maraton_reincorporar(uuid, uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
