-- ========================================================
-- Migración: Soporte para múltiples IDs de ajuste (Apilamiento)
-- Fecha: 2026-03-13
-- Motor: Ferrari Cyclic Inventory
-- ========================================================

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
      -- "El Snap": Pasar a ajustado y apilar IDs si ya existen (preservando readjustment_reason)
      UPDATE public.inventories
      SET status = 'adjusted',
          updated_at = NOW(),
          -- Apilamiento inteligente de IDs por Faltantes
          adjustment_id_shortage = CASE 
            WHEN quantity < system_quantity AND NULLIF(p_shortage_id, '') IS NOT NULL THEN 
              CASE 
                WHEN NULLIF(adjustment_id_shortage, '') IS NULL THEN p_shortage_id 
                WHEN adjustment_id_shortage ~ ('(^|,)' || p_shortage_id || '($|,)') THEN adjustment_id_shortage -- Evitar duplicados exactos
                ELSE adjustment_id_shortage || ',' || p_shortage_id 
              END
            ELSE adjustment_id_shortage 
          END,
          -- Apilamiento inteligente de IDs por Sobrantes
          adjustment_id_surplus = CASE 
            WHEN quantity > system_quantity AND NULLIF(p_surplus_id, '') IS NOT NULL THEN 
              CASE 
                WHEN NULLIF(adjustment_id_surplus, '') IS NULL THEN p_surplus_id 
                WHEN adjustment_id_surplus ~ ('(^|,)' || p_surplus_id || '($|,)') THEN adjustment_id_surplus -- Evitar duplicados exactos
                ELSE adjustment_id_surplus || ',' || p_surplus_id 
              END
            ELSE adjustment_id_surplus 
          END
      WHERE public.normalize_string_sql(branch_name) = v_branch
        AND public.normalize_string_sql(laboratory) = v_lab
        AND status = 'controlled';
  END IF;

  -- Siempre recalcular progreso para el monitor
  PERFORM public.recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory TO anon, authenticated, service_role;
