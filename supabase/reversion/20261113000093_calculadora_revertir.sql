-- =============================================================================
-- REVERSIÓN de la migración 93 (calculadora científica integrada). La migración solo añadió una columna booleana de
-- configuración en activities; quitarla solo pierde qué actividades tenían la calculadora activada (ningún dato de
-- estudiantes). El navegador trata la columna ausente como «sin calculadora», así que el aula sigue funcionando.
-- Se aplica como una migración nueva (copiándola a supabase/migrations con una marca de tiempo mayor) y, como toda
-- migración, con la aprobación del administrador.
-- =============================================================================

-- @destructivo-autorizado: reversión de una columna de configuración añadida por la migración 93
alter table public.activities drop column if exists calculadora;
