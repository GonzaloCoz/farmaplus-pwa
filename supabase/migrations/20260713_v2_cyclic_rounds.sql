-- Migration: Add round column to inventories and branch_laboratories
-- Date: 2026-07-13
-- Purpose: Add multi-round and micro-round support without losing existing active data.

-- 1. Add round column to inventories
ALTER TABLE public.inventories 
ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1 NOT NULL;

-- 2. Add round column to branch_laboratories
ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1 NOT NULL;

-- 3. Recreate Unique Constraint on branch_laboratories (include round)
ALTER TABLE public.branch_laboratories 
DROP CONSTRAINT IF EXISTS branch_laboratories_unique_key CASCADE;

ALTER TABLE public.branch_laboratories 
DROP CONSTRAINT IF EXISTS branch_laboratories_branch_lab_cat_unique CASCADE;

DROP INDEX IF EXISTS public.branch_laboratories_branch_lab_cat_idx CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS branch_laboratories_unique_key_v2_idx 
ON public.branch_laboratories (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(category)), round);

ALTER TABLE public.branch_laboratories 
ADD CONSTRAINT branch_laboratories_unique_key_v2 
UNIQUE USING INDEX branch_laboratories_unique_key_v2_idx;

-- 4. Recreate Unique Constraint on inventories (include round)
ALTER TABLE public.inventories 
DROP CONSTRAINT IF EXISTS inventories_branch_lab_ean_unique CASCADE;

DROP INDEX IF EXISTS public.inventories_branch_lab_ean_idx CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS inventories_branch_lab_ean_round_idx 
ON public.inventories (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round);

ALTER TABLE public.inventories 
ADD CONSTRAINT inventories_branch_lab_ean_round_unique 
UNIQUE USING INDEX inventories_branch_lab_ean_round_idx;

-- 5. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_inventories_round ON public.inventories(round);
CREATE INDEX IF NOT EXISTS idx_branch_laboratories_round ON public.branch_laboratories(round);
