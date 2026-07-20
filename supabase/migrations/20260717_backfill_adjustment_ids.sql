-- Migration: Backfill adjustment IDs in inventories from ledger
-- Date: 2026-07-17
-- Purpose: Repair and sync any missing adjustment_id_shortage or adjustment_id_surplus on adjusted items due to past spacing mismatches.

UPDATE public.inventories i
SET 
  adjustment_id_shortage = COALESCE(i.adjustment_id_shortage, il.adjustment_id_shortage),
  adjustment_id_surplus = COALESCE(i.adjustment_id_surplus, il.adjustment_id_surplus)
FROM public.inventory_ledger il
WHERE normalize_string_sql(i.branch_name) = normalize_string_sql(il.branch_name)
  AND normalize_string_sql(i.laboratory) = normalize_string_sql(il.laboratory)
  AND i.round = il.round
  AND i.status = 'adjusted';
