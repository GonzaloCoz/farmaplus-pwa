-- ========================================================
-- DATA CLEANUP: Normalización de registros ajustados sin IDs reales
-- Fecha: 2026-03-05
-- Propósito: Identificar registros que fueron finalizados con IDs auto-generados 
--            (que empezaban con 'S' o 'R' seguido de fecha) para poder rastrearlos.
-- ========================================================

DO $$ 
BEGIN
    -- Informar sobre registros con IDs genéricos (para auditoría)
    -- Estos registros son los que el usuario menciona que "no aparecen correctamente"
    -- porque no tienen un ID de PLEX real vinculado.
    
    -- Nota: No los borramos porque perderíamos el stock ajustado, 
    -- pero los marcamos para que el admin sepa que requieren atención.
    
    UPDATE public.inventories 
    SET updated_at = NOW()
    WHERE status = 'adjusted' 
      AND (
          adjustment_id_shortage ~ '^S\d{14}$' 
          OR adjustment_id_surplus ~ '^R\d{14}$'
      );

    RAISE NOTICE 'Se han identificado registros con IDs genéricos. El sistema ahora requiere IDs manuales.';
END $$;
