-- Migración 111 · Maratón de jornada fija: N problemas por día, niveles en secuencia, puntuación y apartado teórico.
--
-- Pedido del profesor (25-nov-2026) para el maratón de FG1-A del 26 al 30 de noviembre: cada día son exactamente 10
-- problemas que alternan D2, D3, D2, D3…; lo que el estudiante acierte es su puntuación del día (12 puntos en total);
-- no hay reglas de eliminación; y el botón «No puedo» lleva a un apartado teórico con ese problema resuelto.
--
-- Cuatro claves NUEVAS y OPCIONALES de la configuración (anidadas en bloques que ya existen, como «requeridas» en la
-- migración 106; maraton_cfg conserva las claves anidadas). Sin ellas, todo funciona exactamente como antes:
--  · carga.problemas_jornada (entero 1–100): la jornada se completa al cerrar ese número de problemas, se responda bien,
--    mal o con «No puedo». En ese modo no se aplican la cuota, la vía alternativa, los límites de protección ni las reglas
--    de permanencia de maraton_continuar (rapidez, aciertos, presentados).
--  · dificultad.secuencia (lista de niveles 1–9): el problema k de cada jornada es del nivel secuencia[(k − 1) mod n].
--    Manda sobre la progresión adaptativa y sobre el rango fijado (migración 104).
--  · carga.puntos_total (número 0–1000): cada respuesta correcta vale puntos_total / (jornadas × problemas_jornada).
--    El estudiante ve sus puntos del día y el acumulado. Es informativo: no escribe en el registro de calificaciones.
--  · contenido.teoria (Markdown + KaTeX): apartado teórico que el estudiante abre tras «No puedo», con la solución
--    desarrollada de los problemas que declaró no poder resolver (solo esos: ya están cerrados y no vuelven).
--
-- Aditiva: amplía un check (admite la vía «problemas»), redefine maraton_presentar (copia de la 104), maraton_continuar
-- (copia de la 98) y maraton_estado_json (copia de la 106), y añade maraton_teoria y un disparador de validación.

-- 1) vía de finalización nueva: «problemas» (jornada de N problemas). Se amplía el conjunto admitido; ninguna fila cambia.
alter table public.maraton_jornadas drop constraint if exists maraton_jornadas_via_check;
alter table public.maraton_jornadas add constraint maraton_jornadas_via_check check (via in ('cuota', 'alternativa', 'problemas'));

-- 2) validación de las claves nuevas al guardar la configuración (como maraton_requeridas_valida, migración 106)
create or replace function public.maraton_jornada_fija_valida() returns trigger
language plpgsql set search_path = '' as $$
declare ca jsonb := new.config -> 'carga'; di jsonb := new.config -> 'dificultad'; ct jsonb := new.config -> 'contenido';
  v numeric; x jsonb;
begin
  if ca ? 'problemas_jornada' and ca -> 'problemas_jornada' <> 'null'::jsonb then
    begin v := (ca ->> 'problemas_jornada')::numeric; exception when others then v := null; end;
    if v is null or v <> trunc(v) or v < 1 or v > 100 then
      raise exception 'Los problemas por jornada deben ser un entero entre 1 y 100' using errcode = 'P0001'; end if;
  end if;
  if ca ? 'puntos_total' and ca -> 'puntos_total' <> 'null'::jsonb then
    begin v := (ca ->> 'puntos_total')::numeric; exception when others then v := null; end;
    if v is null or v < 0 or v > 1000 then raise exception 'Los puntos totales deben estar entre 0 y 1000' using errcode = 'P0001'; end if;
    if coalesce(ca -> 'problemas_jornada', 'null'::jsonb) = 'null'::jsonb then
      raise exception 'La puntuación requiere un número fijo de problemas por jornada' using errcode = 'P0001'; end if;
  end if;
  if di ? 'secuencia' and di -> 'secuencia' <> 'null'::jsonb then
    if jsonb_typeof(di -> 'secuencia') <> 'array' or jsonb_array_length(di -> 'secuencia') not between 1 and 50 then
      raise exception 'La secuencia de niveles debe ser una lista de 1 a 50 niveles' using errcode = 'P0001'; end if;
    for x in select * from jsonb_array_elements(di -> 'secuencia') loop
      if jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric not in (1, 2, 3, 4, 5, 6, 7, 8, 9) then
        raise exception 'Cada nivel de la secuencia debe ser un entero entre 1 y 9' using errcode = 'P0001'; end if;
    end loop;
  end if;
  if ct ? 'teoria' and ct -> 'teoria' <> 'null'::jsonb then
    if jsonb_typeof(ct -> 'teoria') <> 'string' or char_length(ct ->> 'teoria') > 100000 then
      raise exception 'El apartado teórico debe ser un texto de hasta 100 000 caracteres' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists maraton_jornada_fija_valida on public.maraton_actividades;
create trigger maraton_jornada_fija_valida before insert or update of config on public.maraton_actividades
  for each row execute function public.maraton_jornada_fija_valida();

-- 3) maraton_presentar (copia de 20261118090000_maraton_niveles_fijados.sql + secuencia de niveles)
create or replace function public.maraton_presentar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; v_temas text[] := public.maraton_temas_sel(p_m);
  v_excl text[]; v_nivel integer; v_niveles integer; v_var text; p public.maraton_plantillas; v_id uuid; v_tmin integer; v_tmax integer;
  v_peso numeric; v_intento integer; v_dist jsonb; v_etapas integer; v_comp boolean := false; v_pc integer; v_base integer;
  v_seq jsonb := c -> 'dificultad' -> 'secuencia'; v_k integer;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  v_excl := coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(c -> 'contenido' -> 'excluir_plantillas') x), '{}');
  v_dist := coalesce(c -> 'contenido' -> 'distribucion', '{}');
  v_niveles := public.maraton_nivel_max(p_m);   -- 6, o 9 con la progresión avanzada (migración 99)
  if jsonb_typeof(v_seq) = 'array' and jsonb_array_length(v_seq) > 0 then
    -- secuencia de niveles (migración 111): el problema k de la jornada (k − 1 = ya presentados) toma secuencia[(k − 1) mod n]
    select j.presentados into v_k from public.maraton_jornadas j where j.id = p_jornada;
    v_base := least(v_niveles, greatest(1, (v_seq ->> (coalesce(v_k, 0) % jsonb_array_length(v_seq)))::int));
  else
    -- rango de niveles fijado por el profesor para este estudiante y esta jornada (migración 104); sin rango, su nivel
    v_base := public.maraton_nivel_fijado(p_m.id, i.user_id, (select j.numero from public.maraton_jornadas j where j.id = p_jornada), i.nivel, v_niveles);
  end if;
  -- nivel pedido; si se agotara (no debería con el banco construido), el más cercano, primero hacia abajo
  for v_intento in 0 .. 10 loop
    v_nivel := case when v_intento = 0 then v_base
                    when v_intento % 2 = 1 then v_base - (v_intento + 1) / 2
                    else v_base + v_intento / 2 end;
    continue when v_nivel < 1 or v_nivel > v_niveles;
    -- plantillas candidatas: primero las no recientes y los temas menos trabajados (según la distribución pedida)
    for p in
      select pl.* from public.maraton_plantillas pl
       where pl.banco_id = p_m.banco_id and pl.nivel = v_nivel and pl.estado = 'validada'
         and pl.tema = any (v_temas) and not (pl.id = any (v_excl))
       order by (pl.id = any (i.recientes)),
                coalesce((i.temas_conteo ->> pl.tema)::numeric, 0) / greatest(coalesce((v_dist ->> pl.tema)::numeric, 1), 0.01),
                random()
    loop
      select v.id into v_var from public.maraton_variantes v
       where v.plantilla_id = p.id and v.estado = 'validada'
         and not exists (select 1 from public.maraton_presentaciones x where x.inscripcion_id = p_insc and x.variante_id = v.id)
       order by random() limit 1;
      exit when v_var is not null;
    end loop;
    exit when v_var is not null;
  end loop;
  if v_var is null then
    raise exception 'No quedan problemas disponibles en el banco para este maratón. Avise a su profesor.' using errcode = 'P0001';
  end if;
  if v_nivel <> v_base then
    perform public.maraton_log(p_m.id, i.user_id, null, 'nivel_sin_problemas', jsonb_build_object('pedido', v_base, 'presentado', v_nivel), i.user_id);
  end if;
  v_tmin := coalesce((c -> 'dificultad' -> 't_min_nivel_s' ->> (v_nivel - 1))::int,
                     greatest(30, round(p.t_min_s * coalesce((c -> 'dificultad' ->> 't_min_factor')::numeric, 1))::int));
  v_tmax := greatest(v_tmin, round(p.t_max_s * greatest(1, coalesce((c -> 'dificultad' ->> 't_min_factor')::numeric, 1)))::int);
  v_peso := case when v_nivel > 6 then (c -> 'avanzado' -> 'pesos' ->> (v_nivel - 7))::numeric
                 else (c -> 'dificultad' -> 'pesos' ->> (v_nivel - 1))::numeric end;
  -- etapas: las del problema avanzado o, en un problema ordinario, la comprobación de razonamiento. La MISMA regla para
  -- todos, que depende de la conducta y no de quién es: un porcentaje base y otro (mayor) si la respuesta anterior fue
  -- anticipada (señal para adaptar la exigencia, no prueba de nada); sorteo determinista por inscripción y número de problema
  v_etapas := 1 + (select count(*) from public.maraton_etapas e where e.variante_id = v_var and e.tipo = 'etapa');
  v_pc := coalesce((c -> 'avanzado' ->> 'comprobacion_porcentaje')::int, 0);
  if exists (select 1 from public.maraton_presentaciones y where y.inscripcion_id = p_insc and y.secuencia = i.secuencia and y.anticipada) then
    v_pc := greatest(v_pc, coalesce((c -> 'avanzado' ->> 'comprobacion_tras_anticipada')::int, 0));
  end if;
  if v_etapas = 1 and v_nivel <= 6 and v_pc > 0
     and exists (select 1 from public.maraton_etapas e where e.variante_id = v_var and e.numero = 2 and e.tipo = 'comprobacion') then
    v_comp := ('x' || substr(md5(p_insc::text || ':' || (i.secuencia + 1)::text), 1, 7))::bit(28)::int % 100 < v_pc;
    if v_comp then
      v_etapas := 2;
      v_tmin := v_tmin + coalesce((c -> 'avanzado' ->> 'comprobacion_segundos')::int, 0);
      v_tmax := v_tmax + coalesce((c -> 'avanzado' ->> 'comprobacion_segundos')::int, 0);
    end if;
  end if;
  insert into public.maraton_presentaciones (inscripcion_id, jornada_id, secuencia, variante_id, plantilla_id, tema, nivel, t_min_s, t_max_s, peso,
                                             etapas_total, comprobacion)
  values (p_insc, p_jornada, i.secuencia + 1, v_var, p.id, p.tema, v_nivel, v_tmin, v_tmax, v_peso, v_etapas, v_comp)
  returning id into v_id;
  update public.maraton_inscripciones
     set secuencia = secuencia + 1, presentacion_actual = v_id, updated_at = now(),
         recientes = (array_prepend(p.id, recientes))[1:8],
         temas_conteo = jsonb_set(temas_conteo, array[p.tema], to_jsonb(coalesce((temas_conteo ->> p.tema)::int, 0) + 1))
   where id = p_insc;
  update public.maraton_jornadas set presentados = presentados + 1 where id = p_jornada;
  return v_id;
end $$;

-- 4) maraton_continuar (copia de 20261116300000_maraton_permanencia.sql + jornada de N problemas)
create or replace function public.maraton_continuar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); ca jsonb := c -> 'carga'; j public.maraton_jornadas; i public.maraton_inscripciones;
  v_motivo text; pe jsonb := c -> 'permanencia'; v_min integer := coalesce((c -> 'permanencia' ->> 'min_correctas')::int, 0);
  x public.maraton_presentaciones; v_np integer;
begin
  select * into j from public.maraton_jornadas where id = p_jornada;
  select * into i from public.maraton_inscripciones where id = p_insc;
  if j.estado <> 'en_curso' then return; end if;
  -- jornada de N problemas (migración 111): se completa al cerrar el N-ésimo problema; ninguna otra regla la termina
  if coalesce(ca -> 'problemas_jornada', 'null'::jsonb) <> 'null'::jsonb then
    v_np := (ca ->> 'problemas_jornada')::int;
    if i.presentacion_actual is not null then return; end if;
    if j.presentados >= v_np then
      update public.maraton_jornadas set estado = 'completada', via = 'problemas', cerrada_at = now(), reabierta_hasta = null where id = p_jornada;
      perform public.maraton_log(p_m.id, i.user_id, j.numero, 'jornada_completada',
        jsonb_build_object('via', 'problemas', 'problemas', j.presentados, 'correctas', j.correctas), i.user_id);
      return;
    end if;
    perform public.maraton_presentar(p_m, p_insc, p_jornada);
    return;
  end if;
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

-- 5) maraton_estado_json (copia de 20261118110000_maraton_jornadas_a_elegir.sql + jornada fija, puntos y teoría)
create or replace function public.maraton_estado_json(p_m public.maraton_actividades, p_insc uuid, p_aviso text default null, p_ultimo jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; j public.maraton_jornadas; x public.maraton_presentaciones;
  v_var public.maraton_variantes; h jsonb := public.maraton_hoy_insc(p_m, p_insc); v_total integer := (c -> 'comodines' ->> 'total')::int;
  v_pj integer; v_disp integer; v_problema jsonb; v_jornada jsonb; v_curso text; v_req integer := public.maraton_requeridas(p_m);
  -- jornada fija y puntuación (migración 111)
  v_np integer := case when coalesce(c -> 'carga' -> 'problemas_jornada', 'null'::jsonb) <> 'null'::jsonb then (c -> 'carga' ->> 'problemas_jornada')::int end;
  v_pt numeric := case when coalesce(c -> 'carga' -> 'puntos_total', 'null'::jsonb) <> 'null'::jsonb then (c -> 'carga' ->> 'puntos_total')::numeric end;
  v_pp numeric; v_nj integer;
begin
  v_nj := coalesce(v_req, (c -> 'programacion' ->> 'jornadas')::int);
  if v_np is not null and v_pt is not null then v_pp := v_pt / (v_nj * v_np); end if;
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
      'cierra', coalesce(case when j.reabierta_hasta >= now() then j.reabierta_hasta end, (public.maraton_calendario(p_m, j.numero) ->> 'cierra')::timestamptz))
      -- jornada fija (migración 111): problemas ya cerrados en la jornada; con puntuación, aciertos y puntos del día
      || case when v_np is not null then jsonb_build_object('cerrados', j.presentados - case when x.id is not null then 1 else 0 end) else '{}'::jsonb end
      || case when v_pp is not null then jsonb_build_object('correctas', j.correctas, 'puntos', round(j.correctas * v_pp, 2)) else '{}'::jsonb end;
  end if;
  return jsonb_build_object(
    'maraton', jsonb_build_object('id', p_m.id, 'titulo', p_m.titulo, 'asignatura', v_curso, 'descripcion', p_m.descripcion,
       'instrucciones', p_m.instrucciones, 'jornadas', v_nj,
       'dias', case when v_req is not null then (c -> 'programacion' ->> 'jornadas')::int end, 'fecha_inicio', p_m.fecha_inicio,
       'zona', c -> 'programacion' ->> 'zona', 'apertura', c -> 'programacion' ->> 'apertura', 'cierre', c -> 'programacion' ->> 'cierre',
       'tiempo_orientativo', jsonb_build_array((c -> 'carga' ->> 'objetivo_min')::int, (c -> 'carga' ->> 'objetivo_max')::int),
       'limite_minutos', (c -> 'carga' ->> 'limite_minutos')::int,
       'comodines_total', v_total, 'comodines_por_jornada', v_pj, 'no_puedo', (c -> 'comodines' ->> 'no_puedo')::boolean,
       'estado', p_m.estado,
       -- reglas de permanencia que el estudiante debe conocer (migración 98); sin niveles ni parámetros internos
       'permanencia', jsonb_build_object('min_correctas', case when v_np is null then coalesce((c -> 'permanencia' ->> 'min_correctas')::int, 0) else 0 end,
         'presentados_max', case when v_np is null and (c -> 'permanencia' ->> 'fuera_por_presentados')::boolean then (c -> 'carga' ->> 'presentados_max')::int end,
         'continuidad', coalesce((c -> 'permanencia' ->> 'fuera_por_continuidad')::boolean, false),
         'rapido_segundos', case when v_np is null and coalesce(c -> 'permanencia' -> 'fuera_rapido_nivel', 'null'::jsonb) <> 'null'::jsonb
                                 then (c -> 'permanencia' ->> 'fuera_rapido_segundos')::int end),
       -- migración 111: jornada de N problemas, puntuación y apartado teórico (sin niveles ni parámetros internos)
       'problemas_jornada', v_np,
       'puntos', case when v_pp is not null then jsonb_build_object('total', v_pt, 'por_jornada', round(v_pt / v_nj, 2), 'por_problema', round(v_pp, 4)) end,
       'teoria', coalesce(char_length(trim(c -> 'contenido' ->> 'teoria')) > 0, false)),
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
    'fuera', case when i.fuera_at is not null then jsonb_build_object('tipo', i.fuera_tipo, 'jornada', i.fuera_jornada, 'desde', i.fuera_at) end,
    -- puntos acumulados en todas las jornadas (migración 111)
    'puntos', case when v_pp is not null and i.id is not null then jsonb_build_object(
      'acumulado', round(coalesce((select sum(jj.correctas) from public.maraton_jornadas jj where jj.inscripcion_id = i.id), 0) * v_pp, 2),
      'maximo', v_pt) end);
end $$;

-- 6) apartado teórico: la teoría del maratón y la solución desarrollada de los problemas que el estudiante (o el
--    profesor en su prueba) declaró no poder resolver. Solo problemas ya CERRADOS con «No puedo»: nunca el abierto.
create or replace function public.maraton_teoria(p_maraton uuid, p_presentacion uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; c jsonb; v_t text;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  c := public.maraton_cfg((a.m).config);
  v_t := c -> 'contenido' ->> 'teoria';
  if coalesce(char_length(trim(v_t)), 0) = 0 then
    raise exception 'Este maratón no tiene apartado teórico' using errcode = 'P0001'; end if;
  select * into i from public.maraton_inscripciones where maraton_id = p_maraton and user_id = auth.uid();
  if p_presentacion is not null and not exists (select 1 from public.maraton_presentaciones x
       where x.id = p_presentacion and x.inscripcion_id = i.id and x.accion = 'no_puedo' and x.cerrada_at is not null) then
    raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  return jsonb_build_object('titulo', (a.m).titulo, 'teoria', v_t, 'actual', p_presentacion,
    'resueltos', (select coalesce(jsonb_agg(jsonb_build_object(
        'presentacion_id', x.id, 'jornada', j.numero,
        'numero', (select count(*) from public.maraton_presentaciones y where y.jornada_id = x.jornada_id and y.secuencia <= x.secuencia),
        'fecha', x.cerrada_at, 'enunciado', v.enunciado,
        'partes', (select jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', p ->> 'unidad')) from jsonb_array_elements(v.partes) p),
        'solucion', k.solucion) order by (x.id = p_presentacion) desc, x.secuencia desc), '[]')
      from public.maraton_presentaciones x
      join public.maraton_jornadas j on j.id = x.jornada_id
      join public.maraton_variantes v on v.id = x.variante_id
      join public.maraton_claves k on k.variante_id = x.variante_id
     where i.id is not null and x.inscripcion_id = i.id and x.accion = 'no_puedo' and x.cerrada_at is not null));
end $$;

-- 7) maraton_revision (copia de 20261114160000_maraton_adaptativo.sql): con una secuencia de niveles solo se exigen
--    problemas de los niveles de la secuencia (un banco D2–D3 no necesita D1); con jornada fija se avisa si el banco
--    no alcanza para todas las jornadas sin repetir variantes a un mismo estudiante
create or replace function public.maraton_revision(p_m public.maraton_actividades) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); e text[] := public.maraton_config_errores(p_m.config); w text[] := '{}';
  d jsonb := public.maraton_disponibles(p_m); k integer; v_t text; v_seq jsonb := c -> 'dificultad' -> 'secuencia'; v_niv integer[];
  v_np integer; v_nec integer;
begin
  if p_m.fecha_inicio is null then e := array_append(e, 'Falta la fecha de inicio (pendiente de configuración docente).');
  elsif p_m.fecha_inicio < (now() at time zone (c -> 'programacion' ->> 'zona'))::date and p_m.estado = 'borrador' then
    e := array_append(e, 'La fecha de inicio ya pasó.'); end if;
  if not public.maraton_banco_permitido(p_m.banco_id, p_m.class_id) then e := array_append(e, 'El banco elegido no corresponde a la asignatura de la sección.'); end if;
  if position('[PENDIENTE' in upper(p_m.instrucciones || ' ' || p_m.descripcion)) > 0 then
    e := array_append(e, 'Las instrucciones tienen apartados [PENDIENTE…] que el profesor debe completar (p. ej., los criterios de la recuperación).'); end if;
  if char_length(trim(p_m.instrucciones)) < 40 then
    w := array_append(w, 'Las instrucciones para estudiantes son muy breves: explique duración, continuidad, comodines, incidencias y criterios.'); end if;
  if cardinality(public.maraton_temas_sel(p_m)) = 0 then e := array_append(e, 'No hay temas seleccionados.'); end if;
  foreach v_t in array public.maraton_temas_sel(p_m) loop
    if not exists (select 1 from public.maraton_temas where banco_id = p_m.banco_id and codigo = v_t and estado <> 'excluido') then
      e := array_append(e, format('El tema «%s» no existe en el banco o está excluido.', v_t)); end if;
  end loop;
  if jsonb_typeof(v_seq) = 'array' and jsonb_array_length(v_seq) > 0 then
    select array_agg(distinct (x #>> '{}')::int order by (x #>> '{}')::int) into v_niv from jsonb_array_elements(v_seq) x;
  else
    select array_agg(g) into v_niv from generate_series(1, least(6, greatest(2, coalesce((c -> 'dificultad' ->> 'niveles')::int, 6)))) g;
  end if;
  foreach k in array v_niv loop
    if coalesce((d ->> k::text)::int, 0) = 0 then e := array_append(e, format('No hay problemas validados de nivel D%s en los temas elegidos.', k));
    elsif (d ->> k::text)::int < 60 then w := array_append(w, format('Solo hay %s variantes validadas de nivel D%s: podrían repetirse entre estudiantes.', d ->> k::text, k)); end if;
  end loop;
  -- jornada fija con secuencia: problemas de cada nivel que un estudiante puede llegar a recibir en todo el maratón
  if coalesce(c -> 'carga' -> 'problemas_jornada', 'null'::jsonb) <> 'null'::jsonb and v_seq is not null and jsonb_typeof(v_seq) = 'array' then
    v_np := (c -> 'carga' ->> 'problemas_jornada')::int;
    foreach k in array v_niv loop
      select count(*) into v_nec from generate_series(0, v_np - 1) g where (v_seq ->> (g % jsonb_array_length(v_seq)))::int = k;
      v_nec := v_nec * (c -> 'programacion' ->> 'jornadas')::int;
      if coalesce((d ->> k::text)::int, 0) < v_nec then
        e := array_append(e, format('Cada estudiante necesita hasta %s problemas de nivel D%s y el banco solo tiene %s.', v_nec, k, coalesce(d ->> k::text, '0'))); end if;
    end loop;
  end if;
  if coalesce(c -> 'carga' -> 'problemas_jornada', 'null'::jsonb) = 'null'::jsonb
     and (c -> 'carga' ->> 'alternativa_minutos')::numeric > (c -> 'carga' ->> 'limite_minutos')::numeric then
    w := array_append(w, 'La finalización alternativa pide más minutos que el límite máximo: casi nunca se aplicará.'); end if;
  return jsonb_build_object('errores', to_jsonb(e), 'avisos', to_jsonb(w), 'disponibles', d);
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer)
  foreach f in array array['maraton_jornada_fija_valida()',
    'maraton_presentar(public.maraton_actividades, uuid, uuid)',
    'maraton_continuar(public.maraton_actividades, uuid, uuid)',
    'maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamable con sesión: comprueba acceso e inscripción por dentro
  execute 'revoke all on function public.maraton_teoria(uuid, uuid) from public, anon';
  execute 'grant execute on function public.maraton_teoria(uuid, uuid) to authenticated';
end $$;
