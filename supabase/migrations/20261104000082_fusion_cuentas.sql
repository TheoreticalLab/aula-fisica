-- =============================================================================
-- Migración 82 · Fusión de cuentas duplicadas de estudiantes (ver docs/FUSION_CUENTAS.md).
--
-- PRINCIPIO: ningún dato académico se pierde. Cada fila de la cuenta SECUNDARIA se TRASLADA a la PRINCIPAL (solo
-- cambia user_id; fechas, respuestas y notas intactas) o se QUEDA en la secundaria, que pasa a ser un archivo
-- histórico desactivado («fusionada»). Cada cambio queda anotado fila a fila (con la fila completa) para verificar y
-- revertir.
--  · Registro explícito de cómo se trata cada tabla con datos del estudiante (fusion_tablas). Una prueba exige que
--    toda clave foránea ON DELETE CASCADE hacia profiles esté registrada: una tabla nueva sin clasificar falla.
--  · Las columnas de «autor» (ON DELETE SET NULL: graded_by, actor…) y las auditorías se conservan con la identidad
--    original; la fusión guarda la correspondencia.
--  · Conflictos (misma actividad, misma nota manual, misma práctica extraordinaria con respuestas): decide el
--    administrador; lo que no vale queda en la cuenta fusionada. Nunca se suma ni se elige la mayor.
--  · Exámenes o prácticas extraordinarias en curso: bloquean.
--  · Vista previa = la MISMA ejecución dentro de un punto de guardado que se deshace (cifras exactas) + huella del plan.
--  · Ejecución en una sola transacción, con bloqueos; la etapa de Supabase Auth (bloqueo de la cuenta) va aparte, con
--    estado persistente y reintento (función «admin-cuentas», acción «suspender»).
--  · Solo el administrador con sesión reciente. Bitácora inmutable.
-- Cambios en funciones existentes (justificados y acotados): touch_updated_at, assisted_steps_inmutable y
-- pes_respuesta_cerrada aceptan ÚNICAMENTE el cambio de user_id entre las dos cuentas de una fusión en curso de la
-- MISMA transacción (no se puede activar desde fuera). Disparador nuevo en profiles: una cuenta fusionada no se
-- reactiva. El motor de examen y las reglas de calificación no cambian.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.fusion_tablas (
  tabla text primary key,
  estrategia text not null check (estrategia in ('intento', 'respuesta', 'practica', 'unico', 'mover', 'nota', 'conservar', 'profesorado')),
  ancla text,                      -- intento: columna del intento; practica: practica_id; respuesta: response_id
  clave text[],                    -- unico / nota: columnas que, con user_id, no pueden repetirse
  orden integer not null default 100,
  nota text
);

create table if not exists public.fusion_operaciones (
  id uuid primary key default gen_random_uuid(),
  principal uuid not null references public.profiles (id) on delete restrict,
  secundaria uuid not null references public.profiles (id) on delete restrict,
  estado text not null check (estado in ('ejecutando', 'auth_pendiente', 'completada', 'revirtiendo', 'revertida')),
  txid bigint not null default txid_current(),
  huella text not null,
  decisiones jsonb not null default '{}'::jsonb,
  usar_id_secundaria boolean not null default false,
  login_original jsonb,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  resumen jsonb not null default '{}'::jsonb,
  solicitado_por uuid references public.profiles (id) on delete set null,
  autorizado_por uuid references public.profiles (id) on delete set null,
  auth_error text,
  created_at timestamptz not null default now(),
  completada_at timestamptz,
  revertida_at timestamptz,
  revertida_por uuid references public.profiles (id) on delete set null,
  motivo_reversion text,
  check (principal <> secundaria)
);
-- una cuenta solo puede ser secundaria de UNA fusión vigente
create unique index if not exists fusion_operaciones_secundaria_vigente on public.fusion_operaciones (secundaria) where estado <> 'revertida';

create table if not exists public.fusion_mov (
  op uuid not null references public.fusion_operaciones (id) on delete cascade,
  tipo text not null check (tipo in ('intento', 'practica')),
  clave uuid not null,
  de uuid not null,
  a uuid not null,
  primary key (op, tipo, clave)
);

create table if not exists public.fusion_filas (
  id bigint generated always as identity primary key,
  op uuid not null references public.fusion_operaciones (id) on delete cascade,
  tabla text not null,
  accion text not null check (accion in ('mover', 'archivar', 'nota')),
  pk jsonb not null,
  de uuid,
  a uuid,
  fila jsonb not null,             -- la fila completa ANTES del cambio (respaldo específico)
  huella text not null,            -- md5 de la fila sin user_id ni updated_at, DESPUÉS del cambio (para revertir)
  detalle jsonb
);
create index if not exists fusion_filas_op_idx on public.fusion_filas (op, tabla);

create table if not exists public.fusion_eventos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  op uuid,
  actor uuid,
  principal uuid,
  secundaria uuid,
  accion text not null check (accion ~ '^[a-z_]{3,40}$'),
  resultado text not null check (resultado in ('ok', 'rechazado', 'error')),
  detalle jsonb not null default '{}'::jsonb
);
create or replace function public.fusion_eventos_inmutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_at := now(); return new; end if;
  raise exception 'La bitácora de fusiones es inmutable' using errcode = '42501';
end $$;
drop trigger if exists fusion_eventos_inmutable on public.fusion_eventos;
create trigger fusion_eventos_inmutable before insert or update or delete on public.fusion_eventos for each row execute function public.fusion_eventos_inmutable();
do $$ begin
  execute 'drop trigger if exists fusion_eventos_sin_vaciar on public.fusion_eventos';
  execute 'create trigger fusion_eventos_sin_vaciar before truncate on public.fusion_eventos for each statement execute function public.fusion_eventos_inmutable()';
end $$;

alter table public.fusion_tablas enable row level security;
alter table public.fusion_operaciones enable row level security;
alter table public.fusion_mov enable row level security;
alter table public.fusion_filas enable row level security;
alter table public.fusion_eventos enable row level security;
revoke all on public.fusion_tablas, public.fusion_operaciones, public.fusion_mov, public.fusion_filas, public.fusion_eventos from anon, authenticated;

-- Registro: cómo se trata cada tabla con datos del estudiante (claves foráneas ON DELETE CASCADE hacia profiles)
insert into public.fusion_tablas (tabla, estrategia, ancla, clave, orden, nota) values
  ('attempts', 'intento', 'id', null, 10, 'el intento; su actividad decide si hay conflicto'),
  ('responses', 'intento', 'attempt_id', null, 20, null),
  ('response_revisions', 'intento', 'attempt_id', null, 20, null),
  ('attempt_snapshots', 'intento', 'attempt_id', null, 20, null),
  ('attempt_active_time', 'intento', 'attempt_id', null, 20, null),
  ('assisted_steps', 'intento', 'attempt_id', null, 20, 'inmutable: excepción solo para la fusión'),
  ('exam_sessions', 'intento', 'attempt_id', null, 20, null),
  ('exam_events', 'intento', 'attempt_id', null, 20, null),
  ('exam_intervals', 'intento', 'attempt_id', null, 20, null),
  ('exam_item_events', 'intento', 'attempt_id', null, 20, null),
  ('exam_adaptive_state', 'intento', 'attempt_id', null, 20, null),
  ('telemetry_events', 'intento', 'attempt_id', null, 20, null),
  ('telemetry_v2_events', 'intento', 'attempt_id', null, 20, null),
  ('response_events', 'respuesta', 'response_id', null, 30, 'viaja con su respuesta'),
  ('pes_asignaciones', 'practica', 'practica_id', null, 40, null),
  ('pes_estado', 'practica', 'practica_id', null, 40, null),
  ('pes_respuestas', 'practica', 'practica_id', null, 40, 'inmutable: excepción solo para la fusión'),
  ('pes_controles', 'practica', 'practica_id', null, 40, null),
  ('grade_entries', 'nota', null, array['class_id', 'category'], 50, 'conflicto si ambas tienen nota distinta'),
  ('grade_part_scores', 'nota', null, array['class_id', 'category'], 50, 'conflicto si ambas tienen nota distinta'),
  ('enrollments', 'unico', null, array['class_id'], 60, 'sin inscripciones duplicadas'),
  ('control_assignments', 'unico', null, array['session_id'], 60, null),
  ('reading_progress', 'unico', null, array['activity_id'], 60, null),
  ('attendance_records', 'unico', null, array['session_id'], 60, null),
  ('attendance_quorum_requests', 'unico', null, array['class_id', 'franja'], 60, null),
  ('live_message_recipients', 'unico', null, array['message_id'], 60, null),
  ('quick_poll_recipients', 'unico', null, array['poll_id'], 60, null),
  ('upload_permissions', 'unico', null, array['box_id'], 60, null),
  ('hist_cierres', 'unico', null, array['class_id'], 60, null),
  ('hist_libre_avisos', 'unico', null, array['grupo_id'], 60, null),
  ('lost_alerts', 'unico', null, array['class_id', 'numero'], 60, null),
  ('orbe_ia_deliveries', 'unico', null, array['joke_id'], 60, null),
  ('duplicate_requests', 'unico', null, array['sha256', 'estado'], 60, null),
  ('grade_history', 'mover', null, null, 70, null),
  ('extra_points', 'mover', null, null, 70, 'se avisa si coinciden sección y motivo'),
  ('hist_captures', 'mover', null, null, 70, null),
  ('hist_declarations', 'mover', null, null, 70, null),
  ('hist_libres', 'mover', null, null, 70, null),
  ('hist_libre_fotos', 'mover', null, null, 70, null),
  ('hist_suggestions', 'mover', null, null, 70, null),
  ('upload_files', 'mover', null, null, 70, 'la descarga se autoriza por la fila, no por la ruta'),
  ('upload_fingerprints', 'mover', null, null, 70, null),
  ('attendance_rejections', 'mover', null, null, 70, null),
  ('study_visits', 'mover', null, null, 70, null),
  ('screen_locks', 'mover', null, null, 70, null),
  ('cuenta_actividad', 'conservar', null, null, 90, 'de la cuenta, no académica'),
  ('cuenta_suspensiones', 'conservar', null, null, 90, 'historial de la cuenta'),
  ('known_devices', 'conservar', null, null, 90, null),
  ('presence_connections', 'conservar', null, null, 90, null),
  ('orbe_ia_prefs', 'conservar', null, null, 90, null),
  ('class_ai_prefs', 'conservar', null, null, 90, null),
  ('study_clock', 'conservar', null, null, 90, null),
  ('join_failures', 'conservar', null, null, 90, null),
  ('attendance_failures', 'conservar', null, null, 90, null),
  ('acceso_solicitudes', 'conservar', null, null, 90, 'historial de recuperación de esa cuenta'),
  ('acceso_monitores', 'conservar', null, null, 90, 'permiso: no se transfiere solo (se avisa)'),
  ('class_monitors', 'conservar', null, null, 90, 'papel de monitor: no se transfiere solo (se avisa)'),
  ('class_upload_delegates', 'conservar', null, null, 90, 'permiso: no se transfiere solo (se avisa)'),
  ('class_teachers', 'profesorado', null, null, 95, 'bloquea'),
  ('course_staff', 'profesorado', null, null, 95, 'bloquea')
on conflict (tabla) do nothing;

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.fusion_en_curso() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fusion_operaciones o where o.estado in ('ejecutando', 'revirtiendo') and o.txid = txid_current())
$$;

-- ¿Este cambio de dueño pertenece a una fusión (o reversión) en curso de ESTA transacción?
create or replace function public.fusion_permite(p_de uuid, p_a uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_de is not null and p_a is not null and exists (
    select 1 from public.fusion_operaciones o where o.estado in ('ejecutando', 'revirtiendo') and o.txid = txid_current()
      and ((o.secundaria = p_de and o.principal = p_a) or (o.principal = p_de and o.secundaria = p_a)))
$$;

create or replace function public.fusion_pk(p_tabla text) returns text[] language sql stable security definer set search_path = '' as $$
  select array_agg(a.attname::text order by k.n)
  from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum, n)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = ('public.' || p_tabla)::regclass and i.indisprimary
$$;

create or replace function public.fusion_fusionada(p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fusion_operaciones o where o.secundaria = p_user and o.estado in ('auth_pendiente', 'completada'))
$$;

create or replace function public.fusion_log(p_op uuid, p_p uuid, p_s uuid, p_accion text, p_resultado text, p_detalle jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.fusion_eventos (op, actor, principal, secundaria, accion, resultado, detalle)
  values (p_op, auth.uid(), p_p, p_s, p_accion, p_resultado, coalesce(p_detalle, '{}'::jsonb))
$$;

create or replace function public.fusion_exigir_admin(p_reciente boolean) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede gestionar fusiones de cuentas' using errcode = '42501'; end if;
  if p_reciente and not public.acceso_sesion_reciente() then
    raise exception 'Por seguridad, vuelva a iniciar sesión para ejecutar o revertir una fusión' using errcode = '42501';
  end if;
end $$;

-- Distancia de edición (para el detector de duplicados; sin extensiones)
create or replace function public.fusion_lev(a text, b text) returns integer language plpgsql immutable set search_path = '' as $$
declare la integer := char_length(coalesce(a, '')); lb integer := char_length(coalesce(b, '')); d integer[]; p integer; t integer; i integer; j integer;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  d := array(select generate_series(0, lb));
  for i in 1..la loop
    p := d[1]; d[1] := i;
    for j in 1..lb loop
      t := d[j + 1];
      d[j + 1] := least(d[j + 1] + 1, d[j] + 1, p + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
      p := t;
    end loop;
  end loop;
  return d[lb + 1];
end $$;

-- Mejor intento entregado por actividad de una cuenta (lo que usa el registro de calificaciones)
create or replace function public.fusion_mejores(p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(activity_id::text, mejor), '{}'::jsonb)
  from (select a.activity_id, max(a.score) as mejor from public.attempts a
        where a.user_id = p_user and a.activity_id is not null and a.status = 'submitted' group by a.activity_id) x
$$;

-- Huella del estado académico de las dos cuentas: si cambia entre la vista previa y la ejecución, hay que simular otra vez
create or replace function public.fusion_huella(p_p uuid, p_s uuid) returns text language sql stable security definer set search_path = '' as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(':', a.id, a.user_id, a.status, a.score, a.submitted_at), ',' order by a.id) from public.attempts a where a.user_id in (p_p, p_s)),
    (select concat_ws(':', count(*), max(r.updated_at)) from public.responses r where r.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', g.class_id, g.user_id, g.category, g.score), ',' order by g.class_id, g.user_id, g.category) from public.grade_entries g where g.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', g.class_id, g.user_id, g.category, g.score), ',' order by g.class_id, g.user_id, g.category) from public.grade_part_scores g where g.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', e.practica_id, e.user_id, e.estado, e.updated_at), ',' order by e.practica_id, e.user_id) from public.pes_estado e where e.user_id in (p_p, p_s)),
    (select concat_ws(':', count(*), max(r.cerrado_at)) from public.pes_respuestas r where r.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', e.class_id, e.user_id), ',' order by e.class_id, e.user_id) from public.enrollments e where e.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', x.id, x.user_id, x.status, x.points), ',' order by x.id) from public.extra_points x where x.user_id in (p_p, p_s)),
    (select string_agg(concat_ws(':', p.id, p.login_id, p.active), ',' order by p.id) from public.profiles p where p.id in (p_p, p_s))))
$$;

-- Resumen de una cuenta para la comparación
create or replace function public.fusion_resumen(p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'login_id', p.login_id, 'nombre', p.full_name, 'matricula', p.student_code, 'rol', p.role, 'activa', p.active,
    'creada', p.created_at, 'fusionada', public.fusion_fusionada(p.id),
    'secciones', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.name, 'asignatura', k.title) order by c.name), '[]'::jsonb)
                  from public.enrollments e join public.classes c on c.id = e.class_id join public.courses k on k.id = c.course_id where e.user_id = p.id),
    'practicas', (select count(distinct a.activity_id) from public.attempts a where a.user_id = p.id and a.mode = 'practice' and a.activity_id is not null),
    'practicas_completadas', (select count(distinct a.activity_id) from public.attempts a where a.user_id = p.id and a.mode = 'practice' and a.activity_id is not null and a.status = 'submitted'),
    'examenes', (select count(distinct a.activity_id) from public.attempts a where a.user_id = p.id and a.mode = 'exam' and a.activity_id is not null),
    'intentos', (select count(*) from public.attempts a where a.user_id = p.id),
    'notas_manuales', (select count(*) from public.grade_entries g where g.user_id = p.id),
    'promedio_mejores', (select round(avg(100.0 * m.s / nullif(m.mx, 0)), 1) from (
        select max(a.score) s, max(a.max_score) mx from public.attempts a where a.user_id = p.id and a.status = 'submitted' and a.activity_id is not null group by a.activity_id) m),
    'practicas_extraordinarias', (select count(*) from public.pes_asignaciones x where x.user_id = p.id),
    'entregas_pdf', (select count(*) from public.upload_files f where f.user_id = p.id),
    'tiempo_s', (select coalesce(sum(v.effective_seconds), 0) from public.study_visits v where v.user_id = p.id),
    'ultimo_acceso', greatest((select ultimo_uso from public.cuenta_actividad ca where ca.user_id = p.id),
                              (select last_sign_in_at from auth.users u where u.id = p.id)))
  from public.profiles p where p.id = p_user
$$;

-- -----------------------------------------------------------------------------
-- Análisis: bloqueos, conflictos, avisos y detalle de actividades
-- -----------------------------------------------------------------------------
create or replace function public.fusion_analisis(p_p uuid, p_s uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  pp public.profiles; ps public.profiles; v_bloq jsonb := '[]'::jsonb; v_conf jsonb := '[]'::jsonb; v_avisos jsonb := '[]'::jsonb; v_act jsonb;
begin
  select * into pp from public.profiles where id = p_p;
  select * into ps from public.profiles where id = p_s;
  if pp.id is null or ps.id is null then return jsonb_build_object('bloqueos', jsonb_build_array('Alguna de las cuentas no existe')); end if;
  if p_p = p_s then v_bloq := v_bloq || to_jsonb('Las dos cuentas son la misma'::text); end if;
  if pp.role::text <> 'student' or ps.role::text <> 'student' then v_bloq := v_bloq || to_jsonb('Solo se fusionan cuentas de estudiantes (una es de profesor o administrador)'::text); end if;
  if public.fusion_fusionada(p_s) then v_bloq := v_bloq || to_jsonb('La cuenta secundaria ya fue fusionada'::text); end if;
  if public.fusion_fusionada(p_p) then v_bloq := v_bloq || to_jsonb('La cuenta principal está fusionada (desactivada): no puede recibir otra'::text); end if;
  if exists (select 1 from public.fusion_operaciones o where o.principal = p_s and o.estado <> 'revertida') then
    v_bloq := v_bloq || to_jsonb('La cuenta secundaria es principal de otra fusión: fusione en sentido contrario o revierta aquella'::text);
  end if;
  if exists (select 1 from public.class_teachers t where t.user_id in (p_p, p_s)) or exists (select 1 from public.course_staff t where t.user_id in (p_p, p_s)) then
    v_bloq := v_bloq || to_jsonb('Una de las cuentas tiene funciones de profesorado'::text);
  end if;
  if exists (select 1 from public.attempts a where a.user_id in (p_p, p_s) and a.status = 'in_progress' and a.mode = 'exam') then
    v_bloq := v_bloq || to_jsonb('Hay un examen en curso en una de las cuentas: espere a que se entregue o cierre'::text);
  end if;
  if exists (select 1 from public.pes_estado e where e.user_id in (p_p, p_s) and e.estado in ('apartado_abierto', 'esperando_liberacion')) then
    v_bloq := v_bloq || to_jsonb('Hay una práctica extraordinaria en curso en una de las cuentas: espere a que termine'::text);
  end if;
  if exists (select 1 from public.attempts a join public.attempts b on b.activity_id = a.activity_id and b.user_id = p_p and b.status = 'in_progress'
             where a.user_id = p_s and a.status = 'in_progress' and a.activity_id is not null) then
    v_bloq := v_bloq || to_jsonb('Las dos cuentas tienen abierta la misma práctica: entréguela en una de ellas'::text);
  end if;

  -- conflictos: misma actividad en las dos cuentas
  select coalesce(jsonb_agg(jsonb_build_object('clave', 'actividad:' || x.activity_id, 'tipo', 'actividad', 'titulo', act.title, 'modo', act.mode,
      'principal', x.p, 'secundaria', x.s, 'opciones', jsonb_build_array('principal', 'secundaria', 'pendiente')) order by act.title), '[]'::jsonb)
    into v_conf
  from (select a.activity_id,
          jsonb_build_object('intentos', count(*) filter (where a.user_id = p_p), 'entregados', count(*) filter (where a.user_id = p_p and a.status = 'submitted'),
            'mejor', max(a.score) filter (where a.user_id = p_p and a.status = 'submitted'), 'maximo', max(a.max_score) filter (where a.user_id = p_p)) p,
          jsonb_build_object('intentos', count(*) filter (where a.user_id = p_s), 'entregados', count(*) filter (where a.user_id = p_s and a.status = 'submitted'),
            'mejor', max(a.score) filter (where a.user_id = p_s and a.status = 'submitted'), 'maximo', max(a.max_score) filter (where a.user_id = p_s)) s
        from public.attempts a where a.user_id in (p_p, p_s) and a.activity_id is not null
        group by a.activity_id having count(*) filter (where a.user_id = p_p) > 0 and count(*) filter (where a.user_id = p_s) > 0) x
  join public.activities act on act.id = x.activity_id;

  -- conflictos: nota manual del registro distinta en las dos cuentas
  v_conf := v_conf || coalesce((select jsonb_agg(jsonb_build_object('clave', t.pref || ':' || gp.class_id || ':' || gp.category, 'tipo', t.pref,
        'titulo', c.name || ' · ' || gp.category, 'principal', jsonb_build_object('nota', gp.score), 'secundaria', jsonb_build_object('nota', gs.score),
        'opciones', jsonb_build_array('principal', 'secundaria', 'pendiente')))
      from (select 'nota' pref, g.* from public.grade_entries g union all select 'parte', g.* from public.grade_part_scores g) gp
      join (select 'nota' pref, g.* from public.grade_entries g union all select 'parte', g.* from public.grade_part_scores g) gs
        on gs.pref = gp.pref and gs.class_id = gp.class_id and gs.category = gp.category and gs.user_id = p_s
      cross join lateral (select gp.pref) t
      join public.classes c on c.id = gp.class_id
      where gp.user_id = p_p and gp.score is distinct from gs.score), '[]'::jsonb);

  -- conflictos: la misma práctica extraordinaria con respuestas en las dos cuentas (no se pueden intercambiar)
  v_conf := v_conf || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pes:' || pr.id, 'tipo', 'pes', 'titulo', pr.titulo,
        'principal', jsonb_build_object('respuestas', (select count(*) from public.pes_respuestas r where r.practica_id = pr.id and r.user_id = p_p)),
        'secundaria', jsonb_build_object('respuestas', (select count(*) from public.pes_respuestas r where r.practica_id = pr.id and r.user_id = p_s)),
        'opciones', jsonb_build_array('principal', 'pendiente')))
      from public.pes_practicas pr
      where exists (select 1 from public.pes_respuestas r where r.practica_id = pr.id and r.user_id = p_p)
        and exists (select 1 from public.pes_respuestas r where r.practica_id = pr.id and r.user_id = p_s)), '[]'::jsonb);

  -- avisos
  if exists (select 1 from public.class_monitors m where m.user_id = p_s and m.revoked_at is null) then
    v_avisos := v_avisos || to_jsonb('La cuenta secundaria es monitor de una sección: ese papel no se transfiere solo; asígnelo a la principal si corresponde'::text);
  end if;
  if exists (select 1 from public.acceso_monitores m where m.user_id = p_s and m.revocado_at is null) or exists (select 1 from public.class_upload_delegates d where d.user_id = p_s and d.revoked_at is null) then
    v_avisos := v_avisos || to_jsonb('La cuenta secundaria tiene permisos delegados (recuperación o subida): no se transfieren'::text);
  end if;
  if exists (select 1 from public.extra_points a join public.extra_points b on b.class_id = a.class_id and lower(b.reason) = lower(a.reason) and b.user_id = p_s
             where a.user_id = p_p) then
    v_avisos := v_avisos || to_jsonb('Hay puntos extra con el mismo motivo en las dos cuentas: revise que no sea un doble crédito'::text);
  end if;
  if exists (select 1 from public.pes_asignaciones a where a.user_id = p_p and exists (select 1 from public.pes_asignaciones b where b.practica_id = a.practica_id and b.user_id = p_s)
             and not exists (select 1 from public.pes_respuestas r where r.practica_id = a.practica_id and r.user_id = p_p)
             and exists (select 1 from public.pes_respuestas r where r.practica_id = a.practica_id and r.user_id = p_s)) then
    v_avisos := v_avisos || to_jsonb('Una práctica extraordinaria está asignada a las dos cuentas pero solo la secundaria la hizo: la asignación vacía de la principal se archiva en la bitácora y se trasladan las respuestas'::text);
  end if;

  -- detalle por actividad
  select coalesce(jsonb_agg(jsonb_build_object('activity_id', x.activity_id, 'titulo', act.title, 'modo', act.mode, 'seccion', c.name,
      'categoria', case when x.np > 0 and x.ns > 0 then 'ambas' when x.np > 0 then 'solo_principal' else 'solo_secundaria' end,
      'en_curso', x.encurso, 'principal', jsonb_build_object('intentos', x.np, 'mejor', x.mp, 'maximo', x.mx),
      'secundaria', jsonb_build_object('intentos', x.ns, 'mejor', x.ms, 'maximo', x.mx)) order by act.title), '[]'::jsonb)
    into v_act
  from (select a.activity_id, count(*) filter (where a.user_id = p_p) np, count(*) filter (where a.user_id = p_s) ns,
          max(a.score) filter (where a.user_id = p_p and a.status = 'submitted') mp, max(a.score) filter (where a.user_id = p_s and a.status = 'submitted') ms,
          max(a.max_score) mx, bool_or(a.status = 'in_progress') encurso
        from public.attempts a where a.user_id in (p_p, p_s) and a.activity_id is not null group by a.activity_id) x
  join public.activities act on act.id = x.activity_id join public.classes c on c.id = act.class_id;

  return jsonb_build_object('bloqueos', v_bloq, 'conflictos', v_conf, 'avisos', v_avisos, 'actividades', v_act,
    'principal', public.fusion_resumen(p_p), 'secundaria', public.fusion_resumen(p_s), 'huella', public.fusion_huella(p_p, p_s));
end $$;

-- -----------------------------------------------------------------------------
-- Motor: aplica la fusión de la operación p_op (que debe estar en estado «ejecutando» en ESTA transacción)
-- -----------------------------------------------------------------------------
create or replace function public.fusion_mover(p_op uuid, p_tabla text, p_donde text, p_set text) returns integer
language plpgsql security definer set search_path = '' as $$
-- Traslada filas de p_tabla (alias t) que cumplen p_donde y anota cada una (fila completa antes, huella después)
declare v_pk text[] := public.fusion_pk(p_tabla); v_n integer; v_pkexpr text;
begin
  if v_pk is null then raise exception 'La tabla % no tiene clave primaria: no se puede trasladar con trazabilidad', p_tabla; end if;
  select string_agg(format('%L, n.j -> %L', k, k), ', ') into v_pkexpr from unnest(v_pk) k;
  execute format($f$
    with antes as (select tf.ctid as c, to_jsonb(tf) as j from public.%1$I tf where %2$s for update),
    m as (update public.%1$I tf set %3$s from antes where tf.ctid = antes.c returning antes.j as j0, to_jsonb(tf) as j)
    insert into public.fusion_filas (op, tabla, accion, pk, de, a, fila, huella)
    select $1, %1$L, 'mover', jsonb_build_object(%4$s), (m.j0 ->> 'user_id')::uuid, (m.j ->> 'user_id')::uuid, m.j0,
      md5((m.j - 'user_id' - 'updated_at')::text)
    from m cross join lateral (select m.j as j) n$f$, p_tabla, p_donde, p_set, v_pkexpr)
  using p_op;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.fusion_aplicar(p_op uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.fusion_operaciones; v_p uuid; v_s uuid; d jsonb; r record; v_n integer; v_cuentas jsonb := '{}'::jsonb; v_dec text; x record;
  v_esperadas jsonb; v_despues jsonb;
begin
  select * into o from public.fusion_operaciones where id = p_op;
  if o.id is null or o.estado <> 'ejecutando' or o.txid <> txid_current() then raise exception 'Operación de fusión no válida'; end if;
  v_p := o.principal; v_s := o.secundaria; d := o.decisiones;

  -- 1) intentos que cambian de dueño
  -- sin actividad (prácticas libres / lecciones): todos, salvo uno en curso que choque con uno en curso de la principal
  insert into public.fusion_mov (op, tipo, clave, de, a)
    select p_op, 'intento', a.id, v_s, v_p from public.attempts a
    where a.user_id = v_s and a.activity_id is null
      and not (a.status = 'in_progress' and exists (select 1 from public.attempts b where b.user_id = v_p and b.activity_id is null
                                                      and b.lesson_id is not distinct from a.lesson_id and b.status = 'in_progress'));
  for x in select distinct a.activity_id from public.attempts a where a.user_id = v_s and a.activity_id is not null loop
    if not exists (select 1 from public.attempts b where b.user_id = v_p and b.activity_id = x.activity_id) then
      insert into public.fusion_mov (op, tipo, clave, de, a) select p_op, 'intento', a.id, v_s, v_p from public.attempts a where a.user_id = v_s and a.activity_id = x.activity_id;
    else
      v_dec := d ->> ('actividad:' || x.activity_id);
      if v_dec is null then raise exception 'Falta decidir el conflicto de la actividad %', x.activity_id using errcode = 'P0001'; end if;
      if v_dec = 'secundaria' then
        insert into public.fusion_mov (op, tipo, clave, de, a) select p_op, 'intento', a.id, v_s, v_p from public.attempts a where a.user_id = v_s and a.activity_id = x.activity_id;
        insert into public.fusion_mov (op, tipo, clave, de, a) select p_op, 'intento', a.id, v_p, v_s from public.attempts a where a.user_id = v_p and a.activity_id = x.activity_id;
      elsif v_dec not in ('principal', 'pendiente') then raise exception 'Decisión no válida para la actividad %', x.activity_id using errcode = '22023';
      end if;
    end if;
  end loop;

  -- notas esperadas de la principal después (mejor intento entregado por actividad): para verificar al final
  select coalesce(jsonb_object_agg(z.activity_id::text, z.mejor), '{}'::jsonb) into v_esperadas from (
    select a.activity_id, max(a.score) mejor from public.attempts a
    where a.activity_id is not null and a.status = 'submitted'
      and ((a.user_id = v_p and not exists (select 1 from public.fusion_mov f where f.op = p_op and f.tipo = 'intento' and f.clave = a.id))
           or exists (select 1 from public.fusion_mov f where f.op = p_op and f.tipo = 'intento' and f.clave = a.id and f.a = v_p))
    group by a.activity_id) z;

  -- 2) prácticas extraordinarias
  for x in select a.practica_id from public.pes_asignaciones a where a.user_id = v_s loop
    if not exists (select 1 from public.pes_asignaciones b where b.practica_id = x.practica_id and b.user_id = v_p) then
      insert into public.fusion_mov (op, tipo, clave, de, a) values (p_op, 'practica', x.practica_id, v_s, v_p);
    elsif not exists (select 1 from public.pes_respuestas q where q.practica_id = x.practica_id and q.user_id = v_p)
          and exists (select 1 from public.pes_respuestas q where q.practica_id = x.practica_id and q.user_id = v_s) then
      -- asignación vacía de la principal: se archiva (fila completa en la bitácora) para dejar paso a la que tiene el trabajo
      with b as (delete from public.pes_estado tf where tf.practica_id = x.practica_id and tf.user_id = v_p returning to_jsonb(tf) j)
      insert into public.fusion_filas (op, tabla, accion, pk, de, a, fila, huella)
        select p_op, 'pes_estado', 'archivar', jsonb_build_object('practica_id', b.j -> 'practica_id', 'user_id', b.j -> 'user_id'), v_p, null, b.j, md5(b.j::text) from b;
      with b as (delete from public.pes_asignaciones tf where tf.practica_id = x.practica_id and tf.user_id = v_p returning to_jsonb(tf) j)
      insert into public.fusion_filas (op, tabla, accion, pk, de, a, fila, huella)
        select p_op, 'pes_asignaciones', 'archivar', jsonb_build_object('practica_id', b.j -> 'practica_id', 'user_id', b.j -> 'user_id'), v_p, null, b.j, md5(b.j::text) from b;
      insert into public.fusion_mov (op, tipo, clave, de, a) values (p_op, 'practica', x.practica_id, v_s, v_p);
    else
      v_dec := d ->> ('pes:' || x.practica_id);
      if exists (select 1 from public.pes_respuestas q where q.practica_id = x.practica_id and q.user_id = v_s) then
        if v_dec is null then raise exception 'Falta decidir el conflicto de la práctica extraordinaria %', x.practica_id using errcode = 'P0001'; end if;
        if v_dec not in ('principal', 'pendiente') then raise exception 'En una práctica extraordinaria hecha en las dos cuentas solo puede conservarse la de la principal o dejarse pendiente' using errcode = '22023'; end if;
      end if;
    end if;
  end loop;

  -- 3) traslados según el registro de tablas
  for r in select * from public.fusion_tablas order by orden, tabla loop
    v_n := 0;
    if r.estrategia = 'intento' then
      v_n := public.fusion_mover(p_op, r.tabla,
        format('exists (select 1 from public.fusion_mov f where f.op = %L and f.tipo = %L and f.clave = tf.%I and f.de = tf.user_id)', p_op, 'intento', r.ancla),
        format('user_id = (select f.a from public.fusion_mov f where f.op = %L and f.tipo = %L and f.clave = tf.%I)', p_op, 'intento', r.ancla));
    elsif r.estrategia = 'respuesta' then
      v_n := public.fusion_mover(p_op, r.tabla,
        format('exists (select 1 from public.responses rr join public.fusion_mov f on f.op = %L and f.tipo = %L and f.clave = rr.attempt_id where rr.id = tf.%I and f.de = tf.user_id)', p_op, 'intento', r.ancla),
        format('user_id = (select f.a from public.responses rr join public.fusion_mov f on f.op = %L and f.tipo = %L and f.clave = rr.attempt_id where rr.id = tf.%I)', p_op, 'intento', r.ancla));
    elsif r.estrategia = 'practica' then
      v_n := public.fusion_mover(p_op, r.tabla,
        format('exists (select 1 from public.fusion_mov f where f.op = %L and f.tipo = %L and f.clave = tf.%I and f.de = tf.user_id)', p_op, 'practica', r.ancla),
        format('user_id = (select f.a from public.fusion_mov f where f.op = %L and f.tipo = %L and f.clave = tf.%I)', p_op, 'practica', r.ancla));
    elsif r.estrategia in ('unico', 'nota') then
      -- sin choque: se traslada; con choque: se queda en la secundaria (y, si es nota con decisión «secundaria», abajo)
      v_n := public.fusion_mover(p_op, r.tabla,
        format('tf.user_id = %L and not exists (select 1 from public.%I y where y.user_id = %L and %s)', v_s, r.tabla, v_p,
          (select string_agg(format('y.%1$I is not distinct from tf.%1$I', k), ' and ') from unnest(r.clave) k)),
        format('user_id = %L', v_p));
      if r.estrategia = 'nota' then
        -- conflicto resuelto a favor de la secundaria: la nota de la principal toma el valor de la secundaria (el
        -- historial del registro lo anota con el administrador como autor); la fila de la secundaria queda archivada
        for x in execute format('select g.class_id, g.category, g.score as sp, h.score as ss, to_jsonb(g) as j from public.%I g join public.%I h
              on h.class_id = g.class_id and h.category = g.category and h.user_id = %L where g.user_id = %L and g.score is distinct from h.score', r.tabla, r.tabla, v_s, v_p) loop
          v_dec := d ->> ((case r.tabla when 'grade_entries' then 'nota' else 'parte' end) || ':' || x.class_id || ':' || x.category);
          if v_dec is null then raise exception 'Falta decidir el conflicto de nota % · %', x.class_id, x.category using errcode = 'P0001'; end if;
          if v_dec = 'secundaria' then
            execute format('update public.%I set score = $1, updated_by = auth.uid(), updated_at = now() where class_id = $2 and category = $3 and user_id = $4', r.tabla)
              using x.ss, x.class_id, x.category, v_p;
            insert into public.fusion_filas (op, tabla, accion, pk, de, a, fila, huella, detalle)
              values (p_op, r.tabla, 'nota', jsonb_build_object('class_id', x.class_id, 'user_id', v_p, 'category', x.category), v_p, v_p, x.j,
                md5(coalesce(x.ss::text, 'null')), jsonb_build_object('antes', x.sp, 'despues', x.ss));
            v_n := v_n + 1;
          elsif v_dec not in ('principal', 'pendiente') then raise exception 'Decisión no válida para la nota' using errcode = '22023';
          end if;
        end loop;
      end if;
    elsif r.estrategia = 'mover' then
      v_n := public.fusion_mover(p_op, r.tabla, format('tf.user_id = %L', v_s), format('user_id = %L', v_p));
    end if;
    if v_n > 0 then v_cuentas := v_cuentas || jsonb_build_object(r.tabla, v_n); end if;
  end loop;

  -- 4) verificación: ninguna fila dependiente con dueño distinto de su intento, y notas de la principal como se previó
  for r in select * from public.fusion_tablas where estrategia = 'intento' and tabla <> 'attempts' loop
    execute format('select count(*) from public.%I tf join public.attempts a on a.id = tf.%I where a.user_id in ($1, $2) and tf.user_id <> a.user_id', r.tabla, r.ancla)
      into v_n using v_p, v_s;
    if v_n > 0 then raise exception 'Verificación fallida: % filas de % no coinciden con el dueño de su intento', v_n, r.tabla; end if;
  end loop;
  select count(*) into v_n from public.response_events e join public.responses rr on rr.id = e.response_id where rr.user_id in (v_p, v_s) and e.user_id <> rr.user_id;
  if v_n > 0 then raise exception 'Verificación fallida: eventos de respuesta con otro dueño'; end if;
  v_despues := public.fusion_mejores(v_p);
  if v_despues <> v_esperadas then raise exception 'Verificación fallida: las notas de la principal no son las previstas'; end if;

  return jsonb_build_object('trasladadas', v_cuentas, 'total', (select count(*) from public.fusion_filas where op = p_op),
    'notas_principal_despues', v_despues);
end $$;

-- -----------------------------------------------------------------------------
-- Vista previa (simulación exacta que se deshace), ejecución, etapa de Auth, reversión
-- -----------------------------------------------------------------------------
create or replace function public.fusion_vista_previa(p_principal uuid, p_secundaria uuid, p_decisiones jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_an jsonb; v_sim jsonb; v_err text; v_ctx text; v_antes jsonb; v_pend jsonb;
begin
  perform public.fusion_exigir_admin(false);
  v_an := public.fusion_analisis(p_principal, p_secundaria);
  v_antes := public.fusion_mejores(p_principal);
  -- decisiones que faltan
  select coalesce(jsonb_agg(c ->> 'clave'), '[]'::jsonb) into v_pend from jsonb_array_elements(v_an -> 'conflictos') c
    where coalesce(p_decisiones, '{}'::jsonb) ->> (c ->> 'clave') is null;
  if jsonb_array_length(v_an -> 'bloqueos') = 0 and jsonb_array_length(v_pend) = 0 then
    begin
      insert into public.fusion_operaciones (id, principal, secundaria, estado, huella, decisiones, motivo, solicitado_por)
        values ('00000000-0000-4000-8000-000000000000', p_principal, p_secundaria, 'ejecutando', v_an ->> 'huella', coalesce(p_decisiones, '{}'::jsonb), 'simulación', auth.uid());
      v_sim := public.fusion_aplicar('00000000-0000-4000-8000-000000000000');
      raise exception using errcode = 'P0004', message = 'fin de la simulación';
    exception
      when sqlstate 'P0004' then null;   -- se deshace todo lo simulado
      when others then
        get stacked diagnostics v_ctx = pg_exception_context;
        v_err := sqlerrm || coalesce(' [' || left(regexp_replace(v_ctx, '\s+', ' ', 'g'), 600) || ']', '');
    end;
  end if;
  return v_an || jsonb_build_object('decisiones_pendientes', v_pend, 'simulacion', v_sim, 'error_simulacion', v_err, 'notas_principal_antes', v_antes,
    'ejecutable', jsonb_array_length(v_an -> 'bloqueos') = 0 and jsonb_array_length(v_pend) = 0 and v_err is null and v_sim is not null);
end $$;

create or replace function public.fusion_ejecutar(p_principal uuid, p_secundaria uuid, p_huella text, p_decisiones jsonb, p_usar_id_secundaria boolean, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_an jsonb; v_op uuid; v_res jsonb; pp public.profiles; ps public.profiles; v_sesiones integer; v_login jsonb;
begin
  perform public.fusion_exigir_admin(true);
  if p_principal is null or p_secundaria is null or p_principal = p_secundaria then raise exception 'Cuentas no válidas' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Indique el motivo de la fusión' using errcode = '22023'; end if;
  -- bloqueos de concurrencia: siempre en el mismo orden (evita interbloqueos entre dos administradores)
  perform pg_advisory_xact_lock(hashtextextended('fusion:' || least(p_principal, p_secundaria)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('fusion:' || greatest(p_principal, p_secundaria)::text, 0));
  select * into pp from public.profiles where id = p_principal for update;
  select * into ps from public.profiles where id = p_secundaria for update;
  v_an := public.fusion_analisis(p_principal, p_secundaria);
  if jsonb_array_length(v_an -> 'bloqueos') > 0 then
    perform public.fusion_log(null, p_principal, p_secundaria, 'ejecutar', 'rechazado', jsonb_build_object('bloqueos', v_an -> 'bloqueos'));
    raise exception 'Fusión bloqueada: %', (select string_agg(b, '; ') from jsonb_array_elements_text(v_an -> 'bloqueos') b) using errcode = 'P0001';
  end if;
  if v_an ->> 'huella' is distinct from p_huella then
    raise exception 'Los datos de las cuentas cambiaron desde la vista previa: simule de nuevo' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(v_an -> 'conflictos') c where coalesce(p_decisiones, '{}'::jsonb) ->> (c ->> 'clave') is null) then
    raise exception 'Hay conflictos sin decidir' using errcode = 'P0001';
  end if;

  insert into public.fusion_operaciones (principal, secundaria, estado, huella, decisiones, usar_id_secundaria, motivo, solicitado_por, autorizado_por)
    values (p_principal, p_secundaria, 'ejecutando', p_huella, coalesce(p_decisiones, '{}'::jsonb), coalesce(p_usar_id_secundaria, false), btrim(p_motivo), auth.uid(), auth.uid())
    returning id into v_op;
  v_res := public.fusion_aplicar(v_op);

  -- ID de acceso: la principal puede quedarse con el de la secundaria (que pasa a un identificador de archivo)
  v_login := jsonb_build_object('principal', pp.login_id, 'secundaria', ps.login_id);
  if coalesce(p_usar_id_secundaria, false) and ps.login_id is not null then
    update public.profiles set login_id = 'fusionada-' || substr(replace(ps.id::text, '-', ''), 1, 12) where id = p_secundaria;
    update public.profiles set login_id = ps.login_id where id = p_principal;
  end if;
  -- la secundaria deja de operar: desactivada y sin sesiones (los tokens de renovación caen con la sesión)
  update public.profiles set active = false, suspended_at = coalesce(suspended_at, now()) where id = p_secundaria;
  delete from auth.sessions where user_id = p_secundaria;
  get diagnostics v_sesiones = row_count;

  update public.fusion_operaciones set estado = 'auth_pendiente', login_original = v_login,
      resumen = v_res || jsonb_build_object('sesiones_cerradas', v_sesiones, 'conflictos', v_an -> 'conflictos', 'avisos', v_an -> 'avisos')
    where id = v_op;
  perform public.fusion_log(v_op, p_principal, p_secundaria, 'ejecutar', 'ok', jsonb_build_object('decisiones', p_decisiones, 'trasladadas', v_res -> 'trasladadas',
    'usar_id_secundaria', p_usar_id_secundaria, 'login', v_login, 'sesiones_cerradas', v_sesiones,
    'antes', jsonb_build_object('principal', v_an -> 'principal', 'secundaria', v_an -> 'secundaria')));
  return jsonb_build_object('op', v_op, 'estado', 'auth_pendiente') || v_res;
end $$;

-- Para la interfaz: si la ejecución falló (la transacción se deshizo), deja constancia del intento
create or replace function public.fusion_registrar_fallo(p_principal uuid, p_secundaria uuid, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.fusion_exigir_admin(false);
  perform public.fusion_log(null, p_principal, p_secundaria, 'ejecutar', 'error', jsonb_build_object('error', left(coalesce(p_error, ''), 500)));
end $$;

-- Resultado de la etapa de Supabase Auth (bloqueo de la cuenta secundaria con «admin-cuentas»)
create or replace function public.fusion_auth_resultado(p_op uuid, p_ok boolean, p_error text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.fusion_operaciones;
begin
  perform public.fusion_exigir_admin(false);
  select * into o from public.fusion_operaciones where id = p_op for update;
  if o.id is null or o.estado not in ('auth_pendiente', 'completada') then raise exception 'Operación no válida' using errcode = 'P0001'; end if;
  if p_ok then
    update public.fusion_operaciones set estado = 'completada', completada_at = coalesce(completada_at, now()), auth_error = null where id = p_op;
  else
    update public.fusion_operaciones set auth_error = left(coalesce(p_error, 'error'), 300) where id = p_op;
  end if;
  perform public.fusion_log(p_op, o.principal, o.secundaria, 'bloqueo_auth', case when p_ok then 'ok' else 'error' end, jsonb_build_object('error', p_error));
  return jsonb_build_object('estado', case when p_ok then 'completada' else o.estado end);
end $$;

-- Reversión: devuelve lo trasladado si nada cambió desde la fusión; si cambió, se bloquea y lo informa
create or replace function public.fusion_revertir(p_op uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.fusion_operaciones; f record; v_cambios jsonb := '[]'::jsonb; v_ok boolean; v_n integer := 0; v_cur jsonb;
begin
  perform public.fusion_exigir_admin(true);
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Indique el motivo de la reversión' using errcode = '22023'; end if;
  select * into o from public.fusion_operaciones where id = p_op for update;
  if o.id is null or o.estado not in ('auth_pendiente', 'completada') then raise exception 'Esa fusión no se puede revertir' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fusion:' || least(o.principal, o.secundaria)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('fusion:' || greatest(o.principal, o.secundaria)::text, 0));
  -- evaluación: cada fila debe seguir como la dejó la fusión
  for f in select * from public.fusion_filas where op = p_op order by id loop
    if f.accion = 'mover' then
      execute format('select to_jsonb(tf) from public.%I tf where to_jsonb(tf) @> $1', f.tabla) into v_cur using f.pk;
      v_ok := v_cur is not null and (v_cur ->> 'user_id')::uuid = f.a and md5((v_cur - 'user_id' - 'updated_at')::text) = f.huella;
    elsif f.accion = 'archivar' then
      execute format('select to_jsonb(tf) from public.%I tf where to_jsonb(tf) @> $1', f.tabla) into v_cur using f.pk;
      v_ok := v_cur is null or exists (select 1 from public.fusion_filas g where g.op = p_op and g.tabla = f.tabla and g.accion = 'mover' and g.pk = f.pk
                                         and g.huella = md5((v_cur - 'user_id' - 'updated_at')::text));
    else
      execute format('select to_jsonb(tf) from public.%I tf where to_jsonb(tf) @> $1', f.tabla) into v_cur using f.pk;
      v_ok := v_cur is not null and md5(coalesce(v_cur ->> 'score', 'null')) = md5(coalesce((f.detalle ->> 'despues'), 'null'));
    end if;
    if not v_ok then v_cambios := v_cambios || jsonb_build_object('tabla', f.tabla, 'pk', f.pk, 'accion', f.accion); end if;
  end loop;
  if exists (select 1 from public.profiles p where p.id = o.secundaria and p.login_id is distinct from
             case when o.usar_id_secundaria then 'fusionada-' || substr(replace(o.secundaria::text, '-', ''), 1, 12) else (o.login_original ->> 'secundaria') end) then
    v_cambios := v_cambios || jsonb_build_object('tabla', 'profiles', 'pk', jsonb_build_object('id', o.secundaria), 'accion', 'login');
  end if;
  if jsonb_array_length(v_cambios) > 0 then
    perform public.fusion_log(p_op, o.principal, o.secundaria, 'revertir', 'rechazado', jsonb_build_object('cambios', v_cambios, 'motivo', p_motivo));
    return jsonb_build_object('ok', false, 'motivo', 'Algunos datos cambiaron después de la fusión: se requiere una evaluación administrativa antes de revertir',
      'cambios', v_cambios);
  end if;
  update public.fusion_operaciones set estado = 'revirtiendo', txid = txid_current() where id = p_op;
  for f in select * from public.fusion_filas where op = p_op order by id desc loop
    if f.accion = 'mover' then
      execute format('update public.%I tf set user_id = $1 where to_jsonb(tf) @> $2', f.tabla) using f.de, f.pk;
    elsif f.accion = 'archivar' then
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', f.tabla, f.tabla) using f.fila;
    else
      execute format('update public.%I set score = ($1 ->> ''score'')::numeric, updated_by = auth.uid(), updated_at = now() where class_id = $2 and category = $3 and user_id = $4', f.tabla)
        using f.fila, (f.pk ->> 'class_id')::uuid, f.pk ->> 'category', (f.pk ->> 'user_id')::uuid;
    end if;
    v_n := v_n + 1;
  end loop;
  if o.usar_id_secundaria then
    update public.profiles set login_id = null where id = o.principal;
    update public.profiles set login_id = o.login_original ->> 'secundaria' where id = o.secundaria;
    update public.profiles set login_id = o.login_original ->> 'principal' where id = o.principal;
  end if;
  update public.profiles set active = true, suspended_at = null where id = o.secundaria;
  update public.fusion_operaciones set estado = 'revertida', revertida_at = now(), revertida_por = auth.uid(), motivo_reversion = btrim(p_motivo) where id = p_op;
  perform public.fusion_log(p_op, o.principal, o.secundaria, 'revertir', 'ok', jsonb_build_object('filas', v_n, 'motivo', p_motivo));
  return jsonb_build_object('ok', true, 'filas', v_n);
end $$;

-- -----------------------------------------------------------------------------
-- Consulta: buscar, candidatos (orientativo), historial y detalle
-- -----------------------------------------------------------------------------
create or replace function public.fusion_buscar(p_texto text)
returns table (id uuid, login_id text, nombre text, matricula text, activa boolean, fusionada boolean, secciones text, intentos bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_texto, '')));
begin
  perform public.fusion_exigir_admin(false);
  if char_length(v) < 2 then return; end if;
  return query
  select p.id, p.login_id, p.full_name, p.student_code, p.active, public.fusion_fusionada(p.id),
    (select string_agg(c.name, ', ' order by c.name) from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = p.id),
    (select count(*) from public.attempts a where a.user_id = p.id)
  from public.profiles p
  where p.role::text = 'student' and (lower(p.full_name) like '%' || v || '%' or p.login_id like '%' || v || '%' or lower(coalesce(p.student_code, '')) like '%' || v || '%'
      or p.id::text = v or lower(coalesce(p.email, '')) like '%' || v || '%'
      or exists (select 1 from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = p.id and lower(c.name) like '%' || v || '%'))
  order by p.full_name limit 50;
end $$;

create or replace function public.fusion_candidatos(p_incluir_prueba boolean default false)
returns table (cuenta_a uuid, login_a text, nombre_a text, activa_a boolean, intentos_a bigint, cuenta_b uuid, login_b text, nombre_b text, activa_b boolean, intentos_b bigint,
  confianza text, puntos numeric, razones text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.fusion_exigir_admin(false);
  return query
  with est as (
    select p.id, p.login_id, p.full_name, p.active, p.created_at,
      array(select w from regexp_split_to_table(lower(translate(p.full_name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z]+') w where char_length(w) > 2) palabras,
      (select count(*) from public.attempts a where a.user_id = p.id) intentos
    from public.profiles p
    where p.role::text = 'student' and not public.fusion_fusionada(p.id) and (p_incluir_prueba or coalesce(p.login_id, '') not like 'prueba-%')),
  pares as (
    select a.*, b.id b_id, b.login_id b_login, b.full_name b_nombre, b.active b_activa, b.intentos b_intentos, b.palabras b_palabras, b.created_at b_creada,
      public.fusion_lev(coalesce(a.login_id, ''), coalesce(b.login_id, '')) dl,
      (select count(*) from unnest(a.palabras) w where w = any (b.palabras))::numeric / greatest(1, least(cardinality(a.palabras), cardinality(b.palabras))) comun,
      exists (select 1 from public.enrollments x join public.enrollments y on y.class_id = x.class_id and y.user_id = b.id where x.user_id = a.id) misma
    from est a join est b on a.id < b.id),
  puntuados as (
    select x.*,
      (case when x.dl = 1 then 0.45 when x.dl = 2 then 0.25 else 0 end)
      + (case when x.comun >= 0.99 then 0.45 when x.comun >= 0.66 then 0.3 else 0 end)
      + (case when x.misma then 0.1 else 0 end)
      + (case when x.active <> x.b_activa then 0.05 else 0 end) pts
    from pares x where x.dl <= 2 or x.comun >= 0.66)
  select z.id, z.login_id, z.full_name, z.active, z.intentos, z.b_id, z.b_login, z.b_nombre, z.b_activa, z.b_intentos,
    case when z.pts >= 0.8 then 'alta' when z.pts >= 0.5 then 'media' else 'baja' end, round(z.pts, 2),
    array_remove(array[
      case when z.dl = 1 then 'ID de acceso con 1 carácter de diferencia' when z.dl = 2 then 'ID de acceso con 2 caracteres de diferencia' end,
      case when z.dl = 1 and abs(char_length(coalesce(z.login_id, '')) - char_length(coalesce(z.b_login, ''))) = 1 then 'un dígito añadido u omitido'
           when z.dl = 1 then 'un dígito cambiado'
           when position(z.login_id in z.b_login) > 0 or position(z.b_login in z.login_id) > 0 then 'un ID contiene al otro' end,
      case when z.comun >= 0.99 then 'mismo nombre' when z.comun >= 0.66 then 'nombres muy parecidos' end,
      case when z.misma then 'misma sección' end,
      case when z.comun < 0.66 then 'los nombres NO coinciden: probablemente son personas distintas' end], null)
  from puntuados z order by z.pts desc, z.login_id;
end $$;

create or replace function public.fusion_historial()
returns table (op uuid, created_at timestamptz, estado text, principal uuid, login_principal text, nombre_principal text, secundaria uuid, login_secundaria text,
  motivo text, filas bigint, auth_error text, autorizado_por text, revertida_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.fusion_exigir_admin(false);
  return query
  select o.id, o.created_at, o.estado, o.principal, pp.login_id, pp.full_name, o.secundaria, coalesce(o.login_original ->> 'secundaria', ps.login_id),
    o.motivo, (select count(*) from public.fusion_filas f where f.op = o.id), o.auth_error, a.full_name, o.revertida_at
  from public.fusion_operaciones o join public.profiles pp on pp.id = o.principal join public.profiles ps on ps.id = o.secundaria
  left join public.profiles a on a.id = o.autorizado_por
  order by o.created_at desc limit 200;
end $$;

create or replace function public.fusion_detalle(p_op uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.fusion_exigir_admin(false);
  return (select to_jsonb(o) - 'txid' || jsonb_build_object(
      'por_tabla', (select coalesce(jsonb_object_agg(t.tabla, t.n), '{}'::jsonb) from (select tabla, count(*) n from public.fusion_filas f where f.op = o.id group by tabla) t),
      'eventos', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) from public.fusion_eventos e where e.op = o.id))
    from public.fusion_operaciones o where o.id = p_op);
end $$;

-- -----------------------------------------------------------------------------
-- Funciones existentes: excepción ACOTADA a la fusión en curso de esta misma transacción
-- -----------------------------------------------------------------------------
-- touch_updated_at (migración 1): en un traslado de la fusión se conserva la fecha original de última modificación
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fusion_en_curso() and to_jsonb(new) ? 'user_id'
     and (to_jsonb(new) - 'user_id' - 'updated_at') = (to_jsonb(old) - 'user_id' - 'updated_at')
     and public.fusion_permite((to_jsonb(old) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'user_id')::uuid) then
    new.updated_at := old.updated_at;
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- assisted_steps_inmutable (migración 38): solo el cambio de dueño de una fusión en curso
create or replace function public.assisted_steps_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fusion_permite(old.user_id, new.user_id) and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  raise exception 'Los pasos de la práctica asistida no se modifican: cada cambio es una versión nueva' using errcode = 'P0001';
end;
$$;

-- pes_respuesta_cerrada (migración 74): ídem
create or replace function public.pes_respuesta_cerrada() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fusion_permite(old.user_id, new.user_id) and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  if new.accion is distinct from old.accion or new.respuesta is distinct from old.respuesta or new.revelado_at is distinct from old.revelado_at
     or new.cerrado_at is distinct from old.cerrado_at or new.segundos is distinct from old.segundos or new.m is distinct from old.m
     or new.t_min_s is distinct from old.t_min_s or new.resultado is distinct from old.resultado
     or new.apartado_id is distinct from old.apartado_id or new.user_id is distinct from old.user_id or new.idem is distinct from old.idem then
    raise exception 'Una respuesta confirmada es definitiva' using errcode = '42501';
  end if;
  return new;
end $$;

-- Una cuenta fusionada no se reactiva (Cuentas, restablecer contraseña, inactividad…) salvo en su reversión
create or replace function public.fusion_guardia_perfil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.active and not old.active and public.fusion_fusionada(new.id)
     and not exists (select 1 from public.fusion_operaciones o where o.secundaria = new.id and o.estado = 'revirtiendo' and o.txid = txid_current()) then
    raise exception 'Esta cuenta fue fusionada con otra: no se puede reactivar (revierta la fusión si fue un error)' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists fusion_guardia_perfil on public.profiles;
create trigger fusion_guardia_perfil before update of active on public.profiles for each row execute function public.fusion_guardia_perfil();

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['fusion_pk(text)', 'fusion_fusionada(uuid)', 'fusion_log(uuid, uuid, uuid, text, text, jsonb)',
    'fusion_exigir_admin(boolean)', 'fusion_lev(text, text)', 'fusion_mejores(uuid)', 'fusion_huella(uuid, uuid)', 'fusion_resumen(uuid)',
    'fusion_analisis(uuid, uuid)', 'fusion_mover(uuid, text, text, text)', 'fusion_aplicar(uuid)', 'fusion_eventos_inmutable()', 'fusion_guardia_perfil()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
  -- la usan disparadores que pueden ejecutarse con cualquier rol (solo informa si hay una fusión en esta transacción)
  revoke all on function public.fusion_en_curso() from public, anon;
  grant execute on function public.fusion_en_curso() to authenticated, service_role;
  revoke all on function public.fusion_permite(uuid, uuid) from public, anon;
  grant execute on function public.fusion_permite(uuid, uuid) to authenticated, service_role;
  foreach f in array array['fusion_vista_previa(uuid, uuid, jsonb)', 'fusion_ejecutar(uuid, uuid, text, jsonb, boolean, text)', 'fusion_registrar_fallo(uuid, uuid, text)',
    'fusion_auth_resultado(uuid, boolean, text)', 'fusion_revertir(uuid, text)', 'fusion_buscar(text)', 'fusion_candidatos(boolean)', 'fusion_historial()', 'fusion_detalle(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
