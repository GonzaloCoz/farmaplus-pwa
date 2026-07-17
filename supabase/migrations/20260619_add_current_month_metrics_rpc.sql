-- ========================================================
-- FIX: get_branch_current_month_metrics RPC
-- Fecha: 2026-06-19
-- Propósito: Devuelve Sobrante/Faltante del mes actual para
--   una sucursal, calculado LIVE desde inventories con filtro
--   de mes. Reemplaza la lectura directa a branch_laboratories
--   en TrendsChartWidget para el mes en curso.
-- ========================================================

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
  WHERE LOWER(TRIM(i.branch_name)) = LOWER(TRIM(p_branch_name))
    AND i.laboratory != '_CONFIG_'
    -- Solo items del mes en curso
    AND DATE_TRUNC('month', i.updated_at) = DATE_TRUNC('month', NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_current_month_metrics(TEXT)
  TO anon, authenticated, service_role;
