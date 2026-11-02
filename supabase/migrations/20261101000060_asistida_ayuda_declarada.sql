-- =============================================================================
-- Práctica asistida: el primer intento hecho con AYUDA DECLARADA vale una fracción (migración 60). Decisión del
-- profesor: un primer intento correcto declarado «consulté ayuda» (p. ej. IA) no debe valer lo mismo que uno autónomo.
--  - assisted_settings.factor_declarada (0–1): multiplica la parte del primer intento (y la corrección que cuenta
--    completa por haber acertado) cuando el estudiante declaró «consulto_ayuda». 1 = sin efecto.
--    Las prácticas existentes conservan 1 hasta que el profesor lo cambie; las nuevas nacen con 0,5.
--  - Transparencia obligatoria: asistida_estado y asistida_credito incluyen el factor para que el estudiante lo vea
--    ANTES de declarar (la interfaz deja de decir que declarar no cambia la nota).
--  - Advertencia documentada: penalizar la declaración puede incentivar declarar «sin ayuda»; la penalización por
--    dependencia observada (migración 59) no depende de la declaración.
-- asistida_credito se copia de la migración 58 y asistida_estado de la 59, con el cambio. Aditiva.
-- =============================================================================

alter table public.assisted_settings add column if not exists factor_declarada numeric(3, 2) not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assisted_settings_factor_declarada_check') then
    alter table public.assisted_settings add constraint assisted_settings_factor_declarada_check check (factor_declarada between 0 and 1);
  end if;
end $$;
alter table public.assisted_settings alter column factor_declarada set default 0.5;

create or replace function public.asistida_credito(p_attempt uuid, p_exercise uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.attempts; s public.assisted_settings; v_tr boolean;
  v_ini numeric := 0; v_ini_credito numeric := 0; v_cor_bruto numeric := 0; v_cor numeric := 0; v_jus numeric := 0; v_tra numeric := 0; v_den numeric; v_final_status text;
  v_ref jsonb; v_hay_ini boolean; v_decl text; v_fd numeric := 1;
begin
  select * into a from public.attempts where id = p_attempt;
  select * into s from public.assisted_settings where activity_id = a.activity_id;
  if s.activity_id is null then return null; end if;
  v_tr := s.transferencia and exists (select 1 from public.assisted_transfer t where t.activity_id = a.activity_id and t.exercise_id = p_exercise);
  select true, coalesce(x.credit, 0), x.declaracion into v_hay_ini, v_ini_credito, v_decl from public.assisted_steps x
    where x.attempt_id = p_attempt and x.exercise_id = p_exercise and x.fase = 'inicial';
  v_hay_ini := coalesce(v_hay_ini, false);
  -- primer intento hecho con ayuda declarada: vale factor_declarada (migración 60)
  if v_decl = 'consulto_ayuda' then v_fd := s.factor_declarada; end if;
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
    'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda, 'factor_declarada', s.factor_declarada),
    'ayuda_declarada', v_decl = 'consulto_ayuda',
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
      'regla', jsonb_build_object('primer_intento', s.nota_primer_intento, 'factor_ayuda', s.factor_ayuda, 'factor_declarada', s.factor_declarada),
      'verificacion', jsonb_build_object('tipo', s.verificacion_tipo, 'fecha', s.verificacion_fecha, 'nota', s.verificacion_nota)),
    'dependencia', public.asistida_dependencia(p_attempt),
    'items', (select coalesce(jsonb_agg(public.asistida_estado_item(p_attempt, i.exercise_id, v_propio) order by i.position), '[]'::jsonb)
              from public.activity_items i where i.activity_id = act.id));
end;
$$;

-- Profesor: valor del primer intento con ayuda declarada y, si lo pide, recálculo de los intentos existentes
create or replace function public.asistida_declarada_guardar(p_activity uuid, p_factor numeric, p_recalcular boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare act public.activities; r record; n integer := 0;
begin
  select * into act from public.activities where id = p_activity;
  if act.id is null or not public.is_class_teacher(act.class_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from public.assisted_settings where activity_id = p_activity) then raise exception 'Esta práctica no usa el aprendizaje asistido' using errcode = 'P0001'; end if;
  if p_factor is null or p_factor < 0 or p_factor > 1 then raise exception 'Valor fuera de los límites' using errcode = '22023'; end if;
  update public.assisted_settings set factor_declarada = round(p_factor, 2), updated_by = auth.uid(), updated_at = now() where activity_id = p_activity;
  if coalesce(p_recalcular, false) then
    for r in select distinct x.attempt_id, x.exercise_id from public.assisted_steps x join public.attempts a on a.id = x.attempt_id where a.activity_id = p_activity loop
      perform public.asistida_actualizar_respuesta(r.attempt_id, r.exercise_id);
      n := n + 1;
    end loop;
  end if;
  return jsonb_build_object('config', public.assisted_settings_get(p_activity) -> 'config', 'recalculados', n);
end;
$$;

revoke all on function public.asistida_credito(uuid, uuid) from public, anon, authenticated;
revoke all on function public.asistida_declarada_guardar(uuid, numeric, boolean) from public, anon;
grant execute on function public.asistida_declarada_guardar(uuid, numeric, boolean) to authenticated;
