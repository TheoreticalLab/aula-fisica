-- Maratón adaptativo: una respuesta incorrecta suma solo una fracción de las unidades y la cuota exige un tiempo
-- mínimo de jornada (decisión del profesor, 16-nov-2026).
--
-- Problema: con la regla de la migración 94 una respuesta incorrecta sumaba las mismas unidades que una correcta y la
-- cuota bastaba para completar la jornada. Fallar a propósito llevaba a D1 (1 unidad, 60 s de tiempo mínimo), de donde
-- fallar ya no baja: escribiendo cualquier cosa y esperando un minuto por ejercicio se completaba la jornada en unos
-- 13 minutos con cero aciertos, más rápido que quien trabaja de verdad en D3–D4 (26–32 min o más).
--
-- Cambios (configurables por maratón en «Carga académica»):
--   carga.fraccion_fallo  (0–1, predeterminado 0,5): fracción de las unidades del nivel que suma una respuesta incorrecta.
--   carga.minutos_minimos (0–600 min, predeterminado 30, ≤ límite máximo): la vía A (cuota) no completa la jornada
--                         antes de ese tiempo de trabajo efectivo; mientras tanto se siguen presentando problemas.
-- La vía alternativa (tiempo + intentos) y los límites de protección no cambian. Fallar rápido ahora termina en el
-- límite de intentos válidos (cierre seguro y revisión docente), no en una jornada completada.
-- Las configuraciones guardadas sin estas claves reciben los valores predeterminados (maraton_cfg combina).
--
-- Cada función es copia exacta de su versión vigente (migración 94) con solo el cambio señalado.

create or replace function public.maraton_defaults() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "programacion": {"jornadas": 14, "modo": "consecutivas", "calendario": [], "hora_inicio": "00:00",
                     "apertura": "00:00", "cierre": "23:59", "zona": "America/Santo_Domingo"},
    "carga": {"cuota": 12, "alternativa_activa": true, "alternativa_minutos": 60, "alternativa_intentos": 8,
              "objetivo_min": 60, "objetivo_max": 75, "limite_minutos": 90, "intentos_max": 18, "presentados_max": 30,
              "fraccion_fallo": 0.5, "minutos_minimos": 30},
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
  co jsonb := c -> 'comodines'; inf jsonb := c -> 'informes'; se jsonb := c -> 'seguridad'; ct jsonb := c -> 'contenido';
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
  v_motivo text;
begin
  select * into j from public.maraton_jornadas where id = p_jornada;
  select * into i from public.maraton_inscripciones where id = p_insc;
  if j.estado <> 'en_curso' then return; end if;
  -- vía A: la cuota solo completa la jornada tras el tiempo mínimo de trabajo efectivo (migración 97)
  if j.unidades >= (ca ->> 'cuota')::numeric and j.segundos >= coalesce((ca ->> 'minutos_minimos')::numeric, 0) * 60 then
    update public.maraton_jornadas set estado = 'completada', via = 'cuota', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'cuota'), i.user_id);
    return;
  end if;
  if (ca ->> 'alternativa_activa')::boolean and j.segundos >= (ca ->> 'alternativa_minutos')::numeric * 60
     and j.intentos_validos >= (ca ->> 'alternativa_intentos')::int then
    update public.maraton_jornadas set estado = 'completada', via = 'alternativa', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
    perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada', jsonb_build_object('via', 'alternativa'), i.user_id);
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

create or replace function public.maraton_cerrar(p_m public.maraton_actividades, p_pres uuid, p_accion text, p_correcta boolean,
  p_respuesta jsonb, p_proc text, p_seg_cliente numeric, p_idem uuid, p_detalle jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); di jsonb := c -> 'dificultad'; x public.maraton_presentaciones;
  i public.maraton_inscripciones; v_wall numeric; v_seg numeric; v_unid numeric := 0; v_ant boolean := false; v_nivel integer;
  v_n integer := (di ->> 'niveles')::int; v_adapt boolean := (di ->> 'adaptativa')::boolean; v_com integer;
begin
  select * into x from public.maraton_presentaciones where id = p_pres;
  select * into i from public.maraton_inscripciones where id = x.inscripcion_id;
  v_wall := greatest(0, extract(epoch from now() - x.presentada_at));
  -- tiempo acreditado: nunca más que el reloj del servidor ni que el tope del problema
  v_seg := round(least(v_wall, x.t_max_s, coalesce(greatest(p_seg_cliente, 0), v_wall)), 1);
  if p_accion = 'respuesta' then
    v_ant := v_seg < x.t_min_s;
    -- respuesta anticipada: crédito proporcional; incorrecta: la fracción configurada (migración 97)
    v_unid := round(x.peso * least(1, v_seg / x.t_min_s)
                    * case when p_correcta then 1 else coalesce((c -> 'carga' ->> 'fraccion_fallo')::numeric, 1) end, 2);
  end if;
  v_nivel := case
    when not v_adapt then x.nivel
    when p_accion = 'respuesta' and p_correcta then least(v_n, x.nivel + (di ->> 'ascenso')::int)
    when p_accion = 'respuesta' then greatest(1, x.nivel - (di ->> 'descenso')::int)
    when p_accion = 'no_puedo' then greatest(1, x.nivel - (di ->> 'descenso_no_puedo')::int)
    else x.nivel end;
  v_com := i.comodines_usados + case when p_accion = 'cambio' then 1 else 0 end;
  update public.maraton_presentaciones
     set cerrada_at = now(), accion = p_accion,
         resultado = case when p_accion = 'respuesta' then case when p_correcta then 'correcta' else 'incorrecta' end end,
         respuesta = p_respuesta, procedimiento = nullif(left(coalesce(p_proc, ''), 20000), ''), detalle = p_detalle,
         segundos = v_seg, segundos_cliente = p_seg_cliente, anticipada = v_ant, unidades = v_unid, nivel_despues = v_nivel,
         comodines_antes = i.comodines_usados, comodines_despues = v_com, idem = p_idem
   where id = p_pres;
  update public.maraton_inscripciones set nivel = v_nivel, comodines_usados = v_com, presentacion_actual = null, updated_at = now()
   where id = i.id;
  update public.maraton_jornadas
     set unidades = unidades + v_unid,
         segundos = segundos + v_seg,
         intentos_validos = intentos_validos + case when p_accion = 'respuesta' then 1 else 0 end,
         correctas = correctas + case when p_accion = 'respuesta' and p_correcta then 1 else 0 end,
         incorrectas = incorrectas + case when p_accion = 'respuesta' and not p_correcta then 1 else 0 end,
         no_puedo = no_puedo + case when p_accion = 'no_puedo' then 1 else 0 end,
         cambios = cambios + case when p_accion = 'cambio' then 1 else 0 end,
         anticipadas = anticipadas + case when v_ant then 1 else 0 end
   where id = x.jornada_id;
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer), como en la migración 94
  foreach f in array array['maraton_defaults()', 'maraton_config_errores(jsonb)', 'maraton_continuar(public.maraton_actividades, uuid, uuid)',
    'maraton_cerrar(public.maraton_actividades, uuid, text, boolean, jsonb, text, numeric, uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
