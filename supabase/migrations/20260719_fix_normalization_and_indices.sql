-- Migration: Fix space normalization mismatch, clean up existing branch names (handling duplicates), and optimize queries
-- Date: 2026-07-19

-- 1. Redefine normalize_string_sql as IMMUTABLE to allow it in index expressions
-- This aligns it with React's normalizeString: str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toUpperCase()
CREATE OR REPLACE FUNCTION public.normalize_string_sql(p_text TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(TRIM(UPPER(unaccent(p_text))), '\s+', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Clean up inventories (handling duplicates to prevent constraint violations)
-- First delete rows with spaces if a row with the normalized name already exists
DELETE FROM public.inventories i_space
WHERE i_space.branch_name LIKE '% %'
  AND EXISTS (
      SELECT 1 
      FROM public.inventories i_clean
      WHERE LOWER(TRIM(i_clean.branch_name)) = LOWER(TRIM(regexp_replace(TRIM(UPPER(unaccent(i_space.branch_name))), '\s+', '', 'g')))
        AND LOWER(TRIM(i_clean.laboratory)) = LOWER(TRIM(i_space.laboratory))
        AND LOWER(TRIM(i_clean.ean)) = LOWER(TRIM(i_space.ean))
        AND i_clean.round = i_space.round
  );

-- Update the remaining rows to use the normalized name
UPDATE public.inventories 
SET branch_name = normalize_string_sql(branch_name)
WHERE branch_name LIKE '% %';

-- 3. Clean up branch_laboratories (handling duplicates case-insensitively to prevent constraint violations)
DELETE FROM public.branch_laboratories bl_space
WHERE bl_space.branch_name LIKE '% %'
  AND EXISTS (
      SELECT 1 
      FROM public.branch_laboratories bl_clean
      WHERE LOWER(TRIM(bl_clean.branch_name)) = LOWER(TRIM(regexp_replace(TRIM(UPPER(unaccent(bl_space.branch_name))), '\s+', '', 'g')))
        AND LOWER(TRIM(bl_clean.laboratory)) = LOWER(TRIM(bl_space.laboratory))
        AND LOWER(TRIM(bl_clean.category)) = LOWER(TRIM(bl_space.category))
        AND bl_clean.round = bl_space.round
  );

UPDATE public.branch_laboratories 
SET branch_name = normalize_string_sql(branch_name)
WHERE branch_name LIKE '% %';

-- 4. Clean up adjustments and ledger
UPDATE public.inventory_adjustments 
SET branch_name = normalize_string_sql(branch_name)
WHERE branch_name LIKE '% %';

UPDATE public.inventory_ledger 
SET branch_name = normalize_string_sql(branch_name)
WHERE branch_name LIKE '% %';

-- 5. Redefine get_branch_monitor_summaries to use normalize_string_sql for robust matching
CREATE OR REPLACE FUNCTION public.get_branch_monitor_summaries(
  p_timeframe TEXT DEFAULT 'all',
  p_round INTEGER DEFAULT NULL,
  p_show_previous BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  branch_name TEXT,
  inventory_units NUMERIC,
  difference_units NUMERIC,
  positive_diff_units NUMERIC,
  negative_diff_units NUMERIC,
  adjustments_value NUMERIC,
  absolute_deviation_value NUMERIC,
  controlled_labs_count BIGINT,
  active_labs_count BIGINT,
  total_labs_count BIGINT,
  total_controlled_items BIGINT,
  total_items_sum BIGINT,
  weighted_progress_sum NUMERIC,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_today TIMESTAMP WITH TIME ZONE := timezone('America/Argentina/Buenos_Aires', current_date);
  v_yesterday TIMESTAMP WITH TIME ZONE := v_today - INTERVAL '1 day';
  v_week TIMESTAMP WITH TIME ZONE := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_month TIMESTAMP WITH TIME ZONE := date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  RETURN QUERY
  WITH 
  branch_rounds AS (
      -- Pre-resolve rounds for all branches/categories using normalize_string_sql
      SELECT 
          normalize_string_sql(inv_cfg.branch_name) as branch_key,
          CASE WHEN inv_cfg.ean = 'CONFIG_ROUND' THEN 'GENERAL'
               ELSE TRANSLATE(UPPER(TRIM(REPLACE(inv_cfg.ean, 'CONFIG_ROUND_', ''))), 'ÁÉÍÓÚ', 'AEIOU')
          END as category_key,
          CASE WHEN p_show_previous 
               THEN GREATEST(1, inv_cfg.quantity::INTEGER - 1) 
               ELSE inv_cfg.quantity::INTEGER 
          END as target_round
      FROM public.inventories inv_cfg
      WHERE inv_cfg.laboratory = '_CONFIG_'
        AND inv_cfg.ean LIKE 'CONFIG_ROUND%'
        AND inv_cfg.round = 1
  ),
  branch_inv_metrics AS (
      -- 1. Aggregates from inventories for specified round & timeframe
      SELECT 
          normalize_string_sql(i.branch_name) as branch_key,
          COALESCE(SUM(i.quantity) FILTER (WHERE i.status IN ('controlled', 'adjusted')), 0)::NUMERIC as inventory_units,
          COALESCE(SUM(
              CASE WHEN i.status IN ('controlled', 'adjusted')
              THEN (i.quantity - i.system_quantity) ELSE 0 END
          ), 0)::NUMERIC as total_diff_units,
          COALESCE(SUM(
              CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) > 0
              THEN (i.quantity - i.system_quantity) ELSE 0 END
          ), 0)::NUMERIC as positive_diff_units,
          COALESCE(SUM(
              CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) < 0
              THEN ABS(i.quantity - i.system_quantity) ELSE 0 END
          ), 0)::NUMERIC as negative_diff_units,
          COALESCE(SUM(
              CASE WHEN i.status IN ('controlled', 'adjusted')
              THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END
          ), 0)::NUMERIC as total_adj_value,
          COALESCE(SUM(
              CASE WHEN i.status IN ('controlled', 'adjusted')
              THEN ABS(i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END
          ), 0)::NUMERIC as absolute_deviation_value,
          COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) as items_controlled_live,
          COUNT(*) as total_items_in_inv
      FROM public.inventories i
      LEFT JOIN branch_rounds br_cat ON normalize_string_sql(i.branch_name) = br_cat.branch_key 
        AND TRANSLATE(UPPER(TRIM(COALESCE(i.category, 'Varios'))), 'ÁÉÍÓÚ', 'AEIOU') = br_cat.category_key
      LEFT JOIN branch_rounds br_gen ON normalize_string_sql(i.branch_name) = br_gen.branch_key 
        AND br_gen.category_key = 'GENERAL'
      LEFT JOIN public.products p ON i.ean = p.ean
      WHERE i.laboratory != '_CONFIG_' 
        AND i.round = COALESCE(p_round, br_cat.target_round, br_gen.target_round, 1)
        AND (
          p_timeframe = 'all' OR
          (p_timeframe = 'yesterday' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_yesterday AND timezone('America/Argentina/Buenos_Aires', i.updated_at) < v_today) OR
          (p_timeframe = 'day' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_today) OR
          (p_timeframe = 'week' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_week) OR
          (p_timeframe = 'month' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_month)
        )
      GROUP BY normalize_string_sql(i.branch_name)
  ),
  lab_averages AS (
      -- 2. Average progress by Lab for specified round
      SELECT 
          normalize_string_sql(bl_sub.branch_name) as branch_key,
          bl_sub.laboratory,
          AVG(bl_sub.progress_percentage) as lab_avg_progress
      FROM public.branch_laboratories bl_sub
      LEFT JOIN branch_rounds br_cat ON normalize_string_sql(bl_sub.branch_name) = br_cat.branch_key 
        AND TRANSLATE(UPPER(TRIM(COALESCE(bl_sub.category, 'Varios'))), 'ÁÉÍÓÚ', 'AEIOU') = br_cat.category_key
      LEFT JOIN branch_rounds br_gen ON normalize_string_sql(bl_sub.branch_name) = br_gen.branch_key 
        AND br_gen.category_key = 'GENERAL'
      WHERE bl_sub.round = COALESCE(p_round, br_cat.target_round, br_gen.target_round, 1)
      GROUP BY normalize_string_sql(bl_sub.branch_name), bl_sub.laboratory
  ),
  branch_weighted_stats AS (
      -- 3. Sum of averages by branch
      SELECT 
          la.branch_key,
          SUM(la.lab_avg_progress)::NUMERIC as weighted_progress_sum
      FROM lab_averages la
      GROUP BY la.branch_key
  ),
  branch_lab_metrics AS (
      -- 4. Lab counts & master totals for specified round
      SELECT 
          normalize_string_sql(bl.branch_name) as branch_key,
          MAX(bl.branch_name) as display_name,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE (bl.status = 'in_progress' OR bl.progress_percentage > 0) AND bl.progress_percentage < 100) as active_labs_count,
          COUNT(DISTINCT bl.laboratory) as total_labs_count,
          SUM(COALESCE(bl.total_items, 0)) as total_items_master,
          MAX(bl.last_updated) as updated_at
      FROM public.branch_laboratories bl
      LEFT JOIN branch_rounds br_cat ON normalize_string_sql(bl.branch_name) = br_cat.branch_key 
        AND TRANSLATE(UPPER(TRIM(COALESCE(bl.category, 'Varios'))), 'ÁÉÍÓÚ', 'AEIOU') = br_cat.category_key
      LEFT JOIN branch_rounds br_gen ON normalize_string_sql(bl.branch_name) = br_gen.branch_key 
        AND br_gen.category_key = 'GENERAL'
      WHERE bl.round = COALESCE(p_round, br_cat.target_round, br_gen.target_round, 1)
      GROUP BY normalize_string_sql(bl.branch_name)
  )
  SELECT 
      bl.display_name as branch_name,
      COALESCE(im.inventory_units, 0) as inventory_units,
      COALESCE(im.total_diff_units, 0) as difference_units,
      COALESCE(im.positive_diff_units, 0) as positive_diff_units,
      COALESCE(im.negative_diff_units, 0) as negative_diff_units,
      COALESCE(im.total_adj_value, 0) as adjustments_value,
      COALESCE(im.absolute_deviation_value, 0) as absolute_deviation_value,
      COALESCE(bl.controlled_labs_count, 0) as controlled_labs_count,
      COALESCE(bl.active_labs_count, 0) as active_labs_count,
      COALESCE(bl.total_labs_count, 0) as total_labs_count,
      COALESCE(im.items_controlled_live, 0)::BIGINT as total_controlled_items,
      COALESCE(NULLIF(bl.total_items_master, 0), im.total_items_in_inv, 0)::BIGINT as total_items_sum,
      COALESCE(ws.weighted_progress_sum, 0) as weighted_progress_sum,
      bl.updated_at
  FROM branch_lab_metrics bl
  LEFT JOIN branch_inv_metrics im ON bl.branch_key = im.branch_key
  LEFT JOIN branch_weighted_stats ws ON bl.branch_key = ws.branch_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_branch_monitor_summaries(TEXT, INTEGER, BOOLEAN) TO anon, authenticated, service_role;

-- 6. Create functional indexes to bypass CPU bottlenecks and prevent timeouts
CREATE INDEX IF NOT EXISTS idx_inventories_branch_normalized 
ON public.inventories (normalize_string_sql(branch_name), normalize_string_sql(laboratory));

CREATE INDEX IF NOT EXISTS idx_branch_labs_branch_normalized 
ON public.branch_laboratories (normalize_string_sql(branch_name), normalize_string_sql(laboratory));
