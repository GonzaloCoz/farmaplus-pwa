-- ==============================================================================
-- Migration: Backfill missing shortage/surplus values in inventory_ledger
--            and inventory_adjustments from inventory_ledger_items
-- Date: 2026-11-04
-- ==============================================================================

-- 1. Backfill inventory_ledger headers where total_shortage_value = 0 and total_surplus_value = 0
WITH item_totals AS (
    SELECT
        ledger_id,
        ROUND(COALESCE(SUM(ABS(total_diff_value)) FILTER (WHERE total_diff_value < 0), 0)::numeric, 2) AS calc_shortage,
        ROUND(COALESCE(SUM(total_diff_value) FILTER (WHERE total_diff_value > 0), 0)::numeric, 2) AS calc_surplus,
        COUNT(*) AS item_count
    FROM public.inventory_ledger_items
    GROUP BY ledger_id
)
UPDATE public.inventory_ledger l
SET
    total_shortage_value = CASE WHEN COALESCE(l.total_shortage_value, 0) = 0 THEN it.calc_shortage ELSE l.total_shortage_value END,
    total_surplus_value  = CASE WHEN COALESCE(l.total_surplus_value, 0) = 0 THEN it.calc_surplus ELSE l.total_surplus_value END,
    total_net_value      = ROUND(
        (CASE WHEN COALESCE(l.total_surplus_value, 0) = 0 THEN it.calc_surplus ELSE l.total_surplus_value END) -
        (CASE WHEN COALESCE(l.total_shortage_value, 0) = 0 THEN it.calc_shortage ELSE l.total_shortage_value END),
        2
    ),
    total_items_adjusted = CASE WHEN COALESCE(l.total_items_adjusted, 0) = 0 THEN it.item_count ELSE l.total_items_adjusted END
FROM item_totals it
WHERE l.id = it.ledger_id
  AND (
      (COALESCE(l.total_shortage_value, 0) = 0 AND it.calc_shortage > 0)
      OR (COALESCE(l.total_surplus_value, 0) = 0 AND it.calc_surplus > 0)
  );

-- 2. Backfill matching rows in inventory_adjustments
UPDATE public.inventory_adjustments a
SET
    shortage_value       = l.total_shortage_value,
    surplus_value        = l.total_surplus_value,
    total_units_adjusted = CASE WHEN COALESCE(a.total_units_adjusted, 0) = 0 THEN l.total_items_adjusted ELSE a.total_units_adjusted END
FROM public.inventory_ledger l
WHERE a.branch_name = l.branch_name
  AND a.laboratory = l.laboratory
  AND COALESCE(a.adjustment_id_shortage, '') = COALESCE(l.adjustment_id_shortage, '')
  AND COALESCE(a.adjustment_id_surplus, '') = COALESCE(l.adjustment_id_surplus, '')
  AND COALESCE(a.shortage_value, 0) = 0
  AND COALESCE(a.surplus_value, 0) = 0
  AND (COALESCE(l.total_shortage_value, 0) > 0 OR COALESCE(l.total_surplus_value, 0) > 0);

