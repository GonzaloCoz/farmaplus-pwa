-- ==========================================
-- NORMALIZACIÓN TOTAL (V4 - TOTAL CONSISTENCY)
-- Ejecutar en el Editor SQL de Supabase
-- ==========================================

-- 1. Normalizar sucursales y categorías en tablas principales
UPDATE public.profiles SET branch_name = UPPER(TRIM(branch_name)) WHERE branch_name IS NOT NULL;
UPDATE public.inventories SET branch_name = UPPER(TRIM(branch_name)), category = UPPER(TRIM(COALESCE(category, 'VARIOS')));
UPDATE public.inventory_adjustments SET branch_name = UPPER(TRIM(branch_name)), category = UPPER(TRIM(COALESCE(category, 'VARIOS')));
UPDATE public.inventory_reports SET branch_name = UPPER(TRIM(branch_name)), category = UPPER(TRIM(COALESCE(category, 'VARIOS')));

-- 2. Consolidar metadatos en branch_laboratories con normalización total
DO $$ 
DECLARE
    row_count INTEGER;
BEGIN
    -- A. Creamos el consolidado normalizando TODO
    CREATE TEMP TABLE consolidated_temp AS
    SELECT 
        UPPER(TRIM(branch_name)) as branch_name, 
        UPPER(TRIM(laboratory)) as laboratory, -- También laboratorios a mayúsculas para evitar ALCON vs Alcon
        UPPER(TRIM(COALESCE(category, 'VARIOS'))) as category,
        SUM(total_items) as total_items,
        SUM(controlled_items) as controlled_items,
        SUM(adjusted_items) as adjusted_items,
        SUM(pending_items) as pending_items,
        SUM(total_system_units) as total_system_units,
        SUM(net_units) as net_units,
        SUM(net_value) as net_value,
        SUM(negative_value) as negative_value,
        SUM(positive_value) as positive_value,
        MAX(last_updated) as last_updated
    FROM public.branch_laboratories
    GROUP BY 1, 2, 3;

    -- B. Limpieza total
    DELETE FROM public.branch_laboratories;

    -- C. Re-insertamos
    INSERT INTO public.branch_laboratories (
        branch_name, laboratory, category, total_items, controlled_items, 
        adjusted_items, pending_items, total_system_units, net_units, 
        net_value, negative_value, positive_value, last_updated, status, progress_percentage
    )
    SELECT 
        branch_name, laboratory, category, total_items, controlled_items, 
        adjusted_items, pending_items, total_system_units, net_units, 
        net_value, negative_value, positive_value, last_updated,
        CASE 
            WHEN (total_items > 0 AND (controlled_items + adjusted_items) >= total_items) THEN 'completed'
            WHEN (controlled_items + adjusted_items) > 0 THEN 'in_progress'
            ELSE 'pending'
        END as status,
        CASE 
            WHEN total_items > 0 THEN LEAST(ROUND(((controlled_items + adjusted_items)::numeric / total_items::numeric) * 100, 1), 100)
            ELSE 0 
        END as progress_percentage
    FROM consolidated_temp;

    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Consolidación total completada: % registros procesados.', row_count;

END $$;
