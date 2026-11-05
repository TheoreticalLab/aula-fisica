-- =============================================================================
-- Migración 86 · Modalidad general de pregunta con RESPUESTA ORAL (grabación de audio)
-- =============================================================================
-- Nuevo formato de ejercicio 'audio' (los cinco existentes no cambian y ninguna actividad existente lo usa).
--  · Configuración del profesor (exercises.audio_config, visible para el estudiante porque no es secreta): duración
--    mínima y máxima (por defecto 60–120 s), número de grabaciones permitidas, escuchar antes de enviar, y las
--    opciones de transcripción e IA (quedan guardadas; hoy no hay un servicio de voz a texto configurado).
--  · La clave (exercise_keys.answer = {format:'audio', rubric}) solo la ve el profesorado: la rúbrica no viaja al
--    estudiante mientras no se revelen las soluciones.
--  · Las grabaciones van a un almacenamiento PRIVADO por la Edge Function «entregas» (módulo «audio»), que comprueba el
--    formato por su firma; aquí se autoriza y se registra (response_audios). La respuesta guarda {audio_id, duracion_ms}.
--  · Se califica a mano (pending_review), con la revisión de siempre (grade_response), que ahora muestra el audio.
--  · Conservación: mientras exista el intento; un administrador puede borrar los archivos de intentos entregados hace
--    más de N días (mínimo 180), dejando constancia (eliminado_at). Nunca se borran filas.
-- Aditiva: valor nuevo de un enumerado, columna nueva, tabla nueva y funciones.
-- =============================================================================

alter type public.exercise_format add value if not exists 'audio';

alter table public.exercises add column if not exists audio_config jsonb;
comment on column public.exercises.audio_config is 'Pregunta oral (formato audio): {min_s, max_s, max_grabaciones, reproducir_previa, transcripcion, ia}.';

-- normaliza la configuración (valores por defecto y límites técnicos: 5–600 s, 1–5 grabaciones)
create or replace function public.audio_config_normal(p jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare v_min integer; v_max integer; v_n integer;
begin
  v_min := least(600, greatest(5, coalesce((p ->> 'min_s')::integer, 60)));
  v_max := least(600, greatest(v_min, coalesce((p ->> 'max_s')::integer, 120)));
  v_n := least(5, greatest(1, coalesce((p ->> 'max_grabaciones')::integer, 2)));
  return jsonb_build_object('min_s', v_min, 'max_s', v_max, 'max_grabaciones', v_n,
    'reproducir_previa', coalesce((p ->> 'reproducir_previa')::boolean, true),
    'transcripcion', coalesce((p ->> 'transcripcion')::boolean, false),
    'ia', coalesce((p ->> 'ia')::boolean, false));
exception when invalid_text_representation then
  raise exception 'Configuración de audio no válida' using errcode = '22023';
end;
$$;

-- la configuración guardada siempre es la normalizada (también si el profesor escribe la tabla directamente)
create or replace function public.exercises_audio_config_trg()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.format::text = 'audio' then new.audio_config := public.audio_config_normal(new.audio_config);
  elsif new.audio_config is not null then new.audio_config := null;
  end if;
  return new;
end;
$$;
drop trigger if exists exercises_audio_config on public.exercises;
create trigger exercises_audio_config before insert or update of format, audio_config on public.exercises
  for each row execute function public.exercises_audio_config_trg();

create table if not exists public.response_audios (
  id uuid primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav')),
  bytes integer not null check (bytes between 1 and 20971520),
  duracion_ms integer not null check (duracion_ms between 1000 and 660000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  transcripcion text,
  created_at timestamptz not null default now(),
  eliminado_at timestamptz
);
create index if not exists response_audios_intento on public.response_audios (attempt_id, exercise_id, created_at);
alter table public.response_audios enable row level security;
revoke all on public.response_audios from anon, authenticated;

insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota)
  values ('response_audios', 'intento', 'attempt_id', null, 20, 'grabaciones: viajan con su intento')
  on conflict (tabla) do nothing;

-- ¿Puede este estudiante grabar ahora en esta pregunta? (dueño, intento escribible —plazo, tiempo, pausa, pantalla
-- bloqueada—, pregunta del intento y abierta, formato audio, duración dentro de lo configurado, grabaciones restantes)
create or replace function public.audio_comprobar(p_user uuid, p_attempt uuid, p_exercise uuid, p_bytes integer, p_duracion_ms integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e public.exercises; cfg jsonb; v_n integer;
begin
  perform public.assert_attempt_writable(p_attempt, p_user);
  perform public.exam_assert_navegable(p_attempt, p_exercise);
  if public.attempt_item_points(p_attempt, p_exercise) is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  select * into e from public.exercises where id = p_exercise;
  if e.format::text <> 'audio' then raise exception 'Esta pregunta no es de respuesta oral' using errcode = '22023'; end if;
  cfg := public.audio_config_normal(e.audio_config);
  if p_bytes is null or p_bytes <= 0 or p_bytes > 20971520 then raise exception 'La grabación supera el máximo de 20 MB' using errcode = '22023'; end if;
  -- la duración la mide el navegador: margen de 1,5 s por debajo y 3 s por encima
  if p_duracion_ms is null or p_duracion_ms < (cfg ->> 'min_s')::integer * 1000 - 1500 then
    raise exception 'La grabación debe durar al menos % segundos', cfg ->> 'min_s' using errcode = '22023';
  end if;
  if p_duracion_ms > (cfg ->> 'max_s')::integer * 1000 + 3000 then
    raise exception 'La grabación no puede pasar de % segundos', cfg ->> 'max_s' using errcode = '22023';
  end if;
  select count(*) into v_n from public.response_audios a where a.attempt_id = p_attempt and a.exercise_id = p_exercise;
  if v_n >= (cfg ->> 'max_grabaciones')::integer then
    raise exception 'Ya usó las % grabaciones permitidas en esta pregunta', cfg ->> 'max_grabaciones' using errcode = '42501';
  end if;
  return cfg || jsonb_build_object('usadas', v_n);
end;
$$;

create or replace function public.svc_audio_check(p_user uuid, p_attempt uuid, p_exercise uuid, p_bytes integer, p_duracion_ms integer)
returns jsonb
language sql security definer set search_path = ''
as $$ select public.audio_comprobar(p_user, p_attempt, p_exercise, p_bytes, p_duracion_ms) $$;

-- Registro tras guardar el archivo: vuelve a comprobar con el intento bloqueado (dos envíos simultáneos no superan el
-- máximo), fija la hora del servidor y deja la respuesta {audio_id, duracion_ms} (la grabación anterior se conserva)
create or replace function public.svc_audio_record(p_user uuid, p_attempt uuid, p_exercise uuid, p_id uuid, p_path text, p_mime text,
  p_bytes integer, p_duracion_ms integer, p_sha text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_ext text; v_points numeric;
begin
  perform 1 from public.attempts where id = p_attempt for update;
  perform public.audio_comprobar(p_user, p_attempt, p_exercise, p_bytes, p_duracion_ms);
  v_ext := case p_mime when 'audio/webm' then 'webm' when 'audio/ogg' then 'ogg' when 'audio/mp4' then 'm4a' when 'audio/mpeg' then 'mp3' when 'audio/wav' then 'wav' end;
  if v_ext is null then raise exception 'Formato de audio no admitido' using errcode = '22023'; end if;
  if p_path <> p_attempt::text || '/' || p_user::text || '/' || p_id::text || '.' || v_ext then raise exception 'Ruta no válida' using errcode = '22023'; end if;
  insert into public.response_audios (id, attempt_id, exercise_id, user_id, storage_path, mime, bytes, duracion_ms, sha256)
    values (p_id, p_attempt, p_exercise, p_user, p_path, p_mime, p_bytes, p_duracion_ms, p_sha);
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  insert into public.responses (attempt_id, exercise_id, user_id, answer, points)
    values (p_attempt, p_exercise, p_user, jsonb_build_object('audio_id', p_id, 'duracion_ms', p_duracion_ms), v_points)
    on conflict (attempt_id, exercise_id) do update set answer = excluded.answer;
  return jsonb_build_object('id', p_id, 'subido', now(), 'duracion_ms', p_duracion_ms);
end;
$$;

-- Ruta de una grabación para escucharla: el autor, el profesorado de la sección, el personal de la asignatura o el admin
create or replace function public.svc_audio_path(p_user uuid, p_audio uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare a public.response_audios; v_class uuid; v_course uuid;
begin
  select * into a from public.response_audios where id = p_audio;
  if a.id is null then raise exception 'Grabación no encontrada' using errcode = 'P0002'; end if;
  if a.eliminado_at is not null then raise exception 'La grabación se eliminó por la política de conservación' using errcode = 'P0002'; end if;
  select act.class_id, c.course_id into v_class, v_course
    from public.attempts t join public.activities act on act.id = t.activity_id join public.classes c on c.id = act.class_id where t.id = a.attempt_id;
  if not public.account_ok(p_user) or not (
       a.user_id = p_user
       or exists (select 1 from public.class_teachers ct where ct.class_id = v_class and ct.user_id = p_user)
       or exists (select 1 from public.course_staff s where s.course_id = v_course and s.user_id = p_user)
       or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')) then
    raise exception 'No tiene acceso a esta grabación' using errcode = '42501';
  end if;
  return a.storage_path;
end;
$$;

-- Estudiante: configuración de la pregunta y sus grabaciones (sin rúbrica ni clave)
create or replace function public.audio_mi_pregunta(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare t public.attempts; e public.exercises;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into t from public.attempts where id = p_attempt;
  if t.id is null or t.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if public.attempt_item_points(p_attempt, p_exercise) is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  select * into e from public.exercises where id = p_exercise;
  if e.format::text <> 'audio' then raise exception 'Esta pregunta no es de respuesta oral' using errcode = '22023'; end if;
  return jsonb_build_object('config', public.audio_config_normal(e.audio_config),
    'grabaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'subido', a.created_at, 'duracion_ms', a.duracion_ms, 'bytes', a.bytes,
        'eliminada', a.eliminado_at is not null) order by a.created_at), '[]')
      from public.response_audios a where a.attempt_id = p_attempt and a.exercise_id = p_exercise),
    'vigente', (select r.answer ->> 'audio_id' from public.responses r where r.attempt_id = p_attempt and r.exercise_id = p_exercise));
end;
$$;

-- Profesorado: grabaciones de una respuesta (duración, transcripción si existe)
create or replace function public.audio_de_respuesta(p_response uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.responses;
begin
  select * into r from public.responses where id = p_response;
  if r.id is null or not public.can_review_attempt(r.attempt_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object('vigente', r.answer ->> 'audio_id',
    'grabaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'subido', a.created_at, 'duracion_ms', a.duracion_ms, 'bytes', a.bytes,
        'mime', a.mime, 'transcripcion', a.transcripcion, 'eliminada', a.eliminado_at is not null) order by a.created_at), '[]')
      from public.response_audios a where a.attempt_id = r.attempt_id and a.exercise_id = r.exercise_id));
end;
$$;

-- Conservación: grabaciones de intentos ENTREGADOS hace más de p_dias (mínimo 180). Solo administradores. La Edge
-- Function borra los archivos y después marca las filas (eliminado_at); las filas y las notas se conservan.
create or replace function public.svc_audio_caducados(p_admin uuid, p_dias integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'admin') then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if p_dias is null or p_dias < 180 then raise exception 'La conservación mínima es de 180 días' using errcode = '22023'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'path', a.storage_path)), '[]')
    from public.response_audios a join public.attempts t on t.id = a.attempt_id
    where a.eliminado_at is null and t.status = 'submitted' and t.submitted_at < now() - make_interval(days => p_dias));
end;
$$;

create or replace function public.svc_audio_marcar_eliminados(p_admin uuid, p_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'admin') then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  update public.response_audios set eliminado_at = now() where id = any (p_ids) and eliminado_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- grade_response (migración 3) + «deshacer la nota» devuelve a pendiente también las respuestas orales
create or replace function public.grade_response(p_response uuid, p_credit numeric, p_feedback text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_resp public.responses;
begin
  select * into v_resp from public.responses where id = p_response;
  if not found or not public.can_review_attempt(v_resp.attempt_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_credit is not null and (p_credit < 0 or p_credit > 1) then
    raise exception 'El crédito debe estar entre 0 y 1' using errcode = '22023';
  end if;
  if exists (select 1 from public.attempts a where a.id = v_resp.attempt_id and a.activity_id is not null and a.status = 'in_progress') then
    raise exception 'El intento todavía no se ha entregado' using errcode = 'P0001';
  end if;
  update public.responses set
    manual_credit = p_credit,
    teacher_feedback = nullif(left(coalesce(p_feedback, ''), 4000), ''),
    graded_by = auth.uid(),
    graded_at = now(),
    status = case
      -- sin nota manual: vuelve al resultado automático (o a pendiente si no lo hay)
      when p_credit is null and auto_credit is null and status in ('correct', 'partial', 'incorrect')
           and (select e.format::text from public.exercises e where e.id = responses.exercise_id) in ('open', 'audio') then 'pending_review'::public.response_status
      when p_credit is null and auto_credit is not null and v_resp.manual_credit is not null then
        (case when auto_credit >= 1 then 'correct' when auto_credit > 0 then 'partial' else 'incorrect' end)::public.response_status
      when p_credit is null then status
      when p_credit >= 1 then 'correct'::public.response_status
      when p_credit > 0 then 'partial'::public.response_status
      else 'incorrect'::public.response_status end
  where id = p_response;
  insert into public.response_events (response_id, user_id, kind, result)
    values (p_response, auth.uid(), 'manual_grade', jsonb_build_object('credit', p_credit));
  perform public.recompute_attempt(v_resp.attempt_id);
end;
$$;

-- permisos -------------------------------------------------------------------------------------------------------
revoke all on function public.audio_config_normal(jsonb) from public, anon;
grant execute on function public.audio_config_normal(jsonb) to authenticated;
revoke all on function public.exercises_audio_config_trg() from public, anon, authenticated;
revoke all on function public.audio_comprobar(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.svc_audio_check(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.svc_audio_record(uuid, uuid, uuid, uuid, text, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.svc_audio_path(uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc_audio_caducados(uuid, integer) from public, anon, authenticated;
revoke all on function public.svc_audio_marcar_eliminados(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.svc_audio_check(uuid, uuid, uuid, integer, integer) to service_role;
grant execute on function public.svc_audio_record(uuid, uuid, uuid, uuid, text, text, integer, integer, text) to service_role;
grant execute on function public.svc_audio_path(uuid, uuid) to service_role;
grant execute on function public.svc_audio_caducados(uuid, integer) to service_role;
grant execute on function public.svc_audio_marcar_eliminados(uuid, uuid[]) to service_role;
revoke all on function public.audio_mi_pregunta(uuid, uuid) from public, anon;
revoke all on function public.audio_de_respuesta(uuid) from public, anon;
grant execute on function public.audio_mi_pregunta(uuid, uuid) to authenticated;
grant execute on function public.audio_de_respuesta(uuid) to authenticated;
