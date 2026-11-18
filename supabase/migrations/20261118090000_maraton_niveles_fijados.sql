-- Migración 104 · Maratón: rango de niveles fijado por el profesor para un estudiante en ciertas jornadas.
--
-- Una fila de maraton_niveles_fijados acota el nivel de un estudiante entre nivel_min y nivel_max durante las jornadas
-- jornada_desde…jornada_hasta. Dentro del rango manda la progresión de siempre (acertar sube, fallar o «No puedo» baja,
-- cambiar mantiene); el nivel nunca sale del rango. Ejemplo, rango 8–9: acierta D8 → D9; falla D9 → D8; falla D8 → sigue
-- en D8; acierta D9 → sigue en D9. Al empezar la jornada, un nivel por debajo del rango sube al mínimo.
--  · Decisión docente. Las filas se cargan como datos privados (no van al repositorio).
--  · Solo se añaden filas; si hay varias para la misma jornada, manda la más reciente.
--  · Invisible para el estudiante, como el resto de la progresión (ni niveles ni rangos en lo que recibe).
--  · No cambia nada para quien no tenga rango: maraton_presentar y maraton_cerrar son las de la migración 99 con una línea
--    más cada una.

create table if not exists public.maraton_niveles_fijados (
  id bigint generated always as identity primary key,
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  jornada_desde smallint not null check (jornada_desde >= 1),
  jornada_hasta smallint not null,
  nivel_min smallint not null check (nivel_min between 1 and 9),
  nivel_max smallint not null check (nivel_max between 1 and 9),
  motivo text not null check (char_length(motivo) between 3 and 2000),
  creado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (jornada_hasta >= jornada_desde),
  check (nivel_max >= nivel_min)
);
create index if not exists maraton_niveles_fijados_idx on public.maraton_niveles_fijados (maraton_id, user_id);

-- RLS sin políticas ni permisos directos, como el resto del maratón; solo se añaden filas
alter table public.maraton_niveles_fijados enable row level security;
drop trigger if exists maraton_niveles_fijados_inmutable on public.maraton_niveles_fijados;
create trigger maraton_niveles_fijados_inmutable before update or delete on public.maraton_niveles_fijados
  for each row execute function public.maraton_solo_anadir();

-- Nivel acotado: p_nivel dentro del rango vigente para esa jornada (y nunca por encima del máximo del maratón)
create or replace function public.maraton_nivel_fijado(p_maraton uuid, p_user uuid, p_jornada integer, p_nivel integer, p_max integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select least(p_max, greatest(f.nivel_min::int, least(f.nivel_max::int, p_nivel)))
                     from public.maraton_niveles_fijados f
                    where f.maraton_id = p_maraton and f.user_id = p_user and p_jornada between f.jornada_desde and f.jornada_hasta
                    order by f.id desc limit 1), p_nivel)
$$;

create or replace function public.maraton_presentar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; v_temas text[] := public.maraton_temas_sel(p_m);
  v_excl text[]; v_nivel integer; v_niveles integer; v_var text; p public.maraton_plantillas; v_id uuid; v_tmin integer; v_tmax integer;
  v_peso numeric; v_intento integer; v_dist jsonb; v_etapas integer; v_comp boolean := false; v_pc integer; v_base integer;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  v_excl := coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(c -> 'contenido' -> 'excluir_plantillas') x), '{}');
  v_dist := coalesce(c -> 'contenido' -> 'distribucion', '{}');
  v_niveles := public.maraton_nivel_max(p_m);   -- 6, o 9 con la progresión avanzada (migración 99)
  -- rango de niveles fijado por el profesor para este estudiante y esta jornada (migración 104); sin rango, su nivel
  v_base := public.maraton_nivel_fijado(p_m.id, i.user_id, (select j.numero from public.maraton_jornadas j where j.id = p_jornada), i.nivel, v_niveles);
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

create or replace function public.maraton_cerrar(p_m public.maraton_actividades, p_pres uuid, p_accion text, p_correcta boolean,
  p_respuesta jsonb, p_proc text, p_seg_cliente numeric, p_idem uuid, p_detalle jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); di jsonb := c -> 'dificultad'; x public.maraton_presentaciones;
  i public.maraton_inscripciones; v_wall numeric; v_seg numeric; v_unid numeric := 0; v_ant boolean := false; v_nivel integer;
  v_n integer := public.maraton_nivel_max(p_m); v_adapt boolean := (di ->> 'adaptativa')::boolean; v_com integer;
begin
  -- v_n: nivel máximo efectivo; con la progresión avanzada, tras acertar el 6 se pasa al 7 (migración 99)
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
  v_nivel := public.maraton_nivel_fijado(p_m.id, i.user_id, (select j.numero from public.maraton_jornadas j where j.id = x.jornada_id), v_nivel, v_n);
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

revoke all on table public.maraton_niveles_fijados from public, anon, authenticated;
grant all on table public.maraton_niveles_fijados to service_role;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer), como en la migración 99
  foreach f in array array['maraton_nivel_fijado(uuid, uuid, integer, integer, integer)',
    'maraton_presentar(public.maraton_actividades, uuid, uuid)',
    'maraton_cerrar(public.maraton_actividades, uuid, text, boolean, jsonb, text, numeric, uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
