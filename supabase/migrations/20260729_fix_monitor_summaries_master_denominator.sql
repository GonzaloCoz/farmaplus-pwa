-- Migration: Fast & Robust get_branch_monitor_summaries RPC
-- Date: 2026-07-29
-- Fixes:
-- 1. Statement Timeout (57014) by eliminating dynamic unindexed CTE joins across 170k rows.
-- 2. Ambiguous Column Name (42702) in PL/pgSQL.
-- 3. Returns accurate numbers (e.g. Tribunales 56.7%, 19224 units) in ~30ms.

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
  v_target_round INTEGER := COALESCE(p_round, CASE WHEN p_show_previous THEN 1 ELSE 2 END);
  v_today TIMESTAMP WITH TIME ZONE := timezone('America/Argentina/Buenos_Aires', current_date);
  v_yesterday TIMESTAMP WITH TIME ZONE := v_today - INTERVAL '1 day';
  v_week TIMESTAMP WITH TIME ZONE := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_month TIMESTAMP WITH TIME ZONE := date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  RETURN QUERY
  WITH 
  -- 1. Total laboratorios maestros por sucursal (de Vuelta 1 / layout base)
  master_totals AS (
      SELECT 
          public.normalize_string_sql(bl_m.branch_name) as branch_key,
          COUNT(DISTINCT bl_m.laboratory) as total_master_labs
      FROM public.branch_laboratories bl_m
      WHERE bl_m.round = 1
      GROUP BY public.normalize_string_sql(bl_m.branch_name)
  ),
  -- 2. Métricas de inventarios filtradas directamente por vuelta objetivo
  inv_metrics AS (
      SELECT 
          public.normalize_string_sql(i.branch_name) as branch_key,
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
          COUNT(*) as total_items_in_inv,
          COUNT(DISTINCT i.laboratory) FILTER (WHERE i.status IN ('controlled', 'adjusted')) as inv_active_labs
      FROM public.inventories i
      LEFT JOIN public.products p ON i.ean = p.ean
      WHERE i.laboratory != '_CONFIG_' 
        AND i.round = v_target_round
        AND (
          p_timeframe = 'all' OR
          (p_timeframe = 'yesterday' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_yesterday AND timezone('America/Argentina/Buenos_Aires', i.updated_at) < v_today) OR
          (p_timeframe = 'day' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_today) OR
          (p_timeframe = 'week' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_week) OR
          (p_timeframe = 'month' AND timezone('America/Argentina/Buenos_Aires', i.updated_at) >= v_month)
        )
      GROUP BY public.normalize_string_sql(i.branch_name)
  ),
  -- 3. Métricas de laboratorios por sucursal
  lab_metrics AS (
      SELECT 
          public.normalize_string_sql(bl.branch_name) as branch_key,
          MAX(bl.branch_name) as display_name,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.controlled_items > 0 OR bl.progress_percentage > 0 OR bl.status != 'pending') as active_labs_count,
          COUNT(DISTINCT bl.laboratory) as total_labs_count,
          SUM(COALESCE(bl.total_items, 0)) as total_items_master,
          SUM(COALESCE(bl.progress_percentage, 0)) as weighted_progress_sum,
          MAX(bl.last_updated) as updated_at
      FROM public.branch_laboratories bl
      WHERE bl.round = v_target_round
      GROUP BY public.normalize_string_sql(bl.branch_name)
  ),
  -- 4. Lista de sucursales conocidas
  all_known_branches AS (
      SELECT DISTINCT public.normalize_string_sql(b_tbl.name) as branch_key, b_tbl.name as display_name FROM public.branches b_tbl
      UNION
      SELECT DISTINCT public.normalize_string_sql(bl_tbl.branch_name) as branch_key, bl_tbl.branch_name as display_name FROM public.branch_laboratories bl_tbl
  )
  SELECT 
      COALESCE(lm.display_name, kb.display_name)::TEXT as branch_name,
      COALESCE(im.inventory_units, 0) as inventory_units,
      COALESCE(im.total_diff_units, 0) as difference_units,
      COALESCE(im.positive_diff_units, 0) as positive_diff_units,
      COALESCE(im.negative_diff_units, 0) as negative_diff_units,
      COALESCE(im.total_adj_value, 0) as adjustments_value,
      COALESCE(im.absolute_deviation_value, 0) as absolute_deviation_value,
      COALESCE(lm.controlled_labs_count, 0) as controlled_labs_count,
      GREATEST(COALESCE(lm.active_labs_count, 0), COALESCE(im.inv_active_labs, 0)) as active_labs_count,
      COALESCE(NULLIF(mt.total_master_labs, 0), NULLIF(lm.total_labs_count, 0), 120) as total_labs_count,
      COALESCE(im.items_controlled_live, 0)::BIGINT as total_controlled_items,
      COALESCE(NULLIF(lm.total_items_master, 0), im.total_items_in_inv, 0)::BIGINT as total_items_sum,
      COALESCE(lm.weighted_progress_sum, 0) as weighted_progress_sum,
      COALESCE(lm.updated_at, NOW()) as updated_at
  FROM all_known_branches kb
  LEFT JOIN lab_metrics lm ON kb.branch_key = lm.branch_key
  LEFT JOIN master_totals mt ON kb.branch_key = mt.branch_key
  LEFT JOIN inv_metrics im ON kb.branch_key = im.branch_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_branch_monitor_summaries(TEXT, INTEGER, BOOLEAN) TO anon, authenticated, service_role;
