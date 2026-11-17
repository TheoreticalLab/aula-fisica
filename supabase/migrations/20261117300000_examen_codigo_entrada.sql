-- =============================================================================
-- Migración 100 · Evaluaciones: código de entrada rotativo
--
-- Por encargo del profesor (17-nov-2026): una evaluación puede exigir, para EMPEZAR, un código que el profesor da en
-- persona. El código tiene 6 cifras y cambia cada 60 s (30 o 120 s configurables); se deriva de un secreto propio de
-- la evaluación (como el código rotativo de la asistencia, migración 26) y vale el de la ventana actual y el de la
-- anterior. El profesor lo ve en el panel de la evaluación; el estudiante lo escribe antes de «Comenzar».
--  · Solo afecta a intentos NUEVOS: continuar un intento en curso no lo pide (el bloqueo al salir sigue igual).
--  · 5 códigos incorrectos en 10 minutos → hay que esperar (se registra cada fallo).
--  · El profesor de la sección no lo necesita (vista previa).
-- Aditiva: columnas con valor por defecto (desactivado), una tabla nueva y create or replace de dos funciones
-- (copias exactas de su versión vigente, generadas por privado/tmp/generar-100.mjs).
-- =============================================================================
set local lock_timeout = '5s';

alter table public.exam_settings add column if not exists codigo_entrada boolean not null default false;
alter table public.exam_settings add column if not exists codigo_entrada_segundos integer not null default 60;
alter table public.exam_settings add column if not exists codigo_entrada_secreto text not null default encode(extensions.gen_random_bytes(16), 'hex');
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'exam_settings_codigo_entrada_seg_chk') then
    alter table public.exam_settings add constraint exam_settings_codigo_entrada_seg_chk check (codigo_entrada_segundos in (30, 60, 120));
  end if;
end $$;
comment on column public.exam_settings.codigo_entrada_secreto is 'Secreto del código de entrada rotativo. Nunca se devuelve.';

-- códigos de entrada incorrectos (para limitar los intentos de adivinarlo)
create table if not exists public.exam_entrada_fallos (
  id bigserial primary key,
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists exam_entrada_fallos_idx on public.exam_entrada_fallos (activity_id, user_id, created_at);
alter table public.exam_entrada_fallos enable row level security;
revoke all on public.exam_entrada_fallos from public, anon, authenticated;
-- los fallos viajan con el estudiante si se fusionan cuentas
insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota)
  values ('exam_entrada_fallos', 'mover', null, null, 72, 'códigos de entrada incorrectos')
  on conflict (tabla) do nothing;

-- Código de una evaluación en una ventana de tiempo (interna)
create or replace function public.exam_codigo_entrada_en(p_activity uuid, p_ventana bigint)
returns text
language sql stable security definer set search_path = ''
as $$
  select lpad(((('x' || substr(encode(sha256(convert_to(s.codigo_entrada_secreto || ':entrada:' || p_ventana::text, 'UTF8')), 'hex'), 1, 12))::bit(48)::bigint) % 1000000)::text, 6, '0')
  from public.exam_settings s where s.activity_id = p_activity
$$;

-- Lo que ve el profesor: el código vigente y cuándo cambia
create or replace function public.exam_codigo_entrada(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; s public.exam_settings; v_win bigint;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.grades_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.exam_settings where activity_id = p_activity;
  if s.activity_id is null or not s.codigo_entrada then return jsonb_build_object('activo', false); end if;
  v_win := floor(extract(epoch from now()) / s.codigo_entrada_segundos)::bigint;
  return jsonb_build_object('activo', true, 'codigo', public.exam_codigo_entrada_en(p_activity, v_win),
    'segundos', s.codigo_entrada_segundos, 'cambia_at', to_timestamp((v_win + 1) * s.codigo_entrada_segundos), 'ahora', now());
end;
$$;

-- El estudiante empieza con el código: si vale (ventana actual o anterior), abre el intento como siempre.
-- Devuelve {ok, attempt_id} o {ok:false, mensaje} (un código incorrecto queda registrado; no se lanza error para no
-- deshacer ese registro).
create or replace function public.start_activity_attempt_codigo(p_activity uuid, p_codigo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); s public.exam_settings; v_win bigint; v_cod text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'); v_id uuid;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.activity_visible_to_me(p_activity) then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
  select * into s from public.exam_settings where activity_id = p_activity;
  if s.activity_id is null or not s.codigo_entrada then
    return jsonb_build_object('ok', true, 'attempt_id', public.start_activity_attempt(p_activity));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_activity::text || ':entrada', 0));
  if (select count(*) from public.exam_entrada_fallos f where f.activity_id = p_activity and f.user_id = v_uid
        and f.created_at > now() - interval '10 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'mensaje', 'Demasiados códigos incorrectos. Espere unos minutos y pida al profesor el código vigente.');
  end if;
  v_win := floor(extract(epoch from now()) / s.codigo_entrada_segundos)::bigint;
  if v_cod = '' or v_cod not in (public.exam_codigo_entrada_en(p_activity, v_win), public.exam_codigo_entrada_en(p_activity, v_win - 1)) then
    insert into public.exam_entrada_fallos (activity_id, user_id) values (p_activity, v_uid);
    return jsonb_build_object('ok', false, 'mensaje', 'Código incorrecto o vencido: pida al profesor el código que ve ahora.');
  end if;
  perform set_config('aula.codigo_entrada', p_activity::text, true);
  v_id := public.start_activity_attempt(p_activity);
  perform set_config('aula.codigo_entrada', '', true);
  return jsonb_build_object('ok', true, 'attempt_id', v_id);
end;
$$;

create or replace function public.exam_settings_of(p_activity uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('presentacion', s.presentacion, 'navegacion', s.navegacion, 'sin_saltos', s.sin_saltos, 'duracion_s', s.duracion_s,
       'pausas', jsonb_build_object('permitidas', s.pausas_permitidas, 'max_numero', s.pausas_max, 'max_total_s', s.pausa_max_total_s, 'detienen_reloj', s.pausa_detiene_reloj),
       'integridad', jsonb_build_object('bloquear_al_salir', s.bloquear_al_salir, 'impedir_copiar', s.impedir_copiar, 'codigo_configurado', s.codigo_salida_hash is not null),
       'codigo_entrada', s.codigo_entrada,
       'configurado', true)
     from public.exam_settings s where s.activity_id = p_activity),
    jsonb_build_object('presentacion', 'todas', 'navegacion', 'libre', 'sin_saltos', false, 'duracion_s', null,
      'pausas', jsonb_build_object('permitidas', false, 'max_numero', 0, 'max_total_s', 0, 'detienen_reloj', false),
      'integridad', jsonb_build_object('bloquear_al_salir', false, 'impedir_copiar', false, 'codigo_configurado', false), 'codigo_entrada', false, 'configurado', false))
$$;

create or replace function public.start_activity_attempt(p_activity uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_act public.activities;
  v_course uuid;
  v_id uuid;
  v_used integer;
  v_seq integer;
begin
  if v_uid is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.activity_visible_to_me(p_activity) then
    raise exception 'Actividad no disponible' using errcode = '42501';
  end if;
  -- serializa dobles clics y peticiones simultáneas del mismo estudiante
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_activity::text, 0));
  select * into v_act from public.activities where id = p_activity;
  if v_act.opens_at is not null and now() < v_act.opens_at then
    raise exception 'La actividad todavía no está abierta' using errcode = 'P0001';
  end if;
  -- lectura cronometrada: primero hay que completar el tiempo mínimo de lectura
  if v_act.reading_min_seconds is not null and not exists (
      select 1 from public.reading_progress r
      where r.user_id = v_uid and r.activity_id = p_activity and r.completed_at is not null) then
    raise exception 'Primero complete el tiempo de lectura' using errcode = 'P0001';
  end if;
  select id into v_id from public.attempts where user_id = v_uid and activity_id = p_activity and status = 'in_progress';
  if found then return v_id; end if;
  -- código de entrada (migración 100): un intento NUEVO solo se abre con el código rotativo del profesor
  -- (start_activity_attempt_codigo lo comprueba y deja la marca de esta transacción); el profesor no lo necesita
  if exists (select 1 from public.exam_settings s where s.activity_id = p_activity and s.codigo_entrada)
     and not public.is_class_teacher(v_act.class_id)
     and current_setting('aula.codigo_entrada', true) is distinct from p_activity::text then
    raise exception 'Para empezar necesita el código de entrada que le da el profesor' using errcode = 'P0001', hint = 'codigo_entrada';
  end if;
  if v_act.closes_at is not null and now() >= v_act.closes_at then
    raise exception 'La actividad está cerrada' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.attempts where user_id = v_uid and activity_id = p_activity;
  if v_act.max_attempts is not null and v_used >= v_act.max_attempts then
    raise exception 'Ya utilizó todos los intentos permitidos' using errcode = 'P0001';
  end if;
  select count(*) into v_seq from public.attempts where activity_id = p_activity;
  select c.course_id into v_course from public.classes c where c.id = v_act.class_id;
  insert into public.attempts (user_id, course_id, activity_id, lesson_id, mode, attempt_number)
    -- lesson_id queda vacío: borrar una lección no debe borrar intentos calificados de una actividad
    values (v_uid, v_course, p_activity, null, v_act.mode, v_used + 1)
    returning id into v_id;
  perform public.assign_attempt_items(v_id, p_activity, v_seq);
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    select v_id, i.exercise_id, v_uid, coalesce(i.points, e.points)
    from public.activity_items i join public.exercises e on e.id = i.exercise_id
    where i.activity_id = p_activity
      and (not exists (select 1 from public.attempt_item_orders o where o.attempt_id = v_id)
           or exists (select 1 from public.attempt_item_orders o where o.attempt_id = v_id and o.exercise_id = i.exercise_id));
  perform public.recompute_attempt(v_id);
  return v_id;
end;
$$;

revoke all on function public.exam_codigo_entrada_en(uuid, bigint) from public, anon, authenticated;
revoke all on function public.exam_codigo_entrada(uuid) from public, anon;
grant execute on function public.exam_codigo_entrada(uuid) to authenticated;
revoke all on function public.start_activity_attempt_codigo(uuid, text) from public, anon;
grant execute on function public.start_activity_attempt_codigo(uuid, text) to authenticated;
revoke all on function public.start_activity_attempt(uuid) from public, anon;
grant execute on function public.start_activity_attempt(uuid) to authenticated;
