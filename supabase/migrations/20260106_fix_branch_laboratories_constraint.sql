-- Migration to update unique constraint on branch_laboratories to include category
-- This allows the same laboratory to exist multiple times for a branch if it has different categories

-- 1. Add category column if it doesn't exist (it should, but safety first or check definition)
-- Checking previous definitions, usually it exists but wasn't part of the key.
-- Let's assume 'category' column exists. If not, we add it.
ALTER TABLE branch_laboratories ADD COLUMN IF NOT EXISTS category text;

-- 2. Drop the old unique constraint (assuming standard naming or we try to find it)
-- Usually it's branch_laboratories_branch_name_laboratory_key OR it is the PRIMARY KEY.
-- We'll try dropping the constraint by name if we can guess it, or just drop PK if it is PK.
-- Safe way: Drop Constraint if exists.

ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_branch_name_laboratory_key;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_pkey;

-- 3. Create new Unique Index/Constraint including category
-- We treat NULL category as 'Varios' or empty string to ensure uniqueness works? 
-- Ideally we shouldn't have NULL categories in this table if it's a dimensional table.
-- Let's make the constraint (branch_name, laboratory, category).

CREATE UNIQUE INDEX IF NOT EXISTS branch_laboratories_branch_lab_cat_idx 
ON branch_laboratories (branch_name, laboratory, category);

-- Optionally set it as Primary Key if appropriate, but unique index is enough for upsert.
ALTER TABLE branch_laboratories ADD PRIMARY KEY USING INDEX branch_laboratories_branch_lab_cat_idx;
