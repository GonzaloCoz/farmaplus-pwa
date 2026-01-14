-- Add category column to inventory_adjustments to track adjustments by Rubro
ALTER TABLE public.inventory_adjustments 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_category ON public.inventory_adjustments(category);
