-- ========================================================
-- UPDATE: branch_summaries VIEW
-- Fecha: 2026-03-05
-- Propósito: Incluir labs activos y totales de items para progreso real
-- ========================================================

DROP VIEW IF EXISTS public.branch_summaries CASCADE;

CREATE OR REPLACE VIEW public.branch_summaries AS
SELECT 
    branch_name,
    SUM(total_system_units) as inventory_units,
    SUM(net_units) as difference_units,
    SUM(net_value) as adjustments_value,
    -- Labs completamente terminados (100%)
    COUNT(*) FILTER (WHERE status = 'completed' OR progress_percentage >= 100) as controlled_labs_count,
    -- Labs con actividad pero no terminados
    COUNT(*) FILTER (WHERE (status = 'in_progress' OR progress_percentage > 0) AND progress_percentage < 100) as active_labs_count,
    -- Totales de items para progreso ponderado
    SUM(controlled_items) as total_controlled_items,
    SUM(total_items) as total_items_sum,
    MAX(last_updated) as updated_at
FROM public.branch_laboratories
GROUP BY branch_name;

GRANT SELECT ON public.branch_summaries TO anon, authenticated, service_role;
