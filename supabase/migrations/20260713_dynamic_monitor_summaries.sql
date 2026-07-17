-- Migration: Add dynamic monitor summaries function with show_previous support
-- Date: 2026-07-13
-- Purpose: Support temporal filters, round-specific statistics, and previous round comparisons.

DROP FUNCTION IF EXISTS public.get_branch_monitor_summaries(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_branch_monitor_summaries(TEXT, INTEGER, BOOLEAN) CASCADE;

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
  v_week TIMESTAMP WITH TIME ZONE := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_month TIMESTAMP WITH TIME ZONE := date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  RETURN QUERY
  WITH 
  branch_inv_metrics AS (
      -- 1. Aggregates from inventories for specified round & timeframe
      SELECT 
          LOWER(TRIM(i.branch_name)) as branch_key,
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
      LEFT JOIN public.products p ON i.ean = p.ean
      WHERE i.laboratory != '_CONFIG_' 
        AND i.round = COALESCE(
          p_round,
          (
            -- Auto-resolve round based on item's category, minus 1 if p_show_previous is TRUE
            SELECT CASE WHEN p_show_previous THEN GREATEST(1, inv_cfg.quantity::INTEGER - 1) ELSE inv_cfg.quantity::INTEGER END
            FROM public.inventories inv_cfg
            WHERE normalize_string_sql(inv_cfg.branch_name) = LOWER(TRIM(i.branch_name)) 
              AND inv_cfg.laboratory = '_CONFIG_' 
              AND inv_cfg.ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(i.category, 'Varios')))
          ),
          1
        )
        AND (
          p_timeframe = 'all' OR
          (p_timeframe = 'day' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_today) OR
          (p_timeframe = 'week' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_week) OR
          (p_timeframe = 'month' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_month)
        )
      GROUP BY LOWER(TRIM(i.branch_name))
  ),
  lab_averages AS (
      -- 2. Average progress by Lab for specified round
      SELECT 
          LOWER(TRIM(bl_sub.branch_name)) as branch_key,
          bl_sub.laboratory,
          AVG(bl_sub.progress_percentage) as lab_avg_progress
      FROM public.branch_laboratories bl_sub
      WHERE bl_sub.round = COALESCE(
          p_round,
          (
            SELECT CASE WHEN p_show_previous THEN GREATEST(1, inv_cfg.quantity::INTEGER - 1) ELSE inv_cfg.quantity::INTEGER END
            FROM public.inventories inv_cfg
            WHERE normalize_string_sql(inv_cfg.branch_name) = LOWER(TRIM(bl_sub.branch_name)) 
              AND inv_cfg.laboratory = '_CONFIG_' 
              AND inv_cfg.ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(bl_sub.category, 'Varios')))
          ),
          1
        )
      GROUP BY LOWER(TRIM(bl_sub.branch_name)), bl_sub.laboratory
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
          LOWER(TRIM(bl.branch_name)) as branch_key,
          MAX(bl.branch_name) as display_name,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE (bl.status = 'in_progress' OR bl.progress_percentage > 0) AND bl.progress_percentage < 100) as active_labs_count,
          COUNT(DISTINCT bl.laboratory) as total_labs_count,
          SUM(COALESCE(bl.total_items, 0)) as total_items_master,
          MAX(bl.last_updated) as updated_at
      FROM public.branch_laboratories bl
      WHERE bl.round = COALESCE(
          p_round,
          (
            SELECT CASE WHEN p_show_previous THEN GREATEST(1, inv_cfg.quantity::INTEGER - 1) ELSE inv_cfg.quantity::INTEGER END
            FROM public.inventories inv_cfg
            WHERE normalize_string_sql(inv_cfg.branch_name) = LOWER(TRIM(bl.branch_name)) 
              AND inv_cfg.laboratory = '_CONFIG_' 
              AND inv_cfg.ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(bl.category, 'Varios')))
          ),
          1
        )
      GROUP BY LOWER(TRIM(bl.branch_name))
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_branch_monitor_summaries(TEXT, INTEGER, BOOLEAN) TO anon, authenticated, service_role;
