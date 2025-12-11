-- Add was_readjusted column to inventories table
ALTER TABLE public.inventories 
ADD COLUMN IF NOT EXISTS was_readjusted BOOLEAN DEFAULT FALSE;
