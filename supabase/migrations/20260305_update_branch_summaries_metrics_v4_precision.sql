-- ========================================================
-- UPDATE: branch_summaries VIEW (v6 - PRECISION PROGRESS)
-- Fecha: 2026-03-05
-- Propósito: Calcular avance ponderado por laboratorio y rubro
-- ========================================================

DROP VIEW IF EXISTS public.branch_summaries CASCADE;

CREATE OR REPLACE VIEW public.branch_summaries AS
WITH 
branch_inv_metrics AS (
    -- 1. Métricas de Inventario (Real-Time Puro desde inventories)
    SELECT 
        LOWER(TRIM(i.branch_name)) as branch_key,
        SUM(i.quantity) as inventory_units,
        SUM(i.quantity - i.system_quantity) as total_diff_units,
        SUM((i.quantity - i.system_quantity) * COALESCE(p.cost, 0)) as total_adj_value,
        COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) as items_controlled_live,
        COUNT(*) as total_items_in_inv
    FROM public.inventories i
    LEFT JOIN public.products p ON i.ean = p.ean
    WHERE i.laboratory != '_CONFIG_'
    GROUP BY LOWER(TRIM(i.branch_name))
),
lab_level_progress AS (
    -- 2. Progreso promedio por Laboratorio (Ponderando sus rubros/categorías)
    SELECT 
        LOWER(TRIM(branch_name)) as branch_key,
        laboratory,
        AVG(progress_percentage) as lab_avg_progress
    FROM public.branch_laboratories
    GROUP BY LOWER(TRIM(branch_name)), laboratory
),
branch_lab_metrics AS (
    -- 3. Métricas de Laboratorios del Maestro (Asignaciones)
    SELECT 
        LOWER(TRIM(bl.branch_name)) as branch_key,
        MAX(bl.branch_name) as display_name,
        COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
        COUNT(DISTINCT bl.laboratory) FILTER (WHERE (bl.status = 'in_progress' OR bl.progress_percentage > 0) AND bl.progress_percentage < 100) as active_labs_count,
        SUM(COALESCE(bl.total_items, 0)) as total_items_master,
        -- Suma de avances ponderados (100 = 1 lab completo)
        (SELECT SUM(lp.lab_avg_progress) FROM lab_level_progress lp WHERE lp.branch_key = LOWER(TRIM(bl.branch_name))) as weighted_progress_sum,
        MAX(bl.last_updated) as updated_at
    FROM public.branch_laboratories bl
    GROUP BY LOWER(TRIM(bl.branch_name))
)
SELECT 
    COALESCE(lm.display_name, im.branch_key) as branch_name,
    COALESCE(im.inventory_units, 0) as inventory_units,
    COALESCE(im.total_diff_units, 0) as difference_units,
    COALESCE(im.total_adj_value, 0) as adjustments_value,
    COALESCE(lm.controlled_labs_count, 0) as controlled_labs_count,
    COALESCE(lm.active_labs_count, 0) as active_labs_count,
    COALESCE(im.items_controlled_live, 0) as total_controlled_items,
    COALESCE(NULLIF(lm.total_items_master, 0), im.total_items_in_inv, 0) as total_items_sum,
    COALESCE(lm.weighted_progress_sum, 0) as weighted_progress_sum,
    lm.updated_at
FROM branch_lab_metrics lm
FULL OUTER JOIN branch_inv_metrics im ON lm.branch_key = im.branch_key;

GRANT SELECT ON public.branch_summaries TO anon, authenticated, service_role;
