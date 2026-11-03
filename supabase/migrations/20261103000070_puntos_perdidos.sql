-- =============================================================================
-- Migración 70 · Puntos perdidos (respecto a 100) y alerta urgente automática con confirmación de lectura.
-- Solo añade: tablas nuevas, una columna nueva (nullable) en live_messages y funciones.
--
--  1) Puntos perdidos (regla del profesor): en cada apartado (3 parciales de 15, Práctica 30, Final 25),
--       perdido = lo que vale − lo que sacó (la nota oficial del registro: a mano, o calculada con las actividades y la
--       parte a mano). Un apartado todavía sin nota no cuenta. Total = suma de los apartados − puntos extras aprobados
--       (nunca menos de 0).
--     Hasta la fecha «parte_hasta» de la sección (exclusive, hora de Santo Domingo), un apartado con parte escrita a mano
--     (migración 69) se mide SOLO por esa parte: valor de la parte − nota de la parte (p. ej. Práctica: 15 − «Prácticas
--     anteriores»). Desde esa fecha, por el apartado completo (30 − nota de Práctica).
--  2) Alerta por sección (desactivada por defecto; solo con el registro PUBLICADO): si los puntos perdidos pasan del
--     umbral (21), el estudiante recibe un aviso URGENTE del profesor, hasta N veces (10), cada uno cuando han pasado
--     H horas (24) desde que CONFIRMÓ haber leído el anterior. Se genera al entrar o seguir en el aula (no hace falta
--     una tarea programada): un estudiante que no entra no acumula avisos.
--  3) Confirmación de lectura obligatoria (live_messages.confirmacion): el aviso no tiene «cerrar»; hay una espera
--     (20 s), una caja que marcar y «Entendido». El servidor no acepta descartarlo ni confirmarlo antes de la espera.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Puntos perdidos
-- -----------------------------------------------------------------------------
create table if not exists public.lost_alert_settings (
  class_id uuid primary key references public.classes (id) on delete cascade,
  activo boolean not null default false,
  umbral numeric(5, 2) not null default 21 check (umbral between 0 and 100),
  repeticiones integer not null default 10 check (repeticiones between 1 and 30),
  intervalo_horas integer not null default 24 check (intervalo_horas between 1 and 168),
  espera_segundos integer not null default 20 check (espera_segundos between 5 and 120),
  firma text check (firma is null or char_length(firma) <= 120),
  parte_hasta date,                                                  -- antes de esta fecha, los apartados con parte a mano se miden solo por la parte     -- p. ej. «Prof. Francisco Orbe»; si no, el nombre del perfil
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.official_lost(p_class uuid)
returns table (user_id uuid, category text, perdidos numeric, etiqueta text)
language sql stable security definer set search_path = ''
as $$
  with solo_parte as (
    select gp.category, gp.max, gp.label from public.grade_parts gp
    join public.lost_alert_settings s on s.class_id = gp.class_id
    where gp.class_id = p_class and s.parte_hasta is not null and (now() at time zone 'America/Santo_Domingo')::date < s.parte_hasta
  )
  select o.user_id, o.category,
    case when sp.category is not null then
           case when ps.score is null then 0 else round(greatest(0, sp.max - least(ps.score, sp.max)), 2) end
         when o.score is null then 0
         else round(greatest(0, public.grade_category_max(o.category) - o.score), 2) end,
    coalesce(sp.label, case o.category when 'parcial1' then 'Primer parcial' when 'parcial2' then 'Segundo parcial' when 'parcial3' then 'Tercer parcial'
                                       when 'practica' then 'Práctica' else 'Examen final' end)
  from public.official_scores(p_class) o
  left join solo_parte sp on sp.category = o.category
  left join public.grade_part_scores ps on ps.class_id = p_class and ps.user_id = o.user_id and ps.category = o.category
$$;

-- Total por estudiante: suma de los apartados − puntos extras aprobados (mínimo 0), con el detalle
create or replace function public.official_lost_total(p_class uuid)
returns table (user_id uuid, perdidos numeric, por_apartados numeric, extras numeric, detalle jsonb)
language sql stable security definer set search_path = ''
as $$
  with l as (select o.user_id, sum(o.perdidos) bruto, jsonb_object_agg(o.category, o.perdidos) detalle from public.official_lost(p_class) o group by o.user_id),
  x as (select e.user_id, sum(e.points) extras from public.extra_points e where e.class_id = p_class and e.status = 'aprobado' group by e.user_id)
  select l.user_id, round(greatest(0, l.bruto - coalesce(x.extras, 0)), 2), round(l.bruto, 2), round(coalesce(x.extras, 0), 2), l.detalle
  from l left join x on x.user_id = l.user_id
$$;

-- -----------------------------------------------------------------------------
-- 2) Configuración de la alerta, registro de avisos y confirmación obligatoria
-- -----------------------------------------------------------------------------

create table if not exists public.lost_alerts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  numero integer not null check (numero between 1 and 30),
  perdidos numeric(5, 2) not null,
  message_id uuid references public.live_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, user_id, numero)
);
alter table public.lost_alert_settings enable row level security;
alter table public.lost_alerts enable row level security;
revoke all on public.lost_alert_settings, public.lost_alerts from anon, authenticated;

-- {"tipo":"caja","espera":20,"caja":"texto de la casilla"}: sin cerrar; espera, casilla y «Entendido»
alter table public.live_messages add column if not exists confirmacion jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_messages_confirmacion_check') then
    alter table public.live_messages add constraint live_messages_confirmacion_check check (confirmacion is null or (jsonb_typeof(confirmacion) = 'object' and octet_length(confirmacion::text) <= 1000));
  end if;
end $$;

-- Pendientes del estudiante (v2 de la migración 57) + confirmación obligatoria
create or replace function public.my_pending_messages_v3()
returns table (id uuid, kind text, body text, sender_name text, remitente text, created_at timestamptz, expires_at timestamptz, delivered_at timestamptz, confirmacion jsonb)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kind, m.body,
         case when m.remitente = 'aula' then null else coalesce(nullif(p.full_name, ''), 'Profesor') end,
         m.remitente, m.created_at, m.expires_at, r.delivered_at, m.confirmacion
  from public.live_message_recipients r
  join public.live_messages m on m.id = r.message_id
  left join public.profiles p on p.id = m.sender_id
  where r.user_id = auth.uid() and r.read_at is null and r.dismissed_at is null
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at
  limit 20
$$;

-- ack_live_message (migración 14) + un mensaje con confirmación obligatoria no se descarta ni se confirma antes de la espera
create or replace function public.ack_live_message(p_id uuid, p_action text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_conf jsonb; v_entregado timestamptz;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión' using errcode = '28000'; end if;
  if p_action not in ('leido', 'descartado') then raise exception 'Acción no válida' using errcode = '22023'; end if;
  select m.confirmacion, r.delivered_at into v_conf, v_entregado
    from public.live_message_recipients r join public.live_messages m on m.id = r.message_id
    where r.user_id = auth.uid() and r.message_id = p_id;
  if not found then raise exception 'Mensaje no encontrado' using errcode = 'P0002'; end if;
  if v_conf is not null then
    if p_action = 'descartado' then raise exception 'Este aviso debe leerse y confirmarse' using errcode = 'P0001'; end if;
    -- margen de 3 s por la latencia; sin recepción registrada, la espera empieza ahora
    if v_entregado is null then
      update public.live_message_recipients set delivered_at = now() where user_id = auth.uid() and message_id = p_id;
      raise exception 'Lea el aviso completo antes de confirmarlo' using errcode = 'P0001';
    end if;
    if now() < v_entregado + make_interval(secs => greatest(0, coalesce((v_conf ->> 'espera')::integer, 0) - 3)) then
      raise exception 'Lea el aviso completo antes de confirmarlo' using errcode = 'P0001';
    end if;
  end if;
  update public.live_message_recipients set
      delivered_at = coalesce(delivered_at, now()),
      read_at = case when p_action = 'leido' then coalesce(read_at, now()) else read_at end,
      dismissed_at = case when p_action = 'descartado' then coalesce(dismissed_at, now()) else dismissed_at end
    where user_id = auth.uid() and message_id = p_id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generación de la alerta (la llama la aplicación del estudiante al entrar y cada pocos minutos)
-- -----------------------------------------------------------------------------
-- 39 → «39»; 21.5 → «21.5»; 21.25 → «21.25»
create or replace function public.puntos_texto(p numeric)
returns text language sql immutable set search_path = ''
as $f$ select case when p = trunc(p) then trunc(p)::text else trim(trailing '0' from round(p, 2)::text) end $f$;

create or replace function public.lost_alert_texto(p_nombre text, p_curso text, p_seccion text, p_perdidos numeric, p_detalle text, p_profesor text)
returns text language sql stable set search_path = ''
as $$
  select '⚠️ AVISO URGENTE — ' || p_curso || ' (' || p_seccion || ')' || E'\n\n'
    || coalesce(nullif(split_part(btrim(coalesce(p_nombre, '')), ' ', 1), '') || ', has', 'Has') || ' perdido ' || public.puntos_texto(p_perdidos)
    || ' puntos de los 100 de la asignatura. Tu nota máxima posible ahora es ' || public.puntos_texto(100 - p_perdidos) || '.'
    || case when coalesce(p_detalle, '') <> '' then E'\n\nDónde los perdiste: ' || p_detalle || '.' else '' end
    || E'\n\nTodavía estás a tiempo. Te invito a dar tu mayor esfuerzo en todo lo que queda: estudia cada tema, entrega todas las prácticas'
    || ' y prepárate a fondo para los próximos parciales y el examen final. Si necesitas ayuda, pídela: estoy para apoyarte.'
    || E'\n\n' || coalesce(nullif(btrim(p_profesor), ''), 'Su profesor')
$$;

create or replace function public.mi_alerta_puntos()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c record; v_n integer; v_ultima record; v_perdidos numeric; v_extras numeric; v_detalle text; v_prof uuid; v_msg uuid; v_enviadas integer := 0;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and role = 'student' and active) then
    return jsonb_build_object('enviadas', 0);
  end if;
  for c in
    select cl.id class_id, cl.name seccion, co.title curso, cl.created_by, s.umbral, s.repeticiones, s.intervalo_horas, s.espera_segundos, s.firma
    from public.enrollments e
    join public.classes cl on cl.id = e.class_id and not cl.archived
    join public.courses co on co.id = cl.course_id
    join public.lost_alert_settings s on s.class_id = cl.id and s.activo
    join public.grade_settings gs on gs.class_id = cl.id and gs.published
    where e.user_id = v_uid
  loop
    perform pg_advisory_xact_lock(hashtextextended('alerta-perdidos:' || c.class_id::text || v_uid::text, 0));
    select count(*) into v_n from public.lost_alerts where class_id = c.class_id and user_id = v_uid;
    continue when v_n >= c.repeticiones;
    if v_n > 0 then
      select la.created_at, r.read_at, r.dismissed_at, m.id mid, m.expires_at into v_ultima
        from public.lost_alerts la left join public.live_messages m on m.id = la.message_id
        left join public.live_message_recipients r on r.message_id = la.message_id and r.user_id = v_uid
        where la.class_id = c.class_id and la.user_id = v_uid order by la.numero desc limit 1;
      -- el anterior sigue sin confirmar (y existe): no se acumulan avisos
      continue when v_ultima.mid is not null and v_ultima.read_at is null and v_ultima.dismissed_at is null
                    and (v_ultima.expires_at is null or v_ultima.expires_at > now());
      -- H horas desde que lo confirmó (si el mensaje se borró, desde que se generó)
      continue when coalesce(v_ultima.read_at, v_ultima.dismissed_at, v_ultima.created_at) + make_interval(hours => c.intervalo_horas) > now();
    end if;
    select t.perdidos, t.extras into v_perdidos, v_extras from public.official_lost_total(c.class_id) t where t.user_id = v_uid;
    v_perdidos := coalesce(v_perdidos, 0);
    select string_agg(o.etiqueta || ' ' || public.puntos_texto(o.perdidos), ' · '
                      order by array_position(array['parcial1', 'parcial2', 'parcial3', 'practica', 'final'], o.category)) filter (where o.perdidos > 0)
             || case when coalesce(v_extras, 0) > 0 then case when v_extras = 1 then ' (ya descontado 1 punto extra)' else ' (ya descontados ' || public.puntos_texto(v_extras) || ' puntos extras)' end else '' end
      into v_detalle
      from public.official_lost(c.class_id) o where o.user_id = v_uid;
    continue when v_perdidos <= c.umbral;
    select coalesce((select ct.user_id from public.class_teachers ct join public.profiles p on p.id = ct.user_id and p.active
                     where ct.class_id = c.class_id order by (ct.user_id = c.created_by) desc limit 1), c.created_by) into v_prof;
    insert into public.live_messages (sender_id, kind, body, audience, remitente, confirmacion)
      values (v_prof, 'urgente',
        public.lost_alert_texto((select full_name from public.profiles where id = v_uid), c.curso, c.seccion, v_perdidos, v_detalle,
                                coalesce(nullif(btrim(c.firma), ''), (select 'Prof. ' || nullif(btrim(full_name), '') from public.profiles where id = v_prof))),
        jsonb_build_object('mode', 'automatico', 'tipo', 'puntos_perdidos', 'class_id', c.class_id, 'numero', v_n + 1),
        'profesor',
        jsonb_build_object('tipo', 'caja', 'espera', c.espera_segundos,
          'caja', 'He leído que he perdido ' || public.puntos_texto(v_perdidos) || ' puntos y que debo dar mi mayor esfuerzo.'))
      returning id into v_msg;
    insert into public.live_message_recipients (message_id, user_id) values (v_msg, v_uid);
    insert into public.lost_alerts (class_id, user_id, numero, perdidos, message_id) values (c.class_id, v_uid, v_n + 1, round(v_perdidos, 2), v_msg);
    v_enviadas := v_enviadas + 1;
  end loop;
  return jsonb_build_object('enviadas', v_enviadas);
end;
$$;

-- -----------------------------------------------------------------------------
-- Profesor: configuración, puntos perdidos y estado de los avisos
-- -----------------------------------------------------------------------------
create or replace function public.lost_alert_config(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare s public.lost_alert_settings;
begin
  perform public.grades_assert_teacher(p_class);
  select * into s from public.lost_alert_settings where class_id = p_class;
  return jsonb_build_object('activo', coalesce(s.activo, false), 'umbral', coalesce(s.umbral, 21), 'repeticiones', coalesce(s.repeticiones, 10),
    'intervalo_horas', coalesce(s.intervalo_horas, 24), 'espera_segundos', coalesce(s.espera_segundos, 20), 'firma', coalesce(s.firma, ''), 'parte_hasta', s.parte_hasta,
    'publicado', coalesce((select published from public.grade_settings where class_id = p_class), false));
end;
$$;

create or replace function public.set_lost_alert_config(p_class uuid, p_activo boolean, p_umbral numeric, p_repeticiones integer, p_intervalo_horas integer, p_espera_segundos integer, p_firma text default null, p_parte_hasta date default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  if p_umbral is null or p_umbral not between 0 and 100 or p_repeticiones is null or p_repeticiones not between 1 and 30
     or p_intervalo_horas is null or p_intervalo_horas not between 1 and 168 or p_espera_segundos is null or p_espera_segundos not between 5 and 120 then
    raise exception 'Valores fuera de rango (umbral 0–100, avisos 1–30, horas 1–168, espera 5–120 s)' using errcode = '22023';
  end if;
  insert into public.lost_alert_settings (class_id, activo, umbral, repeticiones, intervalo_horas, espera_segundos, firma, parte_hasta, updated_by)
    values (p_class, coalesce(p_activo, false), p_umbral, p_repeticiones, p_intervalo_horas, p_espera_segundos, left(nullif(btrim(p_firma), ''), 120), p_parte_hasta, auth.uid())
    on conflict (class_id) do update set activo = excluded.activo, umbral = excluded.umbral, repeticiones = excluded.repeticiones,
      intervalo_horas = excluded.intervalo_horas, espera_segundos = excluded.espera_segundos, firma = excluded.firma, parte_hasta = excluded.parte_hasta, updated_by = excluded.updated_by, updated_at = now();
  return public.lost_alert_config(p_class);
end;
$$;

create or replace function public.gradebook_lost(p_class uuid)
returns table (user_id uuid, perdidos numeric, detalle jsonb, extras numeric, avisos integer, ultimo_aviso timestamptz, ultimo_leido timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.grades_assert_teacher(p_class);
  return query
  select o.user_id, o.perdidos, o.detalle, o.extras,
    (select count(*)::integer from public.lost_alerts la where la.class_id = p_class and la.user_id = o.user_id),
    (select max(la.created_at) from public.lost_alerts la where la.class_id = p_class and la.user_id = o.user_id),
    (select max(r.read_at) from public.lost_alerts la join public.live_message_recipients r on r.message_id = la.message_id and r.user_id = la.user_id
      where la.class_id = p_class and la.user_id = o.user_id)
  from public.official_lost_total(p_class) o;
end;
$$;

-- Estudiante: sus puntos perdidos en las secciones con el registro publicado
create or replace function public.mis_puntos_perdidos()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('class_id', cl.id, 'perdidos',
      (select coalesce(t.perdidos, 0) from public.official_lost_total(cl.id) t where t.user_id = auth.uid()))), '[]'::jsonb)
  from public.enrollments e join public.classes cl on cl.id = e.class_id and not cl.archived
  join public.grade_settings gs on gs.class_id = cl.id and gs.published
  where e.user_id = auth.uid() and public.my_account_ok()
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.official_lost(uuid) from public, anon, authenticated;
revoke all on function public.official_lost_total(uuid) from public, anon, authenticated;
revoke all on function public.lost_alert_texto(text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.puntos_texto(numeric) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['my_pending_messages_v3()', 'ack_live_message(uuid, text)', 'mi_alerta_puntos()', 'lost_alert_config(uuid)',
                           'set_lost_alert_config(uuid, boolean, numeric, integer, integer, integer, text, date)', 'gradebook_lost(uuid)', 'mis_puntos_perdidos()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
