-- =============================================================================
-- Práctica asistida: penalización por DEPENDENCIA OBSERVADA de la ayuda (migración 59).
--
-- «Dependencia» = proporción de ejercicios de la práctica que el estudiante corrigió DESPUÉS de fallar su primer
-- intento (primer intento con crédito < 1 o «no sé», y al menos una corrección). Se observa; no depende de lo que el
-- estudiante declare (la declaración sigue sin intervenir: castigarla premiaría mentir).
-- Si la dependencia supera el umbral de la práctica, la nota del intento se multiplica por (1 − descuento).
--  - assisted_settings.dependencia_umbral (1–100, null = desactivada) y dependencia_descuento (0–100 %)
--  - asistida_dependencia(intento): cifras para el profesor y el propio estudiante
--  - recompute_attempt (copia de la migración 53) aplica el descuento al final, también en vivo con cada paso
--  - asistida_estado (copia de la migración 58) muestra la regla y la dependencia actual al estudiante
--  - asistida_dependencia_guardar: el profesor de la sección la configura y, si quiere, recalcula los intentos
-- Viene DESACTIVADA en todas las prácticas hasta que el profesor la active. Aditiva: columnas y funciones.
-- =============================================================================

alter table public.assisted_settings add column if not exists dependencia_umbral integer;
alter table public.assisted_settings add column if not exists dependencia_descuento integer not null default 20;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assisted_settings_dependencia_umbral_check') then
    alter table public.assisted_settings add constraint assisted_settings_dependencia_umbral_check check (dependencia_umbral is null or dependencia_umbral between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assisted_settings_dependencia_descuento_check') then
    alter table public.assisted_settings add constraint assisted_settings_dependencia_descuento_check check (dependencia_descuento between 0 and 100);
  end if;
end $$;

-- Cifras de dependencia de un intento (null si la actividad no es asistida)
create or replace function public.asistida_dependencia(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare a public.attempts; s public.assisted_settings; v_total integer; v_dep integer; v_pct numeric;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.activity_id is null then return null; end if;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  if s.activity_id is null then return null; end if;
  select count(*) into v_total from public.activity_items i where i.activity_id = a.activity_id;
  select count(*) into v_dep from public.assisted_steps ini
    where ini.attempt_id = p_attempt and ini.fase = 'inicial' and coalesce(ini.credit, 0) < 1
      and exists (select 1 from public.assisted_steps c where c.attempt_id = p_attempt and c.exercise_id = ini.exercise_id and c.fase = 'corregida');
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_dep / v_total, 1) end;
  return jsonb_build_object('ejercicios', v_total, 'corregidos_tras_fallar', v_dep, 'porcentaje', v_pct,
    'umbral', s.dependencia_umbral, 'descuento', s.dependencia_descuento,
    'aplicado', s.dependencia_umbral is not null and v_pct > s.dependencia_umbral);
end;
$$;

create or replace function public.recompute_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_att public.attempts;
  v_asig boolean;
  v_resp jsonb; v_eap jsonb; v_dom double precision; v_dep jsonb;
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
    -- práctica asistida con penalización por dependencia observada de la ayuda (migración 59)
    v_dep := public.asistida_dependencia(p_attempt);
    if v_dep is not null and (v_dep ->> 'aplicado')::boolean then
      update public.attempts set score = round(score * (1 - (v_dep ->> 'descuento')::numeric / 100), 2) where id = p_attempt;
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

-- estado para el estudiante (copia de la migración 58) + la dependencia y su regla
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
      'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda),
      'verificacion', jsonb_build_object('tipo', s.verificacion_tipo, 'fecha', s.verificacion_fecha, 'nota', s.verificacion_nota)),
    'dependencia', public.asistida_dependencia(p_attempt),
    'items', (select coalesce(jsonb_agg(public.asistida_estado_item(p_attempt, i.exercise_id, v_propio) order by i.position), '[]'::jsonb)
              from public.activity_items i where i.activity_id = act.id));
end;
$$;

-- Profesor: activar/ajustar la penalización y, si lo pide, recalcular las notas de los intentos existentes
create or replace function public.asistida_dependencia_guardar(p_activity uuid, p_umbral integer, p_descuento integer, p_recalcular boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; r record; n integer := 0;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.assisted_settings where activity_id = p_activity) then raise exception 'Esta práctica no usa el aprendizaje asistido' using errcode = 'P0001'; end if;
  if (p_umbral is not null and p_umbral not between 1 and 100) or p_descuento is null or p_descuento not between 0 and 100 then
    raise exception 'Penalización fuera de los límites' using errcode = '22023'; end if;
  update public.assisted_settings set dependencia_umbral = p_umbral, dependencia_descuento = p_descuento, updated_by = auth.uid(), updated_at = now()
    where activity_id = p_activity;
  if coalesce(p_recalcular, false) then
    for r in select a.id from public.attempts a where a.activity_id = p_activity loop
      perform public.recompute_attempt(r.id);
      n := n + 1;
    end loop;
  end if;
  return jsonb_build_object('config', public.assisted_settings_get(p_activity) -> 'config', 'recalculados', n);
end;
$$;

revoke all on function public.asistida_dependencia(uuid) from public, anon, authenticated;
revoke all on function public.asistida_dependencia_guardar(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.asistida_dependencia_guardar(uuid, integer, integer, boolean) to authenticated;
