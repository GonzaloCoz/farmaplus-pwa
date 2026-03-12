-- ========================================================
-- Migración: Fix `inventory_adjustments` columns and RPC
-- Fecha: 2026-03-12
-- ========================================================

-- Limpiamos cualquier versión previa conflictiva
DROP FUNCTION IF EXISTS public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_shortage_id TEXT,
  p_surplus_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
  v_branch TEXT := public.normalize_string_sql(p_branch_name);
  v_lab TEXT := public.normalize_string_sql(p_laboratory);
BEGIN
  -- Contar controlados esperando cierre
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE public.normalize_string_sql(branch_name) = v_branch
    AND public.normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  -- Si hay algo para ajustar, lo procesamos
  IF v_controlled_count > 0 THEN
      -- "El Snap": Pasar a ajustado y guardar IDs (preservando readjustment_reason)
      UPDATE public.inventories
      SET status = 'adjusted',
          updated_at = NOW(),
          adjustment_id_shortage = CASE WHEN quantity < system_quantity THEN p_shortage_id ELSE adjustment_id_shortage END,
          adjustment_id_surplus = CASE WHEN quantity > system_quantity THEN p_surplus_id ELSE adjustment_id_surplus END
          -- readjustment_reason y was_readjusted ya están en la fila, no se borran ni entran en conflicto.
      WHERE public.normalize_string_sql(branch_name) = v_branch
        AND public.normalize_string_sql(laboratory) = v_lab
        AND status = 'controlled';
  END IF;

  -- Siempre recalcular progreso para el monitor
  PERFORM public.recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory TO anon, authenticated, service_role;
