-- Pruebas: migración 81 · reutilizar problemas de otras prácticas extraordinarias y límite propio de la generación con IA.
-- Profesor P (secciones S en la asignatura A y S2 en la asignatura B), profesor ajeno Q. Se deshace al final.
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('de810000-0000-4000-8000-000000000001', 'ru1@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reuso","aula_role":"teacher"}', '{}', now(), now()),
  ('de810000-0000-4000-8000-000000000002', 'ru2@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"prof-reuso-otro","aula_role":"teacher"}', '{}', now(), now());
update public.profiles set must_change_password = false, active = true, role = 'teacher' where id::text like 'de810000-%';
insert into public.courses (id, title) values ('de810000-0000-4000-8000-0000000000a0', 'Curso A'), ('de810000-0000-4000-8000-0000000000b0', 'Curso B');
insert into public.classes (id, course_id, name, join_code, created_by) values
  ('de810000-0000-4000-8000-000000000031', 'de810000-0000-4000-8000-0000000000a0', 'S', 'REUSO001', 'de810000-0000-4000-8000-000000000001'),
  ('de810000-0000-4000-8000-000000000032', 'de810000-0000-4000-8000-0000000000b0', 'S2', 'REUSO002', 'de810000-0000-4000-8000-000000000001'),
  ('de810000-0000-4000-8000-000000000033', 'de810000-0000-4000-8000-0000000000b0', 'SQ', 'REUSO003', 'de810000-0000-4000-8000-000000000002');
insert into public.class_teachers (class_id, user_id) values
  ('de810000-0000-4000-8000-000000000031', 'de810000-0000-4000-8000-000000000001'), ('de810000-0000-4000-8000-000000000032', 'de810000-0000-4000-8000-000000000001'),
  ('de810000-0000-4000-8000-000000000033', 'de810000-0000-4000-8000-000000000002') on conflict do nothing;

create temp table ru_t (k text primary key, val uuid);
grant all on ru_t to public;
create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', p_user, true);
  select set_config('request.path', '/rpc/prueba', true);
$$;

-- 1) P crea la práctica X (asignatura A) con un problema de 3 apartados (pesos propios y una figura), e Y (asignatura B)
set local role authenticated;
select pg_temp.como('de810000-0000-4000-8000-000000000001');
do $$ declare x uuid; y uuid; ej uuid; begin
  x := public.pes_crear('de810000-0000-4000-8000-000000000031', jsonb_build_object('titulo', 'PES X', 'cierra_at', now() + interval '10 days'));
  y := public.pes_crear('de810000-0000-4000-8000-000000000032', jsonb_build_object('titulo', 'PES Y', 'cierra_at', now() + interval '10 days'));
  ej := public.pes_ejercicio_redactado(x, '{"titulo":"Ciclista","contexto":"Una ciclista recorre 150 m en 30 s con velocidad constante.","apartados":[
    {"enunciado":"¿Cómo es su aceleración?","formato":"choice","opciones":["Nula","Positiva","Negativa"],"multiple":false,"etapa":"prediccion","peso":0.2,"t_ref_s":120,
     "clave":{"format":"choice","correct":[0],"optionFeedback":{"1":"No acelera.","2":"No frena."}},"rubrica":"","explicacion":"Velocidad constante: aceleración nula."},
    {"enunciado":"Calcule su rapidez.","formato":"numeric","unidad_sugerida":"m/s","etapa":"resolucion","peso":0.5,"t_ref_s":180,
     "clave":{"format":"numeric","value":"5 m/s","relTol":0.02},"rubrica":"","explicacion":"v = d/t = 5 m/s."},
    {"enunciado":"Interprete el resultado.","formato":"open","etapa":"interpretacion","peso":0.3,"t_ref_s":240,"clave":null,
     "rubrica":"Interpreta 5 m recorridos cada segundo y usa unidades.","explicacion":"Cada segundo recorre 5 m."}]}');
  insert into ru_t values ('x', x), ('y', y), ('ej', ej);
end $$;
reset role;
update public.pes_apartados set figura = '{"key":"plano-inclinado"}' where ejercicio_id = (select val from ru_t where k = 'ej') and posicion = 1;

-- 2) Lista y copia: aparece el problema de X en Y; la copia es exacta e independiente
set local role authenticated;
select pg_temp.como('de810000-0000-4000-8000-000000000001');
do $$ declare r record; v uuid; begin
  select * into r from public.pes_reutilizables((select val from ru_t where k = 'y')) where ejercicio_id = (select val from ru_t where k = 'ej');
  if r.ejercicio_id is null then raise exception 'FALLO: el problema de X no aparece para Y'; end if;
  if r.apartados <> 3 or r.formatos <> array['choice', 'numeric', 'open'] or r.ya_en_esta or r.practica_titulo <> 'PES X' then raise exception 'FALLO: datos de la lista: %', row_to_json(r); end if;
  if exists (select 1 from public.pes_reutilizables((select val from ru_t where k = 'x')) where practica_id = (select val from ru_t where k = 'x')) then
    raise exception 'FALLO: la práctica se lista a sí misma';
  end if;
  begin perform public.pes_ejercicio_reutilizar((select val from ru_t where k = 'x'), (select val from ru_t where k = 'ej'));
    raise exception 'FALLO: copió en la misma práctica'; exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if; end;
  v := public.pes_ejercicio_reutilizar((select val from ru_t where k = 'y'), (select val from ru_t where k = 'ej'));
  insert into ru_t values ('copia', v);
  if not (select ya_en_esta from public.pes_reutilizables((select val from ru_t where k = 'y')) where ejercicio_id = (select val from ru_t where k = 'ej')) then
    raise exception 'FALLO: no figura como ya copiado';
  end if;
end $$;
reset role;
do $$ declare o record; c record; begin
  -- apartados, pesos, tiempos, etapas, figura, claves, rúbrica y explicación idénticos
  for o in select a.posicion, a.etapa, a.enunciado, a.formato, a.opciones, a.peso, a.t_ref_s, a.unidad_sugerida, a.figura, k.clave, k.rubrica, k.explicacion
           from public.pes_apartados a join public.pes_claves k on k.apartado_id = a.id where a.ejercicio_id = (select val from ru_t where k = 'ej') loop
    select a.posicion, a.etapa, a.enunciado, a.formato, a.opciones, a.peso, a.t_ref_s, a.unidad_sugerida, a.figura, k.clave, k.rubrica, k.explicacion into c
      from public.pes_apartados a join public.pes_claves k on k.apartado_id = a.id where a.ejercicio_id = (select val from ru_t where k = 'copia') and a.posicion = o.posicion;
    if to_jsonb(o) is distinct from to_jsonb(c) then raise exception 'FALLO: el apartado % no es idéntico: % / %', o.posicion, row_to_json(o), row_to_json(c); end if;
  end loop;
  if (select count(*) from public.pes_apartados where ejercicio_id = (select val from ru_t where k = 'copia')) <> 3 then raise exception 'FALLO: número de apartados'; end if;
  if (select practica_id from public.pes_ejercicios where id = (select val from ru_t where k = 'copia')) <> (select val from ru_t where k = 'y') then raise exception 'FALLO: práctica de la copia'; end if;
  if (select origen_ref from public.pes_ejercicios where id = (select val from ru_t where k = 'copia')) not like 'Reutilizado de «PES X»%' then raise exception 'FALLO: origen'; end if;
  -- independiente: cambiar la copia no toca el original
  update public.pes_apartados set enunciado = 'Cambiado en la copia' where ejercicio_id = (select val from ru_t where k = 'copia') and posicion = 2;
  if (select enunciado from public.pes_apartados where ejercicio_id = (select val from ru_t where k = 'ej') and posicion = 2) <> 'Calcule su rapidez.' then raise exception 'FALLO: la copia no es independiente'; end if;
end $$;

-- 3) Permisos: otro profesor no ve ni copia problemas ajenos; nada se añade a una práctica publicada
set local role authenticated;
select pg_temp.como('de810000-0000-4000-8000-000000000002');
do $$ declare z uuid; begin
  begin perform public.pes_reutilizables((select val from ru_t where k = 'y')); raise exception 'FALLO: Q vio la lista de P'; exception when insufficient_privilege then null; end;
  z := public.pes_crear('de810000-0000-4000-8000-000000000033', jsonb_build_object('titulo', 'PES de Q', 'cierra_at', now() + interval '10 days'));
  insert into ru_t values ('z', z);
  if exists (select 1 from public.pes_reutilizables(z)) then raise exception 'FALLO: Q ve problemas de P'; end if;
  begin perform public.pes_ejercicio_reutilizar(z, (select val from ru_t where k = 'ej')); raise exception 'FALLO: Q copió un problema de P'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.pes_practicas set estado = 'publicada' where id = (select val from ru_t where k = 'y');
set local role authenticated;
select pg_temp.como('de810000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.pes_ejercicio_reutilizar((select val from ru_t where k = 'y'), (select val from ru_t where k = 'ej'));
    raise exception 'FALLO: copió a una práctica publicada';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    if sqlerrm not like '%borrador%' then raise exception 'FALLO: mensaje: %', sqlerrm; end if;
  end;
end $$;
reset role;

-- 4) Generación con IA: límite de salida propio (no el de los chistes) y el presupuesto cuenta las llamadas fallidas
update public.orbe_ia_config set enabled = true, api_real = true, max_output_tokens = 3000, monthly_budget_usd = 1000, daily_max_calls = 1000 where id = 1;   -- holgado: la copia de producción tiene gasto real
do $$ declare r jsonb; begin
  r := public.svc_orbe_ia_reservar_uso('de810000-0000-4000-8000-000000000001', 'generar', null);
  if not (r ->> 'ok')::boolean or (r ->> 'max_tokens')::int <> 12000 then raise exception 'FALLO: límite de generar: %', r; end if;
  if (public.svc_orbe_ia_reservar_uso('de810000-0000-4000-8000-000000000001', 'mensaje', null) ->> 'max_tokens')::int <> 2000 then raise exception 'FALLO: cambió otro propósito'; end if;
  -- gasto del mes en llamadas FALLIDAS (cobradas): también agota el presupuesto
  insert into public.orbe_ia_usage (actor_id, trigger, model, simulated, status, cost_usd, reserved_usd, purpose, created_at)
    values ('de810000-0000-4000-8000-000000000001', 'profesor', 'claude-sonnet-5-5', false, 'error', 2000, 0, 'generar', now());
  if (public.svc_orbe_ia_reservar_uso('de810000-0000-4000-8000-000000000001', 'generar', null) ->> 'motivo') is distinct from 'presupuesto' then
    raise exception 'FALLO: el gasto de llamadas fallidas no cuenta en el presupuesto';
  end if;
end $$;

select 'PRUEBAS DE REUTILIZAR PROBLEMAS PES Y LÍMITE DE LA IA PASARON' as resultado;
rollback;
