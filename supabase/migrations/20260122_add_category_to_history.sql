-- Add category support to history and reports
ALTER TABLE public.inventory_adjustments ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.inventory_reports ADD COLUMN IF NOT EXISTS category TEXT;

-- Update existing records if possible (optional, but good for data integrity)
-- If we had a way to infer it, we would. For now they remain NULL.

COMMENT ON COLUMN public.inventory_adjustments.category IS 'The category (rubro) of the items adjusted in this session';
COMMENT ON COLUMN public.inventory_reports.category IS 'The category (rubro) of the items in this snapshot';
