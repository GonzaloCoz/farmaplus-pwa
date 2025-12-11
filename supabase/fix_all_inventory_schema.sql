-- ==========================================
-- FINAL FIX: Cyclic Inventory Schema v2
-- Run this in the Supabase SQL Editor to resolve all 400/404 errors
-- ==========================================

-- 1. Create 'inventory_adjustments' table (History)
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

-- 2. Ensure 'inventories' table exists and has correct columns
CREATE TABLE IF NOT EXISTS public.inventories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    ean TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    system_quantity INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'controlled', 'adjusted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add 'was_readjusted' column if it's missing (The cause of 400 error)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventories' AND column_name = 'was_readjusted') THEN
        ALTER TABLE public.inventories ADD COLUMN was_readjusted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;

-- 5. Create OPEN Policies (Fixes 404/401 errors for basic apps)
-- Note: In a stricter app, you would restrict this to authenticated users.
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "Allow public read inventories" ON public.inventories;
DROP POLICY IF EXISTS "Allow public insert/update inventories" ON public.inventories;
DROP POLICY IF EXISTS "Allow public delete inventories" ON public.inventories;

CREATE POLICY "Allow public read access" ON public.inventory_adjustments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.inventory_adjustments FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read inventories" ON public.inventories FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update inventories" ON public.inventories FOR ALL USING (true);
