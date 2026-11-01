-- =============================================================================
-- Generación de preguntas con IA para el banco de una asignatura (migración 55).
--
-- El profesorado pide N preguntas (50, 100…) por temas (lecciones), niveles y formatos. La Edge Function «orbe-ia»
-- las pide a Claude por lotes de hasta 4, VERIFICA cada una (capa C, en el servidor) y las guarda como BORRADORES
-- del banco (no publicados, papel «bank»): nunca entran solas en una práctica o evaluación.
--  - Numéricas: Claude da los datos, una expresión (gramática cerrada) y el resultado; el servidor recalcula la
--    expresión con los datos, exige que coincida, que los datos aparezcan en el enunciado y que el motor de
--    calificación acepte la clave → «cálculo comprobado».
--  - Selección y verdadero/falso: estructura validada, pero la física no se puede comprobar sola → «revisar».
-- Comparte interruptor, presupuesto, límite diario y simulador de Orbe IA (propósito «generar»). Claude solo recibe
-- títulos y resúmenes de lecciones, nombres de conceptos y el comienzo de enunciados ya existentes (para no repetir).
-- Aditiva: un propósito más, tablas nuevas y funciones nuevas; svc_orbe_ia_reservar_uso se copia de la migración 52.
-- =============================================================================

alter table public.orbe_ia_usage drop constraint if exists orbe_ia_usage_purpose_check;
alter table public.orbe_ia_usage add constraint orbe_ia_usage_purpose_check check (purpose in ('chistes', 'mensaje', 'pulso', 'pregunta', 'lieia', 'generar'));

create table if not exists public.question_generation_runs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  spec jsonb not null default '{}'::jsonb check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 20000),
  solicitadas integer not null check (solicitadas between 1 and 300),
  creadas integer not null default 0,
  rechazadas integer not null default 0,
  costo_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.question_generation_items (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  run_id uuid not null references public.question_generation_runs (id) on delete cascade,
  verificacion text not null check (verificacion in ('calculo_comprobado', 'revisar')),
  created_at timestamptz not null default now()
);
create index if not exists question_generation_items_run_idx on public.question_generation_items (run_id);
alter table public.question_generation_runs enable row level security;
alter table public.question_generation_items enable row level security;
revoke all on public.question_generation_runs, public.question_generation_items from anon, authenticated;

-- ¿Puede este usuario generar en esta asignatura? (administración, personal de la asignatura o profesorado de una sección)
create or replace function public.generar_permitido(p_actor uuid, p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_actor and p.active and p.suspended_at is null and p.role in ('teacher', 'admin'))
    and (exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin')
         or exists (select 1 from public.course_staff s where s.course_id = p_course and s.user_id = p_actor)
         or exists (select 1 from public.classes cl join public.class_teachers ct on ct.class_id = cl.id where cl.course_id = p_course and ct.user_id = p_actor))
$$;

-- -----------------------------------------------------------------------------
-- Profesorado: temas, estimación y comienzo de una generación

create or replace function public.generar_temas(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.generar_permitido(auth.uid(), p_course) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'asignatura', (select title from public.courses where id = p_course),
    'unidades', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'titulo', u.title,
        'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'oculta', l.hidden,
            'conceptos', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.name) order by c.name), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id),
            'banco', (select jsonb_build_object('basico', count(*) filter (where e.difficulty = 'basico'), 'intermedio', count(*) filter (where e.difficulty = 'intermedio'),
                'desafiante', count(*) filter (where e.difficulty = 'desafiante')) from public.exercises e where e.lesson_id = l.id))
          order by l.position, l.title), '[]'::jsonb) from public.lessons l where l.unit_id = u.id))
      order by u.position, u.title), '[]'::jsonb) from public.units u where u.course_id = p_course));
end;
$$;

-- Datos para estimar el coste ANTES de generar (precios, presupuesto restante, límite diario)
create or replace function public.generar_estimacion(p_course uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare c public.orbe_ia_config;
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  if not public.generar_permitido(auth.uid(), p_course) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into c from public.orbe_ia_config where id = 1;
  return jsonb_build_object('encendido', c.enabled, 'api_real', c.api_real, 'modelo', c.model,
    'precio_entrada', c.price_input_per_mtok, 'precio_salida', c.price_output_per_mtok, 'max_salida', least(c.max_output_tokens, 4000),
    'presupuesto_mes', c.monthly_budget_usd,
    'gastado_mes', (select coalesce(sum(cost_usd), 0) from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated),
    'llamadas_hoy', (select count(*) from public.orbe_ia_usage where created_at >= v_hoy), 'limite_diario', c.daily_max_calls, 'por_lote', 4);
end;
$$;

create or replace function public.generar_iniciar(p_course uuid, p_spec jsonb, p_solicitadas integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.generar_permitido(auth.uid(), p_course) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_solicitadas is null or p_solicitadas not between 1 and 300 then raise exception 'Se pueden pedir entre 1 y 300 preguntas' using errcode = '22023'; end if;
  insert into public.question_generation_runs (course_id, actor_id, spec, solicitadas) values (p_course, auth.uid(), coalesce(p_spec, '{}'::jsonb), p_solicitadas)
    returning id into v_id;
  return v_id;
end;
$$;

-- Resumen de una generación (y enlaces a sus borradores)
create or replace function public.generar_resumen(p_run uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.question_generation_runs;
begin
  select * into r from public.question_generation_runs where id = p_run;
  if r.id is null or not public.generar_permitido(auth.uid(), r.course_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('solicitadas', r.solicitadas, 'creadas', r.creadas, 'rechazadas', r.rechazadas, 'costo_usd', r.costo_usd,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'slug', e.slug, 'formato', e.format, 'dificultad', e.difficulty, 'leccion', l.title,
        'enunciado', left(e.prompt, 140), 'verificacion', i.verificacion) order by i.created_at), '[]'::jsonb)
      from public.question_generation_items i join public.exercises e on e.id = i.exercise_id left join public.lessons l on l.id = e.lesson_id where i.run_id = p_run));
end;
$$;

-- -----------------------------------------------------------------------------
-- Servidor (Edge Function «orbe-ia», acción «generar_preguntas»)

create or replace function public.svc_generar_contexto(p_actor uuid, p_run uuid, p_lessons uuid[])
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.question_generation_runs;
begin
  select * into r from public.question_generation_runs where id = p_run;
  if r.id is null or r.actor_id is distinct from p_actor or not public.generar_permitido(p_actor, r.course_id) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  if r.creadas + r.rechazadas >= r.solicitadas * 2 then raise exception 'Esta generación ya terminó' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(p_lessons) x where not exists (select 1 from public.lessons l where l.id = x and l.course_id = r.course_id)) then
    raise exception 'Lección ajena a la asignatura' using errcode = '42501'; end if;
  return jsonb_build_object(
    'asignatura', (select title from public.courses where id = r.course_id),
    'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.title, 'unidad', u.title, 'resumen', left(l.summary, 500),
        'conceptos', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.name)), '[]'::jsonb) from public.concepts c where c.lesson_id = l.id))), '[]'::jsonb)
      from public.lessons l join public.units u on u.id = l.unit_id where l.id = any (p_lessons)),
    -- comienzo de enunciados ya existentes en esas lecciones, para no repetir (sin claves ni respuestas)
    'existentes', (select coalesce(jsonb_agg(x.p), '[]'::jsonb) from (select left(e.prompt, 160) p from public.exercises e
      where e.lesson_id = any (p_lessons) order by e.updated_at desc limit 30) x));
end;
$$;

create or replace function public.svc_generar_guardar(p_actor uuid, p_run uuid, p_items jsonb, p_rechazadas integer, p_costo numeric)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.question_generation_runs; it jsonb; v_id uuid; v_ids uuid[] := '{}'; v_fmt public.exercise_format;
begin
  select * into r from public.question_generation_runs where id = p_run for update;
  if r.id is null or r.actor_id is distinct from p_actor or not public.generar_permitido(p_actor, r.course_id) then
    raise exception 'Sin permiso' using errcode = '42501'; end if;
  -- todas las lecciones deben ser de la asignatura ANTES de guardar nada
  if exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
             where not exists (select 1 from public.lessons l where l.id = (x ->> 'lesson_id')::uuid and l.course_id = r.course_id)) then
    raise exception 'Lección ajena a la asignatura' using errcode = '42501'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if r.creadas + cardinality(v_ids) >= r.solicitadas then exit; end if;     -- nunca más de lo pedido
    v_fmt := (it ->> 'format')::public.exercise_format;
    if v_fmt not in ('numeric', 'choice', 'truefalse') then raise exception 'Formato no admitido' using errcode = '22023'; end if;
    insert into public.exercises (course_id, lesson_id, slug, category, difficulty, role, format, concepts, prompt, options, unit_hint, points, published, created_by)
    values (r.course_id, (it ->> 'lesson_id')::uuid, 'ia-' || left(replace(gen_random_uuid()::text, '-', ''), 12),
      case v_fmt when 'numeric' then 'numerica' when 'choice' then 'seleccion' else 'vf_justificacion' end::public.exercise_category,
      (it ->> 'difficulty')::public.exercise_difficulty, 'bank', v_fmt,
      coalesce(array(select jsonb_array_elements_text(it -> 'concepts')), '{}'), it ->> 'prompt',
      case when v_fmt = 'choice' then it -> 'options' end, nullif(it ->> 'unit_hint', ''), 1, false, p_actor)
    returning id into v_id;
    insert into public.exercise_keys (exercise_id, answer, hints, explanation)
      values (v_id, it -> 'answer', coalesce(it -> 'hints', '[]'::jsonb), coalesce(it ->> 'explanation', ''));
    insert into public.question_generation_items (exercise_id, run_id, verificacion) values (v_id, p_run, it ->> 'verificacion');
    v_ids := v_ids || v_id;
  end loop;
  update public.question_generation_runs set creadas = creadas + cardinality(v_ids), rechazadas = rechazadas + greatest(coalesce(p_rechazadas, 0), 0),
    costo_usd = costo_usd + greatest(coalesce(p_costo, 0), 0), updated_at = now() where id = p_run;
  return jsonb_build_object('ids', to_jsonb(v_ids));
end;
$$;

-- reserva de Orbe IA (copia de la migración 52) + propósito «generar»
create or replace function public.svc_orbe_ia_reservar_uso(p_actor uuid, p_purpose text, p_lesson uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.orbe_ia_config;
  v_max integer; v_est numeric; v_gastado numeric; v_reservado numeric; v_llamadas integer; v_usage bigint;
  v_ctx jsonb := null; v_course uuid := null; v_admin boolean;
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo';
begin
  perform pg_advisory_xact_lock(hashtextextended('orbe-ia-presupuesto', 0));
  select * into c from public.orbe_ia_config where id = 1;
  if not c.enabled then return jsonb_build_object('ok', false, 'motivo', 'apagado'); end if;
  if p_purpose is null or p_purpose not in ('mensaje', 'pulso', 'pregunta', 'lieia', 'generar') then return jsonb_build_object('ok', false, 'motivo', 'proposito'); end if;
  select p.role = 'admin' into v_admin from public.profiles p
    where p.id = p_actor and p.role in ('teacher', 'admin') and p.active and p.suspended_at is null;
  if v_admin is null then return jsonb_build_object('ok', false, 'motivo', 'permiso'); end if;

  -- preguntas sobre una lección: solo de asignaturas que imparte (o cualquiera si es administrador)
  if p_lesson is not null then
    select l.course_id into v_course from public.lessons l where l.id = p_lesson;
    if v_course is null then return jsonb_build_object('ok', false, 'motivo', 'leccion'); end if;
    if not v_admin and not exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_actor)
       and not exists (select 1 from public.classes cl join public.class_teachers ct on ct.class_id = cl.id where cl.course_id = v_course and ct.user_id = p_actor) then
      return jsonb_build_object('ok', false, 'motivo', 'permiso');
    end if;
    select jsonb_build_object('asignatura', co.title, 'unidad', u.title, 'leccion', l.title, 'resumen', left(coalesce(l.summary, ''), 400),
        'apartados', to_jsonb(public.orbe_ia_apartados(l.id)))
      into v_ctx from public.lessons l join public.units u on u.id = l.unit_id join public.courses co on co.id = l.course_id where l.id = p_lesson;
  end if;

  v_max := case p_purpose when 'pregunta' then c.max_output_tokens when 'lieia' then least(c.max_output_tokens, 3000)
                          when 'generar' then least(c.max_output_tokens, 4000) else least(c.max_output_tokens, 2000) end;
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(case p_purpose when 'lieia' then 8000 when 'generar' then 6000 else 4000 end, v_max) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated;
    select coalesce(sum(reserved_usd), 0) into v_reservado from public.orbe_ia_usage
      where status = 'reservado' and not simulated and created_at > now() - interval '15 minutes';
    if v_gastado + v_reservado + v_est > c.monthly_budget_usd then return jsonb_build_object('ok', false, 'motivo', 'presupuesto'); end if;
  end if;

  insert into public.orbe_ia_usage (actor_id, trigger, course_id, lesson_id, model, simulated, reserved_usd, purpose)
  values (p_actor, 'profesor', v_course, p_lesson, c.model, not c.api_real, v_est, p_purpose) returning id into v_usage;
  return jsonb_build_object('ok', true, 'usage_id', v_usage, 'api_real', c.api_real, 'model', c.model, 'max_tokens', v_max, 'contexto', v_ctx,
    'precio_entrada', c.price_input_per_mtok, 'precio_salida', c.price_output_per_mtok);
end;
$$;

do $$ declare f text; begin
  foreach f in array array['generar_permitido(uuid, uuid)', 'svc_generar_contexto(uuid, uuid, uuid[])', 'svc_generar_guardar(uuid, uuid, jsonb, integer, numeric)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['generar_temas(uuid)', 'generar_estimacion(uuid)', 'generar_iniciar(uuid, jsonb, integer)', 'generar_resumen(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant execute on function public.svc_generar_contexto(uuid, uuid, uuid[]) to service_role;
grant execute on function public.svc_generar_guardar(uuid, uuid, jsonb, integer, numeric) to service_role;
revoke all on function public.svc_orbe_ia_reservar_uso(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_orbe_ia_reservar_uso(uuid, text, uuid) to service_role;
