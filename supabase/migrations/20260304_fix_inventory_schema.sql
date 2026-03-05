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
  p_shortage_id TEXT,
  p_surplus_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
BEGIN
  -- 1. Verificar cuántos ítems hay controlados
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  IF v_controlled_count = 0 THEN
    RAISE EXCEPTION 'No hay artículos controlados para finalizar.';
  END IF;

  -- 2. VALIDACIÓN ESTRICTA (Protección de Hierro)
  -- Si hay faltantes, el ID de faltantes es obligatorio
  IF EXISTS (
    SELECT 1 FROM public.inventories 
    WHERE branch_name ILIKE TRIM(p_branch_name) 
      AND laboratory ILIKE TRIM(p_laboratory) 
      AND status = 'controlled' 
      AND quantity < system_quantity
  ) AND NULLIF(TRIM(p_shortage_id), '') IS NULL THEN
    RAISE EXCEPTION 'ERROR: El ID de ajuste para FALTANTES es obligatorio para procesar el ajuste.';
  END IF;

  -- Si hay sobrantes, el ID de sobrantes es obligatorio
  IF EXISTS (
    SELECT 1 FROM public.inventories 
    WHERE branch_name ILIKE TRIM(p_branch_name) 
      AND laboratory ILIKE TRIM(p_laboratory) 
      AND status = 'controlled' 
      AND quantity > system_quantity
  ) AND NULLIF(TRIM(p_surplus_id), '') IS NULL THEN
    RAISE EXCEPTION 'ERROR: El ID de ajuste para SOBRANTES es obligatorio para procesar el ajuste.';
  END IF;

  -- 3. Registrar evento de auditoría
  -- Usamos el p_shortage_id o p_surplus_id como identificador principal del ajuste
  INSERT INTO public.inventory_adjustments (
      branch_name, laboratory, total_adjustments, net_value, notes, created_by, plex_id
  ) VALUES (
      p_branch_name,
      p_laboratory,
      v_controlled_count,
      0,
      'Cierre de recuento desde app. ' || v_controlled_count || ' artículos ajustados.',
      p_user_id,
      COALESCE(NULLIF(TRIM(p_shortage_id), ''), NULLIF(TRIM(p_surplus_id), ''))
  );

  -- 4. "El Snap": Pasar todo lo controlado a ajustado con sus IDs REALES
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW(),
      adjustment_id_shortage = CASE WHEN quantity < system_quantity THEN NULLIF(TRIM(p_shortage_id), '') ELSE adjustment_id_shortage END,
      adjustment_id_surplus = CASE WHEN quantity > system_quantity THEN NULLIF(TRIM(p_surplus_id), '') ELSE adjustment_id_surplus END
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  -- 5. Recalcular progreso
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
