-- ==========================================
-- RPC: Recomputar progreso desde inventarios (fuente de verdad)
-- Evita el 100% falso cuando hay pendientes que fueron descartados al finalizar
-- ==========================================

CREATE OR REPLACE FUNCTION recompute_lab_progress(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_total_in_inventories INTEGER;
  v_processed INTEGER;
  v_total_denominator INTEGER;
  v_progress NUMERIC;
  v_status TEXT;
BEGIN
  -- 1. Contar items procesados (controlled + adjusted) en inventories
  SELECT COUNT(*) INTO v_processed
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status IN ('controlled', 'adjusted');

  -- 2. Obtener el denominador: correctProgressAfterFinalize guarda el mismo masterTotal en todas las filas
  SELECT COALESCE(MAX(total_items), 0) INTO v_total_denominator
  FROM public.branch_laboratories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory);

  -- 3. Si no hay filas en branch_laboratories, usar count de inventories
  IF v_total_denominator = 0 THEN
    SELECT COUNT(*) INTO v_total_in_inventories
    FROM public.inventories
    WHERE branch_name ILIKE TRIM(p_branch_name)
      AND laboratory ILIKE TRIM(p_laboratory);
    v_total_denominator := GREATEST(v_total_in_inventories, 1);
  END IF;

  -- 4. Calcular progreso real (nunca 100% falso)
  v_progress := CASE
    WHEN v_total_denominator > 0 THEN LEAST(100, ROUND((v_processed::NUMERIC / v_total_denominator) * 100, 1))
    ELSE 0
  END;

  -- 5. Status: completed solo si progreso es 100% real
  v_status := CASE
    WHEN v_progress >= 100 THEN 'completed'
    WHEN v_progress > 0 THEN 'in_progress'
    ELSE 'pending'
  END;

  -- 6. Actualizar solo progress_percentage y status (total_items lo gestiona la app)
  UPDATE public.branch_laboratories
  SET
    progress_percentage = v_progress,
    status = v_status
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario para documentación
COMMENT ON FUNCTION recompute_lab_progress(TEXT, TEXT) IS 
  'Recalcula progress_percentage desde inventarios. Evita 100% falso cuando hay pendientes descartados al finalizar.';
