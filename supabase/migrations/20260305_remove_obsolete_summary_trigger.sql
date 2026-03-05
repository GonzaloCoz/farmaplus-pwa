-- CLEANUP: Eliminar disparador obsoleto que bloquea el reinicio de laboratorios
-- Fecha: 2026-03-05
-- Propósito: Desactivar la sincronización antigua con branch_summaries 
--            ya que ahora es una VISTA (no se puede insertar en ella).

DO $$
BEGIN
    -- 1. Eliminar el trigger de la tabla branch_laboratories
    DROP TRIGGER IF EXISTS tr_refresh_branch_summary ON public.branch_laboratories;
    
    -- 2. Eliminar la función asociada (opcional, por limpieza)
    DROP FUNCTION IF EXISTS refresh_branch_summary();
    
    RAISE NOTICE 'Disparador tr_refresh_branch_summary eliminado. El reinicio de labs debería funcionar ahora.';
END $$;
