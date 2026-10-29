-- Centro de Datos · exportación para investigación (migración 34). Solo añade tablas y funciones de LECTURA.
--
-- 1) export_begin fija el alcance autorizado (estudiantes e intentos), la hora de corte (as_of) y el número de filas
--    que debe tener cada tabla; queda registrado quién exporta, cuándo y con qué alcance (data_exports, sin contenido).
-- 2) export_page sirve los datos página a página (máx. 5000 filas) de 41 fuentes en LISTA BLANCA: el nombre de la
--    fuente no se interpola nunca en SQL; se elige una plantilla fija (export_fuente). Nunca hay tablas arbitrarias.
-- 3) Permisos: el administrador, todo; el profesorado, solo los estudiantes que imparte (teaches_student) y sus
--    secciones/asignaturas. Excluidas siempre: autenticación, seguridad, contraseñas, códigos, ubicación exacta,
--    rutas de archivos. Las claves de respuesta, solo si un administrador las pide expresamente.
-- 4) Modo investigación: los identificadores de personas se sustituyen EN EL SERVIDOR por seudónimos estables
--    (HMAC-SHA256 con una clave que nunca sale de la base) y se quitan nombres, correos, matrículas e ID de acceso.
--    Seudonimización no es anonimización: los textos libres pueden contener datos personales.
-- 5) Instantánea: solo filas creadas hasta as_of; las filas que se actualizan (respuestas, intentos) reflejan su
--    último estado (columnas updated_at/submitted_at lo indican). Lo documenta el manifiesto.

create table if not exists public.data_export_secret (
  id smallint primary key default 1 check (id = 1),
  secret bytea not null
);
insert into public.data_export_secret (id, secret) values (1, extensions.gen_random_bytes(32)) on conflict (id) do nothing;

create table if not exists public.data_exports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  as_of timestamptz not null default now(),
  modo text not null check (modo in ('identificado', 'investigacion')),
  alcance jsonb not null,                                   -- tipo, identificadores y fechas (nunca contenido)
  contenido text[] not null,
  formatos text[] not null default '{}',
  incluye_claves boolean not null default false,
  restringe_curso boolean not null default false,
  cursos uuid[] not null default '{}',
  secciones uuid[] not null default '{}',
  actividades uuid[] not null default '{}',
  desde date,
  hasta date,
  conteos jsonb not null default '{}'::jsonb,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'completada', 'incompleta', 'cancelada', 'error')),
  finished_at timestamptz,
  manifiesto_sha256 text check (manifiesto_sha256 is null or manifiesto_sha256 ~ '^[0-9a-f]{64}$'),
  resumen jsonb,                                            -- recuentos exportados por tabla y advertencias
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,40}$')
);
create index if not exists data_exports_actor_idx on public.data_exports (actor_id, created_at desc);

create table if not exists public.data_export_users (
  export_id uuid not null references public.data_exports (id) on delete cascade,
  user_id uuid not null,
  primary key (export_id, user_id)
);
create table if not exists public.data_export_attempts (
  export_id uuid not null references public.data_exports (id) on delete cascade,
  attempt_id uuid not null,
  primary key (export_id, attempt_id)
);

alter table public.data_export_secret enable row level security;
alter table public.data_exports enable row level security;
alter table public.data_export_users enable row level security;
alter table public.data_export_attempts enable row level security;
revoke all on public.data_export_secret, public.data_exports, public.data_export_users, public.data_export_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Seudónimo estable de una persona: E-… (estudiante) o P-… (profesorado). Nunca revela la clave.
create or replace function public.export_seudonimo(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when p_user is null then null else
    (case coalesce((select role::text from public.profiles where id = p_user), 'student') when 'student' then 'E-' else 'P-' end)
    || upper(left(encode(extensions.hmac(convert_to(p_user::text, 'UTF8'), (select secret from public.data_export_secret where id = 1), 'sha256'), 'hex'), 12))
  end
$$;

-- Limpia una fila: quita columnas sensibles y, en modo investigación, seudonimiza a las personas.
create or replace function public.export_fila(p_modo text, p_tabla text, p_quitar text[], r jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare k text;
begin
  r := r - coalesce(p_quitar, '{}');
  if p_modo = 'investigacion' then
    r := r - array['full_name', 'email', 'student_code', 'login_id', 'original_name', 'audience'];
    foreach k in array array['user_id', 'created_by', 'sender_id', 'graded_by', 'opened_by', 'marked_by', 'updated_by', 'changed_by',
                             'assigned_by', 'reviewed_by', 'decided_by', 'calibrated_by'] loop
      if jsonb_typeof(r -> k) = 'string' then r := jsonb_set(r, array[k], to_jsonb(public.export_seudonimo((r ->> k)::uuid))); end if;
    end loop;
    if p_tabla in ('estudiantes', 'profesores') and jsonb_typeof(r -> 'id') = 'string' then
      r := jsonb_set(r, '{id}', to_jsonb(public.export_seudonimo((r ->> 'id')::uuid)));
    end if;
  end if;
  return r;
end;
$$;

-- Plantilla FIJA de cada fuente. $3 = exportación, $4 = hora de corte. Devuelve null si la fuente no existe.
create or replace function public.export_fuente(p_tabla text,
  out grupo text, out tabla_real text, out desde_sql text, out clave text, out tipo text, out quitar text[])
language plpgsql immutable set search_path = ''
as $$
declare
  u constant text := '(select x.user_id from public.data_export_users x where x.export_id = $3)';
  a constant text := '(select x.attempt_id from public.data_export_attempts x where x.export_id = $3)';
  -- «= any ((select arreglo)::uuid[])»: la conversión explícita hace que se compare con los ELEMENTOS del arreglo
  -- (con solo paréntesis, PostgreSQL lo trata como subconsulta y compara uuid con uuid[])
  e constant text := '((select d.%s from public.data_exports d where d.id = $3)::uuid[])';
begin
  case p_tabla
  when 'estudiantes' then grupo := 'academico'; tabla_real := 'profiles'; clave := 'md5(t.id::text)'; tipo := 'text'; quitar := '{password_fingerprint}';
    desde_sql := 'public.profiles t where t.id in ' || u;
  when 'profesores' then grupo := 'academico'; tabla_real := 'profiles'; clave := 'md5(t.id::text)'; tipo := 'text'; quitar := '{password_fingerprint,email,login_id,student_code,must_change_password}';
    desde_sql := 'public.profiles t where t.role <> ''student'' and t.id in (select ct.user_id from public.class_teachers ct where ct.class_id = any ' || format(e, 'secciones') || ')';
  when 'cursos' then grupo := 'academico'; tabla_real := 'courses'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.courses t where t.id = any ' || format(e, 'cursos');
  when 'unidades' then grupo := 'academico'; tabla_real := 'units'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.units t where t.course_id = any ' || format(e, 'cursos');
  when 'lecciones' then grupo := 'academico'; tabla_real := 'lessons'; clave := 't.id'; tipo := 'uuid'; quitar := '{theory,formulas,examples,simulation,study}';
    desde_sql := 'public.lessons t where t.course_id = any ' || format(e, 'cursos');
  when 'conceptos' then grupo := 'academico'; tabla_real := 'concepts'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.concepts t where t.course_id = any ' || format(e, 'cursos');
  when 'ejercicios' then grupo := 'academico'; tabla_real := 'exercises'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.exercises t where t.course_id = any ' || format(e, 'cursos');
  when 'claves' then grupo := 'claves'; tabla_real := 'exercise_keys'; clave := 'md5(t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.exercise_keys t where t.exercise_id in (select ex.id from public.exercises ex where ex.course_id = any ' || format(e, 'cursos') || ')';
  when 'secciones' then grupo := 'academico'; tabla_real := 'classes'; clave := 't.id'; tipo := 'uuid'; quitar := '{join_code}';
    desde_sql := 'public.classes t where t.id = any ' || format(e, 'secciones');
  when 'grupos' then grupo := 'academico'; tabla_real := 'class_groups'; clave := 't.id'; tipo := 'uuid'; quitar := '{join_code}';
    desde_sql := 'public.class_groups t where t.class_id = any ' || format(e, 'secciones');
  when 'matriculas' then grupo := 'academico'; tabla_real := 'enrollments'; clave := 'md5(t.class_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.enrollments t where t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'profesores_seccion' then grupo := 'academico'; tabla_real := 'class_teachers'; clave := 'md5(t.class_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.class_teachers t where t.class_id = any ' || format(e, 'secciones');
  when 'actividades' then grupo := 'academico'; tabla_real := 'activities'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.activities t where t.id = any ' || format(e, 'actividades');
  when 'actividad_items' then grupo := 'academico'; tabla_real := 'activity_items'; clave := 'md5(t.activity_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.activity_items t where t.activity_id = any ' || format(e, 'actividades');
  when 'intentos' then grupo := 'academico'; tabla_real := 'attempts'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.attempts t where t.id in ' || a;
  when 'respuestas' then grupo := 'respuestas'; tabla_real := 'responses'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.responses t where t.attempt_id in ' || a;
  when 'eventos_respuesta' then grupo := 'respuestas'; tabla_real := 'response_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.response_events t where t.created_at <= $4 and t.response_id in (select r.id from public.responses r where r.attempt_id in ' || a || ')';
  when 'telemetria' then grupo := 'telemetria'; tabla_real := 'telemetry_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.telemetry_events t where t.received_at <= $4 and t.attempt_id in ' || a;
  when 'eventos_pregunta' then grupo := 'telemetria'; tabla_real := 'exam_item_events'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.exam_item_events t where t.created_at <= $4 and t.attempt_id in ' || a;
  when 'orden_items' then grupo := 'telemetria'; tabla_real := 'attempt_item_orders'; clave := 'md5(t.attempt_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.attempt_item_orders t where t.attempt_id in ' || a;
  when 'visitas' then grupo := 'estudio'; tabla_real := 'study_visits'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.study_visits t, public.data_exports d where d.id = $3 and t.created_at <= $4 and t.user_id in ' || u
      || ' and (t.course_id = any (d.cursos) or (t.course_id is null and not d.restringe_curso))'
      || ' and (d.desde is null or t.started_at >= d.desde::timestamptz) and (d.hasta is null or t.started_at < (d.hasta + 1)::timestamptz)';
  when 'lectura' then grupo := 'estudio'; tabla_real := 'reading_progress'; clave := 'md5(t.user_id::text || t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.reading_progress t where t.user_id in ' || u || ' and t.activity_id = any ' || format(e, 'actividades');
  when 'asistencia_sesiones' then grupo := 'asistencia'; tabla_real := 'attendance_sessions'; clave := 't.id'; tipo := 'uuid'; quitar := '{code,secret,geo_lat,geo_lng}';
    desde_sql := 'public.attendance_sessions t where t.opened_at <= $4 and t.class_id = any ' || format(e, 'secciones');
  when 'asistencia_registros' then grupo := 'asistencia'; tabla_real := 'attendance_records'; clave := 'md5(t.session_id::text || t.user_id::text)'; tipo := 'text'; quitar := '{lat,lng,device_hash}';
    desde_sql := 'public.attendance_records t where t.user_id in ' || u || ' and t.session_id in (select s.id from public.attendance_sessions s where s.class_id = any ' || format(e, 'secciones') || ')';
  when 'asistencia_rechazos' then grupo := 'asistencia'; tabla_real := 'attendance_rejections'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.attendance_rejections t where t.created_at <= $4 and t.user_id in ' || u || ' and t.session_id in (select s.id from public.attendance_sessions s where s.class_id = any ' || format(e, 'secciones') || ')';
  when 'calif_config' then grupo := 'calificaciones'; tabla_real := 'grade_settings'; clave := 'md5(t.class_id::text)'; tipo := 'text';
    desde_sql := 'public.grade_settings t where t.class_id = any ' || format(e, 'secciones');
  when 'calif_notas' then grupo := 'calificaciones'; tabla_real := 'grade_entries'; clave := 'md5(t.class_id::text || t.user_id::text || t.category)'; tipo := 'text';
    desde_sql := 'public.grade_entries t where t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'calif_historial' then grupo := 'calificaciones'; tabla_real := 'grade_history'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.grade_history t where t.changed_at <= $4 and t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'puntos_extra' then grupo := 'calificaciones'; tabla_real := 'extra_points'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.extra_points t where t.created_at <= $4 and t.class_id = any ' || format(e, 'secciones') || ' and t.user_id in ' || u;
  when 'calif_vinculos' then grupo := 'calificaciones'; tabla_real := 'activity_grade_links'; clave := 'md5(t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.activity_grade_links t where t.activity_id = any ' || format(e, 'actividades');
  when 'mensajes_recibidos' then grupo := 'comunicacion'; tabla_real := 'live_message_recipients'; clave := 'md5(t.message_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.live_message_recipients t where t.created_at <= $4 and t.user_id in ' || u;
  when 'mensajes' then grupo := 'comunicacion'; tabla_real := 'live_messages'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.live_messages t where t.created_at <= $4 and t.id in (select r.message_id from public.live_message_recipients r where r.user_id in ' || u || ')';
  when 'preguntas_relampago' then grupo := 'comunicacion'; tabla_real := 'quick_polls'; clave := 't.id'; tipo := 'uuid'; quitar := '{unlock_code_hash}';
    desde_sql := 'public.quick_polls t where t.created_at <= $4 and t.id in (select r.poll_id from public.quick_poll_recipients r where r.user_id in ' || u || ')';
  when 'preguntas_relampago_respuestas' then grupo := 'comunicacion'; tabla_real := 'quick_poll_recipients'; clave := 'md5(t.poll_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.quick_poll_recipients t where t.user_id in ' || u;
  when 'orbe_ia_mostrados' then grupo := 'comunicacion'; tabla_real := 'orbe_ia_deliveries'; clave := 't.id'; tipo := 'bigint';
    desde_sql := 'public.orbe_ia_deliveries t where t.shown_at <= $4 and t.user_id in ' || u;
  when 'bloqueos' then grupo := 'comunicacion'; tabla_real := 'screen_locks'; clave := 't.id'; tipo := 'uuid'; quitar := '{code_hash}';
    desde_sql := 'public.screen_locks t where t.created_at <= $4 and t.user_id in ' || u;
  when 'entregas_buzones' then grupo := 'comunicacion'; tabla_real := 'upload_boxes'; clave := 't.id'; tipo := 'uuid';
    desde_sql := 'public.upload_boxes t where t.class_id = any ' || format(e, 'secciones');
  when 'entregas_archivos' then grupo := 'comunicacion'; tabla_real := 'upload_files'; clave := 't.id'; tipo := 'uuid'; quitar := '{storage_path}';
    desde_sql := 'public.upload_files t where t.uploaded_at <= $4 and t.user_id in ' || u || ' and t.box_id in (select b.id from public.upload_boxes b where b.class_id = any ' || format(e, 'secciones') || ')';
  when 'entregas_permisos' then grupo := 'comunicacion'; tabla_real := 'upload_permissions'; clave := 'md5(t.box_id::text || t.user_id::text)'; tipo := 'text';
    desde_sql := 'public.upload_permissions t where t.user_id in ' || u || ' and t.box_id in (select b.id from public.upload_boxes b where b.class_id = any ' || format(e, 'secciones') || ')';
  when 'disenos' then grupo := 'diseno'; tabla_real := 'exam_designs'; clave := 'md5(t.activity_id::text)'; tipo := 'text';
    desde_sql := 'public.exam_designs t where t.activity_id = any ' || format(e, 'actividades');
  when 'diseno_items' then grupo := 'diseno'; tabla_real := 'exam_design_items'; clave := 'md5(t.activity_id::text || t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.exam_design_items t where t.activity_id = any ' || format(e, 'actividades');
  when 'calibraciones' then grupo := 'diseno'; tabla_real := 'item_calibrations'; clave := 'md5(t.exercise_id::text)'; tipo := 'text';
    desde_sql := 'public.item_calibrations t where t.exercise_id in (select ex.id from public.exercises ex where ex.course_id = any ' || format(e, 'cursos') || ')';
  else
    grupo := null;
  end case;
  quitar := coalesce(quitar, '{}');
end;
$$;

-- Resuelve el alcance pedido en conjuntos autorizados. Lanza 42501 si se pide algo fuera de los permisos.
create or replace function public.export_resolver(p_alcance jsonb, p_asof timestamptz,
  out usuarios uuid[], out intentos uuid[], out cursos uuid[], out secciones uuid[], out actividades uuid[],
  out restringe_curso boolean, out desde date, out hasta date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tipo text := p_alcance ->> 'tipo';
  v_admin boolean := public.is_admin();
  v_ids uuid[];
  v_pedidos uuid[];
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado puede exportar datos' using errcode = '42501'; end if;
  if v_tipo is null or v_tipo not in ('estudiante', 'grupo', 'seccion', 'curso', 'actividad', 'intento', 'todo') then
    raise exception 'Alcance no válido' using errcode = '22023';
  end if;
  desde := nullif(p_alcance ->> 'desde', '')::date;
  hasta := nullif(p_alcance ->> 'hasta', '')::date;
  restringe_curso := v_tipo in ('seccion', 'curso', 'actividad');
  select coalesce(array_agg(x::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_alcance -> 'ids', '[]'::jsonb)) x;
  if v_tipo <> 'todo' and cardinality(v_ids) = 0 then raise exception 'Falta elegir qué exportar' using errcode = '22023'; end if;

  if v_tipo in ('estudiante', 'grupo') then
    if exists (select 1 from unnest(v_ids) i where not (v_admin or public.teaches_student(i))) then raise exception 'Estudiante fuera de su ámbito' using errcode = '42501'; end if;
    usuarios := v_ids;
  elsif v_tipo = 'seccion' then
    if exists (select 1 from unnest(v_ids) i where not (v_admin or public.is_class_teacher(i)
               or public.is_course_staff((select course_id from public.classes where id = i)))) then raise exception 'Sección fuera de su ámbito' using errcode = '42501'; end if;
    secciones := v_ids;
  elsif v_tipo = 'curso' then
    if exists (select 1 from unnest(v_ids) i where not (v_admin or public.teaches_course(i))) then raise exception 'Asignatura fuera de su ámbito' using errcode = '42501'; end if;
    cursos := v_ids;
    select coalesce(array_agg(c.id), '{}') into secciones from public.classes c where c.course_id = any (v_ids) and (v_admin or public.is_class_teacher(c.id) or public.is_course_staff(c.course_id));
  elsif v_tipo = 'actividad' then
    if exists (select 1 from unnest(v_ids) i where not exists (select 1 from public.activities ac where ac.id = i
               and (v_admin or public.is_class_teacher(ac.class_id) or public.is_course_staff((select course_id from public.classes where id = ac.class_id))))) then
      raise exception 'Actividad fuera de su ámbito' using errcode = '42501'; end if;
    actividades := v_ids;
    select coalesce(array_agg(distinct ac.class_id), '{}') into secciones from public.activities ac where ac.id = any (v_ids);
  elsif v_tipo = 'intento' then
    if exists (select 1 from unnest(v_ids) i where not (v_admin or public.can_review_attempt(i))) then raise exception 'Intento fuera de su ámbito' using errcode = '42501'; end if;
    intentos := v_ids;
    select coalesce(array_agg(distinct t.user_id), '{}') into usuarios from public.attempts t where t.id = any (v_ids);
  else -- todo lo autorizado
    select coalesce(array_agg(p.id), '{}') into usuarios from public.profiles p
      where p.role = 'student' and (v_admin or public.teaches_student(p.id));
  end if;

  -- secciones → estudiantes matriculados (de mi ámbito)
  if usuarios is null then
    select coalesce(array_agg(distinct e.user_id), '{}') into usuarios from public.enrollments e
      join public.profiles p on p.id = e.user_id and p.role = 'student'
      where e.class_id = any (secciones) and (v_admin or public.teaches_student(e.user_id));
    if v_tipo = 'actividad' then   -- y quien hizo intentos aunque ya no esté matriculado
      select coalesce(array_agg(distinct x), '{}') into usuarios from (
        select unnest(usuarios) x union select t.user_id from public.attempts t where t.activity_id = any (actividades)
          and (v_admin or public.teaches_student(t.user_id))) s;
    end if;
  end if;

  -- intentos de esos estudiantes dentro del alcance y del corte
  if intentos is null then
    select coalesce(array_agg(t.id), '{}') into intentos from public.attempts t
    where t.user_id = any (usuarios) and t.started_at <= p_asof
      and (v_tipo <> 'actividad' or t.activity_id = any (actividades))
      and (not restringe_curso or v_tipo = 'actividad' or t.course_id = any (coalesce(cursos, (select array_agg(c.course_id) from public.classes c where c.id = any (secciones)))))
      and (desde is null or t.started_at >= desde::timestamptz) and (hasta is null or t.started_at < (hasta + 1)::timestamptz)
      and (v_admin or public.can_review_attempt(t.id));
  end if;

  -- asignaturas, secciones y actividades que describen esos datos
  if cursos is null then
    select coalesce(array_agg(distinct x), '{}') into cursos from (
      select t.course_id x from public.attempts t where t.id = any (intentos)
      union select c.course_id from public.classes c where c.id = any (coalesce(secciones, '{}'))
      union select c.course_id from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = any (usuarios) and not restringe_curso) s
    where x is not null and (v_admin or public.teaches_course(x));
  end if;
  if secciones is null then
    select coalesce(array_agg(distinct e.class_id), '{}') into secciones from public.enrollments e
      where e.user_id = any (usuarios) and (v_admin or public.is_class_teacher(e.class_id) or public.is_course_staff((select course_id from public.classes where id = e.class_id)));
  end if;
  if actividades is null then
    select coalesce(array_agg(distinct x), '{}') into actividades from (
      select ac.id x from public.activities ac where ac.class_id = any (secciones)
      union select t.activity_id from public.attempts t where t.id = any (intentos)) s where x is not null;
  end if;
end;
$$;

-- Recuento de filas de una fuente dentro de una exportación (misma plantilla que export_page)
create or replace function public.export_contar(p_export uuid, p_tabla text, p_asof timestamptz)
returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare f record; n bigint;
begin
  select * into f from public.export_fuente(p_tabla);
  if f.grupo is null then return null; end if;
  execute format('select count(*) from %s', f.desde_sql) using null::text, 0, p_export, p_asof into n;
  return n;
end;
$$;

-- Vista previa: recuentos sin registrar la exportación (no devuelve datos)
create or replace function public.export_preview(p_alcance jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record; v_asof timestamptz := now();
begin
  select * into r from public.export_resolver(p_alcance, v_asof);
  return jsonb_build_object(
    'estudiantes', cardinality(r.usuarios), 'intentos', cardinality(r.intentos), 'cursos', cardinality(r.cursos),
    'secciones', cardinality(r.secciones), 'actividades', cardinality(r.actividades),
    'respuestas', (select count(*) from public.responses x where x.attempt_id = any (r.intentos)),
    'eventos_telemetria', (select count(*) from public.telemetry_events x where x.attempt_id = any (r.intentos)),
    'eventos_respuesta', (select count(*) from public.response_events x join public.responses y on y.id = x.response_id where y.attempt_id = any (r.intentos)),
    'eventos_pregunta', (select count(*) from public.exam_item_events x where x.attempt_id = any (r.intentos)),
    'visitas', (select count(*) from public.study_visits x where x.user_id = any (r.usuarios)),
    'es_admin', public.is_admin(), 'server_now', v_asof);
end;
$$;

-- Inicio: fija alcance, corte y recuentos esperados; queda registrado.
create or replace function public.export_begin(p_alcance jsonb, p_modo text, p_contenido text[], p_formatos text[], p_claves boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record; v_id uuid; v_asof timestamptz := now(); v_cont text[]; t text; v_conteos jsonb := '{}'::jsonb; v_tablas text[];
  todas constant text[] := array['estudiantes', 'profesores', 'cursos', 'unidades', 'lecciones', 'conceptos', 'ejercicios', 'claves', 'secciones', 'grupos', 'matriculas',
    'profesores_seccion', 'actividades', 'actividad_items', 'intentos', 'respuestas', 'eventos_respuesta', 'telemetria', 'eventos_pregunta', 'orden_items',
    'visitas', 'lectura', 'asistencia_sesiones', 'asistencia_registros', 'asistencia_rechazos', 'calif_config', 'calif_notas', 'calif_historial',
    'puntos_extra', 'calif_vinculos', 'mensajes_recibidos', 'mensajes', 'preguntas_relampago', 'preguntas_relampago_respuestas', 'orbe_ia_mostrados',
    'bloqueos', 'entregas_buzones', 'entregas_archivos', 'entregas_permisos', 'disenos', 'diseno_items', 'calibraciones'];
begin
  if p_modo is null or p_modo not in ('identificado', 'investigacion') then raise exception 'Modo no válido' using errcode = '22023'; end if;
  select array_agg(distinct c) into v_cont from unnest(coalesce(p_contenido, '{}')) c
    where c in ('academico', 'respuestas', 'telemetria', 'estudio', 'asistencia', 'calificaciones', 'comunicacion', 'diseno');
  v_cont := array(select distinct unnest(coalesce(v_cont, '{}') || array['academico']));   -- lo académico siempre (da contexto)
  if coalesce(p_claves, false) then
    if not public.is_admin() then raise exception 'Solo el administrador puede exportar las claves de respuesta' using errcode = '42501'; end if;
    v_cont := v_cont || array['claves'];
  end if;
  select * into r from public.export_resolver(p_alcance, v_asof);

  -- limpieza: alcances de más de 30 días y exportaciones que quedaron a medias
  delete from public.data_export_users where export_id in (select id from public.data_exports where created_at < now() - interval '30 days');
  delete from public.data_export_attempts where export_id in (select id from public.data_exports where created_at < now() - interval '30 days');
  update public.data_exports set estado = 'incompleta', finished_at = now(), error_code = 'abandonada'
    where estado = 'en_curso' and created_at < now() - interval '1 day';

  insert into public.data_exports (actor_id, as_of, modo, alcance, contenido, formatos, incluye_claves, restringe_curso, cursos, secciones, actividades, desde, hasta)
  values (auth.uid(), v_asof, p_modo, jsonb_build_object('tipo', p_alcance ->> 'tipo', 'ids', coalesce(p_alcance -> 'ids', '[]'::jsonb),
            'desde', r.desde, 'hasta', r.hasta), v_cont, coalesce(p_formatos, '{}'), coalesce(p_claves, false), r.restringe_curso,
          r.cursos, r.secciones, r.actividades, r.desde, r.hasta)
  returning id into v_id;
  insert into public.data_export_users (export_id, user_id) select v_id, x from unnest(r.usuarios) x on conflict do nothing;
  insert into public.data_export_attempts (export_id, attempt_id) select v_id, x from unnest(r.intentos) x on conflict do nothing;

  v_tablas := array(select x from unnest(todas) x where (select grupo from public.export_fuente(x)) = any (v_cont));
  foreach t in array v_tablas loop
    v_conteos := v_conteos || jsonb_build_object(t, public.export_contar(v_id, t, v_asof));
  end loop;
  update public.data_exports set conteos = v_conteos where id = v_id;
  return jsonb_build_object('export_id', v_id, 'as_of', v_asof, 'modo', p_modo, 'contenido', to_jsonb(v_cont), 'conteos', v_conteos,
    'es_admin', public.is_admin(),
    -- identificadores del alcance para el manifiesto: en modo investigación, los de personas van seudonimizados
    'ids_publicos', case when p_modo = 'investigacion' and p_alcance ->> 'tipo' in ('estudiante', 'grupo')
      then (select coalesce(jsonb_agg(public.export_seudonimo(x::uuid)), '[]'::jsonb) from jsonb_array_elements_text(coalesce(p_alcance -> 'ids', '[]'::jsonb)) x)
      else coalesce(p_alcance -> 'ids', '[]'::jsonb) end);
end;
$$;

-- Una página de una fuente. Solo la persona que inició la exportación, mientras está en curso (máx. 24 h).
create or replace function public.export_page(p_export uuid, p_tabla text, p_after text default null, p_limit integer default 5000)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  d public.data_exports; f record; v_filas jsonb; v_sig text; v_n integer; v_lim integer := least(greatest(coalesce(p_limit, 5000), 1), 5000);
  v_inicio text;
begin
  select * into d from public.data_exports where id = p_export;
  if not found or d.actor_id is distinct from auth.uid() or not public.is_teacher() then raise exception 'Exportación no encontrada' using errcode = '42501'; end if;
  if d.estado <> 'en_curso' or d.created_at < now() - interval '1 day' then raise exception 'La exportación ya no está en curso' using errcode = '22023'; end if;
  select * into f from public.export_fuente(p_tabla);
  if f.grupo is null or not (f.grupo = any (d.contenido)) then raise exception 'Fuente no incluida en esta exportación' using errcode = '22023'; end if;
  v_inicio := case f.tipo when 'uuid' then '00000000-0000-0000-0000-000000000000' when 'bigint' then '0' else '' end;
  execute format(
    'select coalesce(jsonb_agg(public.export_fila($5, $6, $7, to_jsonb(x) - ''_k'') order by x._k), ''[]''::jsonb), (array_agg(x._k::text order by x._k desc))[1], count(*)::integer
     from (select t.*, %1$s as _k from %2$s and %1$s > $1::%3$s order by %1$s limit $2) x',
    f.clave, f.desde_sql, f.tipo)
  using coalesce(p_after, v_inicio), v_lim, p_export, d.as_of, d.modo, p_tabla, f.quitar
  into v_filas, v_sig, v_n;
  return jsonb_build_object('filas', v_filas, 'siguiente', v_sig, 'n', v_n, 'fin', v_n < v_lim);
end;
$$;

-- Columnas reales (para el diccionario de datos): solo de las fuentes en lista blanca, sin las columnas quitadas
create or replace function public.export_esquema(p_tablas text[])
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare t text; f record; v jsonb := '{}'::jsonb;
begin
  if not public.is_teacher() then raise exception 'Solo el profesorado' using errcode = '42501'; end if;
  foreach t in array coalesce(p_tablas, '{}') loop
    select * into f from public.export_fuente(t);
    if f.grupo is null then continue; end if;
    v := v || jsonb_build_object(t, (select coalesce(jsonb_agg(jsonb_build_object('columna', c.column_name, 'tipo', c.data_type,
          'nulo', c.is_nullable = 'YES', 'descripcion', col_description(('public.' || f.tabla_real)::regclass, c.ordinal_position::integer)) order by c.ordinal_position), '[]'::jsonb)
      from information_schema.columns c where c.table_schema = 'public' and c.table_name = f.tabla_real and not (c.column_name = any (f.quitar))));
  end loop;
  return v;
end;
$$;

-- Fin: estado, recuentos exportados, huella del manifiesto (sin contenido)
create or replace function public.export_finish(p_export uuid, p_estado text, p_resumen jsonb, p_manifiesto_sha256 text, p_error text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_estado not in ('completada', 'incompleta', 'cancelada', 'error') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.data_exports set estado = p_estado, finished_at = now(), resumen = p_resumen,
    manifiesto_sha256 = case when p_manifiesto_sha256 ~ '^[0-9a-f]{64}$' then p_manifiesto_sha256 end,
    error_code = case when p_error is null then null else left(regexp_replace(lower(p_error), '[^a-z0-9_]', '_', 'g'), 40) end
  where id = p_export and actor_id = auth.uid() and estado = 'en_curso';
  if not found then raise exception 'Exportación no encontrada o ya cerrada' using errcode = '42501'; end if;
end;
$$;

-- Historial: las mías (el administrador ve todas), sin contenido
create or replace function public.my_exports()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select e.id, e.created_at, e.finished_at, e.modo, e.alcance ->> 'tipo' tipo, e.contenido, e.formatos, e.estado, e.incluye_claves,
           e.manifiesto_sha256, e.error_code, coalesce(nullif(p.full_name, ''), p.login_id) actor
    from public.data_exports e left join public.profiles p on p.id = e.actor_id
    where public.is_teacher() and (e.actor_id = auth.uid() or public.is_admin())
    order by e.created_at desc limit 30) x
$$;

-- Permisos
revoke all on function public.export_seudonimo(uuid) from public, anon, authenticated;
revoke all on function public.export_fila(text, text, text[], jsonb) from public, anon, authenticated;
revoke all on function public.export_fuente(text) from public, anon, authenticated;
revoke all on function public.export_resolver(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.export_contar(uuid, text, timestamptz) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['export_preview(jsonb)', 'export_begin(jsonb, text, text[], text[], boolean)', 'export_page(uuid, text, text, integer)',
    'export_esquema(text[])', 'export_finish(uuid, text, jsonb, text, text)', 'my_exports()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
