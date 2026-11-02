-- =============================================================================
-- Práctica asistida: la respuesta corregida CON AYUDA no puede valer lo mismo que acertar solo (migración 58).
--
-- Hasta ahora (migración 38), por ejercicio: primer intento 20 % por PARTICIPAR (aunque estuviera mal) + corrección
-- 30 % completa si quedaba bien + explicación 20 % (+ transferencia). Quien fallaba, consultaba y corregía sacaba 100 %.
-- Nuevo, por práctica:
--  - nota_primer_intento: 'participacion' (como antes) o 'acierto' (cuenta el crédito real del primer intento;
--    «no sé resolverlo» = 0)
--  - factor_ayuda (0–1): si el primer intento NO fue correcto, la corrección vale factor × su crédito; si el primer
--    intento ya era correcto, la corrección cuenta completa.
-- La declaración de uso de IA sigue SIN intervenir: el descuento se aplica a toda corrección tras un primer intento
-- fallido (si dependiera de declarar, se castigaría la honestidad).
-- Las prácticas existentes conservan la regla anterior hasta que el profesor la cambie; las nuevas nacen con
-- 'acierto' y 0,5. asistida_nota_guardar cambia la regla y, si se pide, RECALCULA los intentos existentes (respeta
-- las calificaciones manuales, que siempre prevalecen).
-- Aditiva: dos columnas con valor por defecto y funciones (asistida_credito se copia de la 38 con el cambio).
-- =============================================================================

alter table public.assisted_settings add column if not exists nota_primer_intento text not null default 'participacion';
alter table public.assisted_settings add column if not exists factor_ayuda numeric(3, 2) not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assisted_settings_nota_primer_intento_check') then
    alter table public.assisted_settings add constraint assisted_settings_nota_primer_intento_check check (nota_primer_intento in ('participacion', 'acierto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assisted_settings_factor_ayuda_check') then
    alter table public.assisted_settings add constraint assisted_settings_factor_ayuda_check check (factor_ayuda between 0 and 1);
  end if;
end $$;
-- las prácticas asistidas NUEVAS nacen con la regla corregida (las existentes ya tienen su valor)
alter table public.assisted_settings alter column nota_primer_intento set default 'acierto';
alter table public.assisted_settings alter column factor_ayuda set default 0.5;

create or replace function public.asistida_credito(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.attempts; s public.assisted_settings; v_tr boolean;
  v_ini numeric := 0; v_ini_credito numeric := 0; v_cor_bruto numeric := 0; v_cor numeric := 0; v_jus numeric := 0; v_tra numeric := 0; v_den numeric; v_final_status text;
  v_ref jsonb; v_hay_ini boolean;
begin
  select * into a from public.attempts where id = p_attempt;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  if s.activity_id is null then return null; end if;
  v_tr := s.transferencia and exists (select 1 from public.assisted_transfer t where t.activity_id = a.activity_id and t.exercise_id = p_exercise);
  select true, coalesce(x.credit, 0) into v_hay_ini, v_ini_credito from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial';
  v_hay_ini := coalesce(v_hay_ini, false);
  v_ini := case when not v_hay_ini then 0 when s.nota_primer_intento = 'acierto' then v_ini_credito else 1 end;
  select coalesce(x.credit, 0), x.status into v_cor_bruto, v_final_status from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'corregida' order by x.version desc limit 1;
  v_cor_bruto := coalesce(v_cor_bruto, 0);
  -- con la regla nueva: acertar solo vale la corrección completa; corregir con ayuda tras fallar, una fracción
  v_cor := case when s.nota_primer_intento = 'acierto' and v_ini_credito >= 1 then 1
                when s.nota_primer_intento = 'acierto' then s.factor_ayuda * v_cor_bruto
                else s.factor_ayuda * v_cor_bruto end;
  -- (con 'participacion' y factor 1 queda exactamente como en la migración 38)
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
    'inicial', v_ini, 'correccion', v_cor, 'correccion_bruta', v_cor_bruto, 'justificacion', v_jus, 'transferencia', case when v_tr then v_tra end,
    'pesos', jsonb_build_object('inicial', s.peso_inicial, 'correccion', s.peso_correccion, 'justificacion', s.peso_justificacion,
                                'transferencia', case when v_tr then s.peso_transferencia else 0 end),
    'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda),
    'estado_final', v_final_status);
end;
$$;

-- Profesor: cambia la regla de nota de SU práctica asistida y, si lo pide, recalcula los intentos que ya existen
create or replace function public.asistida_nota_guardar(p_activity uuid, p_primer_intento text, p_factor_ayuda numeric, p_recalcular boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; r record; n integer := 0;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.assisted_settings where activity_id = p_activity) then raise exception 'Esta práctica no usa el aprendizaje asistido' using errcode = 'P0001'; end if;
  if p_primer_intento not in ('participacion', 'acierto') or p_factor_ayuda is null or p_factor_ayuda < 0 or p_factor_ayuda > 1 then
    raise exception 'Regla de nota fuera de los límites' using errcode = '22023'; end if;
  update public.assisted_settings set nota_primer_intento = p_primer_intento, factor_ayuda = round(p_factor_ayuda, 2), updated_by = auth.uid(), updated_at = now()
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

-- estado para el estudiante (copia de la migración 38) + la regla de nota en «config», para verla ANTES de empezar
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
    'items', (select coalesce(jsonb_agg(public.asistida_estado_item(p_attempt, i.exercise_id, v_propio) order by i.position), '[]'::jsonb)
              from public.activity_items i where i.activity_id = act.id));
end;
$$;

revoke all on function public.asistida_credito(uuid, uuid) from public, anon, authenticated;
revoke all on function public.asistida_nota_guardar(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.asistida_nota_guardar(uuid, text, numeric, boolean) to authenticated;
