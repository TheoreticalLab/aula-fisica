-- =============================================================================
-- Migración 99 · Maratón: progresión avanzada (niveles 7–9 por etapas) y comprobaciones de razonamiento
--
-- Por encargo del profesor (17-nov-2026). Aumentar la exigencia de resolver con ayuda externa SIN cambiar los
-- requisitos publicados para completar una jornada (5 aciertos; vía A 12 unidades y 30 min; vía B 60 min y 8
-- respuestas; límites de 90 min, 18 respuestas y 30 problemas; continuidad; 10 comodines).
--
--  · Niveles 7 (razonamiento encadenado), 8 (integración de principios) y 9 (consistencia y generalización): tras
--    acertar un 6 se pasa al 7, del 7 al 8 y del 8 al 9 (que se repite). Fallar o «No puedo» baja un nivel, como siempre;
--    cambiar ejercicio mantiene el nivel. Solo si el maratón usa 6 niveles adaptativos y el banco tiene problemas 7–9.
--  · Un problema avanzado tiene de 3 a 5 ETAPAS que se muestran una tras otra; cada etapa entregada queda guardada y
--    no se puede cambiar; el conjunto cuenta como UNA respuesta para todos los límites. Acierto = todas las etapas
--    correctas; una respuesta parcial cuenta como incorrecta (misma fracción de unidades que cualquier incorrecta).
--  · Comprobación breve de razonamiento en los problemas ordinarios que la tienen: en el 10 % de ellos y en el 100 % del
--    problema que sigue a una respuesta ANTICIPADA (resuelta antes de su tiempo mínimo). Es la misma regla para todos
--    y depende de la conducta, no de quién es: la anticipada es una señal para adaptar la exigencia, no una prueba de
--    fraude, y el estudiante lento y constante casi no la recibe. Sorteo determinista; añade su tiempo al mínimo y al
--    tope del problema.
--  · Sin bonificación: ponderación 1 en los niveles 7–9 (no puede superar la mayor ordinaria); el tiempo mínimo de la
--    jornada no cambia.
--  · Invisible para el estudiante: ni niveles, ni número de etapas, ni si es una comprobación; su informe ya no
--    muestra niveles ni respuestas anticipadas.
--  · Nada retroactivo: jornadas, presentaciones, unidades y aciertos existentes no se tocan.
--
-- Esquema: se amplían a 1..9 las restricciones de nivel (relajar un check no pierde datos) y se añaden tres tablas
-- (texto y clave de cada etapa; respuestas de cada etapa, solo añadir) y tres columnas en maraton_presentaciones.
-- Las funciones modificadas son copia exacta de su versión vigente (generada por privado/tmp/generar-99.mjs).
-- =============================================================================
set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- Niveles 1..9
-- -----------------------------------------------------------------------------
alter table public.maraton_plantillas drop constraint if exists maraton_plantillas_nivel_check;
alter table public.maraton_plantillas add constraint maraton_plantillas_nivel_check check (nivel between 1 and 9);
alter table public.maraton_inscripciones drop constraint if exists maraton_inscripciones_nivel_check;
alter table public.maraton_inscripciones add constraint maraton_inscripciones_nivel_check check (nivel between 1 and 9);
alter table public.maraton_presentaciones drop constraint if exists maraton_presentaciones_nivel_check;
alter table public.maraton_presentaciones add constraint maraton_presentaciones_nivel_check check (nivel between 1 and 9);

-- -----------------------------------------------------------------------------
-- Etapas del banco: etapa 1 = la variante (enunciado, partes y clave de siempre); etapas 2..5 aquí.
-- tipo 'etapa' (problemas 7–9) o 'comprobacion' (etapa 2 opcional de un problema ordinario).
-- -----------------------------------------------------------------------------
create table if not exists public.maraton_etapas (
  variante_id text not null references public.maraton_variantes (id) on delete restrict,
  numero smallint not null check (numero between 2 and 5),
  tipo text not null check (tipo in ('etapa', 'comprobacion')),
  enunciado text not null check (char_length(enunciado) between 1 and 4000),
  partes jsonb not null check (jsonb_typeof(partes) = 'array' and jsonb_array_length(partes) between 1 and 3),
  primary key (variante_id, numero)
);

-- 🔒 claves de las etapas: solo service_role (svc_*) y funciones docentes
create table if not exists public.maraton_etapas_claves (
  variante_id text not null,
  numero smallint not null,
  clave jsonb not null check (jsonb_typeof(clave -> 'partes') = 'array'),
  solucion text not null default '',
  primary key (variante_id, numero),
  foreign key (variante_id, numero) references public.maraton_etapas (variante_id, numero) on delete restrict
);

-- Respuesta de cada etapa entregada: se conserva tal como se envió (solo añadir; una etapa no se reenvía)
create table if not exists public.maraton_respuestas_etapa (
  presentacion_id uuid not null references public.maraton_presentaciones (id) on delete restrict,
  inscripcion_id uuid not null references public.maraton_inscripciones (id) on delete restrict,
  etapa smallint not null check (etapa between 1 and 5),
  respuesta jsonb not null,
  correcta boolean not null,
  detalle jsonb,
  segundos_cliente numeric(8, 1),
  idem uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (presentacion_id, etapa)
);
create index if not exists maraton_respuestas_etapa_insc_idx on public.maraton_respuestas_etapa (inscripcion_id);

alter table public.maraton_presentaciones add column if not exists etapas_total smallint not null default 1;
alter table public.maraton_presentaciones add column if not exists etapa_actual smallint not null default 1;
alter table public.maraton_presentaciones add column if not exists comprobacion boolean not null default false;

alter table public.maraton_etapas enable row level security;
alter table public.maraton_etapas_claves enable row level security;
alter table public.maraton_respuestas_etapa enable row level security;
revoke all on table public.maraton_etapas, public.maraton_etapas_claves, public.maraton_respuestas_etapa from public, anon, authenticated;
grant all on table public.maraton_etapas, public.maraton_etapas_claves, public.maraton_respuestas_etapa to service_role;

create or replace function public.maraton_respuesta_etapa_inmutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('maraton.reinicio', true) = 'si' and public.maraton_es_prueba(old.inscripcion_id) then return old; end if;
  raise exception 'Una etapa entregada del maratón no se puede modificar ni borrar' using errcode = '42501';
end $$;
drop trigger if exists maraton_respuestas_etapa_inmutable on public.maraton_respuestas_etapa;
create trigger maraton_respuestas_etapa_inmutable before update or delete on public.maraton_respuestas_etapa
  for each row execute function public.maraton_respuesta_etapa_inmutable();

-- -----------------------------------------------------------------------------
-- Nivel máximo efectivo: 9 si la progresión avanzada está activa, el maratón usa los 6 niveles adaptativos y el banco
-- tiene problemas validados de nivel 7 o más; si no, el número de niveles configurado (como antes).
-- -----------------------------------------------------------------------------
create or replace function public.maraton_nivel_max(p_m public.maraton_actividades) returns integer
language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((c -> 'avanzado' ->> 'activo')::boolean, false) and (c -> 'dificultad' ->> 'niveles')::int = 6
         and (c -> 'dificultad' ->> 'adaptativa')::boolean
         and exists (select 1 from public.maraton_plantillas pl where pl.banco_id = p_m.banco_id and pl.nivel > 6 and pl.estado = 'validada')
    then 9 else (c -> 'dificultad' ->> 'niveles')::int end
  from (select public.maraton_cfg(p_m.config) c) q
$$;

-- -----------------------------------------------------------------------------
-- Entrega de una etapa (Edge Function «maraton», solo service_role). La etapa debe ser la ABIERTA: no se puede
-- repetir, saltar ni llegar al resultado sin las anteriores. Etapas intermedias: se guardan y se muestra la siguiente
-- (sin decir si acertó). Última etapa: acierto completo solo si TODAS son correctas; se cierra el problema con las
-- reglas de siempre (una sola respuesta, unidades, nivel, finalización).
-- -----------------------------------------------------------------------------
create or replace function public.svc_maraton_etapa(p_user uuid, p_presentacion uuid, p_idem uuid, p_etapa integer, p_respuesta jsonb,
  p_procedimiento text, p_segundos_cliente numeric, p_correcta boolean, p_detalle jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; x public.maraton_presentaciones; v_insc uuid; v_aviso text; v_ok boolean;
  v_resp jsonb; v_det jsonb;
begin
  if p_correcta is null or p_etapa is null then raise exception 'Falta el resultado' using errcode = '22023'; end if;
  select inscripcion_id into v_insc from public.maraton_presentaciones where id = p_presentacion;
  select * into a from public.maraton_acceso((select maraton_id from public.maraton_inscripciones where id = v_insc), p_user);
  i := public.maraton_inscripcion(a.m, p_user, a.prueba, false);   -- bloqueo de la inscripción: las entregas se ordenan aquí
  if i.id is distinct from v_insc then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  v_aviso := public.maraton_previo(a.m, i, p_presentacion, p_idem);
  if v_aviso is not null then return public.maraton_estado_json(a.m, i.id, v_aviso); end if;
  select * into x from public.maraton_presentaciones where id = p_presentacion;
  if p_etapa <> x.etapa_actual then return public.maraton_estado_json(a.m, i.id, 'ya_procesada'); end if;
  if x.etapas_total = 1 then
    perform public.maraton_cerrar(a.m, x.id, 'respuesta', p_correcta, p_respuesta, p_procedimiento, p_segundos_cliente, p_idem, p_detalle);
    perform public.maraton_continuar(a.m, i.id, x.jornada_id);
    return public.maraton_estado_json(a.m, i.id, null, jsonb_build_object('resultado', case when p_correcta then 'correcta' else 'incorrecta' end));
  end if;
  insert into public.maraton_respuestas_etapa (presentacion_id, inscripcion_id, etapa, respuesta, correcta, detalle, segundos_cliente, idem)
  values (x.id, i.id, p_etapa, p_respuesta, p_correcta, p_detalle, p_segundos_cliente, p_idem);
  if p_etapa < x.etapas_total then
    update public.maraton_presentaciones set etapa_actual = etapa_actual + 1 where id = x.id;
    return public.maraton_estado_json(a.m, i.id);
  end if;
  -- última etapa: todas las partes en orden; una respuesta parcial (alguna etapa incorrecta) es incorrecta
  select bool_and(r.correcta) into v_ok from public.maraton_respuestas_etapa r where r.presentacion_id = x.id;
  select jsonb_build_object('partes', jsonb_agg(p order by r.etapa, o.n)) into v_resp
    from public.maraton_respuestas_etapa r cross join lateral jsonb_array_elements(r.respuesta -> 'partes') with ordinality o(p, n)
   where r.presentacion_id = x.id;
  select jsonb_build_object('partes', jsonb_agg(p order by r.etapa, o.n)) into v_det
    from public.maraton_respuestas_etapa r cross join lateral jsonb_array_elements(coalesce(r.detalle -> 'partes', '[]')) with ordinality o(p, n)
   where r.presentacion_id = x.id;
  v_resp := v_resp || jsonb_build_object('etapas', (select jsonb_agg(r.respuesta -> 'partes' order by r.etapa)
                                                     from public.maraton_respuestas_etapa r where r.presentacion_id = x.id));
  v_det := coalesce(v_det, '{}') || jsonb_build_object('comprobacion', x.comprobacion,
    'etapas', (select jsonb_agg(jsonb_build_object('etapa', r.etapa, 'correcta', r.correcta, 'at', r.created_at) order by r.etapa)
                 from public.maraton_respuestas_etapa r where r.presentacion_id = x.id));
  perform public.maraton_cerrar(a.m, x.id, 'respuesta', v_ok, v_resp, p_procedimiento, p_segundos_cliente, p_idem, v_det);
  perform public.maraton_continuar(a.m, i.id, x.jornada_id);
  return public.maraton_estado_json(a.m, i.id, null, jsonb_build_object('resultado', case when v_ok then 'correcta' else 'incorrecta' end));
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
    "avanzado": {"activo": true, "pesos": [1.00, 1.00, 1.00], "comprobacion_porcentaje": 10, "comprobacion_tras_anticipada": 100,
                 "comprobacion_segundos": 60},
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
  co jsonb := c -> 'comodines'; pe jsonb := c -> 'permanencia'; av jsonb := c -> 'avanzado'; inf jsonb := c -> 'informes'; se jsonb := c -> 'seguridad'; ct jsonb := c -> 'contenido';
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
    -- progresión avanzada (migración 99): sin bonificaciones por nivel
    if jsonb_typeof(av -> 'activo') <> 'boolean' then e := array_append(e, 'Indique si la progresión avanzada está activa (sí o no).'); end if;
    if jsonb_typeof(av -> 'pesos') <> 'array' or jsonb_array_length(av -> 'pesos') <> 3 then
      e := array_append(e, 'Debe haber una ponderación por cada nivel avanzado (7, 8 y 9).');
    else
      for i in 0 .. 2 loop
        x := (av -> 'pesos' ->> i)::numeric;
        if x is null or x < 0.1 then e := array_append(e, 'Cada ponderación avanzada debe ser al menos 0.1.'); exit; end if;
        if x > (select max(w::numeric) from jsonb_array_elements_text(di -> 'pesos') w) then
          e := array_append(e, 'La ponderación de un nivel avanzado no puede superar la mayor ponderación ordinaria (no hay bonificación por nivel).'); exit; end if;
      end loop;
    end if;
    if (av ->> 'comprobacion_porcentaje')::int not between 0 and 100 or (av ->> 'comprobacion_tras_anticipada')::int not between 0 and 100 then
      e := array_append(e, 'Los porcentajes de comprobaciones de razonamiento deben estar entre 0 y 100.'); end if;
    if (av ->> 'comprobacion_segundos')::int not between 0 and 600 then e := array_append(e, 'El tiempo adicional de una comprobación debe estar entre 0 y 600 s.'); end if;
  exception when others then e := array_append(e, 'Progresión avanzada no válida.');
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

create or replace function public.maraton_presentar(p_m public.maraton_actividades, p_insc uuid, p_jornada uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c jsonb := public.maraton_cfg(p_m.config); i public.maraton_inscripciones; v_temas text[] := public.maraton_temas_sel(p_m);
  v_excl text[]; v_nivel integer; v_niveles integer; v_var text; p public.maraton_plantillas; v_id uuid; v_tmin integer; v_tmax integer;
  v_peso numeric; v_intento integer; v_dist jsonb; v_etapas integer; v_comp boolean := false; v_pc integer;
begin
  select * into i from public.maraton_inscripciones where id = p_insc;
  v_excl := coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(c -> 'contenido' -> 'excluir_plantillas') x), '{}');
  v_dist := coalesce(c -> 'contenido' -> 'distribucion', '{}');
  v_niveles := public.maraton_nivel_max(p_m);   -- 6, o 9 con la progresión avanzada (migración 99)
  -- nivel pedido; si se agotara (no debería con el banco construido), el más cercano, primero hacia abajo
  for v_intento in 0 .. 10 loop
    v_nivel := case when v_intento = 0 then i.nivel
                    when v_intento % 2 = 1 then i.nivel - (v_intento + 1) / 2
                    else i.nivel + v_intento / 2 end;
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
  if v_nivel <> i.nivel then
    perform public.maraton_log(p_m.id, i.user_id, null, 'nivel_sin_problemas', jsonb_build_object('pedido', i.nivel, 'presentado', v_nivel), i.user_id);
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

create or replace function public.maraton_previo(p_m public.maraton_actividades, i public.maraton_inscripciones, p_pres uuid, p_idem uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare x public.maraton_presentaciones; j public.maraton_jornadas; cal jsonb;
  v_gracia integer := coalesce((public.maraton_cfg(p_m.config) -> 'seguridad' ->> 'gracia_s')::int, 120);
begin
  if p_idem is null then raise exception 'Falta la clave de la operación' using errcode = '22023'; end if;
  if exists (select 1 from public.maraton_presentaciones where idem = p_idem and inscripcion_id = i.id) then return 'ya_procesada'; end if;
  if exists (select 1 from public.maraton_presentaciones where idem = p_idem) then raise exception 'Operación no válida' using errcode = '22023'; end if;
  -- una etapa ya entregada (doble envío, otra pestaña) no se registra dos veces (migración 99)
  if exists (select 1 from public.maraton_respuestas_etapa where idem = p_idem and inscripcion_id = i.id) then return 'ya_procesada'; end if;
  if exists (select 1 from public.maraton_respuestas_etapa where idem = p_idem) then raise exception 'Operación no válida' using errcode = '22023'; end if;
  select * into x from public.maraton_presentaciones where id = p_pres and inscripcion_id = i.id;
  if x.id is null then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  if x.cerrada_at is not null or i.presentacion_actual is distinct from x.id then return 'ya_cerrada'; end if;
  select * into j from public.maraton_jornadas where id = x.jornada_id;
  if j.estado <> 'en_curso' then return 'jornada_cerrada'; end if;
  if not i.prueba and (j.reabierta_hasta is null or j.reabierta_hasta < now()) then
    cal := public.maraton_calendario(p_m, j.numero);
    if cal is null or now() > (cal ->> 'cierra')::timestamptz + make_interval(secs => v_gracia) then
      perform public.maraton_jornada_activa(p_m, i, false);
      return 'jornada_cerrada';
    end if;
  end if;
  return null;
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

create or replace function public.svc_maraton_clave(p_user uuid, p_presentacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare x public.maraton_presentaciones; a record; i public.maraton_inscripciones;
begin
  select * into x from public.maraton_presentaciones where id = p_presentacion;
  if x.id is null then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  select * into i from public.maraton_inscripciones where id = x.inscripcion_id;
  if i.user_id is distinct from p_user then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  select * into a from public.maraton_acceso(i.maraton_id, p_user);
  -- solo la clave de la etapa ABIERTA (migración 99): la Edge Function nunca recibe la de etapas futuras
  return jsonb_build_object('abierta', x.cerrada_at is null, 'etapa', x.etapa_actual, 'etapas_total', x.etapas_total,
    'clave', case when x.cerrada_at is null then
      case when x.etapa_actual = 1 then (select k.clave from public.maraton_claves k where k.variante_id = x.variante_id)
           else (select k.clave from public.maraton_etapas_claves k where k.variante_id = x.variante_id and k.numero = x.etapa_actual) end end);
end $$;

create or replace function public.svc_maraton_responder(p_user uuid, p_presentacion uuid, p_idem uuid, p_respuesta jsonb,
  p_procedimiento text, p_segundos_cliente numeric, p_correcta boolean, p_detalle jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; v_insc uuid; v_aviso text; v_j uuid;
begin
  if p_correcta is null then raise exception 'Falta el resultado' using errcode = '22023'; end if;
  select inscripcion_id, jornada_id into v_insc, v_j from public.maraton_presentaciones where id = p_presentacion;
  select * into a from public.maraton_acceso((select maraton_id from public.maraton_inscripciones where id = v_insc), p_user);
  i := public.maraton_inscripcion(a.m, p_user, a.prueba, false);
  if i.id is distinct from v_insc then raise exception 'Ese problema no le corresponde' using errcode = '42501'; end if;
  v_aviso := public.maraton_previo(a.m, i, p_presentacion, p_idem);
  if v_aviso is not null then return public.maraton_estado_json(a.m, i.id, v_aviso); end if;
  -- un problema por etapas solo se cierra por svc_maraton_etapa (no se puede saltar al resultado final)
  if (select etapas_total from public.maraton_presentaciones where id = p_presentacion) > 1 then
    raise exception 'Este problema tiene varias etapas: actualice la página' using errcode = 'P0001'; end if;
  perform public.maraton_cerrar(a.m, p_presentacion, 'respuesta', p_correcta, p_respuesta, p_procedimiento, p_segundos_cliente, p_idem, p_detalle);
  perform public.maraton_continuar(a.m, i.id, v_j);
  return public.maraton_estado_json(a.m, i.id, null, jsonb_build_object('resultado', case when p_correcta then 'correcta' else 'incorrecta' end));
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
        'accion', x.accion, 'resultado', x.resultado, 'procedimiento', x.procedimiento,
        -- problema por etapas (migración 99): respuesta y detalle de todas las partes en orden, también mientras está abierto
        'respuesta', coalesce(x.respuesta, (select jsonb_build_object('partes', jsonb_agg(p order by r.etapa, o.n))
            from public.maraton_respuestas_etapa r cross join lateral jsonb_array_elements(r.respuesta -> 'partes') with ordinality o(p, n)
           where r.presentacion_id = x.id having count(*) > 0)),
        'detalle', coalesce(x.detalle, (select jsonb_build_object('partes', jsonb_agg(p order by r.etapa, o.n))
            from public.maraton_respuestas_etapa r cross join lateral jsonb_array_elements(r.detalle -> 'partes') with ordinality o(p, n)
           where r.presentacion_id = x.id having count(*) > 0)),
        'etapa_actual', x.etapa_actual, 'etapas_total', x.etapas_total, 'comprobacion', x.comprobacion,
        'etapas', (select coalesce(jsonb_agg(jsonb_build_object('numero', e.numero, 'tipo', e.tipo, 'enunciado', e.enunciado, 'partes', e.partes,
                     'clave', ek.clave, 'respuesta', r.respuesta -> 'partes', 'correcta', r.correcta, 'entregada_at', r.created_at) order by e.numero), '[]')
                   from public.maraton_etapas e
                   left join public.maraton_etapas_claves ek on ek.variante_id = e.variante_id and ek.numero = e.numero
                   left join public.maraton_respuestas_etapa r on r.presentacion_id = x.id and r.etapa = e.numero
                  where e.variante_id = x.variante_id and (e.tipo = 'etapa' or x.comprobacion)),
        'etapa1', (select jsonb_build_object('respuesta', r.respuesta -> 'partes', 'correcta', r.correcta, 'entregada_at', r.created_at)
                   from public.maraton_respuestas_etapa r where r.presentacion_id = x.id and r.etapa = 1),
        'segundos', x.segundos, 'segundos_cliente', x.segundos_cliente, 'anticipada', x.anticipada, 'unidades', x.unidades,
        'nivel_despues', x.nivel_despues, 'comodines_antes', x.comodines_antes, 'comodines_despues', x.comodines_despues,
        'enunciado', v.enunciado,
        'partes', v.partes || coalesce((select jsonb_agg(p order by e.numero, o.n) from public.maraton_etapas e
            cross join lateral jsonb_array_elements(e.partes) with ordinality o(p, n)
           where e.variante_id = x.variante_id and (e.tipo = 'etapa' or x.comprobacion)), '[]'),
        'clave', case when k.clave is not null then jsonb_build_object('partes', (k.clave -> 'partes') || coalesce((select jsonb_agg(p order by ek.numero, o.n)
            from public.maraton_etapas_claves ek join public.maraton_etapas e on e.variante_id = ek.variante_id and e.numero = ek.numero
            cross join lateral jsonb_array_elements(ek.clave -> 'partes') with ordinality o(p, n)
           where ek.variante_id = x.variante_id and (e.tipo = 'etapa' or x.comprobacion)), '[]')) end) order by x.secuencia), '[]')
      from public.maraton_presentaciones x join public.maraton_jornadas j on j.id = x.jornada_id
      join public.maraton_variantes v on v.id = x.variante_id join public.maraton_plantillas pl on pl.id = x.plantilla_id
      left join public.maraton_claves k on k.variante_id = x.variante_id
      where x.inscripcion_id = i.id),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'jornada', e.jornada, 'datos', e.datos, 'actor', e.actor, 'created_at', e.created_at)
                  order by e.id), '[]') from public.maraton_eventos e where e.maraton_id = m.id and e.user_id = p_user),
    'incidencias', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.maraton_incidencias x
                     where x.maraton_id = m.id and x.user_id = p_user));
end $$;

create or replace function public.maraton_mi_informe(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; r jsonb;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  if not a.prueba and not public.maraton_informe_visible(a.m) then
    raise exception 'El informe estará disponible cuando el profesor lo publique' using errcode = 'P0001'; end if;
  select * into i from public.maraton_inscripciones where maraton_id = p_maraton and user_id = auth.uid();
  if i.id is null then return jsonb_build_object('participo', false); end if;
  r := public.maraton_resumen_inscripcion(i.id);
  -- el estudiante no necesita la ponderación ni las unidades internas
  return jsonb_build_object('participo', true, 'titulo', (a.m).titulo,
    'jornadas_total', (public.maraton_cfg((a.m).config) -> 'programacion' ->> 'jornadas')::int,
    -- sin niveles ni señales internas (migración 99): ni nivel máximo, ni reparto por nivel, ni respuestas anticipadas
    'resumen', (r - 'unidades' - 'via_cuota' - 'via_alternativa' - 'jornadas_revision' - 'nivel_maximo' - 'nivel_maximo_correcto'
                  - 'extremos_resueltos' - 'por_nivel' - 'anticipadas')
               || jsonb_build_object('por_jornada', (select coalesce(jsonb_agg(q - 'nivel_medio' - 'nivel_maximo' - 'unidades' - 'anticipadas'), '[]')
                    from jsonb_array_elements(r -> 'por_jornada') q)),
    'aviso', 'Este informe describe su trabajo. No es una calificación: la decisión sobre la recuperación corresponde al profesor.');
end $$;

create or replace function public.maraton_reiniciar_prueba(p_maraton uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton); v_insc uuid;
begin
  select id into v_insc from public.maraton_inscripciones where maraton_id = m.id and user_id = auth.uid() and prueba;
  if v_insc is null then return; end if;
  perform set_config('maraton.reinicio', 'si', true);
  delete from public.maraton_respuestas_etapa where inscripcion_id = v_insc;
  delete from public.maraton_presentaciones where inscripcion_id = v_insc;
  delete from public.maraton_jornadas where inscripcion_id = v_insc;
  delete from public.maraton_inscripciones where id = v_insc and prueba;
  perform set_config('maraton.reinicio', 'no', true);
end $$;

create or replace function public.maraton_banco_muestra(p_plantilla text, p_cuantas integer default 3) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.maraton_banco_docente((select banco_id from public.maraton_plantillas where id = p_plantilla));
  return (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'n', v.n, 'enunciado', v.enunciado, 'partes', v.partes, 'datos', v.datos,
      'clave', k.clave, 'solucion', k.solucion, 'verificacion', k.verificacion, 'estado', v.estado,
      'etapas', (select coalesce(jsonb_agg(jsonb_build_object('numero', e.numero, 'tipo', e.tipo, 'enunciado', e.enunciado, 'partes', e.partes,
                   'clave', ek.clave, 'solucion', ek.solucion) order by e.numero), '[]')
                 from public.maraton_etapas e left join public.maraton_etapas_claves ek on ek.variante_id = e.variante_id and ek.numero = e.numero
                where e.variante_id = v.id)) order by v.n), '[]')
    from (select * from public.maraton_variantes where plantilla_id = p_plantilla order by n limit greatest(1, least(coalesce(p_cuantas, 3), 50))) v
    left join public.maraton_claves k on k.variante_id = v.id);
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer), como en la migración 94
  foreach f in array array['maraton_defaults()', 'maraton_config_errores(jsonb)', 'maraton_nivel_max(public.maraton_actividades)',
    'maraton_presentar(public.maraton_actividades, uuid, uuid)',
    'maraton_cerrar(public.maraton_actividades, uuid, text, boolean, jsonb, text, numeric, uuid, jsonb)',
    'maraton_previo(public.maraton_actividades, public.maraton_inscripciones, uuid, uuid)',
    'maraton_estado_json(public.maraton_actividades, uuid, text, jsonb)', 'maraton_respuesta_etapa_inmutable()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- servidor de calificación: solo service_role
  foreach f in array array['svc_maraton_clave(uuid, uuid)',
    'svc_maraton_responder(uuid, uuid, uuid, jsonb, text, numeric, boolean, jsonb)',
    'svc_maraton_etapa(uuid, uuid, uuid, integer, jsonb, text, numeric, boolean, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- llamables con sesión (cada una comprueba quién llama)
  foreach f in array array['maraton_historial(uuid, uuid)', 'maraton_mi_informe(uuid)', 'maraton_reiniciar_prueba(uuid)',
    'maraton_banco_muestra(text, integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
