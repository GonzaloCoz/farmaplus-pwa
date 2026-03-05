-- ========================================================
-- FIX: finalize_cyclic_inventory RPC (Robust Version)
-- Fecha: 2026-03-05
-- Propósito: Sincronizar parámetros con el frontend, evitar errores 42725 
--            (duplicados) y permitir finalización con ajuste en 0 sin errores.
-- ========================================================

-- 1. Limpiamos cualquier rastro de versiones con distintas firmas
DROP FUNCTION IF EXISTS public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, TEXT, UUID);

-- 2. Versión Ultra-Robusta (Sin excepciones para ajustes en 0)
CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_shortage_id TEXT,
  p_surplus_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
  v_user_name TEXT;
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- Obtener nombre del usuario
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;

  -- Contar controlados esperando cierre
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  -- Si hay algo para ajustar, lo procesamos
  IF v_controlled_count > 0 THEN
      -- Registrar auditoría
      INSERT INTO public.inventory_adjustments (
          branch_name, laboratory, total_adjustments, net_value, notes, created_by, 
          adjustment_id_shortage, adjustment_id_surplus
      ) VALUES (
          p_branch_name, p_laboratory, v_controlled_count, 0, 
          'Cierre de recuento. Usuario: ' || COALESCE(v_user_name, 'Desconocido'),
          p_user_id, p_shortage_id, p_surplus_id
      );

      -- "El Snap": Pasar a ajustado y guardar IDs
      UPDATE public.inventories
      SET status = 'adjusted',
          updated_at = NOW(),
          adjustment_id_shortage = CASE WHEN quantity < system_quantity THEN p_shortage_id ELSE adjustment_id_shortage END,
          adjustment_id_surplus = CASE WHEN quantity > system_quantity THEN p_surplus_id ELSE adjustment_id_surplus END
      WHERE normalize_string_sql(branch_name) = v_branch
        AND normalize_string_sql(laboratory) = v_lab
        AND status = 'controlled';
  END IF;

  -- Siempre recalcular progreso para el monitor
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory TO anon, authenticated, service_role;
