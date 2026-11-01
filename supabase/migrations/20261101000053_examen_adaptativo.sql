-- =============================================================================
-- Examen adaptativo administrado por el motor de examen (migración 53).
--
-- Cada intento recibe sus preguntas UNA A UNA desde el banco calibrado de la actividad (TRI 2PL:
-- P = 1 / (1 + exp(−a(θ − b))), la misma forma que la calibración del laboratorio):
--  - Al empezar se guarda una COPIA de las calibraciones del banco (exam_adaptive_pool): la selección y la nota de ese
--    intento no cambian si después se recalibran las preguntas.
--  - Primera pregunta: máxima información en θ = 0. Siguientes: la Edge Function «calificar» califica en el servidor
--    las respuestas ya dadas (sin mostrar el resultado) y svc_adaptativo_siguiente estima θ (EAP, a priori N(0,1),
--    rejilla de −4 a 4) y asigna la de máxima información de Fisher a²P(1−P) entre las restantes; control de exposición
--    «randomesque»: se elige entre las k mejores con una semilla derivada del intento (reproducible).
--  - Fin: al llegar al máximo de preguntas, o al mínimo si el error típico de θ ya es ≤ el objetivo, o sin banco.
--  - NOTA: el número de aciertos no es comparable entre estudiantes que vieron preguntas distintas. La puntuación es
--    el DOMINIO estimado = proporción esperada de aciertos en TODO el banco con el θ final (curva característica del
--    banco); la nota = puntuación máxima × dominio. Se recalcula con recompute_attempt (créditos manuales incluidos).
-- Las preguntas asignadas usan attempt_item_orders (migración 28): get_attempt, puntos, entrega y revisión ya trabajan
-- solo con lo asignado. Se redefinen assign_attempt_items y recompute_attempt copiando su versión vigente (migración 28)
-- y añadiendo solo la rama adaptativa. Sin configuración adaptativa activa, todo funciona exactamente como antes.
-- Aditiva: tablas nuevas y funciones.
-- =============================================================================

create table if not exists public.exam_adaptive (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  activo boolean not null default true,
  max_items integer not null check (max_items between 5 and 60),
  min_items integer not null check (min_items between 3 and 60),
  se_objetivo double precision check (se_objetivo is null or se_objetivo between 0.2 and 1.0),
  exposicion integer not null default 3 check (exposicion between 1 and 5),
  estados text[] not null default '{calibrado}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (min_items <= max_items),
  check (estados <@ array['calibrado', 'provisional'] and cardinality(estados) >= 1)
);
create table if not exists public.exam_adaptive_pool (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  exercise_id uuid not null,
  a double precision not null,
  b double precision not null,
  primary key (attempt_id, exercise_id)
);
create table if not exists public.exam_adaptive_state (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  theta double precision not null default 0,
  se double precision not null default 1,
  administradas integer not null default 0,
  fin boolean not null default false,
  dominio double precision,
  updated_at timestamptz not null default now()
);
create table if not exists public.exam_adaptive_log (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  posicion integer not null,
  exercise_id uuid,
  theta double precision not null,
  se double precision not null,
  informacion double precision,
  motivo text not null check (motivo in ('inicio', 'seleccion', 'fin_maximo', 'fin_precision', 'fin_banco')),
  created_at timestamptz not null default now()
);
create index if not exists exam_adaptive_log_idx on public.exam_adaptive_log (attempt_id, posicion);

alter table public.exam_adaptive enable row level security;
alter table public.exam_adaptive_pool enable row level security;
alter table public.exam_adaptive_state enable row level security;
alter table public.exam_adaptive_log enable row level security;
revoke all on public.exam_adaptive, public.exam_adaptive_pool, public.exam_adaptive_state, public.exam_adaptive_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ayudantes

-- Banco adaptativo VIGENTE de una actividad (preguntas de la actividad con calibración en los estados admitidos)
create or replace function public.adaptive_bank(p_activity uuid)
returns table (exercise_id uuid, a double precision, b double precision)
language sql stable security definer set search_path = ''
as $$
  select c.exercise_id, c.a, c.b
  from public.activity_items ai
  join public.item_calibrations c on c.exercise_id = ai.exercise_id
  join public.exam_adaptive x on x.activity_id = ai.activity_id
  where ai.activity_id = p_activity and c.estado = any (x.estados)
$$;

create or replace function public.adaptive_p(p_a double precision, p_b double precision, p_theta double precision)
returns double precision language sql immutable set search_path = '' as $$ select 1.0 / (1.0 + exp(-p_a * (p_theta - p_b))) $$;

-- EAP de θ con la copia del banco del intento. p_resp: {exercise_id: crédito 0..1}; el crédito fraccionario entra como
-- verosimilitud P^c (1−P)^(1−c). Devuelve {theta, se, n}.
create or replace function public.adaptive_eap(p_attempt uuid, p_resp jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  k integer; th double precision; lp double precision; mx double precision := -1e300;
  lps double precision[] := '{}'; z double precision := 0; m double precision := 0; m2 double precision := 0; w double precision;
  r record; n integer;
begin
  select count(*) into n from jsonb_each_text(coalesce(p_resp, '{}'::jsonb)) x join public.exam_adaptive_pool p on p.attempt_id = p_attempt and p.exercise_id::text = x.key;
  for k in 0..80 loop
    th := -4 + k * 0.1;
    lp := -0.5 * th * th;
    for r in select p.a, p.b, least(1.0, greatest(0.0, x.value::double precision)) as cr
             from jsonb_each_text(coalesce(p_resp, '{}'::jsonb)) x
             join public.exam_adaptive_pool p on p.attempt_id = p_attempt and p.exercise_id::text = x.key loop
      w := public.adaptive_p(r.a, r.b, th);
      lp := lp + r.cr * ln(greatest(1e-12, w)) + (1 - r.cr) * ln(greatest(1e-12, 1 - w));
    end loop;
    lps := lps || lp;
    mx := greatest(mx, lp);
  end loop;
  for k in 0..80 loop
    w := exp(lps[k + 1] - mx);
    th := -4 + k * 0.1;
    z := z + w; m := m + w * th; m2 := m2 + w * th * th;
  end loop;
  m := m / z;
  return jsonb_build_object('theta', m, 'se', sqrt(greatest(m2 / z - m * m, 0)), 'n', n);
end;
$$;

-- Elige entre las k preguntas más informativas en θ (sin las ya asignadas), con una semilla del intento y la posición
create or replace function public.adaptive_elegir(p_attempt uuid, p_theta double precision, p_k integer, p_pos integer)
returns table (exercise_id uuid, informacion double precision)
language sql stable security definer set search_path = ''
as $$
  with cand as (
    select p.exercise_id, p.a * p.a * public.adaptive_p(p.a, p.b, p_theta) * (1 - public.adaptive_p(p.a, p.b, p_theta)) as info
    from public.exam_adaptive_pool p
    where p.attempt_id = p_attempt
      and not exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = p.exercise_id)
    order by info desc, p.exercise_id
    limit greatest(1, p_k)
  ), num as (select c.*, row_number() over (order by c.info desc, c.exercise_id) - 1 as rn, count(*) over () as total from cand c)
  select n.exercise_id, n.info from num n
  where n.rn = abs(hashtextextended(p_attempt::text || ':' || p_pos, 0)) % n.total
$$;

-- -----------------------------------------------------------------------------
-- Profesor: configuración

create or replace function public.exam_adaptive_get(p_activity uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_class uuid; x public.exam_adaptive;
begin
  select class_id into v_class from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into x from public.exam_adaptive where activity_id = p_activity;
  return jsonb_build_object(
    'config', case when x.activity_id is null then null else jsonb_build_object('activo', x.activo, 'max_items', x.max_items, 'min_items', x.min_items,
      'se_objetivo', x.se_objetivo, 'exposicion', x.exposicion, 'incluir_provisionales', 'provisional' = any (x.estados)) end,
    'preguntas', (select count(*) from public.activity_items where activity_id = p_activity),
    'calibradas', (select count(*) from public.activity_items ai join public.item_calibrations c on c.exercise_id = ai.exercise_id where ai.activity_id = p_activity and c.estado = 'calibrado'),
    'provisionales', (select count(*) from public.activity_items ai join public.item_calibrations c on c.exercise_id = ai.exercise_id where ai.activity_id = p_activity and c.estado = 'provisional'),
    'intentos', (select count(*) from public.attempts where activity_id = p_activity),
    'minimo_banco', 15);
end;
$$;

create or replace function public.exam_adaptive_save(p_activity uuid, p_cfg jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_class uuid; v_mode public.activity_mode; v_activo boolean; v_max integer; v_min integer; v_se double precision; v_k integer;
  v_estados text[]; v_banco integer;
begin
  select class_id, mode into v_class, v_mode from public.activities where id = p_activity;
  if v_class is null or not public.is_class_teacher(v_class) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if v_mode <> 'exam' then raise exception 'El modo adaptativo solo se aplica a evaluaciones' using errcode = '22023'; end if;
  if exists (select 1 from public.attempts where activity_id = p_activity) then
    raise exception 'Ya hay intentos en esta evaluación: el modo adaptativo no puede cambiar (cree otra evaluación)' using errcode = 'P0001';
  end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Configuración inválida' using errcode = '22023'; end if;
  v_activo := coalesce((p_cfg ->> 'activo')::boolean, true);
  v_max := coalesce((p_cfg ->> 'max_items')::integer, 15);
  v_min := coalesce((p_cfg ->> 'min_items')::integer, least(10, v_max));
  v_se := (p_cfg ->> 'se_objetivo')::double precision;
  v_k := coalesce((p_cfg ->> 'exposicion')::integer, 3);
  v_estados := case when coalesce((p_cfg ->> 'incluir_provisionales')::boolean, false) then array['calibrado', 'provisional'] else array['calibrado'] end;
  if v_activo then
    select count(*) into v_banco from public.activity_items ai join public.item_calibrations c on c.exercise_id = ai.exercise_id
      where ai.activity_id = p_activity and c.estado = any (v_estados);
    if v_banco < 15 then raise exception 'El banco adaptativo necesita al menos 15 preguntas calibradas en la evaluación (tiene %)', v_banco using errcode = 'P0001'; end if;
    if v_max > v_banco then raise exception 'El máximo de preguntas (%) supera el banco calibrado (%)', v_max, v_banco using errcode = '22023'; end if;
  end if;
  begin
    insert into public.exam_adaptive as x (activity_id, activo, max_items, min_items, se_objetivo, exposicion, estados, updated_by, updated_at)
    values (p_activity, v_activo, v_max, v_min, v_se, v_k, v_estados, auth.uid(), now())
    on conflict (activity_id) do update set activo = excluded.activo, max_items = excluded.max_items, min_items = excluded.min_items,
      se_objetivo = excluded.se_objetivo, exposicion = excluded.exposicion, estados = excluded.estados, updated_by = excluded.updated_by, updated_at = now();
  exception when check_violation or invalid_text_representation then
    raise exception 'Configuración fuera de los límites permitidos' using errcode = '22023';
  end;
  -- un examen adaptativo es de una pregunta a la vez y solo hacia adelante (se conservan duración y pausas)
  if v_activo then
    insert into public.exam_settings as s (activity_id, presentacion, navegacion, updated_by, updated_at)
    values (p_activity, 'una_a_la_vez', 'solo_adelante', auth.uid(), now())
    on conflict (activity_id) do update set presentacion = 'una_a_la_vez', navegacion = 'solo_adelante', updated_by = excluded.updated_by, updated_at = now();
  end if;
  return public.exam_adaptive_get(p_activity);
end;
$$;

-- Estudiante (o quien revisa): ¿es adaptativo?, ¿cuántas van?, ¿terminó?
create or replace function public.exam_adaptive_estado(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_att public.attempts; s public.exam_adaptive_state; v_max integer;
begin
  select * into v_att from public.attempts where id = p_attempt;
  if v_att.id is null or not (v_att.user_id = auth.uid() or public.can_review_attempt(p_attempt)) then raise exception 'Intento no encontrado' using errcode = '42501'; end if;
  select * into s from public.exam_adaptive_state where attempt_id = p_attempt;
  if s.attempt_id is null then return jsonb_build_object('activo', false); end if;
  select max_items into v_max from public.exam_adaptive where activity_id = v_att.activity_id;
  return jsonb_build_object('activo', true, 'max_items', v_max, 'administradas', s.administradas, 'fin', s.fin)
    -- θ y dominio solo para quien revisa (el estudiante ve su nota cuando se publique)
    || case when public.can_review_attempt(p_attempt) then jsonb_build_object('theta', s.theta, 'se', s.se, 'dominio', s.dominio) else '{}'::jsonb end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Servidor (Edge Function «calificar», acción «adaptativo»): siguiente pregunta

create or replace function public.svc_adaptativo_siguiente(p_user uuid, p_attempt uuid, p_tras uuid, p_creditos jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts; x public.exam_adaptive; s public.exam_adaptive_state;
  v_orden uuid[]; n integer; j integer; v_eap jsonb; v_theta double precision; v_se double precision;
  v_sig uuid; v_info double precision; v_motivo text; v_resp jsonb;
begin
  v_att := public.assert_attempt_writable(p_attempt, p_user);   -- dueño, sin entregar, plazo y tiempo del examen
  perform pg_advisory_xact_lock(hashtextextended('adaptativo:' || p_attempt::text, 0));
  select * into s from public.exam_adaptive_state where attempt_id = p_attempt;
  if s.attempt_id is null then raise exception 'Este intento no es adaptativo' using errcode = '22023'; end if;
  select * into x from public.exam_adaptive where activity_id = v_att.activity_id;
  select array_agg(o.exercise_id order by o.position) into v_orden from public.attempt_item_orders o where o.attempt_id = p_attempt;
  n := coalesce(cardinality(v_orden), 0);
  j := array_position(v_orden, p_tras);
  if j is null then raise exception 'La pregunta no pertenece a este intento' using errcode = '42501'; end if;
  -- repetición (doble clic, red): la siguiente ya estaba asignada
  if j < n then return jsonb_build_object('siguiente', v_orden[j + 1], 'fin', false, 'administradas', n, 'max_items', x.max_items); end if;
  if s.fin then return jsonb_build_object('siguiente', null, 'fin', true, 'administradas', n, 'max_items', x.max_items); end if;

  -- solo cuentan los créditos de preguntas asignadas (el resto se ignora)
  select coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb) into v_resp
    from jsonb_each(coalesce(p_creditos, '{}'::jsonb)) k where k.key = any (select unnest(v_orden)::text);
  v_eap := public.adaptive_eap(p_attempt, v_resp);
  v_theta := (v_eap ->> 'theta')::double precision; v_se := (v_eap ->> 'se')::double precision;
  v_motivo := case when n >= x.max_items then 'fin_maximo'
                   when x.se_objetivo is not null and n >= x.min_items and v_se <= x.se_objetivo then 'fin_precision' end;
  if v_motivo is null then
    select e.exercise_id, e.informacion into v_sig, v_info from public.adaptive_elegir(p_attempt, v_theta, x.exposicion, n + 1) e;
    if v_sig is null then v_motivo := 'fin_banco'; end if;
  end if;
  if v_motivo is not null then
    update public.exam_adaptive_state set theta = v_theta, se = v_se, fin = true, updated_at = now() where attempt_id = p_attempt;
    insert into public.exam_adaptive_log (attempt_id, posicion, exercise_id, theta, se, motivo) values (p_attempt, n, null, v_theta, v_se, v_motivo);
    return jsonb_build_object('siguiente', null, 'fin', true, 'administradas', n, 'max_items', x.max_items);
  end if;
  insert into public.attempt_item_orders (attempt_id, exercise_id, position) values (p_attempt, v_sig, n + 1);
  insert into public.responses (attempt_id, exercise_id, user_id, points)
    select p_attempt, v_sig, p_user, coalesce(i.points, e.points)
    from public.activity_items i join public.exercises e on e.id = i.exercise_id
    where i.activity_id = v_att.activity_id and i.exercise_id = v_sig
    on conflict (attempt_id, exercise_id) do nothing;
  insert into public.exam_adaptive_log (attempt_id, posicion, exercise_id, theta, se, informacion, motivo) values (p_attempt, n + 1, v_sig, v_theta, v_se, v_info, 'seleccion');
  update public.exam_adaptive_state set theta = v_theta, se = v_se, administradas = n + 1, updated_at = now() where attempt_id = p_attempt;
  perform public.recompute_attempt(p_attempt);
  return jsonb_build_object('siguiente', v_sig, 'fin', false, 'administradas', n + 1, 'max_items', x.max_items);
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones existentes (copia de la migración 28) + rama adaptativa

create or replace function public.assign_attempt_items(p_attempt uuid, p_activity uuid, p_seq integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.exam_designs; v_items uuid[]; v_anclas uuid[]; v_libres uuid[]; v_final uuid[] := '{}'; v_bloques integer[]; v_rot integer; k integer; e uuid;
  v_ad public.exam_adaptive; v_primera uuid; v_info double precision;
begin
  -- examen adaptativo: copia del banco calibrado y primera pregunta (máxima información en θ = 0)
  select * into v_ad from public.exam_adaptive where activity_id = p_activity and activo;
  if found then
    insert into public.exam_adaptive_pool (attempt_id, exercise_id, a, b)
      select p_attempt, bk.exercise_id, bk.a, bk.b from public.adaptive_bank(p_activity) bk;
    select el.exercise_id, el.informacion into v_primera, v_info from public.adaptive_elegir(p_attempt, 0, v_ad.exposicion, 1) el;
    if v_primera is null then raise exception 'El banco adaptativo de esta evaluación está vacío' using errcode = 'P0001'; end if;
    insert into public.attempt_item_orders (attempt_id, exercise_id, position) values (p_attempt, v_primera, 1);
    insert into public.exam_adaptive_state (attempt_id, user_id, theta, se, administradas)
      select p_attempt, a.user_id, 0, 1, 1 from public.attempts a where a.id = p_attempt;
    insert into public.exam_adaptive_log (attempt_id, posicion, exercise_id, theta, se, informacion, motivo) values (p_attempt, 1, v_primera, 0, 1, v_info, 'inicio');
    return;
  end if;
  select * into d from public.exam_designs where activity_id = p_activity;
  if not found or (d.orden = 'fijo' and not d.versiones) then return; end if;
  -- ítems asignados en el orden base
  select array_agg(ai.exercise_id order by ai.position) into v_items
  from public.activity_items ai
  left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = ai.exercise_id
  where ai.activity_id = p_activity
    and (not d.versiones or di.grupo is null or ai.exercise_id = (
      select z.exercise_id from (
        select di2.exercise_id, row_number() over (order by ai2.position) - 1 rn, count(*) over () n,
               dense_rank() over (order by di2.grupo) gr
        from public.exam_design_items di2 join public.activity_items ai2 on ai2.activity_id = p_activity and ai2.exercise_id = di2.exercise_id
        where di2.activity_id = p_activity and di2.grupo = di.grupo) z
      where z.rn = (p_seq + (select count(distinct di3.grupo) from public.exam_design_items di3 where di3.activity_id = p_activity and di3.grupo < di.grupo)) % z.n));
  if v_items is null then return; end if;
  if d.orden = 'aleatorio' then
    select array_agg(x order by random()) into v_final from unnest(v_items) x;
  elsif d.orden = 'anclas_fijas' then
    select array_agg(x order by random()) into v_libres from unnest(v_items) x
      where not exists (select 1 from public.exam_design_items di where di.activity_id = p_activity and di.exercise_id = x and di.rol = 'ancla');
    k := 1;
    foreach e in array v_items loop
      if exists (select 1 from public.exam_design_items di where di.activity_id = p_activity and di.exercise_id = e and di.rol = 'ancla') then
        v_final := v_final || e;
      else
        v_final := v_final || v_libres[k]; k := k + 1;
      end if;
    end loop;
  elsif d.orden = 'contrabalanceado' then
    select array_agg(distinct coalesce(di.bloque, 0) order by coalesce(di.bloque, 0)) into v_bloques
      from unnest(v_items) x left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = x;
    v_rot := p_seq % greatest(1, cardinality(v_bloques));
    select array_agg(x order by ((array_position(v_bloques, coalesce(di.bloque, 0)) - 1 - v_rot + cardinality(v_bloques)) % cardinality(v_bloques)), ord)
      into v_final
      from unnest(v_items) with ordinality u(x, ord) left join public.exam_design_items di on di.activity_id = p_activity and di.exercise_id = u.x;
  else
    v_final := v_items;
  end if;
  insert into public.attempt_item_orders (attempt_id, exercise_id, position)
    select p_attempt, x, ord from unnest(v_final) with ordinality u(x, ord);
end;
$$;

create or replace function public.recompute_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_asig boolean;
  v_resp jsonb; v_eap jsonb; v_dom double precision;
begin
  select * into v_att from public.attempts where id = p_attempt;
  v_asig := exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt);
  if v_att.activity_id is not null then
    update public.attempts a set
      max_score = (select coalesce(sum(coalesce(i.points, e.points)), 0) from public.activity_items i
                   join public.exercises e on e.id = i.exercise_id where i.activity_id = v_att.activity_id
                     and (not v_asig or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = i.exercise_id))),
      -- mismos puntos que max_score y solo ítems que siguen en la actividad
      score = (select coalesce(sum(coalesce(i.points, e.points) * coalesce(r.manual_credit, r.auto_credit, 0)), 0)
               from public.responses r
               join public.activity_items i on i.activity_id = v_att.activity_id and i.exercise_id = r.exercise_id
               join public.exercises e on e.id = r.exercise_id
               where r.attempt_id = p_attempt
                 and (not v_asig or exists (select 1 from public.attempt_item_orders o where o.attempt_id = p_attempt and o.exercise_id = r.exercise_id))),
      needs_review = exists (select 1 from public.responses r where r.attempt_id = p_attempt
                             and r.status = 'pending_review' and r.manual_credit is null)
    where a.id = p_attempt;
    -- examen adaptativo ENTREGADO: nota = máximo × dominio estimado en el banco (los aciertos no son comparables)
    if exists (select 1 from public.exam_adaptive_state s where s.attempt_id = p_attempt)
       and (select status from public.attempts where id = p_attempt) = 'submitted' then
      select coalesce(jsonb_object_agg(r.exercise_id::text, coalesce(r.manual_credit, r.auto_credit, 0)), '{}'::jsonb) into v_resp
        from public.responses r join public.attempt_item_orders o on o.attempt_id = r.attempt_id and o.exercise_id = r.exercise_id
        where r.attempt_id = p_attempt;
      v_eap := public.adaptive_eap(p_attempt, v_resp);
      select avg(public.adaptive_p(p.a, p.b, (v_eap ->> 'theta')::double precision)) into v_dom from public.exam_adaptive_pool p where p.attempt_id = p_attempt;
      update public.attempts set score = round((max_score * coalesce(v_dom, 0))::numeric, 2) where id = p_attempt;
      update public.exam_adaptive_state set theta = (v_eap ->> 'theta')::double precision, se = (v_eap ->> 'se')::double precision,
        dominio = v_dom, fin = true, updated_at = now() where attempt_id = p_attempt;
    end if;
  else
    update public.attempts a set
      max_score = (select coalesce(sum(r.points), 0) from public.responses r where r.attempt_id = p_attempt),
      score = (select coalesce(sum(r.points * coalesce(r.manual_credit, r.auto_credit, 0)), 0)
               from public.responses r where r.attempt_id = p_attempt),
      needs_review = false
    where a.id = p_attempt;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['adaptive_bank(uuid)', 'adaptive_eap(uuid, jsonb)', 'adaptive_elegir(uuid, double precision, integer, integer)',
                           'svc_adaptativo_siguiente(uuid, uuid, uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['exam_adaptive_get(uuid)', 'exam_adaptive_save(uuid, jsonb)', 'exam_adaptive_estado(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant execute on function public.svc_adaptativo_siguiente(uuid, uuid, uuid, jsonb) to service_role;
