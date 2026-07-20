-- Migration: Clean incorrect adjustment IDs
-- Date: 2026-07-17
-- Purpose: Remove shortage IDs from surplus items and surplus IDs from shortage items in inventories to ensure clean and correct data.

-- 1. Clear shortage IDs from items that are not shortages (diff >= 0)
UPDATE public.inventories
SET adjustment_id_shortage = NULL
WHERE status = 'adjusted'
  AND quantity >= system_quantity
  AND adjustment_id_shortage IS NOT NULL;

-- 2. Clear surplus IDs from items that are not surpluses (diff <= 0)
UPDATE public.inventories
SET adjustment_id_surplus = NULL
WHERE status = 'adjusted'
  AND quantity <= system_quantity
  AND adjustment_id_surplus IS NOT NULL;
