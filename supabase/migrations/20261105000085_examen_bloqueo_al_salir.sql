-- =============================================================================
-- Migración 85 · Quiz y exámenes: bloquear al salir (con código) e impedir copiar y pegar
-- =============================================================================
-- Opciones por evaluación (exam_settings; las prácticas no cambian):
--  · bloquear_al_salir: si el estudiante sale del examen sin entregarlo (otra pestaña u otra app, minimizar, apagar la
--    pantalla, más de 5 s sin foco, cerrar o recargar la página, ir a otra parte del aula), su pantalla se bloquea con el
--    BLOQUEO CON CÓDIGO existente (migración 19): solo vuelve con el código que el profesor fijó para la evaluación o si
--    el profesor lo libera. El reloj sigue corriendo.
--  · impedir_copiar: el navegador no deja pegar ni arrastrar texto en las respuestas, ni copiar o cortar el enunciado
--    (barrera de la página; no controla otros dispositivos). Cada intento queda anotado.
-- Barrera en el servidor (no solo en la pantalla): con un bloqueo activo, una evaluación no guarda respuestas, pistas,
-- comprobaciones ni la siguiente pregunta adaptativa (assert_attempt_writable) y no abre preguntas nuevas (exam_goto).
-- Volver a abrir un examen de «una pregunta a la vez» ya empezado (recargar, otro dispositivo) cuenta como salida: lo
-- decide exam_open en el servidor, aunque el navegador no haya avisado.
-- Aditiva: columnas con valor por defecto (todo desactivado), una tabla nueva y create or replace de funciones.
-- =============================================================================

-- 1) configuración -----------------------------------------------------------------------------------------------
alter table public.exam_settings add column if not exists bloquear_al_salir boolean not null default false;
alter table public.exam_settings add column if not exists impedir_copiar boolean not null default false;
alter table public.exam_settings add column if not exists codigo_salida_hash text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'exam_settings_codigo_salida_chk') then
    alter table public.exam_settings add constraint exam_settings_codigo_salida_chk check (not bloquear_al_salir or codigo_salida_hash is not null);
  end if;
end $$;
comment on column public.exam_settings.codigo_salida_hash is 'Código de desbloqueo de la evaluación, cifrado (bcrypt). Nunca se devuelve.';

-- 2) registro: entradas, salidas, reingresos e intentos de pegar/arrastrar/copiar --------------------------------------
create table if not exists public.exam_integridad_eventos (
  id bigserial primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'reingreso', 'pegado', 'arrastre', 'copia')),
  motivo text check (motivo is null or motivo in ('oculta', 'sin_foco', 'cierre', 'navegacion', 'reapertura')),
  lock_id uuid references public.screen_locks (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists exam_integridad_eventos_intento on public.exam_integridad_eventos (attempt_id, created_at);
alter table public.exam_integridad_eventos enable row level security;
revoke all on public.exam_integridad_eventos from anon, authenticated;

insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota)
  values ('exam_integridad_eventos', 'intento', 'attempt_id', null, 20, 'viaja con su intento')
  on conflict (tabla) do nothing;

-- 3) piezas internas -----------------------------------------------------------------------------------------------
-- ¿Tiene el estudiante la pantalla bloqueada (por salir de un examen o porque el profesor la bloqueó)?
create or replace function public.exam_bloqueado(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.screen_locks l where l.user_id = p_user and l.unlocked_at is null) $$;

-- ¿Sigue protegida esta evaluación? (en curso, con la opción activa, sin plazo ni tiempo oficial vencidos)
create or replace function public.exam_protegido(p_attempt uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; v_lim timestamptz;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.id is null or a.status <> 'in_progress' or a.activity_id is null then return false; end if;
  select * into act from public.activities where id = a.activity_id;
  if act.mode <> 'exam' or not coalesce((select s.bloquear_al_salir from public.exam_settings s where s.activity_id = act.id), false) then return false; end if;
  if act.closes_at is not null and now() >= act.closes_at then return false; end if;
  v_lim := public.exam_deadline(p_attempt);
  return v_lim is null or now() < v_lim;
end;
$$;

-- Registra un evento y, si es una salida o un reingreso en una evaluación protegida, bloquea la pantalla con el código
-- de la evaluación (un solo bloqueo activo por estudiante: si ya lo hay, solo se anota).
create or replace function public.exam_registrar(p_attempt uuid, p_tipo text, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; v_hash text; v_lock uuid; v_bloquea boolean;
begin
  select * into a from public.attempts where id = p_attempt for update;      -- serializa avisos simultáneos
  if a.id is null then return jsonb_build_object('bloqueado', false); end if;
  v_bloquea := p_tipo in ('salida', 'reingreso') and public.exam_protegido(p_attempt);
  if v_bloquea then
    select l.id into v_lock from public.screen_locks l where l.user_id = a.user_id and l.unlocked_at is null order by l.created_at desc limit 1;
    if v_lock is null then
      select * into act from public.activities where id = a.activity_id;
      select s.codigo_salida_hash into v_hash from public.exam_settings s where s.activity_id = act.id;
      insert into public.screen_locks (user_id, sender_id, body, code_hash)
        values (a.user_id, act.created_by,
          format('Saliste de «%s» antes de entregarlo. Para volver a entrar, pide el código al profesor. El tiempo del examen sigue corriendo.', left(act.title, 200)),
          v_hash)
        returning id into v_lock;
    end if;
  end if;
  -- registro acotado (500 eventos por intento): un navegador manipulado no puede inflar la tabla
  if (select count(*) from public.exam_integridad_eventos e where e.attempt_id = p_attempt) < 500 then
    insert into public.exam_integridad_eventos (attempt_id, user_id, tipo, motivo, lock_id) values (p_attempt, a.user_id, p_tipo, p_motivo, v_lock);
  end if;
  return jsonb_build_object('bloqueado', v_lock is not null);
end;
$$;

-- Entrada al examen: la primera se anota; las siguientes (recargar, otro dispositivo, volver desde otra página) son un
-- reingreso. Con la pantalla ya bloqueada solo se anota (desbloquear y seguir no vuelve a bloquear).
create or replace function public.exam_registrar_entrada(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  select user_id into v_user from public.attempts where id = p_attempt;
  if not public.exam_protegido(p_attempt) then return jsonb_build_object('bloqueado', public.exam_bloqueado(v_user)); end if;
  if exists (select 1 from public.exam_integridad_eventos e where e.attempt_id = p_attempt and e.tipo = 'entrada') and not public.exam_bloqueado(v_user) then
    perform public.exam_registrar(p_attempt, 'reingreso', 'reapertura');
  end if;
  perform public.exam_registrar(p_attempt, 'entrada', null);
  return jsonb_build_object('bloqueado', public.exam_bloqueado(v_user));
end;
$$;

-- 4) estudiante ---------------------------------------------------------------------------------------------------
create or replace function public.exam_intento_propio(p_attempt uuid)
returns public.attempts
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt;
  if a.id is null or a.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  return a;
end;
$$;

-- Qué protecciones tiene el intento (sin efectos; nunca devuelve el código)
create or replace function public.exam_integridad(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; s public.exam_settings;
begin
  a := public.exam_intento_propio(p_attempt);
  select x.* into s from public.exam_settings x join public.activities act on act.id = x.activity_id
    where x.activity_id = a.activity_id and act.mode = 'exam';
  return jsonb_build_object(
    'bloquear_al_salir', coalesce(s.bloquear_al_salir, false) and public.exam_protegido(p_attempt),
    'impedir_copiar', coalesce(s.impedir_copiar, false) and a.status = 'in_progress',
    'bloqueado', public.exam_bloqueado(a.user_id));
end;
$$;

-- El navegador avisa de que el estudiante salió (oculta, sin foco, cierre, navegación dentro del aula)
create or replace function public.exam_salida(p_attempt uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.exam_intento_propio(p_attempt);
  if p_motivo is null or p_motivo not in ('oculta', 'sin_foco', 'cierre', 'navegacion') then raise exception 'Motivo no válido' using errcode = '22023'; end if;
  if not public.exam_protegido(p_attempt) then return jsonb_build_object('bloqueado', false); end if;
  return public.exam_registrar(p_attempt, 'salida', p_motivo);
end;
$$;

-- Entrada en la interfaz clásica (todas las preguntas en una página); «una pregunta a la vez» la registra exam_open
create or replace function public.exam_entrada(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.exam_intento_propio(p_attempt);
  return public.exam_registrar_entrada(p_attempt);
end;
$$;

-- Intento de pegar, arrastrar o copiar (ya impedido en el navegador): solo se anota
create or replace function public.exam_evento_copia(p_attempt uuid, p_tipo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts;
begin
  a := public.exam_intento_propio(p_attempt);
  if p_tipo is null or p_tipo not in ('pegado', 'arrastre', 'copia') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if a.status <> 'in_progress' then return; end if;
  perform public.exam_registrar(p_attempt, p_tipo, null);
end;
$$;

-- 5) profesorado: resumen por estudiante de una evaluación ------------------------------------------------------------
create or replace function public.exam_integridad_resumen(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare act public.activities;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.grades_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'config', (select jsonb_build_object('bloquear_al_salir', s.bloquear_al_salir, 'impedir_copiar', s.impedir_copiar, 'codigo_configurado', s.codigo_salida_hash is not null)
               from public.exam_settings s where s.activity_id = p_activity),
    'estudiantes', (select coalesce(jsonb_agg(z order by z->>'nombre'), '[]') from (
      select jsonb_build_object('user_id', p.id, 'nombre', p.full_name, 'matricula', coalesce(p.student_code, p.login_id),
        'attempt_id', a.id, 'estado', a.status, 'inicio', a.started_at,
        'salidas', count(*) filter (where e.tipo = 'salida'), 'reingresos', count(*) filter (where e.tipo = 'reingreso'),
        'pegados', count(*) filter (where e.tipo = 'pegado'), 'arrastres', count(*) filter (where e.tipo = 'arrastre'),
        'copias', count(*) filter (where e.tipo = 'copia'),
        'ultima_salida', max(e.created_at) filter (where e.tipo in ('salida', 'reingreso')),
        'lock_id', (select l.id from public.screen_locks l where l.user_id = p.id and l.unlocked_at is null order by l.created_at desc limit 1),
        'detalle', coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'motivo', e.motivo, 'en', e.created_at) order by e.created_at)
                     filter (where e.tipo <> 'entrada'), '[]')) z
      from public.attempts a
      join public.profiles p on p.id = a.user_id
      left join public.exam_integridad_eventos e on e.attempt_id = a.id
      where a.activity_id = p_activity
      group by p.id, p.full_name, p.student_code, p.login_id, a.id, a.status, a.started_at) q));
end;
$$;

-- 6) funciones existentes (copia de su última versión + lo indicado) ----------------------------------------------------

-- exam_settings_of (migración 35) + «integridad» (nunca el código)
create or replace function public.exam_settings_of(p_activity uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('presentacion', s.presentacion, 'navegacion', s.navegacion, 'duracion_s', s.duracion_s,
       'pausas', jsonb_build_object('permitidas', s.pausas_permitidas, 'max_numero', s.pausas_max, 'max_total_s', s.pausa_max_total_s, 'detienen_reloj', s.pausa_detiene_reloj),
       'integridad', jsonb_build_object('bloquear_al_salir', s.bloquear_al_salir, 'impedir_copiar', s.impedir_copiar, 'codigo_configurado', s.codigo_salida_hash is not null),
       'configurado', true)
     from public.exam_settings s where s.activity_id = p_activity),
    jsonb_build_object('presentacion', 'todas', 'navegacion', 'libre', 'duracion_s', null,
      'pausas', jsonb_build_object('permitidas', false, 'max_numero', 0, 'max_total_s', 0, 'detienen_reloj', false),
      'integridad', jsonb_build_object('bloquear_al_salir', false, 'impedir_copiar', false, 'codigo_configurado', false), 'configurado', false))
$$;

-- exam_settings_save (migración 35) + «integridad» { bloquear_al_salir, impedir_copiar, codigo }.
-- Sin la clave «integridad» se conserva lo que había; código vacío = se conserva el anterior.
create or replace function public.exam_settings_save(p_activity uuid, p_cfg jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_mode public.activity_mode; v_pp boolean; v_prev public.exam_settings; v_bloq boolean; v_imp boolean; v_cod text; v_hash text;
begin
  select class_id, mode into v_class, v_mode from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if v_mode <> 'exam' then raise exception 'La configuración de examen solo se aplica a evaluaciones' using errcode = '22023'; end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Configuración inválida' using errcode = '22023'; end if;
  select * into v_prev from public.exam_settings where activity_id = p_activity;
  begin
    v_pp := coalesce((p_cfg -> 'pausas' ->> 'permitidas')::boolean, false);
    if p_cfg ? 'integridad' then
      v_bloq := coalesce((p_cfg -> 'integridad' ->> 'bloquear_al_salir')::boolean, false);
      v_imp := coalesce((p_cfg -> 'integridad' ->> 'impedir_copiar')::boolean, false);
      v_cod := nullif(btrim(coalesce(p_cfg -> 'integridad' ->> 'codigo', '')), '');
    else
      v_bloq := coalesce(v_prev.bloquear_al_salir, false);
      v_imp := coalesce(v_prev.impedir_copiar, false);
    end if;
  exception when invalid_text_representation then
    raise exception 'Configuración fuera de los límites permitidos' using errcode = '22023';
  end;
  if v_cod is not null and (char_length(v_cod) < 4 or char_length(v_cod) > 32) then
    raise exception 'El código de desbloqueo debe tener entre 4 y 32 caracteres' using errcode = '22023';
  end if;
  v_hash := case when v_cod is not null then extensions.crypt(lower(v_cod), extensions.gen_salt('bf')) else v_prev.codigo_salida_hash end;
  if v_bloq and v_hash is null then
    raise exception 'Para bloquear al salir, escriba el código de desbloqueo (4 a 32 caracteres)' using errcode = '22023';
  end if;
  begin
    insert into public.exam_settings as s (activity_id, presentacion, navegacion, duracion_s, pausas_permitidas, pausas_max, pausa_max_total_s, pausa_detiene_reloj,
      bloquear_al_salir, impedir_copiar, codigo_salida_hash, updated_by, updated_at)
    values (p_activity,
      coalesce(p_cfg ->> 'presentacion', 'una_a_la_vez'), coalesce(p_cfg ->> 'navegacion', 'libre'), (p_cfg ->> 'duracion_s')::integer,
      v_pp, case when v_pp then coalesce((p_cfg -> 'pausas' ->> 'max_numero')::integer, 1) else 0 end,
      case when v_pp then coalesce((p_cfg -> 'pausas' ->> 'max_total_s')::integer, 300) else 0 end,
      v_pp and coalesce((p_cfg -> 'pausas' ->> 'detienen_reloj')::boolean, false),
      v_bloq, v_imp, v_hash, auth.uid(), now())
    on conflict (activity_id) do update set presentacion = excluded.presentacion, navegacion = excluded.navegacion, duracion_s = excluded.duracion_s,
      pausas_permitidas = excluded.pausas_permitidas, pausas_max = excluded.pausas_max, pausa_max_total_s = excluded.pausa_max_total_s,
      pausa_detiene_reloj = excluded.pausa_detiene_reloj, bloquear_al_salir = excluded.bloquear_al_salir, impedir_copiar = excluded.impedir_copiar,
      codigo_salida_hash = excluded.codigo_salida_hash, updated_by = excluded.updated_by, updated_at = now();
  exception when check_violation or invalid_text_representation then
    raise exception 'Configuración fuera de los límites permitidos' using errcode = '22023';
  end;
  return public.exam_settings_get(p_activity);
end;
$$;

-- exam_open (migración 35) + registro de la entrada: reabrir un examen ya empezado y protegido bloquea la pantalla
create or replace function public.exam_open(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a public.attempts; act public.activities; cfg public.exam_settings; s public.exam_sessions; v_orden uuid[];
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if not public.account_ok(auth.uid()) then raise exception 'Cuenta no habilitada' using errcode = '42501'; end if;
  select * into a from public.attempts where id = p_attempt;
  if not found or a.user_id <> auth.uid() then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into act from public.activities where id = a.activity_id;
  select * into s from public.exam_sessions where attempt_id = p_attempt for update;
  if not found then
    -- prácticas y evaluaciones sin el modo de una pregunta a la vez: interfaz clásica, sin sesión (como antes)
    select * into cfg from public.exam_settings where activity_id = act.id;
    if act.id is null or act.mode <> 'exam' or cfg.activity_id is null or cfg.presentacion <> 'una_a_la_vez' then
      return jsonb_build_object('modo', 'clasico');
    end if;
    if a.status <> 'in_progress' then return jsonb_build_object('modo', 'clasico'); end if;
    v_orden := public.exam_item_order(p_attempt);
    insert into public.exam_sessions (attempt_id, user_id, presentacion, navegacion, duracion_s, pausas_permitidas, pausas_max, pausa_max_total_s, pausa_detiene_reloj, activa)
      values (p_attempt, a.user_id, cfg.presentacion, cfg.navegacion, cfg.duracion_s, cfg.pausas_permitidas, cfg.pausas_max, cfg.pausa_max_total_s, cfg.pausa_detiene_reloj, v_orden[1])
      returning * into s;
  end if;
  if a.status = 'in_progress' then
    update public.exam_sessions set ultimo_contacto = now() where attempt_id = p_attempt;
    insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, a.user_id, 'apertura', s.activa);
    perform public.exam_registrar_entrada(p_attempt);
  end if;
  return public.exam_state(p_attempt);
end;
$$;

-- exam_goto (migración 80) + con la pantalla bloqueada no se abren preguntas
create or replace function public.exam_goto(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.exam_sessions; v_orden uuid[]; i integer; j integer; v_lim timestamptz;
begin
  s := public.exam_session_for(p_attempt);
  if public.exam_bloqueado(s.user_id) then
    raise exception 'Su pantalla está bloqueada: pida el código al profesor para continuar' using errcode = 'P0001';
  end if;
  v_lim := public.exam_deadline(p_attempt);
  if v_lim is not null and now() >= v_lim then
    raise exception 'El tiempo del examen terminó: ya no se puede cambiar de pregunta' using errcode = 'P0001';
  end if;
  if s.pausa_desde is not null then raise exception 'Reanude el examen para continuar' using errcode = 'P0001'; end if;
  v_orden := public.exam_item_order(p_attempt);
  j := array_position(v_orden, p_exercise);
  if j is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  if s.navegacion = 'solo_adelante' and s.activa is not null then
    i := array_position(v_orden, s.activa);
    if j < i or (j <> i and exists (select 1 from public.exam_events e where e.attempt_id = p_attempt and e.tipo in ('apertura', 'ir_a') and e.exercise_id = p_exercise)) then
      raise exception 'En este examen no se puede volver a preguntas anteriores' using errcode = 'P0001';
    end if;
  end if;
  update public.exam_sessions set activa = p_exercise, ultimo_contacto = now() where attempt_id = p_attempt;
  insert into public.exam_events (attempt_id, user_id, tipo, exercise_id) values (p_attempt, s.user_id, 'ir_a', p_exercise);
  return jsonb_build_object('ahora_ms', public.exam_ms(now()), 'activa', p_exercise);
end;
$$;

-- assert_attempt_writable (migración 35) + en una evaluación, con la pantalla bloqueada no se escribe nada
create or replace function public.assert_attempt_writable(p_attempt uuid, p_user uuid)
returns public.attempts
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_act public.activities;
  v_lim timestamptz;
begin
  if not public.account_ok(p_user) then raise exception 'Cuenta no habilitada' using errcode = '42501'; end if;
  select * into v_att from public.attempts where id = p_attempt;
  if not found or v_att.user_id <> p_user then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  if v_att.status <> 'in_progress' then raise exception 'El intento ya fue entregado' using errcode = 'P0001'; end if;
  if v_att.activity_id is not null then
    select * into v_act from public.activities where id = v_att.activity_id;
    if v_act.closes_at is not null and now() >= v_act.closes_at then
      raise exception 'El plazo de la actividad terminó' using errcode = 'P0001';
    end if;
    if not v_act.published then raise exception 'Actividad no disponible' using errcode = '42501'; end if;
    if v_act.mode = 'exam' and public.exam_bloqueado(p_user) then
      raise exception 'Su pantalla está bloqueada: pida el código al profesor para continuar' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.exam_sessions s where s.attempt_id = p_attempt) then
      if (select pausa_desde from public.exam_sessions where attempt_id = p_attempt) is not null then
        raise exception 'El examen está en pausa' using errcode = 'P0001';
      end if;
      v_lim := public.exam_deadline(p_attempt);
      if v_lim is not null and now() >= v_lim + interval '30 seconds' then
        raise exception 'El tiempo del examen terminó' using errcode = 'P0001';
      end if;
    end if;
  elsif v_att.lesson_id is null then
    raise exception 'Intento inválido' using errcode = 'P0001';
  end if;
  return v_att;
end;
$$;

-- 7) permisos -----------------------------------------------------------------------------------------------------
revoke all on function public.exam_bloqueado(uuid) from public, anon, authenticated;
revoke all on function public.exam_protegido(uuid) from public, anon, authenticated;
revoke all on function public.exam_registrar(uuid, text, text) from public, anon, authenticated;
revoke all on function public.exam_registrar_entrada(uuid) from public, anon, authenticated;
revoke all on function public.exam_intento_propio(uuid) from public, anon, authenticated;
revoke all on function public.exam_integridad(uuid) from public, anon;
revoke all on function public.exam_salida(uuid, text) from public, anon;
revoke all on function public.exam_entrada(uuid) from public, anon;
revoke all on function public.exam_evento_copia(uuid, text) from public, anon;
revoke all on function public.exam_integridad_resumen(uuid) from public, anon;
grant execute on function public.exam_integridad(uuid) to authenticated;
grant execute on function public.exam_salida(uuid, text) to authenticated;
grant execute on function public.exam_entrada(uuid) to authenticated;
grant execute on function public.exam_evento_copia(uuid, text) to authenticated;
grant execute on function public.exam_integridad_resumen(uuid) to authenticated;
