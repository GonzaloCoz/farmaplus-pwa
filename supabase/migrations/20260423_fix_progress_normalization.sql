-- ==========================================
-- Migration: Fix Progress Normalization & Consistency
-- Date: 2026-04-23
-- Purpose: 
--  1. Ensures all branch/lab names are normalized in the tables.
--  2. Hardens recompute_lab_progress to use normalization in its matching.
--  3. Solves "0% but showing in progress" by fixing the UPDATE WHERE clause.
-- ==========================================

-- 1. Mass Normalization (Ensure existing data is clean)
UPDATE public.branch_laboratories 
SET 
    branch_name = normalize_string_sql(branch_name),
    laboratory = normalize_string_sql(laboratory),
    category = normalize_string_sql(category);

UPDATE public.inventories 
SET 
    branch_name = normalize_string_sql(branch_name),
    laboratory = normalize_string_sql(laboratory),
    category = normalize_string_sql(category);

-- 2. Hardened RPC: recompute_lab_progress
CREATE OR REPLACE FUNCTION recompute_lab_progress(
  p_branch_name TEXT, p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
  v_total_global INTEGER;
  v_processed_global INTEGER;
  v_progress_global NUMERIC;
BEGIN
  -- 1. Aggregates (Indexed)
  SELECT COUNT(*), COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END)
  INTO v_total_global, v_processed_global
  FROM public.inventories 
  WHERE normalize_string_sql(branch_name) = v_branch 
    AND normalize_string_sql(laboratory) = v_lab;

  v_progress_global := CASE 
    WHEN v_total_global > 0 THEN LEAST(100, ROUND((v_processed_global::NUMERIC / v_total_global) * 100, 1)) 
    ELSE 0 
  END;

  -- 2. Mass Update by Category
  -- We use normalization in the WHERE clause of the update for absolute safety
  UPDATE public.branch_laboratories bl
  SET
    total_items = COALESCE(s.total, 0),
    controlled_items = COALESCE(s.processed, 0),
    progress_percentage = v_progress_global,
    status = CASE 
        WHEN v_progress_global >= 100 THEN 'completed' 
        WHEN v_progress_global > 0 THEN 'in_progress' 
        ELSE 'pending' 
    END,
    negative_units = COALESCE(s.neg_units, 0), positive_units = COALESCE(s.pos_units, 0),
    negative_value = COALESCE(s.neg_val, 0), positive_value = COALESCE(s.pos_val, 0),
    net_units = COALESCE(s.neg_units, 0) + COALESCE(s.pos_units, 0),
    net_value = COALESCE(s.neg_val, 0) + COALESCE(s.pos_val, 0)
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
          WHERE normalize_string_sql(i.branch_name) = v_branch 
            AND normalize_string_sql(i.laboratory) = v_lab
          GROUP BY normalize_string_sql(i.category)
      ) i_stats ON (normalize_string_sql(bl_sub.category) = i_stats.cat OR (normalize_string_sql(bl_sub.category) IN ('VARIOS', 'VARIOUS') AND (i_stats.cat = 'VARIOS' OR i_stats.cat IS NULL)))
      WHERE normalize_string_sql(bl_sub.branch_name) = v_branch 
        AND normalize_string_sql(bl_sub.laboratory) = v_lab
  ) s
  WHERE normalize_string_sql(bl.branch_name) = v_branch 
    AND normalize_string_sql(bl.laboratory) = v_lab 
    AND normalize_string_sql(bl.category) = s.target_cat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
