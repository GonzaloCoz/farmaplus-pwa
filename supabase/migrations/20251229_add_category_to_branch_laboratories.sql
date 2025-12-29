-- Add category column to branch_laboratories table
-- This allows the same laboratory to appear in multiple categories (rubros)

ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'MEDICAMENTOS';

-- Update the unique constraint to include category
-- This allows the same lab to exist in different categories
ALTER TABLE public.branch_laboratories 
DROP CONSTRAINT IF EXISTS branch_laboratories_branch_name_laboratory_key;

-- Add new unique constraint including category
ALTER TABLE public.branch_laboratories 
ADD CONSTRAINT branch_laboratories_branch_lab_category_key 
UNIQUE (branch_name, laboratory, category);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_branch_laboratories_category 
ON public.branch_laboratories(category);
