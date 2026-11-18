-- Migración 105 · AURORA-07: entrevista automatizada de verificación académica (una por estudiante y maratón).
--
-- Un guion determinista (árbol de preguntas con ramas programadas) que se carga como datos privados y que el profesor
-- habilita cuando decide. Durante la entrevista no interviene ningún modelo de lenguaje ni servicio externo: el servidor
-- solo guarda cada respuesta y elige la pregunta siguiente según reglas fijas del guion.
--  · El estudiante ve su conversación (preguntas y sus respuestas), nunca el guion completo ni el informe.
--  · El profesorado de la sección ve el informe: declaraciones, registros del maratón en las jornadas indicadas y las
--    visitas a la página de inicio del aula esos días. El contraste se calcula en el navegador del profesor con reglas fijas.
--  · No toca el maratón (ni sus tablas ni sus funciones) ni las calificaciones. Solo se añaden respuestas.
--
-- Guion (jsonb): {"inicio": "<nodo>", "nodos": {"<nodo>": {...}}}. Cada nodo: tipo 'info' (botón), 'opcion' (opciones
-- {valor, texto, pide_texto?, siguiente?}), 'texto' (max, opcional?) o 'fin'. Pregunta siguiente: la de la opción elegida;
-- si no, la primera rama {"si": {"nodo", "en": [valores]}, "ir"} que se cumpla con respuestas anteriores; si no, «siguiente».
-- Los demás campos (afirmacion, episodio, …) solo los usa el informe del profesor.

create table if not exists public.aurora_entrevistas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  jornadas smallint[] not null check (cardinality(jornadas) between 1 and 14),
  titulo text not null check (char_length(titulo) between 3 and 200),
  titulo_informe text not null check (char_length(titulo_informe) between 3 and 300),
  guion jsonb not null,
  estado text not null default 'preparada' check (estado in ('preparada', 'abierta', 'finalizada')),
  nodo_actual text,
  habilitada_at timestamptz,
  habilitada_por uuid references public.profiles (id) on delete set null,
  iniciada_at timestamptz,
  finalizada_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, maraton_id)   -- una sola entrevista por estudiante y maratón
);

create table if not exists public.aurora_respuestas (
  id bigint generated always as identity primary key,
  entrevista_id uuid not null references public.aurora_entrevistas (id) on delete restrict,
  nodo text not null,
  pregunta text not null,
  valor text,
  texto text check (texto is null or char_length(texto) <= 6000),
  mostrada text not null,
  idem uuid not null unique,
  created_at timestamptz not null default now()
);
create index if not exists aurora_respuestas_entrevista_idx on public.aurora_respuestas (entrevista_id, id);

-- RLS sin políticas ni permisos directos: todo pasa por funciones que comprueban quién llama
alter table public.aurora_entrevistas enable row level security;
alter table public.aurora_respuestas enable row level security;
drop trigger if exists aurora_respuestas_inmutable on public.aurora_respuestas;
create trigger aurora_respuestas_inmutable before update or delete on public.aurora_respuestas
  for each row execute function public.maraton_solo_anadir();
drop trigger if exists aurora_entrevistas_sin_borrado on public.aurora_entrevistas;
create trigger aurora_entrevistas_sin_borrado before delete on public.aurora_entrevistas
  for each row execute function public.maraton_solo_anadir();

-- Errores de un guion (vacío si es válido)
create or replace function public.aurora_guion_errores(g jsonb) returns text[]
language plpgsql immutable set search_path = '' as $$
declare e text[] := '{}'; k text; n jsonb; o jsonb; r jsonb; v_fin integer := 0; v_vals text[];
begin
  if jsonb_typeof(g -> 'nodos') <> 'object' then return array['El guion no tiene nodos.']; end if;
  if g -> 'nodos' -> (g ->> 'inicio') is null then e := array_append(e, 'El nodo de inicio no existe.'); end if;
  for k, n in select * from jsonb_each(g -> 'nodos') loop
    if coalesce(n ->> 'tipo', '') not in ('info', 'opcion', 'texto', 'fin') then e := array_append(e, format('%s: tipo no válido', k)); continue; end if;
    if coalesce(btrim(n ->> 'texto'), '') = '' then e := array_append(e, format('%s: sin texto', k)); end if;
    if n ->> 'tipo' = 'fin' then v_fin := v_fin + 1; continue; end if;
    if n ? 'siguiente' and g -> 'nodos' -> (n ->> 'siguiente') is null then e := array_append(e, format('%s: siguiente inexistente', k)); end if;
    for r in select * from jsonb_array_elements(coalesce(n -> 'ramas', '[]')) loop
      if g -> 'nodos' -> (r ->> 'ir') is null or g -> 'nodos' -> (r -> 'si' ->> 'nodo') is null or jsonb_typeof(r -> 'si' -> 'en') <> 'array' then
        e := array_append(e, format('%s: rama no válida', k)); end if;
    end loop;
    if n ->> 'tipo' = 'opcion' then
      if jsonb_typeof(n -> 'opciones') <> 'array' or jsonb_array_length(n -> 'opciones') < 2 then
        e := array_append(e, format('%s: necesita al menos dos opciones', k)); continue; end if;
      v_vals := '{}';
      for o in select * from jsonb_array_elements(n -> 'opciones') loop
        if coalesce(o ->> 'valor', '') = '' or coalesce(btrim(o ->> 'texto'), '') = '' or (o ->> 'valor') = any (v_vals) then
          e := array_append(e, format('%s: opción sin valor, sin texto o repetida', k)); end if;
        v_vals := array_append(v_vals, o ->> 'valor');
        if o ? 'siguiente' and g -> 'nodos' -> (o ->> 'siguiente') is null then e := array_append(e, format('%s: siguiente inexistente en una opción', k)); end if;
        if not (o ? 'siguiente') and not (n ? 'siguiente') then e := array_append(e, format('%s: una opción no lleva a ningún nodo', k)); end if;
      end loop;
    elsif not (n ? 'siguiente') then e := array_append(e, format('%s: sin siguiente', k));
    end if;
    if n ->> 'tipo' = 'texto' and coalesce((n ->> 'max')::int, 3000) not between 1 and 6000 then e := array_append(e, format('%s: máximo no válido', k)); end if;
  end loop;
  if v_fin = 0 then e := array_append(e, 'El guion no tiene final.'); end if;
  return e;
exception when others then return array['Guion no válido.'];
end $$;

create or replace function public.aurora_validar() returns trigger language plpgsql set search_path = '' as $$
declare e text[] := public.aurora_guion_errores(new.guion); begin
  if coalesce(array_length(e, 1), 0) > 0 then raise exception 'Guion de AURORA no válido: %', array_to_string(e, ' ') using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists aurora_entrevistas_validar on public.aurora_entrevistas;
create trigger aurora_entrevistas_validar before insert or update of guion on public.aurora_entrevistas
  for each row execute function public.aurora_validar();

-- Lo que el estudiante ve de un nodo: texto, tipo y opciones (sin ramas, destinos ni campos del informe)
create or replace function public.aurora_nodo_publico(n jsonb, p_nodo text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object('nodo', p_nodo, 'tipo', n ->> 'tipo', 'texto', n ->> 'texto', 'boton', n ->> 'boton',
    'max', case when n ->> 'tipo' = 'texto' then coalesce((n ->> 'max')::int, 3000) end, 'opcional', n -> 'opcional',
    'opciones', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('valor', o ->> 'valor', 'texto', o ->> 'texto', 'pide_texto', o -> 'pide_texto'))
                                  order by k)
                   from jsonb_array_elements(n -> 'opciones') with ordinality t(o, k))))
$$;

-- Estudiante: sus entrevistas habilitadas y sin terminar
create or replace function public.aurora_pendiente() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'iniciada', e.iniciada_at is not null) order by e.created_at), '[]')
    from public.aurora_entrevistas e where e.user_id = auth.uid() and e.estado = 'abierta'
$$;

-- Estudiante: su conversación y la pregunta actual
create or replace function public.aurora_estado(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.aurora_entrevistas;
begin
  select * into e from public.aurora_entrevistas where id = p_id;
  if e.id is null or e.user_id is distinct from auth.uid() or e.estado = 'preparada' then
    raise exception 'Entrevista no disponible' using errcode = '42501'; end if;
  return jsonb_build_object('id', e.id, 'titulo', e.titulo, 'estado', e.estado, 'finalizada_at', e.finalizada_at,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('pregunta', r.pregunta, 'respuesta', r.mostrada, 'at', r.created_at) order by r.id), '[]')
                    from public.aurora_respuestas r where r.entrevista_id = e.id),
    'actual', public.aurora_nodo_publico(e.guion -> 'nodos' -> e.nodo_actual, e.nodo_actual));
end $$;

-- Estudiante: responde la pregunta actual; el servidor elige la siguiente con las reglas del guion
create or replace function public.aurora_responder(p_id uuid, p_nodo text, p_valor text, p_texto text, p_idem uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.aurora_entrevistas; n jsonb; o jsonb; v_valor text; v_txt text := nullif(btrim(coalesce(p_texto, '')), '');
  v_most text; v_sig text;
begin
  select * into e from public.aurora_entrevistas where id = p_id for update;
  if e.id is null or e.user_id is distinct from auth.uid() or e.estado = 'preparada' then
    raise exception 'Entrevista no disponible' using errcode = '42501'; end if;
  -- doble envío o pestaña atrasada: no se registra nada y se devuelve el estado actual
  if p_idem is null or exists (select 1 from public.aurora_respuestas where idem = p_idem) or p_nodo is distinct from e.nodo_actual then
    return public.aurora_estado(p_id); end if;
  if e.estado = 'finalizada' then raise exception 'La entrevista ya terminó.' using errcode = 'P0001'; end if;
  n := e.guion -> 'nodos' -> e.nodo_actual;
  if n ->> 'tipo' = 'info' then
    v_most := coalesce(n ->> 'boton', 'Continuar'); v_txt := null;
  elsif n ->> 'tipo' = 'opcion' then
    select x into o from jsonb_array_elements(n -> 'opciones') x where x ->> 'valor' = p_valor;
    if o is null then raise exception 'Elija una de las opciones.' using errcode = 'P0001'; end if;
    if coalesce((o ->> 'pide_texto')::boolean, false) then
      if v_txt is null then raise exception 'Escriba su explicación para esta opción.' using errcode = 'P0001'; end if;
    else v_txt := null; end if;
    v_valor := p_valor;
    v_most := (o ->> 'texto') || coalesce(': ' || v_txt, '');
  elsif n ->> 'tipo' = 'texto' then
    if v_txt is null and not coalesce((n ->> 'opcional')::boolean, false) then raise exception 'Escriba su respuesta.' using errcode = 'P0001'; end if;
    v_most := coalesce(v_txt, '(sin respuesta)');
  else
    raise exception 'La entrevista ya terminó.' using errcode = 'P0001';
  end if;
  if char_length(v_txt) > coalesce((n ->> 'max')::int, 3000) then
    raise exception 'La respuesta es demasiado larga (máximo % caracteres).', coalesce((n ->> 'max')::int, 3000) using errcode = 'P0001'; end if;
  insert into public.aurora_respuestas (entrevista_id, nodo, pregunta, valor, texto, mostrada, idem)
  values (e.id, e.nodo_actual, n ->> 'texto', v_valor, v_txt, v_most, p_idem);
  -- siguiente: la de la opción; si no, la primera rama que se cumpla; si no, la del nodo
  v_sig := o ->> 'siguiente';
  if v_sig is null then
    select rm ->> 'ir' into v_sig from jsonb_array_elements(coalesce(n -> 'ramas', '[]')) with ordinality t(rm, k)
     where exists (select 1 from public.aurora_respuestas q
                    where q.entrevista_id = e.id and q.nodo = rm -> 'si' ->> 'nodo'
                      and q.valor in (select jsonb_array_elements_text(rm -> 'si' -> 'en')))
     order by k limit 1;
  end if;
  v_sig := coalesce(v_sig, n ->> 'siguiente');
  if v_sig is null or e.guion -> 'nodos' -> v_sig is null then raise exception 'Guion incompleto en %', e.nodo_actual; end if;
  update public.aurora_entrevistas
     set nodo_actual = v_sig, iniciada_at = coalesce(iniciada_at, now()),
         estado = case when e.guion -> 'nodos' -> v_sig ->> 'tipo' = 'fin' then 'finalizada' else estado end,
         finalizada_at = case when e.guion -> 'nodos' -> v_sig ->> 'tipo' = 'fin' then now() end
   where id = e.id;
  return public.aurora_estado(p_id);
end $$;

-- Profesor de la sección: habilita la entrevista (una sola vez)
create or replace function public.aurora_habilitar(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.aurora_entrevistas;
begin
  select * into e from public.aurora_entrevistas where id = p_id for update;
  if e.id is null then raise exception 'Entrevista no encontrada' using errcode = '42501'; end if;
  perform public.maraton_docente(e.maraton_id);   -- solo el profesorado de la sección
  if e.estado <> 'preparada' then raise exception 'La entrevista ya estaba habilitada.' using errcode = 'P0001'; end if;
  update public.aurora_entrevistas set estado = 'abierta', nodo_actual = e.guion ->> 'inicio', habilitada_at = now(), habilitada_por = auth.uid()
   where id = e.id;
  return public.aurora_informe(p_id);
end $$;

-- Profesor de la sección: expediente completo para el informe
create or replace function public.aurora_informe(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.aurora_entrevistas; m public.maraton_actividades; i public.maraton_inscripciones; v_fechas date[];
begin
  select * into e from public.aurora_entrevistas where id = p_id;
  if e.id is null then raise exception 'Entrevista no encontrada' using errcode = '42501'; end if;
  m := public.maraton_docente(e.maraton_id);
  select * into i from public.maraton_inscripciones where maraton_id = m.id and user_id = e.user_id;
  select coalesce(array_agg(j.fecha), '{}') into v_fechas from public.maraton_jornadas j where j.inscripcion_id = i.id and j.numero = any (e.jornadas);
  return jsonb_build_object(
    'entrevista', jsonb_build_object('id', e.id, 'titulo', e.titulo, 'titulo_informe', e.titulo_informe, 'estado', e.estado, 'jornadas', e.jornadas,
       'guion', e.guion, 'nodo_actual', e.nodo_actual, 'habilitada_at', e.habilitada_at, 'iniciada_at', e.iniciada_at, 'finalizada_at', e.finalizada_at,
       'habilitada_por', (select full_name from public.profiles where id = e.habilitada_por)),
    'estudiante', (select jsonb_build_object('nombre', full_name, 'login_id', login_id) from public.profiles where id = e.user_id),
    'maraton', jsonb_build_object('titulo', m.titulo, 'seccion', (select name from public.classes where id = m.class_id), 'fecha_inicio', m.fecha_inicio),
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('nodo', r.nodo, 'pregunta', r.pregunta, 'valor', r.valor, 'texto', r.texto,
                     'mostrada', r.mostrada, 'at', r.created_at) order by r.id), '[]') from public.aurora_respuestas r where r.entrevista_id = e.id),
    'jornadas', (select coalesce(jsonb_agg(to_jsonb(j) - 'inscripcion_id' - 'maraton_id' order by j.numero), '[]')
                   from public.maraton_jornadas j where j.inscripcion_id = i.id and j.numero = any (e.jornadas)),
    'presentaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'jornada', j.numero, 'secuencia', x.secuencia, 'titulo', pl.titulo,
        'tema', x.tema, 'nivel', x.nivel, 'variante_id', x.variante_id, 'plantilla_id', x.plantilla_id,
        'presentada_at', x.presentada_at, 'cerrada_at', x.cerrada_at, 'accion', x.accion, 'resultado', x.resultado,
        'segundos', x.segundos, 'segundos_cliente', x.segundos_cliente, 't_min_s', x.t_min_s, 'anticipada', x.anticipada,
        'respuesta', x.respuesta, 'procedimiento', x.procedimiento, 'etapas_total', x.etapas_total,
        'etapas', (select coalesce(jsonb_agg(jsonb_build_object('etapa', re.etapa, 'at', re.created_at, 'correcta', re.correcta,
                      'segundos_cliente', re.segundos_cliente, 'respuesta', re.respuesta) order by re.etapa), '[]')
                     from public.maraton_respuestas_etapa re where re.presentacion_id = x.id)) order by x.secuencia), '[]')
        from public.maraton_presentaciones x join public.maraton_jornadas j on j.id = x.jornada_id
        left join public.maraton_plantillas pl on pl.id = x.plantilla_id
       where x.inscripcion_id = i.id and j.numero = any (e.jornadas)),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', ev.tipo, 'jornada', ev.jornada, 'at', ev.created_at, 'datos', ev.datos) order by ev.created_at), '[]')
                  from public.maraton_eventos ev where ev.maraton_id = m.id and ev.user_id = e.user_id and ev.jornada = any (e.jornadas)),
    -- visitas a páginas del aula que miden tiempo (el maratón no lo hace) en las fechas de esas jornadas
    'visitas', (select coalesce(jsonb_agg(jsonb_build_object('seccion', v.section, 'pestana', left(v.session_id::text, 8), 'inicio', v.started_at,
                   'ultimo_latido', v.last_beat_at, 'efectivo_s', v.effective_seconds, 'oculto_s', v.hidden_seconds, 'inactivo_s', v.idle_seconds,
                   'tras_desconexion', v.offline_sync) order by v.started_at), '[]')
                  from public.study_visits v
                 where v.user_id = e.user_id and (v.started_at at time zone 'America/Santo_Domingo')::date = any (v_fechas)));
end $$;

revoke all on table public.aurora_entrevistas, public.aurora_respuestas from public, anon, authenticated;
grant all on table public.aurora_entrevistas, public.aurora_respuestas to service_role;

do $$ declare f text; begin
  foreach f in array array['aurora_guion_errores(jsonb)', 'aurora_validar()', 'aurora_nodo_publico(jsonb, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamables con sesión (cada una comprueba quién llama)
  foreach f in array array['aurora_pendiente()', 'aurora_estado(uuid)', 'aurora_responder(uuid, text, text, text, uuid)',
    'aurora_habilitar(uuid)', 'aurora_informe(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
