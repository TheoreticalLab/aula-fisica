-- Migración 110 · Práctica secuencial con aviso de rapidez y mensaje tras responder «Sí» (decisión del profesor, 23-nov-2026).
--
-- El profesor quiere, en una práctica de Física Básica:
--   · Al empezar, la pregunta de la plataforma «¿Usará inteligencia artificial?» (migración 108). Si responde «Sí», un
--     recordatorio de que en realidad no se puede usar. → columna opcional actividad_consultas.mensaje_si, que la
--     pregunta pendiente entrega junto con el texto; el navegador lo muestra después de un «Sí».
--   · Los ejercicios de uno en uno y en orden al azar, sin saltar al siguiente hasta cerrar el actual.
--   · Si resuelve un ejercicio antes de un tiempo umbral según su dificultad (básico 2 min, intermedio 5, desafiante 8),
--     el aviso «Me parece que estás usando asistencia artificial, pero puedes continuar». → tabla practica_secuencial
--     (una fila por práctica) y la función practica_secuencial_config.
-- Alcance honesto: el orden, la secuencia y el aviso son de la interfaz (el tiempo lo mide el navegador desde que el
-- ejercicio aparece). No cambian la calificación, los intentos ni la entrega; el aviso no prueba nada y no se registra
-- como sanción. Aditiva: una columna nueva, una tabla nueva y funciones nuevas o redefinidas con la misma firma.

-- 1. Mensaje tras «Sí»
alter table public.actividad_consultas add column if not exists mensaje_si text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'actividad_consultas_mensaje_si_largo') then
    alter table public.actividad_consultas add constraint actividad_consultas_mensaje_si_largo
      check (mensaje_si is null or char_length(mensaje_si) between 3 and 2000);
  end if;
end $$;

-- Lo que ve el estudiante: la pregunta pendiente de esa actividad (o null). Copia de la migración 108 con mensaje_si.
create or replace function public.actividad_consulta_pendiente(p_activity uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', q.texto, 'mensaje_si', q.mensaje_si)
            from public.actividad_consultas q
           where q.activity_id = p_activity and q.activa and auth.uid() is not null
             and public.actividad_consulta_aplica(q, auth.uid())
             and not exists (select 1 from public.actividad_declaraciones d where d.consulta_id = q.id and d.user_id = auth.uid())
           order by q.created_at limit 1)
$$;

-- 2. Práctica secuencial
create table if not exists public.practica_secuencial (
  activity_id uuid primary key references public.activities (id) on delete restrict,
  aleatorio boolean not null default true,
  umbral_basico_s integer not null default 120 check (umbral_basico_s between 0 and 7200),
  umbral_intermedio_s integer not null default 300 check (umbral_intermedio_s between 0 and 7200),
  umbral_desafiante_s integer not null default 480 check (umbral_desafiante_s between 0 and 7200),
  aviso text not null check (char_length(aviso) between 3 and 1000),
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.practica_secuencial enable row level security;
revoke all on table public.practica_secuencial from public, anon, authenticated;
grant all on table public.practica_secuencial to service_role;

-- Configuración para quien puede ver la práctica: estudiante matriculado (sin baja) o profesor de la sección.
-- Solo prácticas; null si no hay configuración o no le corresponde.
create or replace function public.practica_secuencial_config(p_activity uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object(
                   'aleatorio', s.aleatorio,
                   'umbrales', jsonb_build_object('basico', s.umbral_basico_s, 'intermedio', s.umbral_intermedio_s, 'desafiante', s.umbral_desafiante_s),
                   'aviso', s.aviso)
            from public.practica_secuencial s
            join public.activities a on a.id = s.activity_id and a.mode = 'practice'
           where s.activity_id = p_activity and auth.uid() is not null
             and (public.is_class_teacher(a.class_id)
                  or exists (select 1 from public.enrollments e where e.class_id = a.class_id and e.user_id = auth.uid()
                               and not public.fuera_de_seccion(a.class_id, auth.uid()))))
$$;

do $$ declare f text; begin
  foreach f in array array['actividad_consulta_pendiente(uuid)', 'practica_secuencial_config(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
