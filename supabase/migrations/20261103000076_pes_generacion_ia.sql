-- =============================================================================
-- Migración 76 · PRÁCTICA EXTRAORDINARIA SECUENCIAL · problemas por apartados generados con IA (requiere 74).
-- Solo añade. Un «paquete» (pes_generaciones) pide N problemas de una práctica EN BORRADOR, repartidos entre
-- lecciones, dificultades y tipos; la función «orbe-ia» (acción «pes_generar») genera uno por llamada, lo verifica y lo
-- guarda como PROPUESTA (pes_propuestas_ia). Nada entra en la práctica sin que el profesor lo acepte (tal cual o
-- editado). Presupuesto, límite diario y simulador: los de Orbe IA (propósito «generar»). La IA recibe solo el temario
-- y el comienzo de enunciados existentes, nunca datos de estudiantes. Las propuestas incluyen claves: solo profesorado.
-- =============================================================================

create table if not exists public.pes_generaciones (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  spec jsonb not null default '{}'::jsonb check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 20000),
  solicitados integer not null check (solicitados between 1 and 50),
  creados integer not null default 0,
  rechazados integer not null default 0,
  motivos jsonb not null default '[]'::jsonb check (jsonb_typeof(motivos) = 'array'),
  costo_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pes_generaciones_practica_idx on public.pes_generaciones (practica_id);

create table if not exists public.pes_propuestas_ia (
  id uuid primary key default gen_random_uuid(),
  generacion_id uuid not null references public.pes_generaciones (id) on delete cascade,
  practica_id uuid not null references public.pes_practicas (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'descartada')),
  leccion_id uuid references public.lessons (id) on delete set null,
  dificultad text not null check (dificultad in ('basico', 'intermedio', 'desafiante')),
  tipo text not null check (tipo in ('calculo', 'conceptual', 'datos', 'errores', 'transferencia')),
  problema jsonb not null check (jsonb_typeof(problema) = 'object' and jsonb_typeof(problema -> 'apartados') = 'array' and octet_length(problema::text) <= 80000),
  verificacion jsonb not null default '[]'::jsonb check (jsonb_typeof(verificacion) = 'array'),
  ejercicio_id uuid references public.pes_ejercicios (id) on delete set null,
  editada boolean not null default false,
  decidido_por uuid references public.profiles (id) on delete set null,
  decidido_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pes_propuestas_ia_idx on public.pes_propuestas_ia (practica_id, estado);

alter table public.pes_generaciones enable row level security;
alter table public.pes_propuestas_ia enable row level security;
revoke all on public.pes_generaciones, public.pes_propuestas_ia from anon, authenticated;

-- ¿Puede este usuario generar para esta práctica? Profesorado de la práctica, con permiso de generación en la asignatura.
create or replace function public.pes_generar_permitido(p_actor uuid, p_practica uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (public.clase_es_docente(p.class_id, p_actor)
      or exists (select 1 from public.course_staff s where s.course_id = p.course_id and s.user_id = p_actor))
      and public.generar_permitido(p_actor, p.course_id) from public.pes_practicas p where p.id = p_practica), false)
$$;

-- -----------------------------------------------------------------------------
-- Profesorado
-- -----------------------------------------------------------------------------
create or replace function public.pes_generar_iniciar(p_practica uuid, p_spec jsonb, p_solicitados integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.pes_generar_permitido(auth.uid(), p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if (select estado from public.pes_practicas where id = p_practica) <> 'borrador' then
    raise exception 'Solo se generan problemas para una práctica en borrador' using errcode = 'P0001'; end if;
  if p_solicitados is null or p_solicitados not between 1 and 50 then raise exception 'Se pueden pedir de 1 a 50 problemas por paquete' using errcode = '22023'; end if;
  insert into public.pes_generaciones (practica_id, actor_id, spec, solicitados) values (p_practica, auth.uid(), coalesce(p_spec, '{}'::jsonb), p_solicitados)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.pes_generaciones_lista(p_practica uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'solicitados', g.solicitados, 'creados', g.creados, 'rechazados', g.rechazados,
      'motivos', g.motivos, 'costo_usd', g.costo_usd, 'spec', g.spec, 'created_at', g.created_at) order by g.created_at desc)
    from public.pes_generaciones g where g.practica_id = p_practica), '[]'::jsonb);
end $$;

-- Propuestas de la práctica (con claves y rúbricas: solo profesorado)
create or replace function public.pes_propuestas(p_practica uuid, p_estado text default 'pendiente') returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pes_docente(p_practica) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'generacion_id', x.generacion_id, 'estado', x.estado, 'leccion_id', x.leccion_id,
      'leccion', l.title, 'dificultad', x.dificultad, 'tipo', x.tipo, 'problema', x.problema, 'verificacion', x.verificacion,
      'ejercicio_id', x.ejercicio_id, 'editada', x.editada, 'created_at', x.created_at) order by x.created_at)
    from public.pes_propuestas_ia x left join public.lessons l on l.id = x.leccion_id
    where x.practica_id = p_practica and (p_estado is null or x.estado = p_estado)), '[]'::jsonb);
end $$;

-- Aceptar: crea el ejercicio con las mismas validaciones que uno redactado (tal cual o con la versión editada)
create or replace function public.pes_propuesta_aceptar(p_propuesta uuid, p_problema jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare x public.pes_propuestas_ia; v_ej uuid;
begin
  select * into x from public.pes_propuestas_ia where id = p_propuesta for update;
  if x.id is null or not public.pes_docente(x.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if x.estado <> 'pendiente' then raise exception 'Esa propuesta ya se decidió' using errcode = 'P0001'; end if;
  v_ej := public.pes_ejercicio_redactado(x.practica_id, coalesce(p_problema, x.problema));
  update public.pes_ejercicios set origen_ref = case when p_problema is null then 'Generado con IA · revisado por el profesor' else 'Generado con IA · editado por el profesor' end
    where id = v_ej;
  update public.pes_propuestas_ia set estado = 'aceptada', ejercicio_id = v_ej, editada = p_problema is not null, decidido_por = auth.uid(), decidido_at = now()
    where id = p_propuesta;
  return v_ej;
end $$;

create or replace function public.pes_propuesta_descartar(p_propuesta uuid) returns void language plpgsql security definer set search_path = '' as $$
declare x public.pes_propuestas_ia;
begin
  select * into x from public.pes_propuestas_ia where id = p_propuesta for update;
  if x.id is null or not public.pes_docente(x.practica_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if x.estado <> 'pendiente' then raise exception 'Esa propuesta ya se decidió' using errcode = 'P0001'; end if;
  update public.pes_propuestas_ia set estado = 'descartada', decidido_por = auth.uid(), decidido_at = now() where id = p_propuesta;
end $$;

-- -----------------------------------------------------------------------------
-- Servidor (función «orbe-ia», acción «pes_generar»)
-- -----------------------------------------------------------------------------
-- Contexto de UN problema: la lección (de la asignatura de la práctica) y lo que ya existe, para no repetir
create or replace function public.svc_pes_generar_contexto(p_actor uuid, p_generacion uuid, p_leccion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.pes_generaciones; p public.pes_practicas;
begin
  select * into g from public.pes_generaciones where id = p_generacion;
  select * into p from public.pes_practicas where id = g.practica_id;
  if g.id is null or g.actor_id is distinct from p_actor or not public.pes_generar_permitido(p_actor, g.practica_id) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p.estado <> 'borrador' then raise exception 'La práctica ya no está en borrador' using errcode = 'P0001'; end if;
  if g.creados + g.rechazados >= g.solicitados * 2 then raise exception 'Este paquete ya terminó' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.lessons l where l.id = p_leccion and l.course_id = p.course_id) then
    raise exception 'Lección ajena a la asignatura' using errcode = '42501'; end if;
  return jsonb_build_object(
    'asignatura', (select title from public.courses where id = p.course_id),
    'leccion', (select jsonb_build_object('id', l.id, 'titulo', l.title, 'unidad', u.title, 'resumen', left(coalesce(l.summary, ''), 600),
        'conceptos', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.name)), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id))
      from public.lessons l join public.units u on u.id = l.unit_id where l.id = p_leccion),
    'existentes', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select left(e.contexto, 160) t from public.pes_ejercicios e where e.practica_id = p.id and char_length(e.contexto) > 0
      union all select left(x.problema ->> 'contexto', 160) from public.pes_propuestas_ia x where x.practica_id = p.id and x.estado <> 'descartada'
      union all (select left(ex.prompt, 160) from public.exercises ex where ex.lesson_id = p_leccion order by ex.position limit 20)
      limit 30) z));
end $$;

-- Guarda una propuesta verificada (o cuenta un rechazo con su motivo) y el coste
create or replace function public.svc_pes_generar_guardar(p_actor uuid, p_generacion uuid, p_propuesta jsonb, p_motivo text, p_costo numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.pes_generaciones; v_id uuid;
begin
  select * into g from public.pes_generaciones where id = p_generacion for update;
  if g.id is null or g.actor_id is distinct from p_actor or not public.pes_generar_permitido(p_actor, g.practica_id) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_propuesta is not null then
    insert into public.pes_propuestas_ia (generacion_id, practica_id, leccion_id, dificultad, tipo, problema, verificacion)
    values (g.id, g.practica_id, (p_propuesta ->> 'leccion_id')::uuid, p_propuesta ->> 'dificultad', p_propuesta ->> 'tipo', p_propuesta -> 'problema',
      coalesce(p_propuesta -> 'verificacion', '[]'::jsonb))
    returning id into v_id;
  end if;
  update public.pes_generaciones set creados = creados + (v_id is not null)::integer, rechazados = rechazados + (v_id is null)::integer,
    -- los 50 motivos de rechazo más recientes (para mostrar al profesor por qué se descartaron)
    motivos = case when v_id is null and p_motivo is not null
      then (case when jsonb_array_length(motivos) >= 50 then motivos - 0 else motivos end) || to_jsonb(left(p_motivo, 300)) else motivos end,
    costo_usd = costo_usd + coalesce(p_costo, 0), updated_at = now()
    where id = g.id;
  return jsonb_build_object('id', v_id);
end $$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['pes_generar_permitido(uuid, uuid)', 'svc_pes_generar_contexto(uuid, uuid, uuid)', 'svc_pes_generar_guardar(uuid, uuid, jsonb, text, numeric)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['svc_pes_generar_contexto(uuid, uuid, uuid)', 'svc_pes_generar_guardar(uuid, uuid, jsonb, text, numeric)'] loop
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['pes_generar_iniciar(uuid, jsonb, integer)', 'pes_generaciones_lista(uuid)', 'pes_propuestas(uuid, text)',
    'pes_propuesta_aceptar(uuid, jsonb)', 'pes_propuesta_descartar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
