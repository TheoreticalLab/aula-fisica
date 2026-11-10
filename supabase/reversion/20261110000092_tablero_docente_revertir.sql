-- =============================================================================
-- REVERSIÓN de la migración 92 (centro de mando del profesor). La migración solo añadió dos funciones de lectura:
-- no creó tablas ni columnas ni tocó datos, así que revertirla no pierde nada.
-- Se eliminan las funciones (no basta con retirar el permiso): el panel docente vuelve a su modo anterior cuando la
-- función NO EXISTE; con la función presente pero sin permiso mostraría «Sin conexión con el servidor».
-- Se aplica como una migración nueva (copiándola a supabase/migrations con una marca de tiempo mayor) y, como toda
-- migración, con la aprobación del administrador.
-- =============================================================================

drop function if exists public.tablero_docente();
drop function if exists public.tablero_eventos(integer);

notify pgrst, 'reload schema';
