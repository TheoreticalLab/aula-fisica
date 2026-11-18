-- Maratón: preguntas de la plataforma a los participantes (decisión del profesor, 17-nov-2026).
--
-- El profesor quiere hacer a quienes participan una pregunta con un mensaje neutro de la plataforma: «¿Ha utilizado
-- inteligencia artificial…?» con las respuestas «Sí» y «No». Quien responde «Sí» queda fuera del maratón (tipo
-- «declaracion»); el profesor puede reincorporarlo como en cualquier otra salida (maraton_reincorporar).
--   · maraton_consultas: la pregunta (texto, si «Sí» deja fuera, activa / cerrada). La crea esta migración para FG1.
--   · maraton_declaraciones: una respuesta por estudiante y pregunta; solo se añaden filas (no se cambian ni se borran).
--   · El estudiante la ve al abrir el maratón y no puede seguir trabajando hasta responderla: maraton_previo (copia exacta
--     de la migración 99 + esa comprobación) rechaza entregar, «No puedo» y «Cambiar ejercicio» mientras esté pendiente,
--     con un mensaje que pide actualizar la página (así también la ven quienes tienen abierta la versión anterior).
--   · Solo participantes que ya aceptaron las condiciones y siguen en el maratón; nunca el recorrido de prueba del profesor.
-- Nada retroactivo: no cambia jornadas, presentaciones ni reglas de permanencia.

create table if not exists public.maraton_consultas (
  id uuid primary key default gen_random_uuid(),
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  titulo text not null check (char_length(titulo) between 3 and 200),
  texto text not null check (char_length(texto) between 3 and 4000),
  fuera_si boolean not null default true,
  activa boolean not null default true,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create index if not exists maraton_consultas_maraton_idx on public.maraton_consultas (maraton_id);

create table if not exists public.maraton_declaraciones (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.maraton_consultas (id) on delete restrict,
  maraton_id uuid not null references public.maraton_actividades (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  respuesta boolean not null,
  jornada smallint,
  created_at timestamptz not null default now(),
  unique (consulta_id, user_id)
);
create index if not exists maraton_declaraciones_maraton_idx on public.maraton_declaraciones (maraton_id);

alter table public.maraton_consultas enable row level security;
alter table public.maraton_declaraciones enable row level security;
revoke all on table public.maraton_consultas, public.maraton_declaraciones from public, anon, authenticated;
grant all on table public.maraton_consultas, public.maraton_declaraciones to service_role;

-- las respuestas solo se añaden
create or replace function public.maraton_declaracion_inmutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Las respuestas a las preguntas del maratón no se pueden cambiar ni borrar' using errcode = '42501';
end $$;
drop trigger if exists maraton_declaraciones_inmutable on public.maraton_declaraciones;
create trigger maraton_declaraciones_inmutable before update or delete on public.maraton_declaraciones
  for each row execute function public.maraton_declaracion_inmutable();

-- Pregunta pendiente de un participante (null si no hay): activa, sin responder, aceptó las condiciones, sigue dentro
create or replace function public.maraton_consulta_de(i public.maraton_inscripciones) returns public.maraton_consultas
language sql stable security definer set search_path = '' as $$
  select q.* from public.maraton_consultas q
   where q.maraton_id = i.maraton_id and q.activa and i.id is not null and not i.prueba
     and i.aceptado_at is not null and i.fuera_at is null
     and not exists (select 1 from public.maraton_declaraciones d where d.consulta_id = q.id and d.user_id = i.user_id)
   order by q.created_at limit 1
$$;

-- Lo que ve el estudiante: la pregunta pendiente (o null)
create or replace function public.maraton_consulta_pendiente(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; q public.maraton_consultas;
begin
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  select * into i from public.maraton_inscripciones where maraton_id = p_maraton and user_id = auth.uid();
  if i.id is null then return null; end if;
  q := public.maraton_consulta_de(i);
  if q.id is null then return null; end if;
  return jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', q.texto);
end $$;

-- El estudiante responde (una sola vez). «Sí» en una pregunta que deja fuera: queda fuera del maratón.
create or replace function public.maraton_declarar(p_maraton uuid, p_consulta uuid, p_respuesta boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; i public.maraton_inscripciones; q public.maraton_consultas; j public.maraton_jornadas; v_num integer;
begin
  if p_respuesta is null then raise exception 'Falta la respuesta' using errcode = '22023'; end if;
  select * into a from public.maraton_acceso(p_maraton, auth.uid());
  i := public.maraton_inscripcion(a.m, auth.uid(), a.prueba, false);
  select * into q from public.maraton_consultas where id = p_consulta and maraton_id = p_maraton;
  if q.id is null or i.id is null or i.prueba then raise exception 'Esa pregunta no le corresponde' using errcode = '42501'; end if;
  -- ya respondida (doble clic, otra pestaña): no se registra dos veces
  if exists (select 1 from public.maraton_declaraciones where consulta_id = q.id and user_id = i.user_id) then
    return public.maraton_estado_json(a.m, i.id);
  end if;
  if not q.activa then raise exception 'Esa pregunta ya está cerrada' using errcode = 'P0001'; end if;
  select * into j from public.maraton_jornadas where inscripcion_id = i.id and estado = 'en_curso' order by numero desc limit 1;
  v_num := coalesce(j.numero, (public.maraton_hoy(a.m) ->> 'numero')::int);
  insert into public.maraton_declaraciones (consulta_id, maraton_id, user_id, respuesta, jornada)
  values (q.id, p_maraton, i.user_id, p_respuesta, v_num);
  perform public.maraton_log(p_maraton, i.user_id, v_num, 'declaracion',
    jsonb_build_object('consulta', q.id, 'titulo', q.titulo, 'respuesta', case when p_respuesta then 'si' else 'no' end), i.user_id);
  if p_respuesta and q.fuera_si and i.fuera_at is null then
    perform public.maraton_fuera(i.id, j.id, 'declaracion', format('Respondió «Sí» a la pregunta «%s»', q.titulo), v_num);
  end if;
  return public.maraton_estado_json(a.m, i.id);
end $$;

-- Profesor: preguntas del maratón con las respuestas y quién falta por responder
create or replace function public.maraton_consultas_docente(p_maraton uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maraton_actividades := public.maraton_docente(p_maraton);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', q.texto, 'fuera_si', q.fuera_si,
      'activa', q.activa, 'created_at', q.created_at, 'cerrada_at', q.cerrada_at,
      'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'nombre', p.full_name, 'login_id', p.login_id,
                       'respuesta', d.respuesta, 'jornada', d.jornada, 'created_at', d.created_at) order by d.created_at), '[]')
                     from public.maraton_declaraciones d join public.profiles p on p.id = d.user_id where d.consulta_id = q.id),
      'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', i.user_id, 'nombre', p.full_name, 'login_id', p.login_id) order by p.full_name), '[]')
                     from public.maraton_inscripciones i join public.profiles p on p.id = i.user_id
                    where i.maraton_id = m.id and not i.prueba and i.aceptado_at is not null and i.fuera_at is null
                      and not exists (select 1 from public.maraton_declaraciones d where d.consulta_id = q.id and d.user_id = i.user_id)))
    order by q.created_at desc), '[]'::jsonb)
    from public.maraton_consultas q where q.maraton_id = m.id);
end $$;

-- Profesor: cerrar una pregunta (deja de mostrarse; las respuestas se conservan)
create or replace function public.maraton_consulta_cerrar(p_consulta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.maraton_consultas;
begin
  select * into q from public.maraton_consultas where id = p_consulta;
  if q.id is null then raise exception 'Pregunta no encontrada' using errcode = 'P0002'; end if;
  perform public.maraton_docente(q.maraton_id);
  update public.maraton_consultas set activa = false, cerrada_at = coalesce(cerrada_at, now()) where id = q.id;
  return public.maraton_consultas_docente(q.maraton_id);
end $$;

-- Copia exacta de la migración 99 + la pregunta pendiente (no se puede seguir trabajando sin responderla)
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
  -- pregunta de la plataforma pendiente (migración 101): primero hay que responderla
  if (public.maraton_consulta_de(i)).id is not null then
    raise exception 'La plataforma tiene una pregunta pendiente para usted. Actualice la página para responderla y poder continuar.'
      using errcode = 'P0001', hint = 'consulta_pendiente';
  end if;
  return null;
end $$;

-- La pregunta de hoy para el maratón de FG1 (idempotente)
insert into public.maraton_consultas (id, maraton_id, titulo, texto, fuera_si)
select 'c0a50001-0000-4000-8000-000000000001', 'f9a7a700-0000-4000-8000-000000000001',
  'Uso de inteligencia artificial',
  E'¿Ha utilizado inteligencia artificial para resolver los ejercicios de este maratón?\n\nRecuerde que su uso no está permitido.\n\nSi la ha utilizado, marque «Sí». Si no la ha utilizado, marque «No».\n\nSi marca «Sí», quedará fuera de este maratón.',
  true
where exists (select 1 from public.maraton_actividades where id = 'f9a7a700-0000-4000-8000-000000000001')
on conflict (id) do nothing;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer)
  foreach f in array array['maraton_declaracion_inmutable()', 'maraton_consulta_de(public.maraton_inscripciones)',
    'maraton_previo(public.maraton_actividades, public.maraton_inscripciones, uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamables con sesión (cada una comprueba quién llama)
  foreach f in array array['maraton_consulta_pendiente(uuid)', 'maraton_declarar(uuid, uuid, boolean)',
    'maraton_consultas_docente(uuid)', 'maraton_consulta_cerrar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
