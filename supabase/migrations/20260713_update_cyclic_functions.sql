-- Migration: Update cyclic functions to support round filtering
-- Date: 2026-07-13
-- Purpose: Support dynamic rounds in finalization and progress recomputation.

-- Drop old function signatures to prevent duplicate overloading issues
DROP FUNCTION IF EXISTS public.finalize_cyclic_inventory(TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.recompute_lab_progress(TEXT, TEXT) CASCADE;

-- 1. Updated recompute_lab_progress
CREATE OR REPLACE FUNCTION public.recompute_lab_progress(
  p_branch_name TEXT, p_laboratory TEXT, p_round INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
  v_total_global INTEGER;
  v_processed_global INTEGER;
  v_progress_global NUMERIC;
BEGIN
  -- 1. Aggregates (Indexed by branch, lab, and round)
  SELECT COUNT(*), COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END)
  INTO v_total_global, v_processed_global
  FROM public.inventories 
  WHERE branch_name = v_branch AND laboratory = v_lab AND round = p_round;

  v_progress_global := CASE WHEN v_total_global > 0 THEN LEAST(100, ROUND((v_processed_global::NUMERIC / v_total_global) * 100, 1)) ELSE 0 END;

  -- 2. Mass Update by Category & Round
  UPDATE public.branch_laboratories bl
  SET
    total_items = COALESCE(s.total, 0),
    controlled_items = COALESCE(s.processed, 0),
    progress_percentage = v_progress_global,
    status = CASE WHEN v_progress_global >= 100 THEN 'completed' WHEN v_progress_global > 0 THEN 'in_progress' ELSE 'pending' END,
    negative_units = COALESCE(s.neg_units, 0), positive_units = COALESCE(s.pos_units, 0),
    negative_value = COALESCE(s.neg_val, 0), positive_value = COALESCE(s.pos_val, 0),
    net_units = COALESCE(s.neg_units, 0) + COALESCE(s.pos_units, 0),
    net_value = COALESCE(s.neg_val, 0) + COALESCE(s.pos_val, 0),
    last_updated = NOW()
  FROM (
      SELECT 
        bl_sub.category as target_cat, i_stats.*
      FROM public.branch_laboratories bl_sub
      LEFT JOIN (
          SELECT normalize_string_sql(i.category) as cat, COUNT(*) as total,
            COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END) as processed,
            SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as neg_units,
            SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as pos_units,
            SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as neg_val,
            SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as pos_val
          FROM public.inventories i
          LEFT JOIN public.products p ON i.ean = p.ean
          WHERE i.branch_name = v_branch AND i.laboratory = v_lab AND i.round = p_round
          GROUP BY normalize_string_sql(i.category)
      ) i_stats ON (normalize_string_sql(bl_sub.category) = i_stats.cat OR (normalize_string_sql(bl_sub.category) IN ('VARIOS', 'VARIOUS') AND (i_stats.cat = 'VARIOS' OR i_stats.cat IS NULL)))
      WHERE bl_sub.branch_name = v_branch AND bl_sub.laboratory = v_lab AND bl_sub.round = p_round
  ) s
  WHERE bl.branch_name = v_branch 
    AND bl.laboratory = v_lab 
    AND bl.round = p_round
    AND normalize_string_sql(bl.category) = s.target_cat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Updated finalize_cyclic_inventory
CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT, p_laboratory TEXT, p_plex_id TEXT, p_user_id UUID, p_round INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- Update status to adjusted only for items in the specific round
  UPDATE public.inventories
  SET status = 'adjusted', updated_at = NOW()
  WHERE branch_name = v_branch AND laboratory = v_lab AND status = 'controlled' AND round = p_round;

  -- Recompute progress for the specific round
  PERFORM public.recompute_lab_progress(p_branch_name, p_laboratory, p_round);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.recompute_lab_progress TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory TO anon, authenticated, service_role;
