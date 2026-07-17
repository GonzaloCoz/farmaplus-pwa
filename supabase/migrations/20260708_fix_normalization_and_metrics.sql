-- ========================================================
-- Migration: Fix Month Metrics and Branch Normalization
-- Date: 2026-07-08
-- Purpose:
--   1. Recreate get_branch_current_month_metrics using normalize_string_sql
--      to avoid mismatching accented/cased branch names.
--   2. Add get_all_cyclic_inventories for accent-insensitive
--      and case-insensitive branch metadata queries.
-- ========================================================

-- 1. Recreate get_branch_current_month_metrics
CREATE OR REPLACE FUNCTION public.get_branch_current_month_metrics(
  p_branch_name TEXT
)
RETURNS TABLE (
  surplus_value     NUMERIC,
  shortage_value    NUMERIC,
  surplus_units     INTEGER,
  shortage_units    INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(
      CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) > 0
      THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0)
      ELSE 0 END
    ), 0) AS surplus_value,

    COALESCE(SUM(
      CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) < 0
      THEN ABS((i.quantity - i.system_quantity) * COALESCE(p.cost, 0))
      ELSE 0 END
    ), 0) AS shortage_value,

    COALESCE(SUM(
      CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) > 0
      THEN (i.quantity - i.system_quantity)
      ELSE 0 END
    )::INTEGER, 0) AS surplus_units,

    COALESCE(SUM(
      CASE WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) < 0
      THEN ABS(i.quantity - i.system_quantity)
      ELSE 0 END
    )::INTEGER, 0) AS shortage_units

  FROM public.inventories i
  LEFT JOIN public.products p ON i.ean = p.ean
  WHERE public.normalize_string_sql(i.branch_name) = public.normalize_string_sql(p_branch_name)
    AND i.laboratory != '_CONFIG_'
    -- Solo items del mes en curso
    AND DATE_TRUNC('month', i.updated_at) = DATE_TRUNC('month', NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_current_month_metrics(TEXT)
  TO anon, authenticated, service_role;


-- 2. Add get_all_cyclic_inventories
CREATE OR REPLACE FUNCTION public.get_all_cyclic_inventories(
  p_branch_name TEXT
)
RETURNS SETOF public.branch_laboratories
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.branch_laboratories
  WHERE public.normalize_string_sql(branch_name) = public.normalize_string_sql(p_branch_name);
$$;

GRANT EXECUTE ON FUNCTION public.get_all_cyclic_inventories(TEXT)
  TO anon, authenticated, service_role;
