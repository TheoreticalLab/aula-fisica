-- Migración 108 · Preguntas de la plataforma en una práctica (decisión del profesor, 21-nov-2026).
--
-- El profesor quiere preguntar a quienes hacen la práctica de engranajes de FG1 «¿Está usando inteligencia artificial
-- para resolver esta práctica? La plataforma tiene herramientas de medición.» con «Sí» / «No», a todos menos a dos
-- estudiantes. Mismo diseño que las preguntas del maratón (migración 101), pero para una actividad:
--   · actividad_consultas: la pregunta (actividad, texto, estudiantes excluidos, activa / cerrada).
--   · actividad_declaraciones: una respuesta por estudiante y pregunta; solo se añaden filas (no se cambian ni se borran).
--   · El estudiante la ve al abrir la práctica (página de la actividad y del intento) y la página no le deja seguir sin
--     responder. Responder «Sí» no tiene consecuencias automáticas: queda registrado para el profesor.
--   · Solo estudiantes matriculados en la sección, sin baja y no excluidos; nunca el profesor.
--   · No toca la calificación ni los intentos. Las preguntas se crean como datos privados (por ahora no desde el panel).

create table if not exists public.actividad_consultas (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete restrict,
  titulo text not null check (char_length(titulo) between 3 and 200),
  texto text not null check (char_length(texto) between 3 and 4000),
  excluidos uuid[] not null default '{}',
  activa boolean not null default true,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create index if not exists actividad_consultas_activity_idx on public.actividad_consultas (activity_id);

create table if not exists public.actividad_declaraciones (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.actividad_consultas (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  respuesta boolean not null,
  created_at timestamptz not null default now(),
  unique (consulta_id, user_id)
);

alter table public.actividad_consultas enable row level security;
alter table public.actividad_declaraciones enable row level security;
revoke all on table public.actividad_consultas, public.actividad_declaraciones from public, anon, authenticated;
grant all on table public.actividad_consultas, public.actividad_declaraciones to service_role;

-- las respuestas solo se añaden
create or replace function public.actividad_declaracion_inmutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Las respuestas a las preguntas de la plataforma no se pueden cambiar ni borrar' using errcode = '42501';
end $$;
drop trigger if exists actividad_declaraciones_inmutable on public.actividad_declaraciones;
create trigger actividad_declaraciones_inmutable before update or delete on public.actividad_declaraciones
  for each row execute function public.actividad_declaracion_inmutable();

-- ¿A este estudiante le corresponde la pregunta? (matriculado en la sección, sin baja, cuenta activa, no excluido)
create or replace function public.actividad_consulta_aplica(q public.actividad_consultas, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.activities a
      join public.enrollments e on e.class_id = a.class_id and e.user_id = p_user
      join public.profiles p on p.id = p_user and p.role = 'student'
     where a.id = q.activity_id and not public.fuera_de_seccion(a.class_id, p_user)) and not (p_user = any (q.excluidos))
$$;

-- Lo que ve el estudiante: la pregunta pendiente de esa actividad (o null)
create or replace function public.actividad_consulta_pendiente(p_activity uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', q.texto)
            from public.actividad_consultas q
           where q.activity_id = p_activity and q.activa and auth.uid() is not null
             and public.actividad_consulta_aplica(q, auth.uid())
             and not exists (select 1 from public.actividad_declaraciones d where d.consulta_id = q.id and d.user_id = auth.uid())
           order by q.created_at limit 1)
$$;

-- El estudiante responde (una sola vez); devuelve la siguiente pregunta pendiente de la misma actividad (o null)
create or replace function public.actividad_declarar(p_consulta uuid, p_respuesta boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.actividad_consultas;
begin
  if p_respuesta is null then raise exception 'Falta la respuesta' using errcode = '22023'; end if;
  select * into q from public.actividad_consultas where id = p_consulta;
  if q.id is null or auth.uid() is null or not public.actividad_consulta_aplica(q, auth.uid()) then
    raise exception 'Esa pregunta no le corresponde' using errcode = '42501';
  end if;
  -- ya respondida (doble clic, otra pestaña): no se registra dos veces
  if not exists (select 1 from public.actividad_declaraciones where consulta_id = q.id and user_id = auth.uid()) then
    if not q.activa then raise exception 'Esa pregunta ya está cerrada' using errcode = 'P0001'; end if;
    insert into public.actividad_declaraciones (consulta_id, user_id, respuesta) values (q.id, auth.uid(), p_respuesta)
      on conflict (consulta_id, user_id) do nothing;
  end if;
  return public.actividad_consulta_pendiente(q.activity_id);
end $$;

-- Profesor de la sección: preguntas de la actividad con las respuestas, quién falta (y si ya empezó) y los excluidos
create or replace function public.actividad_consultas_docente(p_activity uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_class uuid;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'No tiene acceso a esta actividad' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', q.texto,
      'activa', q.activa, 'created_at', q.created_at, 'cerrada_at', q.cerrada_at,
      'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'nombre', p.full_name,
                       'respuesta', d.respuesta, 'created_at', d.created_at) order by d.created_at), '[]')
                     from public.actividad_declaraciones d join public.profiles p on p.id = d.user_id where d.consulta_id = q.id),
      'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'nombre', p.full_name,
                       'empezo', exists (select 1 from public.attempts t where t.activity_id = p_activity and t.user_id = p.id)) order by p.full_name), '[]')
                     from public.enrollments e join public.profiles p on p.id = e.user_id
                    where e.class_id = v_class and public.actividad_consulta_aplica(q, p.id)
                      and not exists (select 1 from public.actividad_declaraciones d where d.consulta_id = q.id and d.user_id = p.id)),
      'excluidos', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'nombre', p.full_name) order by p.full_name), '[]')
                    from public.profiles p where p.id = any (q.excluidos)))
    order by q.created_at desc), '[]'::jsonb)
    from public.actividad_consultas q where q.activity_id = p_activity);
end $$;

-- Profesor: cerrar una pregunta (deja de mostrarse; las respuestas se conservan)
create or replace function public.actividad_consulta_cerrar(p_consulta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.actividad_consultas; v_class uuid;
begin
  select * into q from public.actividad_consultas where id = p_consulta;
  if q.id is null then raise exception 'Pregunta no encontrada' using errcode = 'P0002'; end if;
  select class_id into v_class from public.activities where id = q.activity_id;
  if not public.is_class_teacher(v_class) then raise exception 'No tiene acceso a esta actividad' using errcode = '42501'; end if;
  update public.actividad_consultas set activa = false, cerrada_at = coalesce(cerrada_at, now()) where id = q.id;
  return public.actividad_consultas_docente(q.activity_id);
end $$;

do $$ declare f text; begin
  -- internas: nadie salvo las propias funciones (security definer)
  foreach f in array array['actividad_declaracion_inmutable()', 'actividad_consulta_aplica(public.actividad_consultas, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- llamables con sesión (cada una comprueba quién llama)
  foreach f in array array['actividad_consulta_pendiente(uuid)', 'actividad_declarar(uuid, boolean)',
    'actividad_consultas_docente(uuid)', 'actividad_consulta_cerrar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
