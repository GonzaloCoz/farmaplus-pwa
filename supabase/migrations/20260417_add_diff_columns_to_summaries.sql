-- ========================================================
-- UPDATE: branch_summaries VIEW (Añadiendo faltantes y sobrantes)
-- Fecha: 2026-04-17
-- Propósito: Actualizar la vista para que incluya las diferencias 
-- separadas sin romper la estructura existente.
-- ========================================================

DROP VIEW IF EXISTS public.branch_summaries CASCADE;

CREATE OR REPLACE VIEW public.branch_summaries AS
WITH 
branch_inv_metrics AS (
    -- 1. Métricas de Inventario (Real-Time)
    SELECT 
        LOWER(TRIM(i.branch_name)) as branch_key,
        SUM(i.quantity) as inventory_units,
        SUM(i.quantity - i.system_quantity) as total_diff_units,
        SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as positive_diff_units,
        SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN ABS(i.quantity - i.system_quantity) ELSE 0 END) as negative_diff_units,
        SUM((i.quantity - i.system_quantity) * COALESCE(p.cost, 0)) as total_adj_value,
        COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) as items_controlled_live,
        COUNT(*) as total_items_in_inv
    FROM public.inventories i
    LEFT JOIN public.products p ON i.ean = p.ean
    WHERE i.laboratory != '_CONFIG_'
    GROUP BY LOWER(TRIM(i.branch_name))
),
lab_averages AS (
    -- 2. Progreso promedio por Laboratorio
    SELECT 
        LOWER(TRIM(branch_name)) as branch_key,
        laboratory,
        AVG(progress_percentage) as lab_avg_progress
    FROM public.branch_laboratories
    GROUP BY LOWER(TRIM(branch_name)), laboratory
),
branch_weighted_stats AS (
    -- 3. Suma de avances ya agrupada por sucursal
    SELECT 
        branch_key,
        SUM(lab_avg_progress) as weighted_progress_sum
    FROM lab_averages
    GROUP BY branch_key
),
branch_lab_metrics AS (
    -- 4. Métricas de Laboratorios del Maestro
    SELECT 
        LOWER(TRIM(bl.branch_name)) as branch_key,
        MAX(bl.branch_name) as display_name,
        COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
        COUNT(DISTINCT bl.laboratory) FILTER (WHERE (bl.status = 'in_progress' OR bl.progress_percentage > 0) AND bl.progress_percentage < 100) as active_labs_count,
        COUNT(DISTINCT bl.laboratory) as total_labs_count,
        SUM(COALESCE(bl.total_items, 0)) as total_items_master,
        MAX(bl.last_updated) as updated_at
    FROM public.branch_laboratories bl
    GROUP BY LOWER(TRIM(bl.branch_name))
)
SELECT 
    bl.display_name as branch_name,
    COALESCE(im.inventory_units, 0) as inventory_units,
    COALESCE(im.total_diff_units, 0) as difference_units,
    COALESCE(im.positive_diff_units, 0) as positive_diff_units,
    COALESCE(im.negative_diff_units, 0) as negative_diff_units,
    COALESCE(im.total_adj_value, 0) as adjustments_value,
    COALESCE(bl.controlled_labs_count, 0) as controlled_labs_count,
    COALESCE(bl.active_labs_count, 0) as active_labs_count,
    COALESCE(bl.total_labs_count, 0) as total_labs_count,
    COALESCE(im.items_controlled_live, 0) as total_controlled_items,
    COALESCE(NULLIF(bl.total_items_master, 0), im.total_items_in_inv, 0) as total_items_sum,
    COALESCE(ws.weighted_progress_sum, 0) as weighted_progress_sum,
    bl.updated_at
FROM branch_lab_metrics bl
LEFT JOIN branch_inv_metrics im ON bl.branch_key = im.branch_key
LEFT JOIN branch_weighted_stats ws ON bl.branch_key = ws.branch_key;

GRANT SELECT ON public.branch_summaries TO anon, authenticated, service_role;
