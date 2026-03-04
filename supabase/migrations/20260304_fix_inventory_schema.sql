-- ========================================================
-- Migración: Corrección de Esquema y Eliminación de Plex ID
-- Fecha: 2026-03-04
-- ========================================================

-- 1. Agregar columnas faltantes a public.inventories para evitar Error 400
-- Estas columnas son requeridas por las consultas del frontend
ALTER TABLE public.inventories 
ADD COLUMN IF NOT EXISTS adjustment_id_shortage TEXT,
ADD COLUMN IF NOT EXISTS adjustment_id_surplus TEXT;

-- 2. Modificar finalize_cyclic_inventory para que p_plex_id sea opcional
-- y no falle si se envía NULL o vacío
CREATE OR REPLACE FUNCTION finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_plex_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
BEGIN
  -- Verificar cuántos ítems hay controlados
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  IF v_controlled_count = 0 THEN
    RAISE EXCEPTION 'No hay artículos controlados para finalizar.';
  END IF;

  -- 1. Registrar evento de auditoría
  -- Si p_plex_id es NULL o vacío, se guarda como NULL
  INSERT INTO public.inventory_adjustments (
      branch_name, laboratory, total_adjustments, net_value, notes, created_by, plex_id
  ) VALUES (
      p_branch_name,
      p_laboratory,
      v_controlled_count,
      0,
      'Cierre de recuento desde app. ' || v_controlled_count || ' artículos ajustados.',
      p_user_id,
      NULLIF(TRIM(p_plex_id), '')
  );

  -- 2. "El Snap": Pasar todo lo controlado a ajustado
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW(),
      adjustment_id_shortage = CASE WHEN quantity < system_quantity THEN 'S' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') ELSE adjustment_id_shortage END,
      adjustment_id_surplus = CASE WHEN quantity > system_quantity THEN 'R' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') ELSE adjustment_id_surplus END
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  -- 3. Recalcular progreso
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
