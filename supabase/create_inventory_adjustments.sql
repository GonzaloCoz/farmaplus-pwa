-- Create table for tracking Cyclic Inventory Adjustments History
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    adjustment_id_shortage TEXT,
    adjustment_id_surplus TEXT,
    shortage_value NUMERIC DEFAULT 0,
    surplus_value NUMERIC DEFAULT 0,
    total_units_adjusted INTEGER DEFAULT 0,
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (since we are using client-side auth loosely or as a PWA)
-- Ideally, constrain this to authenticated users, but sticking to existing pattern
CREATE POLICY "Allow public read access" ON public.inventory_adjustments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.inventory_adjustments FOR INSERT WITH CHECK (true);
