
-- Migration: Enhanced Recompute Lab Progress (FINAL - CATEGORY & JOIN SUPPORT)
-- Date: 2026-03-11
-- Purpose: Include negative/positive units and values in the recomputation logic joining with products

CREATE OR REPLACE FUNCTION recompute_lab_progress(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_total_global INTEGER;
  v_processed_global INTEGER;
  v_progress_global NUMERIC;
  v_rec RECORD;
BEGIN
  -- 1. Calcular progreso GLOBAL del laboratorio para mantener consistencia UI
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END)
  INTO v_total_global, v_processed_global
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory);

  v_progress_global := CASE 
    WHEN v_total_global > 0 THEN LEAST(100, ROUND((v_processed_global::NUMERIC / v_total_global) * 100, 1))
    ELSE 0
  END;

  -- 2. Iterar por cada categoría y actualizar sus stats específicos, pero con el progreso global
  FOR v_rec IN (SELECT category FROM public.branch_laboratories WHERE branch_name ILIKE TRIM(p_branch_name) AND laboratory ILIKE TRIM(p_laboratory)) LOOP
    
    UPDATE public.branch_laboratories bl
    SET
      total_items = s.total,
      controlled_items = s.processed,
      progress_percentage = v_progress_global, -- PROGRESO GLOBAL COMPARTIDO
      status = CASE 
        WHEN v_progress_global >= 100 THEN 'completed'
        WHEN v_progress_global > 0 THEN 'in_progress'
        ELSE 'pending'
      END,
      negative_units = s.neg_units,
      positive_units = s.pos_units,
      negative_value = s.neg_val,
      positive_value = s.pos_val,
      net_units = s.neg_units + s.pos_units,
      net_value = s.neg_val + s.pos_val
    FROM (
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END) as processed,
        SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as neg_units,
        SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as pos_units,
        SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as neg_val,
        SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as pos_val
      FROM public.inventories i
      LEFT JOIN public.products p ON i.ean = p.ean
      WHERE i.branch_name ILIKE TRIM(p_branch_name) 
        AND i.laboratory ILIKE TRIM(p_laboratory)
        AND (
            i.category = v_rec.category 
            OR (v_rec.category = 'VARIOS' AND (i.category IS NULL OR i.category = ''))
            OR (v_rec.category = 'Varios' AND (i.category IS NULL OR i.category = ''))
        )
    ) s
    WHERE bl.branch_name ILIKE TRIM(p_branch_name)
      AND bl.laboratory ILIKE TRIM(p_laboratory)
      AND bl.category = v_rec.category;
      
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
