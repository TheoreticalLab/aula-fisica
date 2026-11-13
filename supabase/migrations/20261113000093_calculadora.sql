-- =============================================================================
-- Migración 93 · Calculadora científica integrada: permiso por actividad (apagado por defecto).
--
-- La calculadora funciona entera en el navegador (src/lib/calculadora/motor.ts): no hay funciones, tablas ni
-- registros nuevos en el servidor, y el historial no se guarda. Solo hace falta saber si cada actividad la permite.
--
-- Aditiva: una columna con valor por defecto «no». Las actividades existentes, incluidas las programadas, quedan
-- exactamente como estaban (sin calculadora) hasta que el profesor la active en el editor de la actividad.
-- Sin cambios de RLS ni de permisos: activities_select ya deja leer la fila a quien ve la actividad (profesorado de la
-- sección y estudiantes inscritos con la actividad publicada) y activities_write solo al profesorado de la sección.
-- Reversión: supabase/reversion/20261113000093_calculadora_revertir.sql
-- =============================================================================

set local lock_timeout = '5s';

alter table public.activities add column if not exists calculadora boolean not null default false;
comment on column public.activities.calculadora is
  'Calculadora científica integrada permitida durante la actividad (migración 93). Solo presentación: se calcula en el navegador.';
