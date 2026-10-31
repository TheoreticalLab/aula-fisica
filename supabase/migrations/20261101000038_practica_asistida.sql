-- =============================================================================
-- Prácticas con APRENDIZAJE ASISTIDO: INTENTA → RECIBE AYUDA → CORRIGE → EXPLICA → DEMUESTRA.
--
-- Aditiva: tablas nuevas y funciones nuevas. No redefine ninguna función existente ni toca exámenes, calificaciones
-- históricas ni LIEIA. Las prácticas asistidas se crean SIN retroalimentación inmediata y SIN pistas, de modo que las
-- vías clásicas (svc_check_context, get_hint, reveal_solution) ya están cerradas para ellas por su propia configuración.
--
-- Fases por ejercicio (assisted_steps, una fila por versión; nada se sobrescribe):
--   inicial        primer intento + declaración de autonomía. INMUTABLE (índice único + disparador que impide UPDATE).
--   corregida      respuesta después de estudiar (varias versiones; cuenta la última). Calificada por el motor.
--   reflexion      explicación del aprendizaje y fuentes declaradas (varias versiones; cuenta la última).
--   transferencia  ejercicio distinto con el mismo concepto (opcional). Calificado por el motor.
-- La calificación compuesta por ejercicio se escribe en responses.auto_credit, así que el libro de calificaciones y la
-- entrega del intento funcionan como siempre. La declaración de uso de IA NO interviene en ninguna nota.
-- =============================================================================

create table if not exists public.assisted_settings (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  transferencia boolean not null default false,
  peso_inicial integer not null default 20 check (peso_inicial between 0 and 100),
  peso_correccion integer not null default 30 check (peso_correccion between 0 and 100),
  peso_justificacion integer not null default 20 check (peso_justificacion between 0 and 100),
  peso_transferencia integer not null default 30 check (peso_transferencia between 0 and 100),
  verificacion_tipo text check (verificacion_tipo is null or verificacion_tipo in ('otra_sesion', 'fecha', 'presencial', 'examen')),
  verificacion_fecha timestamptz,
  verificacion_actividad uuid references public.activities (id) on delete set null,
  verificacion_nota text check (verificacion_nota is null or char_length(verificacion_nota) <= 300),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (peso_inicial + peso_correccion + peso_justificacion + peso_transferencia = 100)
);

-- Ejercicio de transferencia de cada ejercicio (lo elige el profesor del banco de la misma asignatura)
create table if not exists public.assisted_transfer (
  activity_id uuid not null references public.activities (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  transfer_exercise_id uuid not null references public.exercises (id) on delete restrict,
  primary key (activity_id, exercise_id),
  check (transfer_exercise_id <> exercise_id)
);

create table if not exists public.assisted_steps (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fase text not null check (fase in ('inicial', 'corregida', 'reflexion', 'transferencia')),
  version integer not null default 1,
  client_id uuid not null unique,                      -- idempotencia (reintentos, dos pestañas)
  answer jsonb check (answer is null or (jsonb_typeof(answer) = 'object' and octet_length(answer::text) <= 20000)),
  procedimiento text check (procedimiento is null or char_length(procedimiento) <= 5000),
  explicacion text check (explicacion is null or char_length(explicacion) <= 3000),
  no_se boolean not null default false,
  declaracion text check (declaracion is null or declaracion in ('autonomo', 'consulto_ayuda', 'no_pudo')),
  fuentes text[] check (fuentes is null or fuentes <@ array['ia', 'libro', 'apuntes', 'persona', 'video', 'simulador', 'ninguna']),
  reflexion jsonb check (reflexion is null or (jsonb_typeof(reflexion) = 'object' and octet_length(reflexion::text) <= 12000)),
  referencias jsonb check (referencias is null or (jsonb_typeof(referencias) = 'array' and octet_length(referencias::text) <= 6000)),
  transfer_exercise_id uuid references public.exercises (id) on delete restrict,
  status text,                                         -- resultado del motor (correct, partial, incorrect, invalid, pending_review)
  credit numeric(4, 3) check (credit is null or credit between 0 and 1),
  engine_code text,
  engine_messages jsonb,
  created_at timestamptz not null default now(),
  check (fase <> 'inicial' or declaracion is not null)
);
create unique index if not exists assisted_steps_un_inicial on public.assisted_steps (attempt_id, exercise_id) where fase = 'inicial';
create unique index if not exists assisted_steps_un_transfer on public.assisted_steps (attempt_id, exercise_id) where fase = 'transferencia';
create index if not exists assisted_steps_attempt_idx on public.assisted_steps (attempt_id, exercise_id, fase, version);

-- Nada se modifica: las correcciones son versiones nuevas
create or replace function public.assisted_steps_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Los pasos de la práctica asistida no se modifican: cada cambio es una versión nueva' using errcode = 'P0001';
end;
$$;
drop trigger if exists assisted_steps_inmutable on public.assisted_steps;
create trigger assisted_steps_inmutable before update on public.assisted_steps for each row execute function public.assisted_steps_inmutable();

alter table public.assisted_settings enable row level security;
alter table public.assisted_transfer enable row level security;
alter table public.assisted_steps enable row level security;
revoke all on public.assisted_settings, public.assisted_transfer, public.assisted_steps from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Calificación compuesta de un ejercicio (pesos explícitos; sin transferencia, se reparten proporcionalmente)
create or replace function public.asistida_credito(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.attempts; s public.assisted_settings; v_tr boolean;
  v_ini numeric := 0; v_cor numeric := 0; v_jus numeric := 0; v_tra numeric := 0; v_den numeric; v_final_status text;
  v_ref jsonb;
begin
  select * into a from public.attempts where id = p_attempt;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  if s.activity_id is null then return null; end if;
  v_tr := s.transferencia and exists (select 1 from public.assisted_transfer t where t.activity_id = a.activity_id and t.exercise_id = p_exercise);
  if exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial') then v_ini := 1; end if;
  select coalesce(x.credit, 0), x.status into v_cor, v_final_status from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida' order by x.version desc limit 1;
  v_cor := coalesce(v_cor, 0);
  select x.reflexion into v_ref from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'reflexion' order by x.version desc limit 1;
  -- justificación presentada: al menos una respuesta con contenido (≥ 15 caracteres); la calidad la puede ajustar el profesor
  if v_ref is not null and exists (select 1 from jsonb_each_text(v_ref) e where char_length(trim(e.value)) >= 15) then v_jus := 1; end if;
  if v_tr then
    select coalesce(x.credit, 0) into v_tra from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'transferencia';
    v_tra := coalesce(v_tra, 0);
  end if;
  v_den := s.peso_inicial + s.peso_correccion + s.peso_justificacion + case when v_tr then s.peso_transferencia else 0 end;
  return jsonb_build_object(
    'credito', case when v_den = 0 then 0 else round((s.peso_inicial * v_ini + s.peso_correccion * v_cor + s.peso_justificacion * v_jus
                 + case when v_tr then s.peso_transferencia * v_tra else 0 end) / v_den, 3) end,
    'inicial', v_ini, 'correccion', v_cor, 'justificacion', v_jus, 'transferencia', case when v_tr then v_tra end,
    'pesos', jsonb_build_object('inicial', s.peso_inicial, 'correccion', s.peso_correccion, 'justificacion', s.peso_justificacion,
                                'transferencia', case when v_tr then s.peso_transferencia else 0 end),
    'estado_final', v_final_status);
end;
$$;

-- Escribe la calificación compuesta en responses (lo que leen el libro de calificaciones y la entrega)
create or replace function public.asistida_actualizar_respuesta(p_attempt uuid, p_exercise uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare c jsonb; a public.attempts; v_points numeric; v_ans jsonb;
begin
  c := public.asistida_credito(p_attempt, p_exercise);
  if c is null then return; end if;
  select * into a from public.attempts where id = p_attempt;
  v_points := public.attempt_item_points(p_attempt, p_exercise);
  select coalesce(
    (select x.answer from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida' order by x.version desc limit 1),
    (select x.answer from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial'),
    '{}'::jsonb) into v_ans;
  insert into public.responses (attempt_id, exercise_id, user_id, answer, points)
    values (p_attempt, p_exercise, a.user_id, coalesce(v_ans, '{}'::jsonb), v_points)
    on conflict (attempt_id, exercise_id) do nothing;
  -- estado distinto de «draft»: la entrega del intento no lo vuelve a calificar (svc_record_submission solo toca borradores)
  update public.responses r set answer = coalesce(v_ans, r.answer), auto_credit = (c ->> 'credito')::numeric,
    status = case coalesce(c ->> 'estado_final', '') when 'correct' then 'correct' when 'partial' then 'partial' when 'pending_review' then 'pending_review'
                  else case when (c ->> 'inicial')::numeric > 0 then 'incorrect' else 'draft' end end::public.response_status
    where r.attempt_id = p_attempt and r.exercise_id = p_exercise;
  perform public.recompute_attempt(p_attempt);
end;
$$;

-- -----------------------------------------------------------------------------
-- Reglas de cada fase (comprobadas en el servidor; el cliente no decide nada)
create or replace function public.asistida_validar(p_user uuid, p_attempt uuid, p_exercise uuid, p_fase text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; s public.assisted_settings; v_tr uuid; v_n integer; v_max integer;
begin
  a := public.assert_attempt_writable(p_attempt, p_user);
  if a.mode <> 'practice' or a.activity_id is null then raise exception 'Solo las prácticas asignadas usan el aprendizaje asistido' using errcode = 'P0001'; end if;
  select * into act from public.activities where id = a.activity_id;
  select * into s from public.assisted_settings where activity_id = act.id;
  if s.activity_id is null then raise exception 'Esta práctica no usa el aprendizaje asistido' using errcode = 'P0001'; end if;
  if public.attempt_item_points(p_attempt, p_exercise) is null then raise exception 'El ejercicio no pertenece a este intento' using errcode = '42501'; end if;
  perform 1 from public.attempts where id = p_attempt for update;   -- serializa las fases del intento (dos pestañas)
  if p_fase = 'inicial' then
    if exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial') then
      raise exception 'El primer intento ya está guardado y no se puede cambiar' using errcode = 'P0001'; end if;
  elsif p_fase = 'corregida' then
    if not exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial') then
      raise exception 'Primero guarde su primer intento' using errcode = 'P0001'; end if;
    select count(*) into v_n from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida';
    v_max := greatest(1, act.max_tries_per_item);
    if v_n >= v_max then raise exception 'Ya usó las % comprobaciones de este ejercicio', v_max using errcode = 'P0001'; end if;
  elsif p_fase = 'reflexion' then
    if not exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida') then
      raise exception 'Primero guarde su respuesta después de estudiar' using errcode = 'P0001'; end if;
  elsif p_fase = 'transferencia' then
    select t.transfer_exercise_id into v_tr from public.assisted_transfer t where t.activity_id = act.id and t.exercise_id = p_exercise;
    if not s.transferencia or v_tr is null then raise exception 'Este ejercicio no tiene comprobación de transferencia' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'reflexion') then
      raise exception 'Primero explique lo que aprendió' using errcode = 'P0001'; end if;
    if exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'transferencia') then
      raise exception 'La comprobación de transferencia ya está hecha' using errcode = 'P0001'; end if;
  else
    raise exception 'Fase desconocida' using errcode = '22023';
  end if;
  return jsonb_build_object('activity_id', act.id, 'max_correcciones', greatest(1, act.max_tries_per_item), 'transfer_exercise_id', v_tr);
end;
$$;

-- Para la Edge Function: clave del ejercicio (o del de transferencia) tras validar la fase
create or replace function public.svc_asistida_contexto(p_user uuid, p_attempt uuid, p_exercise uuid, p_fase text, p_client_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v jsonb; v_ex uuid; e public.exercises; k public.exercise_keys;
begin
  if p_fase not in ('inicial', 'corregida', 'transferencia') then raise exception 'Fase desconocida' using errcode = '22023'; end if;
  -- reintento de un envío ya guardado (red caída tras guardar, doble clic): se devuelve lo guardado, sin calificar de nuevo
  if p_client_id is not null and exists (select 1 from public.assisted_steps x where x.client_id = p_client_id and x.user_id = p_user
      and x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = p_fase) then
    return jsonb_build_object('repetido', true, 'estado', public.asistida_estado_item(p_attempt, p_exercise, true));
  end if;
  v := public.asistida_validar(p_user, p_attempt, p_exercise, p_fase);
  v_ex := case when p_fase = 'transferencia' then (v ->> 'transfer_exercise_id')::uuid else p_exercise end;
  select * into e from public.exercises where id = v_ex;
  select * into k from public.exercise_keys where exercise_id = v_ex;
  return v || jsonb_build_object('key', k.answer, 'format', e.format,
    'option_count', case when e.options is null then null else jsonb_array_length(e.options) end);
end;
$$;

-- Registra un paso calificado por el motor (idempotente por client_id) y devuelve el estado del ejercicio
create or replace function public.svc_asistida_registrar(p_user uuid, p_attempt uuid, p_exercise uuid, p_fase text, p_datos jsonb, p_resultado jsonb, p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v jsonb; v_ver integer; v_decl text; v_fuentes text[];
begin
  if p_client_id is null then raise exception 'Falta el identificador del envío' using errcode = '22023'; end if;
  if exists (select 1 from public.assisted_steps x where x.client_id = p_client_id) then    -- reintento: ya estaba guardado
    if not exists (select 1 from public.assisted_steps x where x.client_id = p_client_id and x.user_id = p_user and x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = p_fase) then
      raise exception 'Identificador de envío reutilizado' using errcode = '22023'; end if;
    return public.asistida_estado_item(p_attempt, p_exercise, true) || jsonb_build_object('repetido', true);
  end if;
  if p_fase not in ('inicial', 'corregida', 'transferencia') then raise exception 'Fase desconocida' using errcode = '22023'; end if;
  v := public.asistida_validar(p_user, p_attempt, p_exercise, p_fase);
  v_decl := p_datos ->> 'declaracion';
  if p_fase = 'inicial' and (v_decl is null or v_decl not in ('autonomo', 'consulto_ayuda', 'no_pudo')) then
    raise exception 'Indique cómo realizó el primer intento' using errcode = '22023'; end if;
  select coalesce(max(x.version), 0) + 1 into v_ver from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = p_fase;
  insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, version, client_id, answer, procedimiento, explicacion, no_se, declaracion,
                                     transfer_exercise_id, status, credit, engine_code, engine_messages)
  values (p_attempt, p_exercise, p_user, p_fase, v_ver, p_client_id,
    case when coalesce((p_datos ->> 'no_se')::boolean, false) then null else p_datos -> 'answer' end,
    left(nullif(trim(p_datos ->> 'procedimiento'), ''), 5000), left(nullif(trim(p_datos ->> 'explicacion'), ''), 3000),
    coalesce((p_datos ->> 'no_se')::boolean, false), case when p_fase = 'inicial' then v_decl end,
    case when p_fase = 'transferencia' then (v ->> 'transfer_exercise_id')::uuid end,
    p_resultado ->> 'status', least(1, greatest(0, coalesce((p_resultado ->> 'credit')::numeric, 0))), p_resultado ->> 'code', p_resultado -> 'messages');
  perform public.asistida_actualizar_respuesta(p_attempt, p_exercise);
  return public.asistida_estado_item(p_attempt, p_exercise, true);
end;
$$;

-- Reflexión y fuentes (sin calificación automática: no necesita el motor)
create or replace function public.asistida_reflexion(p_attempt uuid, p_exercise uuid, p_reflexion jsonb, p_fuentes text[], p_referencias jsonb, p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_ver integer;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_client_id is null then raise exception 'Falta el identificador del envío' using errcode = '22023'; end if;
  if exists (select 1 from public.assisted_steps x where x.client_id = p_client_id and x.user_id = auth.uid() and x.attempt_id = p_attempt and x.fase = 'reflexion') then
    return public.asistida_estado_item(p_attempt, p_exercise, true) || jsonb_build_object('repetido', true);
  end if;
  if p_reflexion is null or jsonb_typeof(p_reflexion) <> 'object' then raise exception 'Reflexión inválida' using errcode = '22023'; end if;
  perform public.asistida_validar(auth.uid(), p_attempt, p_exercise, 'reflexion');
  select coalesce(max(x.version), 0) + 1 into v_ver from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'reflexion';
  begin
    insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, version, client_id, reflexion, fuentes, referencias)
      values (p_attempt, p_exercise, auth.uid(), 'reflexion', v_ver, p_client_id, p_reflexion,
              case when p_fuentes is null or cardinality(p_fuentes) = 0 then null else p_fuentes end,
              case when p_referencias is null or jsonb_array_length(p_referencias) = 0 then null else p_referencias end);
  exception when check_violation then raise exception 'Datos de la reflexión fuera de los límites permitidos' using errcode = '22023';
  end;
  perform public.asistida_actualizar_respuesta(p_attempt, p_exercise);
  return public.asistida_estado_item(p_attempt, p_exercise, true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Lectura

-- Estado de un ejercicio (pasos en orden, fase siguiente, enunciado de transferencia y solución SOLO cuando corresponde)
create or replace function public.asistida_estado_item(p_attempt uuid, p_exercise uuid, p_propio boolean)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; s public.assisted_settings; v_tr uuid; v_ini boolean; v_cor integer; v_ref boolean; v_tra boolean; v_sig text; e public.exercises; k public.exercise_keys;
begin
  select * into a from public.attempts where id = p_attempt;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  select t.transfer_exercise_id into v_tr from public.assisted_transfer t where t.activity_id = a.activity_id and t.exercise_id = p_exercise;
  v_ini := exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial');
  select count(*) into v_cor from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida';
  v_ref := exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'reflexion');
  v_tra := exists (select 1 from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'transferencia');
  v_sig := case when not v_ini then 'inicial' when v_cor = 0 then 'corregida' when not v_ref then 'reflexion'
                when s.transferencia and v_tr is not null and not v_tra then 'transferencia' else 'completo' end;
  -- solución: solo después de explicar lo aprendido, y nunca si la actividad dice «no mostrar soluciones»
  if v_ref and (select reveal_policy from public.activities where id = a.activity_id) <> 'never' then
    select * into k from public.exercise_keys where exercise_id = p_exercise;
  end if;
  if s.transferencia and v_tr is not null and v_ref then select * into e from public.exercises where id = v_tr; end if;
  return jsonb_build_object(
    'exercise_id', p_exercise, 'siguiente', v_sig, 'correcciones', v_cor, 'con_transferencia', coalesce(s.transferencia, false) and v_tr is not null,
    'pasos', (select coalesce(jsonb_agg(jsonb_build_object('fase', x.fase, 'version', x.version, 'answer', x.answer, 'procedimiento', x.procedimiento,
                'explicacion', x.explicacion, 'no_se', x.no_se, 'declaracion', x.declaracion, 'fuentes', x.fuentes, 'reflexion', x.reflexion,
                'referencias', x.referencias, 'transfer_exercise_id', x.transfer_exercise_id,
                -- el resultado del primer intento NO se muestra al estudiante hasta que guarda su respuesta corregida (sin oráculo;
                -- después ya no puede cambiarlo y sirve para adaptar la reflexión); el profesor siempre lo ve
                'status', case when x.fase = 'inicial' and p_propio and v_cor = 0 then null else x.status end,
                'credit', case when x.fase = 'inicial' and p_propio and v_cor = 0 then null else x.credit end,
                'messages', case when x.fase = 'inicial' and p_propio then null else x.engine_messages end,
                'created_at', x.created_at) order by x.id), '[]'::jsonb)
              from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise),
    'transferencia', case when e.id is null then null else jsonb_build_object('id', e.id, 'prompt', e.prompt, 'format', e.format, 'options', e.options,
                       'multiple', e.multiple, 'figure', e.figure, 'unit_hint', e.unit_hint, 'concepts', e.concepts) end,
    'solucion', case when k.exercise_id is null then null else jsonb_build_object('answer', k.answer, 'explanation', k.explanation) end,
    'calificacion', public.asistida_credito(p_attempt, p_exercise));
end;
$$;

-- Estado completo de un intento (el propio estudiante o el profesorado de la sección)
create or replace function public.asistida_estado(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; s public.assisted_settings; v_propio boolean;
begin
  select * into a from public.attempts where id = p_attempt;
  if not found then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into act from public.activities where id = a.activity_id;
  v_propio := a.user_id = auth.uid();
  if not v_propio and (act.id is null or not public.is_class_teacher(act.class_id)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.assisted_settings where activity_id = act.id;
  if s.activity_id is null then return jsonb_build_object('asistida', false); end if;
  return jsonb_build_object('asistida', true,
    'config', jsonb_build_object('transferencia', s.transferencia, 'max_correcciones', greatest(1, act.max_tries_per_item),
      'pesos', jsonb_build_object('inicial', s.peso_inicial, 'correccion', s.peso_correccion, 'justificacion', s.peso_justificacion, 'transferencia', s.peso_transferencia),
      'verificacion', jsonb_build_object('tipo', s.verificacion_tipo, 'fecha', s.verificacion_fecha, 'nota', s.verificacion_nota)),
    'items', (select coalesce(jsonb_agg(public.asistida_estado_item(p_attempt, i.exercise_id, v_propio) order by i.position), '[]'::jsonb)
              from public.activity_items i where i.activity_id = act.id));
end;
$$;

-- Profesorado: proceso de aprendizaje de toda la actividad (una fila por estudiante y ejercicio)
create or replace function public.asistida_proceso(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities; s public.assisted_settings;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.assisted_settings where activity_id = p_activity;
  if s.activity_id is null then return jsonb_build_object('asistida', false); end if;
  return jsonb_build_object('asistida', true,
    'config', to_jsonb(s) - 'updated_by',
    'inscritos', (select count(*) from public.enrollments e where e.class_id = act.class_id),
    'ejercicios', (select coalesce(jsonb_agg(jsonb_build_object('exercise_id', i.exercise_id, 'slug', x.slug, 'concepts', x.concepts, 'format', x.format,
                     'transfer_exercise_id', t.transfer_exercise_id) order by i.position), '[]'::jsonb)
                   from public.activity_items i join public.exercises x on x.id = i.exercise_id
                   left join public.assisted_transfer t on t.activity_id = p_activity and t.exercise_id = i.exercise_id
                   where i.activity_id = p_activity),
    'intentos', (select coalesce(jsonb_agg(jsonb_build_object('attempt_id', a.id, 'user_id', a.user_id, 'nombre', p.full_name, 'status', a.status,
                   'items', (select coalesce(jsonb_agg(public.asistida_estado_item(a.id, i.exercise_id, false) order by i.position), '[]'::jsonb)
                             from public.activity_items i where i.activity_id = p_activity),
                   'retencion', case when s.verificacion_actividad is null then null else
                     (select max(case when b.max_score > 0 then b.score / b.max_score end) from public.attempts b
                      where b.activity_id = s.verificacion_actividad and b.user_id = a.user_id and b.status = 'submitted') end)
                   order by p.full_name, a.attempt_number), '[]'::jsonb)
                 from public.attempts a join public.profiles p on p.id = a.user_id where a.activity_id = p_activity));
end;
$$;

-- -----------------------------------------------------------------------------
-- Profesorado: configuración

create or replace function public.assisted_settings_get(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'config', (select to_jsonb(s) - 'updated_by' from public.assisted_settings s where s.activity_id = p_activity),
    'transferencias', (select coalesce(jsonb_object_agg(t.exercise_id, t.transfer_exercise_id), '{}'::jsonb) from public.assisted_transfer t where t.activity_id = p_activity),
    'con_pasos', exists (select 1 from public.assisted_steps x join public.attempts a on a.id = x.attempt_id where a.activity_id = p_activity));
end;
$$;

create or replace function public.assisted_settings_save(p_activity uuid, p_cfg jsonb, p_transferencias jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; k text; v text;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if act.mode <> 'practice' then raise exception 'El aprendizaje asistido es para prácticas' using errcode = '22023'; end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Configuración inválida' using errcode = '22023'; end if;
  begin
    insert into public.assisted_settings as s (activity_id, transferencia, peso_inicial, peso_correccion, peso_justificacion, peso_transferencia,
        verificacion_tipo, verificacion_fecha, verificacion_actividad, verificacion_nota, updated_by, updated_at)
      values (p_activity, coalesce((p_cfg ->> 'transferencia')::boolean, false),
        coalesce((p_cfg ->> 'peso_inicial')::integer, 20), coalesce((p_cfg ->> 'peso_correccion')::integer, 30),
        coalesce((p_cfg ->> 'peso_justificacion')::integer, 20), coalesce((p_cfg ->> 'peso_transferencia')::integer, 30),
        nullif(p_cfg ->> 'verificacion_tipo', ''), nullif(p_cfg ->> 'verificacion_fecha', '')::timestamptz,
        nullif(p_cfg ->> 'verificacion_actividad', '')::uuid, left(nullif(trim(p_cfg ->> 'verificacion_nota'), ''), 300), auth.uid(), now())
      on conflict (activity_id) do update set transferencia = excluded.transferencia, peso_inicial = excluded.peso_inicial,
        peso_correccion = excluded.peso_correccion, peso_justificacion = excluded.peso_justificacion, peso_transferencia = excluded.peso_transferencia,
        verificacion_tipo = excluded.verificacion_tipo, verificacion_fecha = excluded.verificacion_fecha, verificacion_actividad = excluded.verificacion_actividad,
        verificacion_nota = excluded.verificacion_nota, updated_by = excluded.updated_by, updated_at = now();
  exception when check_violation or invalid_text_representation or foreign_key_violation then
    raise exception 'Configuración fuera de los límites (los pesos deben sumar 100)' using errcode = '22023';
  end;
  -- prácticas asistidas: sin retroalimentación inmediata ni pistas (cierra la comprobación, pistas y solución clásicas)
  update public.activities set reveal_policy = case when reveal_policy = 'immediate' then 'after_submit' else reveal_policy end, hints_enabled = false
    where id = p_activity;
  if p_transferencias is not null then
    if jsonb_typeof(p_transferencias) <> 'object' then raise exception 'Transferencias inválidas' using errcode = '22023'; end if;
    delete from public.assisted_transfer where activity_id = p_activity;
    for k, v in select * from jsonb_each_text(p_transferencias) loop
      continue when v is null or v = '';
      if not exists (select 1 from public.activity_items i where i.activity_id = p_activity and i.exercise_id = k::uuid) then
        raise exception 'Un ejercicio no pertenece a la práctica' using errcode = '22023'; end if;
      if not exists (select 1 from public.exercises x join public.classes c on c.course_id = x.course_id where x.id = v::uuid and c.id = act.class_id) then
        raise exception 'El ejercicio de transferencia debe ser de la misma asignatura' using errcode = '22023'; end if;
      insert into public.assisted_transfer (activity_id, exercise_id, transfer_exercise_id) values (p_activity, k::uuid, v::uuid);
    end loop;
  end if;
  return public.assisted_settings_get(p_activity);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
do $$
declare f text;
begin
  foreach f in array array['public.asistida_credito(uuid, uuid)', 'public.asistida_actualizar_respuesta(uuid, uuid)', 'public.asistida_validar(uuid, uuid, uuid, text)',
    'public.asistida_estado_item(uuid, uuid, boolean)', 'public.assisted_steps_inmutable()',
    'public.svc_asistida_contexto(uuid, uuid, uuid, text, uuid)', 'public.svc_asistida_registrar(uuid, uuid, uuid, text, jsonb, jsonb, uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  execute 'grant execute on function public.svc_asistida_contexto(uuid, uuid, uuid, text, uuid) to service_role';
  execute 'grant execute on function public.svc_asistida_registrar(uuid, uuid, uuid, text, jsonb, jsonb, uuid) to service_role';
  foreach f in array array['public.asistida_reflexion(uuid, uuid, jsonb, text[], jsonb, uuid)', 'public.asistida_estado(uuid)', 'public.asistida_proceso(uuid)',
    'public.assisted_settings_get(uuid)', 'public.assisted_settings_save(uuid, jsonb, jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
