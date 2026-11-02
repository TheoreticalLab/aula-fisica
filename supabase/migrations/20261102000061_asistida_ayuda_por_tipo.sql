-- =============================================================================
-- Práctica asistida: el primer intento con ayuda declarada vale según el TIPO de ayuda (migración 61). Decisión del
-- profesor: la IA reduce el esfuerzo mental casi a cero; un libro o los apuntes, no. Al declarar «consulté alguna
-- ayuda» se despliegan los tipos (IA, libro, apuntes, otra persona, videos, simuladores) y cada uno tiene su valor.
--  - assisted_settings.factores_fuente (jsonb {fuente: 0–1}): valor del primer intento según la ayuda declarada. Con
--    varias, cuenta la MENOR (la que más ayudó). Un tipo sin valor, o una declaración sin tipos (las hechas antes de
--    esta migración o desde una versión anterior de la página), usa factor_declarada (migración 60).
--    Prácticas existentes: '{}' (y factor_declarada 1) = sin efecto hasta que el profesor lo cambie. Prácticas nuevas:
--    IA 25 %, otra persona 50 %, videos 60 %, libro 80 %, simuladores 80 %, apuntes 90 %.
--  - svc_asistida_registrar guarda los tipos en assisted_steps.fuentes del paso inicial (columna de la migración 38).
--  - asistida_credito devuelve el factor aplicado y los tipos; asistida_estado, la tabla de valores: el estudiante ve
--    el valor de cada tipo ANTES de declarar.
-- svc_asistida_registrar se copia de la migración 38, asistida_credito y asistida_estado de la 60, con el cambio. Aditiva.
-- =============================================================================

alter table public.assisted_settings add column if not exists factores_fuente jsonb not null default '{}'::jsonb;
alter table public.assisted_settings alter column factores_fuente set default
  '{"ia": 0.25, "persona": 0.5, "video": 0.6, "libro": 0.8, "simulador": 0.8, "apuntes": 0.9}'::jsonb;

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
  -- tipos de ayuda del primer intento (migración 61): solo con «consulté alguna ayuda»; los desconocidos se ignoran
  if p_fase = 'inicial' and v_decl = 'consulto_ayuda' and jsonb_typeof(p_datos -> 'fuentes') = 'array' then
    select array_agg(distinct f order by f) into v_fuentes from jsonb_array_elements_text(p_datos -> 'fuentes') f
      where f in ('ia', 'libro', 'apuntes', 'persona', 'video', 'simulador');
  end if;
  select coalesce(max(x.version), 0) + 1 into v_ver from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = p_fase;
  insert into public.assisted_steps (attempt_id, exercise_id, user_id, fase, version, client_id, answer, procedimiento, explicacion, no_se, declaracion,
                                     fuentes, transfer_exercise_id, status, credit, engine_code, engine_messages)
  values (p_attempt, p_exercise, p_user, p_fase, v_ver, p_client_id,
    case when coalesce((p_datos ->> 'no_se')::boolean, false) then null else p_datos -> 'answer' end,
    left(nullif(trim(p_datos ->> 'procedimiento'), ''), 5000), left(nullif(trim(p_datos ->> 'explicacion'), ''), 3000),
    coalesce((p_datos ->> 'no_se')::boolean, false), case when p_fase = 'inicial' then v_decl end,
    v_fuentes,
    case when p_fase = 'transferencia' then (v ->> 'transfer_exercise_id')::uuid end,
    p_resultado ->> 'status', least(1, greatest(0, coalesce((p_resultado ->> 'credit')::numeric, 0))), p_resultado ->> 'code', p_resultado -> 'messages');
  perform public.asistida_actualizar_respuesta(p_attempt, p_exercise);
  return public.asistida_estado_item(p_attempt, p_exercise, true);
end;
$$;

create or replace function public.asistida_credito(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.attempts; s public.assisted_settings; v_tr boolean;
  v_ini numeric := 0; v_ini_credito numeric := 0; v_cor_bruto numeric := 0; v_cor numeric := 0; v_jus numeric := 0; v_tra numeric := 0; v_den numeric; v_final_status text;
  v_ref jsonb; v_hay_ini boolean; v_decl text; v_fd numeric := 1; v_fuentes text[];
begin
  select * into a from public.attempts where id = p_attempt;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  if s.activity_id is null then return null; end if;
  v_tr := s.transferencia and exists (select 1 from public.assisted_transfer t where t.activity_id = a.activity_id and t.exercise_id = p_exercise);
  select true, coalesce(x.credit, 0), x.declaracion, x.fuentes into v_hay_ini, v_ini_credito, v_decl, v_fuentes from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial';
  v_hay_ini := coalesce(v_hay_ini, false);
  -- primer intento hecho con ayuda declarada: vale según el tipo (la menor si son varios, migración 61);
  -- sin tipos declarados, factor_declarada (migración 60)
  if v_decl = 'consulto_ayuda' then
    v_fd := s.factor_declarada;
    if coalesce(cardinality(v_fuentes), 0) > 0 then
      select min(coalesce((s.factores_fuente ->> f)::numeric, s.factor_declarada)) into v_fd from unnest(v_fuentes) f;
    end if;
  end if;
  v_ini := case when not v_hay_ini then 0 when s.nota_primer_intento = 'acierto' then v_ini_credito else 1 end * v_fd;
  select coalesce(x.credit, 0), x.status into v_cor_bruto, v_final_status from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida' order by x.version desc limit 1;
  v_cor_bruto := coalesce(v_cor_bruto, 0);
  -- acertar en el primer intento vale la corrección completa (por el factor de la ayuda declarada, si la hubo);
  -- corregir con ayuda tras fallar, una fracción
  v_cor := case when s.nota_primer_intento = 'acierto' and v_ini_credito >= 1 then v_fd
                else s.factor_ayuda * v_cor_bruto end;
  select x.reflexion into v_ref from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'reflexion' order by x.version desc limit 1;
  if v_ref is not null and exists (select 1 from jsonb_each_text(v_ref) e where char_length(trim(e.value)) >= 15) then v_jus := 1; end if;
  if v_tr then
    select coalesce(x.credit, 0) into v_tra from public.assisted_steps x where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'transferencia';
    v_tra := coalesce(v_tra, 0);
  end if;
  v_den := s.peso_inicial + s.peso_correccion + s.peso_justificacion + case when v_tr then s.peso_transferencia else 0 end;
  return jsonb_build_object(
    'credito', case when v_den = 0 then 0 else round((s.peso_inicial * v_ini + s.peso_correccion * v_cor + s.peso_justificacion * v_jus
                 + case when v_tr then s.peso_transferencia * v_tra else 0 end) / v_den, 3) end,
    'inicial', v_ini, 'correccion', v_cor, 'correccion_bruta', v_cor_bruto, 'justificacion', v_jus, 'transferencia', case when v_tr then v_tra end,
    'pesos', jsonb_build_object('inicial', s.peso_inicial, 'correccion', s.peso_correccion, 'justificacion', s.peso_justificacion,
                                'transferencia', case when v_tr then s.peso_transferencia else 0 end),
    'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda, 'factor_declarada', s.factor_declarada,
                                'factores_fuente', s.factores_fuente),
    'ayuda_declarada', v_decl = 'consulto_ayuda',
    'fuentes_iniciales', to_jsonb(v_fuentes),
    'factor_aplicado', v_fd,
    'estado_final', v_final_status);
end;
$$;

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
      'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda, 'factor_declarada', s.factor_declarada,
                                  'factores_fuente', s.factores_fuente),
      'verificacion', jsonb_build_object('tipo', s.verificacion_tipo, 'fecha', s.verificacion_fecha, 'nota', s.verificacion_nota)),
    'dependencia', public.asistida_dependencia(p_attempt),
    'items', (select coalesce(jsonb_agg(public.asistida_estado_item(p_attempt, i.exercise_id, v_propio) order by i.position), '[]'::jsonb)
              from public.activity_items i where i.activity_id = act.id));
end;
$$;

-- Profesor: valor del primer intento con ayuda declarada (sin tipo y por tipo) y, si lo pide, recálculo de los intentos existentes
create or replace function public.asistida_ayuda_guardar(p_activity uuid, p_factor numeric, p_fuentes jsonb, p_recalcular boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; r record; n integer := 0; v_map jsonb := '{}'::jsonb; e record;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.assisted_settings where activity_id = p_activity) then raise exception 'Esta práctica no usa el aprendizaje asistido' using errcode = 'P0001'; end if;
  if p_factor is null or p_factor < 0 or p_factor > 1 then raise exception 'Valor fuera de los límites' using errcode = '22023'; end if;
  if p_fuentes is null or jsonb_typeof(p_fuentes) <> 'object' then raise exception 'Valores por tipo de ayuda inválidos' using errcode = '22023'; end if;
  for e in select key, value from jsonb_each(p_fuentes) loop
    if e.key not in ('ia', 'libro', 'apuntes', 'persona', 'video', 'simulador') then raise exception 'Tipo de ayuda desconocido: %', e.key using errcode = '22023'; end if;
    if jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric < 0 or (e.value #>> '{}')::numeric > 1 then
      raise exception 'Valor fuera de los límites para %', e.key using errcode = '22023'; end if;
    v_map := v_map || jsonb_build_object(e.key, round((e.value #>> '{}')::numeric, 2));
  end loop;
  update public.assisted_settings set factor_declarada = round(p_factor, 2), factores_fuente = v_map, updated_by = auth.uid(), updated_at = now()
    where activity_id = p_activity;
  if coalesce(p_recalcular, false) then
    for r in select distinct x.attempt_id, x.exercise_id from public.assisted_steps x join public.attempts a on a.id = x.attempt_id where a.activity_id = p_activity loop
      perform public.asistida_actualizar_respuesta(r.attempt_id, r.exercise_id);
      n := n + 1;
    end loop;
  end if;
  return jsonb_build_object('config', public.assisted_settings_get(p_activity) -> 'config', 'recalculados', n);
end;
$$;

revoke all on function public.svc_asistida_registrar(uuid, uuid, uuid, text, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.svc_asistida_registrar(uuid, uuid, uuid, text, jsonb, jsonb, uuid) to service_role;
revoke all on function public.asistida_credito(uuid, uuid) from public, anon, authenticated;
revoke all on function public.asistida_ayuda_guardar(uuid, numeric, jsonb, boolean) from public, anon;
grant execute on function public.asistida_ayuda_guardar(uuid, numeric, jsonb, boolean) to authenticated;
