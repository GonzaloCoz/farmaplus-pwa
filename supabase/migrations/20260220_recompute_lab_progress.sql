-- ==========================================
-- RPC: Recomputar progreso desde inventarios (fuente de verdad)
-- Evita el 100% falso y ahora que los pendientes se conservan,
-- usa el TOTAL REAL de inventarios como denominador
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

  -- 2. Contar TODOS los items del laboratorio (incluyendo pendientes) -> denominador real
  --    Ahora que no se borran los pendientes, este es el total correcto.
  SELECT COUNT(*) INTO v_total_in_inventories
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory);

  v_total_denominator := GREATEST(v_total_in_inventories, 1);

  -- 3. Calcular progreso real (nunca 100% falso)
  v_progress := CASE
    WHEN v_total_denominator > 0 THEN LEAST(100, ROUND((v_processed::NUMERIC / v_total_denominator) * 100, 1))
    ELSE 0
  END;

  -- 4. Status: completed solo si progreso es 100% real
  v_status := CASE
    WHEN v_progress >= 100 THEN 'completed'
    WHEN v_progress > 0 THEN 'in_progress'
    ELSE 'pending'
  END;

  -- 5. Actualizar progress_percentage, status y total_items en branch_laboratories
  UPDATE public.branch_laboratories
  SET
    total_items = v_total_in_inventories,
    progress_percentage = v_progress,
    status = v_status
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recompute_lab_progress TO anon, authenticated;

COMMENT ON FUNCTION recompute_lab_progress(TEXT, TEXT) IS 
  'Recalcula progress_percentage desde inventarios (fuente de verdad). Denominador = total de items en inventarios incluyendo pendientes.';
