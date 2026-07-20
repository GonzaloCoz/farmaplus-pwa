-- Migration: Add total_counted_items to inventory_ledger
-- Date: 2026-07-17
-- Purpose: Store the total physical quantity counted (sum of counted quantities) for audit and adjustments analysis, and backfill historical data.

-- 1. Add total_counted_items column
ALTER TABLE public.inventory_ledger 
ADD COLUMN IF NOT EXISTS total_counted_items INTEGER DEFAULT 0 NOT NULL;

-- 2. Backfill historic records from inventory_ledger_items
UPDATE public.inventory_ledger il
SET total_counted_items = COALESCE(
    (
      SELECT SUM(ili.counted_quantity)::INTEGER 
      FROM public.inventory_ledger_items ili 
      WHERE ili.ledger_id = il.id
    ), 
    0
);
