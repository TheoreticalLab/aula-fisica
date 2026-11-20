-- Migración 107 · Entrenador: práctica libre con ejercicios de un banco preconstruido, con corrección inmediata.
--
-- Pedido del profesor (19-nov-2026): que los estudiantes de la sección de laboratorio entrenen para el próximo examen con
-- ejercicios de los temas de los exámenes, con números nuevos cada vez. El banco es el del Maratón adaptativo
-- (maraton_plantillas → maraton_variantes + maraton_claves); el Entrenador solo lo lee.
--  · Un entrenador por sección y banco (entrenadores). Lo crea el profesor como dato; puede activarlo o desactivarlo.
--  · SIN NIVELES NI PROGRESIÓN (decisión del profesor): cada ejercicio se elige al azar entre las variantes validadas del
--    banco (opcionalmente de un tema), sin repetir variante mientras queden y sin repetir el tipo de problema reciente.
--  · Corrección inmediata: N intentos por ejercicio (predeterminado 2). Al acertar, al agotar los intentos o si el
--    estudiante pide verla, el ejercicio se cierra y se muestra la solución desarrollada. Un ejercicio cerrado no cambia.
--  · NUNCA CALIFICA: no hay vínculo con el registro de calificaciones (calificacion_automatica = false, como el maratón).
--  · Las claves solo salen hacia la Edge Function «entrenador» (svc_entrenador_clave, service_role), que califica con el
--    motor de siempre y registra con svc_entrenador_responder. La solución se entrega solo con el ejercicio cerrado.
--  · El profesorado de la sección ve un informe: cuánto entrenó cada estudiante, aciertos, temas y sus respuestas.
--  · Historial de estudiantes: entrenador_ejercicios y entrenador_respuestas (protegidas; las respuestas solo se añaden).
set local lock_timeout = '5s';

create table if not exists public.entrenadores (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  banco_id text not null references public.maraton_bancos (id) on delete restrict,
  titulo text not null check (char_length(titulo) between 1 and 160),
  descripcion text not null default '',
  intentos smallint not null default 2 check (intentos between 1 and 5),
  activo boolean not null default true,
  calificacion_automatica boolean not null default false check (calificacion_automatica = false),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entrenadores_class_idx on public.entrenadores (class_id);

create table if not exists public.entrenador_ejercicios (
  id uuid primary key default gen_random_uuid(),
  entrenador_id uuid not null references public.entrenadores (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  variante_id text not null references public.maraton_variantes (id) on delete restrict,
  plantilla_id text not null,
  tema text not null,
  prueba boolean not null default false,            -- recorrido del profesor (fuera del informe)
  intentos smallint not null default 0 check (intentos >= 0),
  estado text not null default 'abierto' check (estado in ('abierto', 'correcto', 'agotado', 'solucion')),
  segundos integer check (segundos >= 0),           -- min(tiempo activo del navegador, reloj del servidor, 30 min)
  presentado_at timestamptz not null default now(),
  cerrado_at timestamptz,
  check ((estado = 'abierto') = (cerrado_at is null))
);
create index if not exists entrenador_ejercicios_user_idx on public.entrenador_ejercicios (entrenador_id, user_id, presentado_at);
-- a lo sumo un ejercicio abierto por estudiante y entrenador
create unique index if not exists entrenador_ejercicios_abierto_uidx on public.entrenador_ejercicios (entrenador_id, user_id) where estado = 'abierto';

create table if not exists public.entrenador_respuestas (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references public.entrenador_ejercicios (id) on delete restrict,
  n smallint not null check (n >= 1),
  idem uuid not null unique,
  partes jsonb not null check (jsonb_typeof(partes) = 'array'),
  correcta boolean not null,
  detalle jsonb,
  created_at timestamptz not null default now(),
  unique (ejercicio_id, n)
);

-- RLS sin políticas: todo pasa por las funciones de abajo
alter table public.entrenadores enable row level security;
alter table public.entrenador_ejercicios enable row level security;
alter table public.entrenador_respuestas enable row level security;

create or replace function public.entrenador_respuestas_inmutables() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Las respuestas del Entrenador no se pueden alterar';
end $$;
drop trigger if exists entrenador_respuestas_inmutable on public.entrenador_respuestas;
create trigger entrenador_respuestas_inmutable before update or delete on public.entrenador_respuestas
  for each row execute function public.entrenador_respuestas_inmutables();

-- -----------------------------------------------------------------------------
-- Acceso: estudiante matriculado (entrenador activo) o profesor de la sección / administrador (recorrido de prueba)
-- -----------------------------------------------------------------------------
create or replace function public.entrenador_acceso(p_ent uuid, p_user uuid, out e public.entrenadores, out prueba boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  select * into e from public.entrenadores where id = p_ent;
  if e.id is null or p_user is null or not public.account_ok(p_user) then
    raise exception 'No tiene acceso a este entrenador' using errcode = '42501';
  end if;
  if public.is_teacher_user(p_user) and (exists (select 1 from public.class_teachers t where t.class_id = e.class_id and t.user_id = p_user)
       or exists (select 1 from public.profiles pr where pr.id = p_user and pr.role = 'admin')) then
    prueba := true; return;
  end if;
  if e.activo and exists (select 1 from public.enrollments n where n.class_id = e.class_id and n.user_id = p_user)
     and not public.baja_vigente(e.class_id, p_user) then
    prueba := false; return;
  end if;
  raise exception 'No tiene acceso a este entrenador' using errcode = '42501';
end $$;

-- Ejercicio para el estudiante: enunciado y casillas; con el ejercicio cerrado, también la solución y los valores
create or replace function public.entrenador_ejercicio_json(p_ej uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', x.id, 'tema', x.tema, 'estado', x.estado, 'intentos', x.intentos, 'intentos_max', en.intentos,
    'enunciado', v.enunciado,
    'partes', (select coalesce(jsonb_agg(jsonb_build_object('etiqueta', p ->> 'etiqueta', 'unidad', coalesce(p ->> 'unidad', '')) order by o), '[]')
               from jsonb_array_elements(v.partes) with ordinality as t(p, o)),
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('n', r.n, 'partes', r.partes, 'correcta', r.correcta, 'detalle', r.detalle) order by r.n), '[]')
                   from public.entrenador_respuestas r where r.ejercicio_id = x.id),
    'solucion', case when x.estado <> 'abierto' then k.solucion end,
    'valores', case when x.estado <> 'abierto' then (select coalesce(jsonb_agg(c ->> 'value' order by o), '[]')
                                                    from jsonb_array_elements(k.clave -> 'partes') with ordinality as t(c, o)) end)
  from public.entrenador_ejercicios x
  join public.entrenadores en on en.id = x.entrenador_id
  join public.maraton_variantes v on v.id = x.variante_id
  left join public.maraton_claves k on k.variante_id = x.variante_id
  where x.id = p_ej
$$;

create or replace function public.entrenador_resumen(p_ent uuid, p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ejercicios', count(*) filter (where estado <> 'abierto'),
    'correctos', count(*) filter (where estado = 'correcto'),
    'primer_intento', count(*) filter (where estado = 'correcto' and intentos = 1),
    'sin_resolver', count(*) filter (where estado in ('agotado', 'solucion')),
    'hoy', count(*) filter (where estado <> 'abierto' and (cerrado_at at time zone 'America/Santo_Domingo')::date = (now() at time zone 'America/Santo_Domingo')::date),
    'minutos', round(coalesce(sum(segundos), 0) / 60.0))
  from public.entrenador_ejercicios where entrenador_id = p_ent and user_id = p_user
$$;

create or replace function public.entrenador_estado_json(p_e public.entrenadores, p_user uuid, p_prueba boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'entrenador', jsonb_build_object('id', p_e.id, 'titulo', p_e.titulo, 'descripcion', p_e.descripcion, 'intentos', p_e.intentos, 'activo', p_e.activo),
    'prueba', p_prueba,
    'temas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) order by t.orden), '[]')
              from public.maraton_temas t where t.banco_id = p_e.banco_id and t.estado = 'verificado'
                and exists (select 1 from public.maraton_plantillas p where p.banco_id = t.banco_id and p.tema = t.codigo and p.estado = 'validada')),
    'resumen', public.entrenador_resumen(p_e.id, p_user),
    'actual', (select public.entrenador_ejercicio_json(x.id) from public.entrenador_ejercicios x
               where x.entrenador_id = p_e.id and x.user_id = p_user and x.estado = 'abierto'))
$$;

-- -----------------------------------------------------------------------------
-- Estudiante
-- -----------------------------------------------------------------------------
create or replace function public.entrenador_mis() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'descripcion', e.descripcion, 'class_id', e.class_id,
           'seccion', c.name, 'resumen', public.entrenador_resumen(e.id, auth.uid())) order by e.created_at), '[]')
  from public.entrenadores e join public.classes c on c.id = e.class_id
  where public.my_account_ok() and e.activo
    and exists (select 1 from public.enrollments n where n.class_id = e.class_id and n.user_id = auth.uid())
    and not public.baja_vigente(e.class_id, auth.uid())
$$;

create or replace function public.entrenador_estado(p_ent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a record;
begin
  select * into a from public.entrenador_acceso(p_ent, auth.uid());
  return public.entrenador_estado_json(a.e, auth.uid(), a.prueba);
end $$;

-- Siguiente ejercicio (si hay uno abierto, devuelve ese). p_tema: null = todos los temas.
create or replace function public.entrenador_siguiente(p_ent uuid, p_tema text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; v_user uuid := auth.uid(); v_var text; v_pl text; v_tema text; v_recientes text[];
begin
  select * into a from public.entrenador_acceso(p_ent, v_user);
  -- serializa las peticiones del mismo estudiante en este entrenador (doble clic, dos pestañas)
  perform pg_advisory_xact_lock(hashtextextended(p_ent::text || v_user::text, 0));
  if p_tema is not null and not exists (select 1 from public.maraton_temas where banco_id = (a.e).banco_id and codigo = p_tema) then
    raise exception 'Tema desconocido' using errcode = '22023';
  end if;
  if exists (select 1 from public.entrenador_ejercicios where entrenador_id = p_ent and user_id = v_user and estado = 'abierto') then
    return public.entrenador_estado_json(a.e, v_user, a.prueba);
  end if;
  select coalesce(array_agg(plantilla_id), '{}') into v_recientes from (
    select plantilla_id from public.entrenador_ejercicios where entrenador_id = p_ent and user_id = v_user
    order by presentado_at desc limit 8) r;
  -- al azar: primero variantes no vistas de tipos no recientes; si se agotan, se relaja (no vistas, luego cualquiera)
  select v.id, p.id, p.tema into v_var, v_pl, v_tema
  from public.maraton_variantes v join public.maraton_plantillas p on p.id = v.plantilla_id
  where p.banco_id = (a.e).banco_id and p.estado = 'validada' and v.estado = 'validada' and (p_tema is null or p.tema = p_tema)
  order by (exists (select 1 from public.entrenador_ejercicios x where x.entrenador_id = p_ent and x.user_id = v_user and x.variante_id = v.id)),
           (p.id = any (v_recientes)), random()
  limit 1;
  if v_var is null then raise exception 'Este entrenador no tiene ejercicios disponibles' using errcode = 'P0001'; end if;
  insert into public.entrenador_ejercicios (entrenador_id, user_id, variante_id, plantilla_id, tema, prueba)
  values (p_ent, v_user, v_var, v_pl, v_tema, a.prueba);
  return public.entrenador_estado_json(a.e, v_user, a.prueba);
end $$;

-- «Ver la solución»: cierra el ejercicio abierto sin resolverlo (o devuelve uno ya cerrado del estudiante)
create or replace function public.entrenador_ver_solucion(p_ejercicio uuid, p_segundos_cliente numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.entrenador_ejercicios; a record;
begin
  select * into x from public.entrenador_ejercicios where id = p_ejercicio for update;
  if x.id is null or x.user_id is distinct from auth.uid() then raise exception 'Ese ejercicio no le corresponde' using errcode = '42501'; end if;
  select * into a from public.entrenador_acceso(x.entrenador_id, auth.uid());
  if x.estado = 'abierto' then
    update public.entrenador_ejercicios set estado = 'solucion', cerrado_at = now(),
      segundos = public.entrenador_segundos(x.presentado_at, p_segundos_cliente)
    where id = x.id;
  end if;
  return public.entrenador_ejercicio_json(x.id);
end $$;

-- tiempo acreditado: min(tiempo activo informado por el navegador, reloj del servidor, 30 min)
create or replace function public.entrenador_segundos(p_desde timestamptz, p_cliente numeric) returns integer
language sql stable set search_path = '' as $$
  select least(greatest(0, extract(epoch from now() - p_desde)), coalesce(greatest(0, p_cliente), 1e9), 1800)::integer
$$;

-- -----------------------------------------------------------------------------
-- Edge Function «entrenador» (solo service_role)
-- -----------------------------------------------------------------------------
create or replace function public.svc_entrenador_clave(p_user uuid, p_ejercicio uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare x public.entrenador_ejercicios; a record;
begin
  select * into x from public.entrenador_ejercicios where id = p_ejercicio;
  if x.id is null or x.user_id is distinct from p_user then raise exception 'Ese ejercicio no le corresponde' using errcode = '42501'; end if;
  select * into a from public.entrenador_acceso(x.entrenador_id, p_user);
  return jsonb_build_object('abierto', x.estado = 'abierto',
    'clave', case when x.estado = 'abierto' then (select k.clave from public.maraton_claves k where k.variante_id = x.variante_id) end);
end $$;

create or replace function public.svc_entrenador_responder(p_user uuid, p_ejercicio uuid, p_idem uuid, p_partes jsonb,
  p_correcta boolean, p_detalle jsonb, p_segundos_cliente numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.entrenador_ejercicios; a record; v_max integer; v_estado text;
begin
  if p_correcta is null or p_idem is null or jsonb_typeof(p_partes) is distinct from 'array' then
    raise exception 'Respuesta incompleta' using errcode = '22023';
  end if;
  select * into x from public.entrenador_ejercicios where id = p_ejercicio for update;
  if x.id is null or x.user_id is distinct from p_user then raise exception 'Ese ejercicio no le corresponde' using errcode = '42501'; end if;
  select * into a from public.entrenador_acceso(x.entrenador_id, p_user);
  -- doble envío o ejercicio ya cerrado: estado vigente, sin escribir
  if exists (select 1 from public.entrenador_respuestas where idem = p_idem) or x.estado <> 'abierto' then
    return jsonb_build_object('registrada', false, 'ejercicio', public.entrenador_ejercicio_json(x.id), 'resumen', public.entrenador_resumen(x.entrenador_id, p_user));
  end if;
  v_max := (a.e).intentos;
  insert into public.entrenador_respuestas (ejercicio_id, n, idem, partes, correcta, detalle)
  values (x.id, x.intentos + 1, p_idem, p_partes, p_correcta, p_detalle);
  v_estado := case when p_correcta then 'correcto' when x.intentos + 1 >= v_max then 'agotado' else 'abierto' end;
  update public.entrenador_ejercicios set intentos = x.intentos + 1, estado = v_estado,
    cerrado_at = case when v_estado <> 'abierto' then now() end,
    segundos = case when v_estado <> 'abierto' then public.entrenador_segundos(x.presentado_at, p_segundos_cliente) end
  where id = x.id;
  return jsonb_build_object('registrada', true, 'correcta', p_correcta, 'detalle', p_detalle,
    'ejercicio', public.entrenador_ejercicio_json(x.id), 'resumen', public.entrenador_resumen(x.entrenador_id, p_user));
end $$;

-- -----------------------------------------------------------------------------
-- Profesorado de la sección
-- -----------------------------------------------------------------------------
create or replace function public.entrenador_de_clase(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'activo', e.activo, 'intentos', e.intentos) order by e.created_at), '[]')
          from public.entrenadores e where e.class_id = p_class);
end $$;

create or replace function public.entrenador_activar(p_ent uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_class uuid;
begin
  select class_id into v_class from public.entrenadores where id = p_ent;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  update public.entrenadores set activo = coalesce(p_activo, activo), updated_at = now() where id = p_ent;
end $$;

-- Informe: por estudiante matriculado (también quien no ha entrenado) y por tema; sin recorridos de prueba
create or replace function public.entrenador_informe(p_ent uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.entrenadores;
begin
  select * into e from public.entrenadores where id = p_ent;
  if e.id is null or not public.is_class_teacher(e.class_id) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return jsonb_build_object(
    'entrenador', jsonb_build_object('id', e.id, 'titulo', e.titulo, 'activo', e.activo, 'intentos', e.intentos),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', pr.id, 'nombre', pr.full_name,
                      'resumen', public.entrenador_resumen(e.id, pr.id),
                      'ultimo', (select max(x.presentado_at) from public.entrenador_ejercicios x where x.entrenador_id = e.id and x.user_id = pr.id))
                      order by pr.full_name), '[]')
                    from public.enrollments n join public.profiles pr on pr.id = n.user_id
                    where n.class_id = e.class_id and pr.role = 'student' and not public.fuera_de_seccion(e.class_id, pr.id)),
    'temas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre,
                'ejercicios', (select count(*) from public.entrenador_ejercicios x where x.entrenador_id = e.id and x.tema = t.codigo and not x.prueba and x.estado <> 'abierto'),
                'correctos', (select count(*) from public.entrenador_ejercicios x where x.entrenador_id = e.id and x.tema = t.codigo and not x.prueba and x.estado = 'correcto'))
                order by t.orden), '[]')
              from public.maraton_temas t where t.banco_id = e.banco_id));
end $$;

-- Ejercicios de un estudiante, del más reciente al más antiguo (con sus respuestas y la clave)
create or replace function public.entrenador_detalle(p_ent uuid, p_user uuid, p_limite integer default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.entrenadores;
begin
  select * into e from public.entrenadores where id = p_ent;
  if e.id is null or not public.is_class_teacher(e.class_id) then raise exception 'Solo el profesorado de la sección' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(j order by (j ->> 'presentado_at') desc), '[]') from (
    select public.entrenador_ejercicio_json(x.id) || jsonb_build_object('presentado_at', x.presentado_at, 'cerrado_at', x.cerrado_at,
             'segundos', x.segundos, 'plantilla', x.plantilla_id,
             'valores', (select coalesce(jsonb_agg(c ->> 'value' order by o), '[]')
                         from public.maraton_claves k, jsonb_array_elements(k.clave -> 'partes') with ordinality as t(c, o) where k.variante_id = x.variante_id)) j
    from public.entrenador_ejercicios x where x.entrenador_id = p_ent and x.user_id = p_user
    order by x.presentado_at desc limit greatest(1, least(coalesce(p_limite, 100), 500))) s);
end $$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on table public.entrenadores, public.entrenador_ejercicios, public.entrenador_respuestas from public, anon, authenticated;
grant all on table public.entrenadores, public.entrenador_ejercicios, public.entrenador_respuestas to service_role;

do $$ declare f text; begin
  -- internas: solo las propias funciones (security definer)
  foreach f in array array['entrenador_acceso(uuid, uuid)', 'entrenador_ejercicio_json(uuid)', 'entrenador_resumen(uuid, uuid)',
    'entrenador_estado_json(public.entrenadores, uuid, boolean)', 'entrenador_segundos(timestamptz, numeric)',
    'entrenador_respuestas_inmutables()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- Edge Function
  foreach f in array array['svc_entrenador_clave(uuid, uuid)', 'svc_entrenador_responder(uuid, uuid, uuid, jsonb, boolean, jsonb, numeric)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- estudiante y profesorado (cada función comprueba el acceso)
  foreach f in array array['entrenador_mis()', 'entrenador_estado(uuid)', 'entrenador_siguiente(uuid, text)',
    'entrenador_ver_solucion(uuid, numeric)', 'entrenador_de_clase(uuid)', 'entrenador_activar(uuid, boolean)',
    'entrenador_informe(uuid)', 'entrenador_detalle(uuid, uuid, integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
