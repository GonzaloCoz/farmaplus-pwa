-- ========================================================
-- UPDATE: branch_summaries VIEW (v4 - Case Insensitive & Correct Aggregation)
-- Fecha: 2026-03-05
-- Propósito: Normalizar nombres de sucursales para el JOIN y evitar duplicados
-- ========================================================

DROP VIEW IF EXISTS public.branch_summaries CASCADE;

CREATE OR REPLACE VIEW public.branch_summaries AS
WITH 
branch_level_inv AS (
    -- Métricas de Inventario (Real-Time desde inventories)
    SELECT 
        LOWER(TRIM(i.branch_name)) as branch_key,
        SUM(i.system_quantity) as total_sys_units,
        SUM(i.quantity - i.system_quantity) as total_diff_units,
        SUM((i.quantity - i.system_quantity) * COALESCE(p.cost, 0)) as total_adj_value
    FROM public.inventories i
    LEFT JOIN public.products p ON i.ean = p.ean
    WHERE i.laboratory != '_CONFIG_'
    AND (i.status != 'pending' OR i.quantity != i.system_quantity)
    GROUP BY LOWER(TRIM(i.branch_name))
),
branch_level_labs AS (
    -- Métricas de Laboratorios (Desde maestro branch_laboratories)
    SELECT 
        LOWER(TRIM(branch_name)) as branch_key,
        MAX(branch_name) as display_name, -- Mantenemos el nombre "bonito"
        COUNT(*) FILTER (WHERE status = 'completed' OR progress_percentage >= 100) as controlled_labs_count,
        COUNT(*) FILTER (WHERE (status = 'in_progress' OR progress_percentage > 0) AND progress_percentage < 100) as active_labs_count,
        SUM(controlled_items) as total_controlled_items,
        SUM(total_items) as total_items_sum,
        MAX(last_updated) as updated_at
    FROM public.branch_laboratories
    GROUP BY LOWER(TRIM(branch_name))
)
SELECT 
    bl.display_name as branch_name,
    COALESCE(bi.total_sys_units, 0) as inventory_units,
    COALESCE(bi.total_diff_units, 0) as difference_units,
    COALESCE(bi.total_adj_value, 0) as adjustments_value,
    bl.controlled_labs_count,
    bl.active_labs_count,
    bl.total_controlled_items,
    bl.total_items_sum,
    bl.updated_at
FROM branch_level_labs bl
LEFT JOIN branch_level_inv bi ON bl.branch_key = bi.branch_key;

GRANT SELECT ON public.branch_summaries TO anon, authenticated, service_role;
