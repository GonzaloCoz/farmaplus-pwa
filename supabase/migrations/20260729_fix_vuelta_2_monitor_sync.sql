-- Migration: Reorganize inventories and branch_laboratories by 2026-07-21 cutoff for Vuelta 2
-- Date: 2026-07-29
-- GUARANTEE: NO INVENTORY DATA OR USER COUNTS ARE DELETED. ONLY ROUND ASSIGNMENTS ARE ADJUSTED.

-- 1. Reassign round = 2 to items updated on or after 21/07/2026 (WITHOUT DELETING ANYTHING)
-- Only updates if no round = 2 record already exists for that EAN in that branch
UPDATE public.inventories i
SET round = 2
WHERE i.laboratory != '_CONFIG_'
  AND i.updated_at >= '2026-07-21 00:00:00-03:00'
  AND i.round = 1
  AND NOT EXISTS (
      SELECT 1 FROM public.inventories i_target
      WHERE LOWER(TRIM(i_target.branch_name)) = LOWER(TRIM(i.branch_name))
        AND LOWER(TRIM(i_target.laboratory)) = LOWER(TRIM(i.laboratory))
        AND LOWER(TRIM(i_target.ean)) = LOWER(TRIM(i.ean))
        AND i_target.round = 2
  );

-- 2. Reassign round = 1 to items updated before 21/07/2026 (WITHOUT DELETING ANYTHING)
-- Only updates if no round = 1 record already exists for that EAN in that branch
UPDATE public.inventories i
SET round = 1
WHERE i.laboratory != '_CONFIG_'
  AND i.updated_at < '2026-07-21 00:00:00-03:00'
  AND i.round = 2
  AND NOT EXISTS (
      SELECT 1 FROM public.inventories i_target
      WHERE LOWER(TRIM(i_target.branch_name)) = LOWER(TRIM(i.branch_name))
        AND LOWER(TRIM(i_target.laboratory)) = LOWER(TRIM(i.laboratory))
        AND LOWER(TRIM(i_target.ean)) = LOWER(TRIM(i.ean))
        AND i_target.round = 1
  );

-- 3. Update inventory_ledger rounds by date
UPDATE public.inventory_ledger
SET round = 2
WHERE created_at >= '2026-07-21 00:00:00-03:00';

UPDATE public.inventory_ledger
SET round = 1
WHERE created_at < '2026-07-21 00:00:00-03:00';

-- 4. Set CONFIG_ROUND = 2 for branches that have inventory activity on or after 21/07/2026
INSERT INTO public.inventories (
    branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at
)
SELECT DISTINCT
    public.normalize_string_sql(branch_name), '_CONFIG_', 'CONFIG_ROUND', 2, 0, 'pending', 'SISTEMA', 1, NOW()
FROM public.inventories
WHERE laboratory != '_CONFIG_'
  AND updated_at >= '2026-07-21 00:00:00-03:00'
ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round)
DO UPDATE SET quantity = 2, updated_at = NOW();

-- 5. Set CONFIG_START_DATE = 1784602800 (2026-07-21 00:00:00-03:00) for round 2
INSERT INTO public.inventories (
    branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at
)
SELECT DISTINCT
    public.normalize_string_sql(branch_name), '_CONFIG_', 'CONFIG_START_DATE', 1784602800, 0, 'pending', 'SISTEMA', 2, NOW()
FROM public.inventories
WHERE laboratory != '_CONFIG_'
  AND updated_at >= '2026-07-21 00:00:00-03:00'
ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round)
DO UPDATE SET quantity = 1784602800, updated_at = NOW();

-- 6. Ensure branch_laboratories rows exist for round = 2 for active branches
INSERT INTO public.branch_laboratories (
    branch_name, laboratory, category, total_items, controlled_items, adjusted_items, pending_items, progress_percentage, total_system_units, net_units, net_value, negative_value, positive_value, status, round, created_at, last_updated
)
SELECT 
    bl.branch_name,
    bl.laboratory,
    bl.category,
    bl.total_items,
    0, 0, bl.total_items, 0, 0, 0, 0, 0, 0, 'pending'::TEXT, 2, NOW(), NOW()
FROM public.branch_laboratories bl
WHERE bl.round = 1
  AND public.normalize_string_sql(bl.branch_name) IN (
      SELECT DISTINCT public.normalize_string_sql(branch_name) 
      FROM public.inventories 
      WHERE laboratory != '_CONFIG_' AND updated_at >= '2026-07-21 00:00:00-03:00'
  )
ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(category)), round) DO NOTHING;

-- 7. Recompute branch_laboratories metrics for round = 1 and round = 2 strictly based on items in inventories
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT DISTINCT branch_name, laboratory, round 
        FROM public.inventories 
        WHERE laboratory != '_CONFIG_'
    LOOP
        PERFORM public.recompute_lab_progress(r.branch_name, r.laboratory, r.round);
    END LOOP;
END;
$$;

-- 8. Redefine reset_category_round with proper category & general handling
CREATE OR REPLACE FUNCTION public.reset_category_round(
  p_branch_name TEXT,
  p_category TEXT,
  p_next_round INTEGER
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := public.normalize_string_sql(p_branch_name);
  v_cat_clean TEXT := UPPER(TRIM(COALESCE(p_category, 'GENERAL')));
  v_is_general BOOLEAN := (v_cat_clean IN ('GENERAL', 'TODOS', 'ALL', ''));
  v_ean_key TEXT := CASE WHEN v_is_general THEN 'CONFIG_ROUND' ELSE 'CONFIG_ROUND_' || v_cat_clean END;
BEGIN
  -- 1. Ensure CONFIG_ROUND product exists
  INSERT INTO public.products (ean, name, category, laboratory, cost)
  VALUES (v_ean_key, 'Configuración: Vuelta ' || COALESCE(p_category, 'General'), 'SISTEMA', '_CONFIG_', 0)
  ON CONFLICT (ean) DO NOTHING;

  -- 2. Upsert config round value in inventories
  INSERT INTO public.inventories (
      branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at
  )
  VALUES (
      v_branch, '_CONFIG_', v_ean_key, p_next_round, 0, 'pending', 'SISTEMA', 1, NOW()
  )
  ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
  DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

  -- 3. Copy laboratory layout from the previous round (or highest round < p_next_round), resetting metrics to zero
  INSERT INTO public.branch_laboratories (
      branch_name, laboratory, category, total_items, controlled_items, adjusted_items, pending_items, progress_percentage, total_system_units, net_units, net_value, negative_value, positive_value, status, round, created_at, last_updated
  )
  SELECT 
      bl.branch_name,
      bl.laboratory,
      bl.category,
      bl.total_items,
      0, -- Reset controlled_items
      0, -- Reset adjusted_items
      bl.total_items, -- Reset pending_items
      0, -- Reset progress
      0, -- Reset total_system_units
      0, -- Reset net_units
      0, -- Reset net_value
      0, -- Reset negative_value
      0, -- Reset positive_value
      'pending'::TEXT,
      p_next_round,
      NOW(),
      NOW()
  FROM public.branch_laboratories bl
  INNER JOIN (
      SELECT laboratory, category, MAX(round) as max_r
      FROM public.branch_laboratories
      WHERE public.normalize_string_sql(branch_name) = v_branch
        AND (v_is_general OR public.normalize_string_sql(category) = public.normalize_string_sql(p_category))
        AND round < p_next_round
      GROUP BY laboratory, category
  ) sub ON bl.laboratory = sub.laboratory AND bl.category = sub.category AND bl.round = sub.max_r
  WHERE public.normalize_string_sql(bl.branch_name) = v_branch
  ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(category)), round) 
  DO UPDATE SET 
      controlled_items = 0,
      adjusted_items = 0,
      pending_items = EXCLUDED.total_items,
      progress_percentage = 0,
      status = 'pending',
      last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_category_round(TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;


-- 9. Redefine get_branch_monitor_summaries to resolve dynamic rounds across all tables
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
  v_yesterday TIMESTAMP WITH TIME ZONE := v_today - INTERVAL '1 day';
  v_week TIMESTAMP WITH TIME ZONE := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_month TIMESTAMP WITH TIME ZONE := date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  RETURN QUERY
  WITH 
  config_rounds AS (
      SELECT 
          public.normalize_string_sql(inv_cfg.branch_name) as branch_key,
          CASE WHEN inv_cfg.ean = 'CONFIG_ROUND' THEN 'GENERAL'
               ELSE TRANSLATE(UPPER(TRIM(REPLACE(inv_cfg.ean, 'CONFIG_ROUND_', ''))), 'ÁÉÍÓÚ', 'AEIOU')
          END as category_key,
          MAX(inv_cfg.quantity::INTEGER) as cfg_round
      FROM public.inventories inv_cfg
      WHERE inv_cfg.laboratory = '_CONFIG_'
        AND inv_cfg.ean LIKE 'CONFIG_ROUND%'
      GROUP BY public.normalize_string_sql(inv_cfg.branch_name),
               CASE WHEN inv_cfg.ean = 'CONFIG_ROUND' THEN 'GENERAL'
                    ELSE TRANSLATE(UPPER(TRIM(REPLACE(inv_cfg.ean, 'CONFIG_ROUND_', ''))), 'ÁÉÍÓÚ', 'AEIOU')
               END
  ),
  lab_max_rounds AS (
      SELECT 
          public.normalize_string_sql(bl.branch_name) as branch_key,
          TRANSLATE(UPPER(TRIM(COALESCE(bl.category, 'GENERAL'))), 'ÁÉÍÓÚ', 'AEIOU') as category_key,
          MAX(bl.round) as lab_round,
          MAX(bl.round) FILTER (WHERE bl.controlled_items > 0 OR bl.progress_percentage > 0 OR bl.status != 'pending') as active_data_round
      FROM public.branch_laboratories bl
      GROUP BY public.normalize_string_sql(bl.branch_name),
               TRANSLATE(UPPER(TRIM(COALESCE(bl.category, 'GENERAL'))), 'ÁÉÍÓÚ', 'AEIOU')
  ),
  branch_rounds AS (
      SELECT 
          b.branch_key,
          c.category_key,
          CASE 
              WHEN p_round IS NOT NULL THEN p_round
              WHEN p_show_previous THEN GREATEST(1, COALESCE(cr.cfg_round, lr.lab_round, 1) - 1)
              ELSE COALESCE(
                  cr.cfg_round,
                  lr.active_data_round,
                  lr.lab_round,
                  1
              )
          END as target_round
      FROM (
          SELECT DISTINCT public.normalize_string_sql(branch_name) as branch_key FROM public.branch_laboratories
          UNION
          SELECT DISTINCT public.normalize_string_sql(branch_name) as branch_key FROM public.inventories
      ) b
      CROSS JOIN (
          SELECT 'GENERAL' as category_key
          UNION SELECT 'MEDICAMENTOS'
          UNION SELECT 'PERFUMERIA'
      ) c
      LEFT JOIN config_rounds cr ON b.branch_key = cr.branch_key AND (cr.category_key = c.category_key OR cr.category_key = 'GENERAL')
      LEFT JOIN lab_max_rounds lr ON b.branch_key = lr.branch_key AND lr.category_key = c.category_key
  ),
  branch_inv_metrics AS (
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
          COUNT(*) as total_items_in_inv
      FROM public.inventories i
      LEFT JOIN branch_rounds br_cat ON public.normalize_string_sql(i.branch_name) = br_cat.branch_key 
        AND TRANSLATE(UPPER(TRIM(COALESCE(i.category, 'Varios'))), 'ÁÉÍÓÚ', 'AEIOU') = br_cat.category_key
      LEFT JOIN branch_rounds br_gen ON public.normalize_string_sql(i.branch_name) = br_gen.branch_key 
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
      GROUP BY public.normalize_string_sql(i.branch_name)
  ),
  effective_branch_labs AS (
      SELECT bl.*
      FROM public.branch_laboratories bl
      LEFT JOIN branch_rounds br_cat ON public.normalize_string_sql(bl.branch_name) = br_cat.branch_key 
        AND TRANSLATE(UPPER(TRIM(COALESCE(bl.category, 'Varios'))), 'ÁÉÍÓÚ', 'AEIOU') = br_cat.category_key
      LEFT JOIN branch_rounds br_gen ON public.normalize_string_sql(bl.branch_name) = br_gen.branch_key 
        AND br_gen.category_key = 'GENERAL'
      WHERE bl.round = COALESCE(
          p_round, 
          br_cat.target_round, 
          br_gen.target_round, 
          1
      )
  ),
  lab_averages AS (
      SELECT 
          public.normalize_string_sql(bl_sub.branch_name) as branch_key,
          bl_sub.laboratory,
          AVG(bl_sub.progress_percentage) as lab_avg_progress
      FROM effective_branch_labs bl_sub
      GROUP BY public.normalize_string_sql(bl_sub.branch_name), bl_sub.laboratory
  ),
  branch_weighted_stats AS (
      SELECT 
          la.branch_key,
          SUM(la.lab_avg_progress)::NUMERIC as weighted_progress_sum
      FROM lab_averages la
      GROUP BY la.branch_key
  ),
  branch_lab_metrics AS (
      SELECT 
          public.normalize_string_sql(bl.branch_name) as branch_key,
          MAX(bl.branch_name) as display_name,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE bl.status = 'completed' OR bl.progress_percentage >= 100) as controlled_labs_count,
          COUNT(DISTINCT bl.laboratory) FILTER (WHERE (bl.status = 'in_progress' OR bl.progress_percentage > 0) AND bl.progress_percentage < 100) as active_labs_count,
          COUNT(DISTINCT bl.laboratory) as total_labs_count,
          SUM(COALESCE(bl.total_items, 0)) as total_items_master,
          MAX(bl.last_updated) as updated_at
      FROM effective_branch_labs bl
      GROUP BY public.normalize_string_sql(bl.branch_name)
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
