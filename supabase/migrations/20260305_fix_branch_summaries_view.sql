-- ========================================================
-- FIX: Reemplazar tabla branch_summaries por una VISTA
-- Fecha: 2026-03-05
-- Propósito: Garantizar datos en tiempo real para el Monitor de Sucursales
-- ========================================================

-- 1. Eliminar la tabla existente (y sus datos huérfanos si los hay)
DROP TABLE IF EXISTS public.branch_summaries CASCADE;

-- 2. Crear la VISTA de resumen por sucursal
-- Agrupa los datos de branch_laboratories (que es actualizada por el servicio al guardar)
CREATE OR REPLACE VIEW public.branch_summaries AS
SELECT 
    branch_name,
    SUM(total_system_units) as inventory_units,
    SUM(net_units) as difference_units,
    SUM(net_value) as adjustments_value,
    COUNT(*) FILTER (WHERE status = 'completed' OR progress_percentage >= 100) as controlled_labs_count,
    MAX(last_updated) as updated_at
FROM public.branch_laboratories
GROUP BY branch_name;

-- 3. Otorgar permisos de lectura sobre la vista
GRANT SELECT ON public.branch_summaries TO anon, authenticated, service_role;

COMMENT ON VIEW public.branch_summaries IS 'Vista en tiempo real para el Monitor de Sucursales, agregando datos de branch_laboratories.';
