-- Orbe Control con Claude (migración 33). Solo añade: una columna con valor por defecto, tablas nuevas y funciones.
--
-- 1) Redactar mensajes y «pulso de la clase» con Claude: comparten el presupuesto mensual y el límite diario de
--    Orbe IA (orbe_ia_usage, ahora con el propósito de cada llamada). Claude nunca recibe nombres: los mensajes
--    personalizados llevan el hueco {nombre}, que Orbe Control rellena en el teléfono del profesor.
-- 2) Pulso de la clase: solo cifras agregadas (conectados, dónde están, ejercicios con más errores).
-- 3) Pregunta relámpago: el profesor lanza una pregunta de opción múltiple a sus estudiantes (conectados o toda la
--    sección) y ve las respuestas en vivo. Si la activa con bloqueo, quien SALGA de la plataforma después de ver la
--    pregunta y antes de responder queda con la pantalla bloqueada (sistema de la migración 19: solo se quita con el
--    código que el profesor eligió al lanzarla, guardado cifrado, o si el profesor lo libera). Dos barreras: el aula
--    avisa al salir (poll_left) y el latido de conexión con la pestaña oculta también bloquea (presence_ping).

-- ---------------------------------------------------------------------------------------------------------
-- 1) Consumo por propósito y reserva genérica para Orbe Control
alter table public.orbe_ia_usage add column if not exists purpose text not null default 'chistes';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orbe_ia_usage_purpose_check') then
    alter table public.orbe_ia_usage add constraint orbe_ia_usage_purpose_check check (purpose in ('chistes', 'mensaje', 'pulso', 'pregunta'));
  end if;
end $$;

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
  if p_purpose is null or p_purpose not in ('mensaje', 'pulso', 'pregunta') then return jsonb_build_object('ok', false, 'motivo', 'proposito'); end if;
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

  v_max := case p_purpose when 'pregunta' then c.max_output_tokens else least(c.max_output_tokens, 2000) end;
  select count(*) into v_llamadas from public.orbe_ia_usage where created_at >= v_hoy;
  if v_llamadas >= c.daily_max_calls then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;
  v_est := case when c.api_real then public.orbe_ia_costo(4000, v_max) else 0 end;
  if c.api_real then
    select coalesce(sum(cost_usd), 0) into v_gastado from public.orbe_ia_usage where created_at >= v_mes and status = 'ok' and not simulated;
    select coalesce(sum(reserved_usd), 0) into v_reservado from public.orbe_ia_usage
      where status = 'reservado' and not simulated and created_at > now() - interval '15 minutes';
    if v_gastado + v_reservado + v_est > c.monthly_budget_usd then return jsonb_build_object('ok', false, 'motivo', 'presupuesto'); end if;
  end if;

  insert into public.orbe_ia_usage (actor_id, trigger, course_id, lesson_id, model, simulated, reserved_usd, purpose)
  values (p_actor, 'profesor', v_course, p_lesson, c.model, not c.api_real, v_est, p_purpose) returning id into v_usage;
  return jsonb_build_object('ok', true, 'usage_id', v_usage, 'api_real', c.api_real, 'model', c.model, 'max_tokens', v_max, 'contexto', v_ctx);
end;
$$;

create or replace function public.svc_orbe_ia_finalizar_uso(p_usage bigint, p_ok boolean, p_input integer, p_output integer, p_error text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare u public.orbe_ia_usage;
begin
  select * into u from public.orbe_ia_usage where id = p_usage for update;
  if not found or u.status <> 'reservado' or u.purpose = 'chistes' then raise exception 'Reserva no válida' using errcode = '22023'; end if;
  update public.orbe_ia_usage set
    status = case when p_ok then 'ok' else 'error' end,
    finished_at = now(),
    input_tokens = greatest(coalesce(p_input, 0), 0),
    output_tokens = greatest(coalesce(p_output, 0), 0),
    cost_usd = case when u.simulated then 0 else public.orbe_ia_costo(p_input, p_output) end,
    reserved_usd = 0,
    error_code = case when p_ok then null else left(regexp_replace(lower(coalesce(p_error, 'error')), '[^a-z0-9_]', '_', 'g'), 40) end
  where id = p_usage;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 2) Pulso de la clase: cifras agregadas de los últimos 15 minutos (sin nombres)
create or replace function public.control_pulso(p_class uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  if p_class is not null and not (public.is_admin() or public.is_class_teacher(p_class)
       or public.is_course_staff((select course_id from public.classes where id = p_class))) then
    raise exception 'No imparte esa sección' using errcode = '42501';
  end if;
  return (
    with alumnos as (select distinct s.user_id from public.my_messageable_students() s where p_class is null or s.class_id = p_class),
    online as (select distinct on (o.user_id) o.* from public.control_online() o where p_class is null or o.class_id = p_class order by o.user_id),
    activos as (select distinct v.user_id from public.study_visits v where v.last_beat_at > now() - interval '5 minutes' and v.effective_seconds > 0
                  and v.user_id in (select user_id from online)),
    ev as (
      select e.id ejercicio, left(regexp_replace(e.prompt, '\s+', ' ', 'g'), 90) enunciado, l.title leccion, x.user_id,
             x.result ->> 'status' estado, nullif(x.result ->> 'code', 'ok') codigo
      from public.response_events x join public.responses r on r.id = x.response_id
      join public.exercises e on e.id = r.exercise_id left join public.lessons l on l.id = e.lesson_id
      where x.created_at > now() - interval '15 minutes' and x.kind in ('check', 'submit') and x.user_id in (select user_id from alumnos)
    )
    select jsonb_build_object(
      'ventana_min', 15,
      'inscritos', (select count(*) from alumnos),
      'conectados', (select count(*) from online),
      'en_segundo_plano', (select count(*) from online where not visible),
      'sin_actividad_reciente', (select count(*) from online where user_id not in (select user_id from activos)),
      'por_lugar', (select coalesce(jsonb_agg(y order by y.estudiantes desc), '[]'::jsonb) from (
          select coalesce(lesson_title, activity_title, 'Otra página del aula') lugar, section seccion, count(*) estudiantes
          from online group by 1, 2 order by 3 desc limit 10) y),
      'ejercicios', (select coalesce(jsonb_agg(z order by z.estudiantes desc), '[]'::jsonb) from (
          select ev.enunciado, ev.leccion, count(*) intentos, count(distinct ev.user_id) estudiantes,
                 count(*) filter (where ev.estado = 'correct') correctos,
                 mode() within group (order by ev.codigo) filter (where ev.estado <> 'correct' and ev.codigo is not null) error_frecuente
          from ev group by ev.ejercicio, ev.enunciado, ev.leccion
          having count(*) filter (where ev.estado <> 'correct') > 0
          order by count(distinct ev.user_id) desc limit 8) z),
      'server_now', now())
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 3) Pregunta relámpago
create table if not exists public.quick_polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  question text not null check (char_length(btrim(question)) between 5 and 500),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  correct smallint check (correct is null or correct >= 0),
  explanation text check (explanation is null or char_length(explanation) <= 600),
  lock_on_leave boolean not null default false,
  unlock_code_hash text,
  origin text not null default 'profesor' check (origin in ('profesor', 'ia')),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null,
  closed_at timestamptz,
  check (not lock_on_leave or unlock_code_hash is not null)
);
create index if not exists quick_polls_creador_idx on public.quick_polls (created_by, created_at desc);

create table if not exists public.quick_poll_recipients (
  poll_id uuid not null references public.quick_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz,                                       -- el aula del estudiante mostró la pregunta
  answer smallint,
  answered_at timestamptz,
  left_at timestamptz,                                       -- salió de la plataforma sin responder
  lock_id uuid references public.screen_locks (id) on delete set null,
  primary key (poll_id, user_id)
);
create index if not exists quick_poll_recipients_user_idx on public.quick_poll_recipients (user_id);

alter table public.quick_polls enable row level security;
alter table public.quick_poll_recipients enable row level security;
revoke all on public.quick_polls, public.quick_poll_recipients from anon, authenticated;
-- solo para el aviso por Realtime: el estudiante ve que existe una fila suya (poll_id, user_id); nada más
drop policy if exists quick_poll_recipients_select on public.quick_poll_recipients;
create policy quick_poll_recipients_select on public.quick_poll_recipients for select to authenticated using (user_id = auth.uid());
do $$ begin
  execute 'grant select (poll_id, user_id) on public.quick_poll_recipients to authenticated';
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'quick_poll_recipients') then
    alter publication supabase_realtime add table public.quick_poll_recipients;
  end if;
end $$;

-- Interno: bloquea a un estudiante que salió de la plataforma con una pregunta con bloqueo abierta, ya vista y sin
-- responder. Si ya tenía un bloqueo activo, se reutiliza (no se libera el del profesor). Devuelve cuántos bloqueó.
create or replace function public.poll_lock_if_left(p_user uuid, p_poll uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare r record; v_lock uuid; v_n integer := 0;
begin
  for r in
    select q.id, q.created_by, q.unlock_code_hash from public.quick_poll_recipients x join public.quick_polls q on q.id = x.poll_id
    where x.user_id = p_user and (p_poll is null or q.id = p_poll)
      and q.lock_on_leave and q.closed_at is null and q.closes_at > now()
      and x.seen_at is not null and x.answered_at is null and x.lock_id is null
    for update of x
  loop
    select l.id into v_lock from public.screen_locks l where l.user_id = p_user and l.unlocked_at is null order by l.created_at desc limit 1;
    if v_lock is null then
      insert into public.screen_locks (user_id, sender_id, body, code_hash)
      values (p_user, r.created_by,
        'Saliste de la plataforma durante la pregunta relámpago sin responder. Comunícate con el profesor para que te dé el código de desbloqueo.',
        r.unlock_code_hash)
      returning id into v_lock;
    end if;
    update public.quick_poll_recipients set left_at = now(), lock_id = v_lock where poll_id = r.id and user_id = p_user;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Profesor: lanza la pregunta. p_mode: 'conectados' (en línea ahora; de p_class o de todas mis secciones),
-- 'seccion' (toda la sección p_class) o 'todos' (todos mis estudiantes). Cierra la pregunta abierta anterior suya.
create or replace function public.poll_open(p_mode text, p_class uuid, p_question text, p_options text[], p_correct integer,
  p_explanation text, p_lock boolean, p_code text, p_minutes integer, p_origin text default 'profesor')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_ids uuid[]; v_opts text[]; v_id uuid; v_n integer;
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado puede lanzar preguntas' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('conectados', 'seccion', 'todos') then raise exception 'Destinatarios no válidos' using errcode = '22023'; end if;
  if (p_mode = 'seccion' or p_class is not null) and (p_class is null or not (public.is_admin() or public.is_class_teacher(p_class)
       or public.is_course_staff((select course_id from public.classes where id = p_class)))) then
    raise exception 'No imparte esa sección' using errcode = '42501';
  end if;
  if p_question is null or char_length(btrim(p_question)) not between 5 and 500 then
    raise exception 'La pregunta debe tener entre 5 y 500 caracteres' using errcode = '22023';
  end if;
  select array_agg(btrim(t.x) order by t.n) into v_opts from unnest(p_options) with ordinality t(x, n) where btrim(coalesce(t.x, '')) <> '';
  if coalesce(array_length(v_opts, 1), 0) not between 2 and 6 or exists (select 1 from unnest(v_opts) o where char_length(o) > 200) then
    raise exception 'Entre 2 y 6 opciones de hasta 200 caracteres' using errcode = '22023';
  end if;
  if p_correct is not null and (p_correct < 0 or p_correct >= array_length(v_opts, 1)) then raise exception 'Respuesta correcta fuera de rango' using errcode = '22023'; end if;
  if p_minutes is null or p_minutes not between 1 and 30 then raise exception 'Duración entre 1 y 30 minutos' using errcode = '22023'; end if;
  if coalesce(p_lock, false) and (p_code is null or char_length(btrim(p_code)) < 4 or char_length(p_code) > 32) then
    raise exception 'El código de desbloqueo debe tener entre 4 y 32 caracteres' using errcode = '22023';
  end if;

  if p_mode = 'conectados' then
    select array_agg(distinct o.user_id) into v_ids from public.control_online() o where p_class is null or o.class_id = p_class;
  else
    select array_agg(distinct s.user_id) into v_ids from public.my_messageable_students() s where p_mode = 'todos' or s.class_id = p_class;
  end if;
  if v_ids is null then raise exception 'Ningún destinatario' using errcode = 'P0001'; end if;

  update public.quick_polls set closed_at = now() where created_by = auth.uid() and closed_at is null and closes_at > now();
  insert into public.quick_polls (created_by, class_id, question, options, correct, explanation, lock_on_leave, unlock_code_hash, origin, closes_at)
  values (auth.uid(), p_class, btrim(p_question), v_opts, p_correct, nullif(btrim(coalesce(p_explanation, '')), ''), coalesce(p_lock, false),
          case when coalesce(p_lock, false) then extensions.crypt(lower(btrim(p_code)), extensions.gen_salt('bf')) end,
          case when p_origin = 'ia' then 'ia' else 'profesor' end, now() + make_interval(mins => p_minutes))
  returning id into v_id;
  insert into public.quick_poll_recipients (poll_id, user_id) select v_id, u from unnest(v_ids) u;
  get diagnostics v_n = row_count;
  return jsonb_build_object('id', v_id, 'destinatarios', v_n);
end;
$$;

-- Estudiante: pregunta abierta pendiente (sin la respuesta correcta). Marca que la vio.
create or replace function public.my_open_poll()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if auth.uid() is null then return null; end if;
  select q.id, q.question, q.options, q.lock_on_leave, q.closes_at, coalesce(nullif(p.full_name, ''), 'Profesor') sender into r
  from public.quick_poll_recipients x join public.quick_polls q on q.id = x.poll_id left join public.profiles p on p.id = q.created_by
  where x.user_id = auth.uid() and x.answered_at is null and x.lock_id is null and q.closed_at is null and q.closes_at > now()
  order by q.created_at desc limit 1;
  if not found then return null; end if;
  update public.quick_poll_recipients set seen_at = coalesce(seen_at, now()) where poll_id = r.id and user_id = auth.uid();
  return jsonb_build_object('id', r.id, 'question', r.question, 'options', to_jsonb(r.options), 'lock_on_leave', r.lock_on_leave,
    'closes_at', r.closes_at, 'sender_name', r.sender, 'server_now', now());
end;
$$;

-- Estudiante: responde (una sola vez, mientras esté abierta y no haya salido)
create or replace function public.poll_answer(p_poll uuid, p_option integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare q public.quick_polls; x public.quick_poll_recipients;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into q from public.quick_polls where id = p_poll;
  select * into x from public.quick_poll_recipients where poll_id = p_poll and user_id = auth.uid() for update;
  if q.id is null or x.poll_id is null then raise exception 'Pregunta no encontrada' using errcode = '42501'; end if;
  if p_option is null or p_option < 0 or p_option >= array_length(q.options, 1) then raise exception 'Opción no válida' using errcode = '22023'; end if;
  if x.answered_at is not null then return jsonb_build_object('ok', false, 'motivo', 'ya_respondida'); end if;
  if x.lock_id is not null then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
  if q.closed_at is not null or q.closes_at <= now() then return jsonb_build_object('ok', false, 'motivo', 'cerrada'); end if;
  update public.quick_poll_recipients set answer = p_option, answered_at = now(), seen_at = coalesce(seen_at, now())
    where poll_id = p_poll and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- Estudiante: el aula avisa de que salió de la plataforma (idempotente)
create or replace function public.poll_left(p_poll uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  return jsonb_build_object('bloqueado', public.poll_lock_if_left(auth.uid(), p_poll) > 0
    or exists (select 1 from public.quick_poll_recipients where poll_id = p_poll and user_id = auth.uid() and lock_id is not null));
end;
$$;

-- Profesor: ¿puede ver o gestionar esta pregunta? (quien la lanzó o el administrador)
create or replace function public.poll_es_mia(p_poll uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_teacher() and exists (select 1 from public.quick_polls q where q.id = p_poll and (q.created_by = auth.uid() or public.is_admin())) $$;

create or replace function public.poll_close(p_poll uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.poll_es_mia(p_poll) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.quick_polls set closed_at = now() where id = p_poll and closed_at is null;
end;
$$;

create or replace function public.poll_results(p_poll uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare q public.quick_polls;
begin
  if not public.poll_es_mia(p_poll) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into q from public.quick_polls where id = p_poll;
  return jsonb_build_object(
    'id', q.id, 'question', q.question, 'options', to_jsonb(q.options), 'correct', q.correct, 'explanation', q.explanation,
    'lock_on_leave', q.lock_on_leave, 'created_at', q.created_at, 'closes_at', q.closes_at,
    'abierta', q.closed_at is null and q.closes_at > now(), 'server_now', now(),
    'conteo', (select to_jsonb(array_agg(coalesce(c.n, 0) order by i)) from generate_series(0, array_length(q.options, 1) - 1) i
               left join (select answer, count(*) n from public.quick_poll_recipients where poll_id = p_poll and answer is not null group by answer) c on c.answer = i),
    'destinatarios', (select count(*) from public.quick_poll_recipients where poll_id = p_poll),
    'vieron', (select count(*) from public.quick_poll_recipients where poll_id = p_poll and seen_at is not null),
    'respondieron', (select count(*) from public.quick_poll_recipients where poll_id = p_poll and answered_at is not null),
    'salieron', (select count(*) from public.quick_poll_recipients where poll_id = p_poll and lock_id is not null),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nombre', coalesce(nullif(p.full_name, ''), p.student_code, 'Estudiante'),
        'vio', x.seen_at is not null, 'respuesta', x.answer, 'respondio', x.answered_at, 'salio', x.left_at,
        'bloqueado', exists (select 1 from public.screen_locks l where l.id = x.lock_id and l.unlocked_at is null))
        order by p.full_name), '[]'::jsonb)
      from public.quick_poll_recipients x join public.profiles p on p.id = x.user_id where x.poll_id = p_poll));
end;
$$;

-- Profesor: libera de una vez a todos los que bloqueó esta pregunta
create or replace function public.poll_release_all(p_poll uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  if not public.poll_es_mia(p_poll) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.screen_locks set unlocked_at = now(), unlocked_by = 'profesor'
    where unlocked_at is null and id in (select lock_id from public.quick_poll_recipients where poll_id = p_poll and lock_id is not null);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.my_recent_polls()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select q.id, q.question, q.created_at, q.closed_at is null and q.closes_at > now() abierta, q.lock_on_leave,
      (select count(*) from public.quick_poll_recipients r where r.poll_id = q.id) destinatarios,
      (select count(*) from public.quick_poll_recipients r where r.poll_id = q.id and r.answered_at is not null) respondieron,
      (select count(*) from public.quick_poll_recipients r where r.poll_id = q.id and r.lock_id is not null) salieron
    from public.quick_polls q where public.is_teacher() and q.created_by = auth.uid() order by q.created_at desc limit 10) x
$$;

-- Segunda barrera: el latido de conexión con la pestaña oculta también bloquea (misma función de la migración 18,
-- con una línea añadida al final)
create or replace function public.presence_ping(p_conn uuid, p_visible boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_dueno uuid;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.my_account_ok() or coalesce((select role from public.profiles where id = v_uid), 'student') <> 'student' then
    return jsonb_build_object('tracked', false, 'server_now', now());
  end if;
  if p_conn is null then raise exception 'Falta la conexión' using errcode = '22023'; end if;
  select user_id into v_dueno from public.presence_connections where conn_id = p_conn;
  if v_dueno is not null and v_dueno <> v_uid then raise exception 'Conexión ajena' using errcode = '42501'; end if;
  insert into public.presence_connections (conn_id, user_id, visible) values (p_conn, v_uid, coalesce(p_visible, true))
    on conflict (conn_id) do update set last_seen = now(), visible = excluded.visible;
  delete from public.presence_connections where user_id = v_uid and last_seen < now() - interval '10 minutes';
  if not coalesce(p_visible, true) then perform public.poll_lock_if_left(v_uid, null); end if;
  return jsonb_build_object('tracked', true, 'server_now', now());
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Permisos
revoke all on function public.poll_lock_if_left(uuid, uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['control_pulso(uuid)', 'poll_open(text, uuid, text, text[], integer, text, boolean, text, integer, text)', 'my_open_poll()',
    'poll_answer(uuid, integer)', 'poll_left(uuid)', 'poll_es_mia(uuid)', 'poll_close(uuid)', 'poll_results(uuid)', 'poll_release_all(uuid)', 'my_recent_polls()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['svc_orbe_ia_reservar_uso(uuid, text, uuid)', 'svc_orbe_ia_finalizar_uso(bigint, boolean, integer, integer, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
