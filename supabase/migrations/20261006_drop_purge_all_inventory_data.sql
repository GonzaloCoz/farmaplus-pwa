-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD: ELIMINACIÓN DE RPC DESTRUCTIVO
-- Descripción: Elimina la definición de purge_all_inventory_data() de la base de datos.
-- NOTA CRÍTICA: DROP FUNCTION solo borra la función del catálogo de PostgreSQL.
--               NO ejecuta la función ni toca, modifica o elimina ningún dato existente.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.purge_all_inventory_data();
