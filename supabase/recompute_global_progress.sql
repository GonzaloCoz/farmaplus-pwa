-- ============================================================
-- SCRIPT: Recalcular Progreso Global (Massive Recompute)
-- Ejecutar en el Editor SQL de Supabase
-- ============================================================
-- Este script sincroniza la tabla de monitoreo (branch_laboratories)
-- con la realidad de los ítems controlados/ajustados (inventories).
-- Útil si después de limpiezas o migraciones los laboratorios
-- aparecen como "Pendientes" pero tienen historia de ajustes.
-- ============================================================

DO $$
DECLARE
    r RECORD;
    v_count_recomputed INT := 0;
    v_start_time TIMESTAMP := clock_timestamp();
BEGIN
    RAISE NOTICE 'Iniciando recalculo masivo de progreso...';

    -- Iteramos por cada laboratorio registrado en la tabla de metadatos
    FOR r IN 
        SELECT DISTINCT branch_name, laboratory 
        FROM public.branch_laboratories
        ORDER BY branch_name, laboratory
    LOOP
        -- Llamamos a la función Ferrari de recomputo para cada par sucursal/lab
        -- Esta función ya maneja la normalización de strings internamente.
        PERFORM public.recompute_lab_progress(r.branch_name, r.laboratory);
        
        v_count_recomputed := v_count_recomputed + 1;
        
        -- Log cada 50 labs para no saturar la consola pero dar feedback
        IF v_count_recomputed % 50 = 0 THEN
            RAISE NOTICE 'Procesados % laboratorios...', v_count_recomputed;
        END IF;
    END LOOP;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'RECALCULO COMPLETADO';
    RAISE NOTICE 'Total laboratorios actualizados: %', v_count_recomputed;
    RAISE NOTICE 'Tiempo de ejecución: %', (clock_timestamp() - v_start_time);
    RAISE NOTICE '================================================';
END $$;

-- VERIFICACIÓN: Ver laboratorios que siguen al 0% pero tienen ítems controlados/ajustados
-- (Si esto devuelve filas, hay algo mal en la lógica de normalización de nombres)
SELECT 
    bl.branch_name, 
    bl.laboratory, 
    bl.progress_percentage,
    (SELECT COUNT(*) FROM public.inventories i 
     WHERE public.normalize_string_sql(i.branch_name) = public.normalize_string_sql(bl.branch_name)
       AND public.normalize_string_sql(i.laboratory) = public.normalize_string_sql(bl.laboratory)
       AND i.status IN ('controlled', 'adjusted')) as actual_controlled_count
FROM public.branch_laboratories bl
WHERE bl.progress_percentage = 0
  AND EXISTS (
      SELECT 1 FROM public.inventories i 
      WHERE public.normalize_string_sql(i.branch_name) = public.normalize_string_sql(bl.branch_name)
        AND public.normalize_string_sql(i.laboratory) = public.normalize_string_sql(bl.laboratory)
        AND i.status IN ('controlled', 'adjusted')
  )
ORDER BY bl.branch_name, bl.laboratory;
