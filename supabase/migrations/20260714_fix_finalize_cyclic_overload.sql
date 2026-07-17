-- Migration: Fix finalize_cyclic_inventory RPC mismatch & add overload support
-- Date: 2026-07-14
-- Purpose: Support both old (shortage/surplus) and new (plex_id/round) signatures, and fix plex_id assignment.

-- 1. Redefinir la firma nueva (5 argumentos con p_round) para procesar y guardar el plex_id
CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT, 
  p_laboratory TEXT, 
  p_plex_id TEXT, 
  p_user_id UUID, 
  p_round INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
  v_shortage_id TEXT;
  v_surplus_id TEXT;
BEGIN
  -- Extraer v_shortage_id y v_surplus_id desde p_plex_id
  IF p_plex_id LIKE '%,%' THEN
    v_shortage_id := TRIM(split_part(p_plex_id, ',', 1));
    v_surplus_id := TRIM(split_part(p_plex_id, ',', 2));
  ELSE
    v_shortage_id := TRIM(p_plex_id);
    v_surplus_id := TRIM(p_plex_id);
  END IF;

  -- 1. Actualizar estado y asignar IDs de ajuste correspondientes en inventories
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW(),
      adjustment_id_shortage = CASE 
        WHEN quantity < system_quantity AND NULLIF(v_shortage_id, '') IS NOT NULL THEN 
          CASE 
            WHEN NULLIF(adjustment_id_shortage, '') IS NULL THEN v_shortage_id 
            WHEN adjustment_id_shortage ~ ('(^|,)' || v_shortage_id || '($|,)') THEN adjustment_id_shortage
            ELSE adjustment_id_shortage || ',' || v_shortage_id 
          END
        ELSE adjustment_id_shortage 
      END,
      adjustment_id_surplus = CASE 
        WHEN quantity > system_quantity AND NULLIF(v_surplus_id, '') IS NOT NULL THEN 
          CASE 
            WHEN NULLIF(adjustment_id_surplus, '') IS NULL THEN v_surplus_id 
            WHEN adjustment_id_surplus ~ ('(^|,)' || v_surplus_id || '($|,)') THEN adjustment_id_surplus
            ELSE adjustment_id_surplus || ',' || v_surplus_id 
          END
        ELSE adjustment_id_surplus 
      END
  WHERE branch_name = v_branch 
    AND laboratory = v_lab 
    AND status = 'controlled' 
    AND round = p_round;

  -- 2. Recalcular progreso para la ronda específica
  PERFORM public.recompute_lab_progress(p_branch_name, p_laboratory, p_round);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear la sobrecarga para compatibilidad retroactiva (firma vieja de 5 argumentos)
CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_shortage_id TEXT,
  p_surplus_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
  v_plex_id TEXT;
  v_category TEXT;
  v_round INTEGER;
BEGIN
  -- Construir plex_id combinando los IDs
  v_plex_id := CASE 
    WHEN NULLIF(p_shortage_id, '') IS NOT NULL AND NULLIF(p_surplus_id, '') IS NOT NULL THEN TRIM(p_shortage_id) || ', ' || TRIM(p_surplus_id)
    ELSE COALESCE(NULLIF(TRIM(p_shortage_id), ''), NULLIF(TRIM(p_surplus_id), ''), '')
  END;

  -- Resolver categoría del laboratorio para identificar su ronda activa
  SELECT bl.category INTO v_category 
  FROM public.branch_laboratories bl
  WHERE normalize_string_sql(bl.branch_name) = v_branch 
    AND normalize_string_sql(bl.laboratory) = v_lab
  LIMIT 1;

  -- Resolver la ronda activa (por defecto 1)
  v_round := COALESCE(
    (
      SELECT inv.quantity::INTEGER 
      FROM public.inventories inv
      WHERE normalize_string_sql(inv.branch_name) = v_branch 
        AND inv.laboratory = '_CONFIG_' 
        AND inv.ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(v_category, 'Varios')))
    ),
    1
  );

  -- Delegar a la firma principal
  PERFORM public.finalize_cyclic_inventory(
    p_branch_name,
    p_laboratory,
    v_plex_id,
    p_user_id,
    v_round
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, UUID, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
