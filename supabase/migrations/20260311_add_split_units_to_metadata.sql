
-- Migration: Add split unit counts to branch_laboratories
-- Date: 2026-03-11
-- Purpose: Support separate visualization of negative and positive unit adjustments

ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS negative_units INTEGER DEFAULT 0;

ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS positive_units INTEGER DEFAULT 0;

-- Update existing records if possible (though we only have net_units persisted)
-- Since we can't reconstruct historical data perfectly from just net_units, 
-- we leave them at 0 and let the next sync populate them.
