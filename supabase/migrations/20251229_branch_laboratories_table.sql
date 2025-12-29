
-- Migration: Create branch_laboratories metadata table
-- Date: 2025-12-29
-- Purpose: Store aggregated laboratory progress and statistics for fast queries

-- Create the metadata table
CREATE TABLE IF NOT EXISTS public.branch_laboratories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    
    -- Item counts
    total_items INTEGER DEFAULT 0,
    controlled_items INTEGER DEFAULT 0,
    adjusted_items INTEGER DEFAULT 0,
    pending_items INTEGER DEFAULT 0,
    
    -- Progress
    progress_percentage NUMERIC DEFAULT 0,
    
    -- Financial data (only from adjusted/controlled items)
    total_system_units INTEGER DEFAULT 0,
    net_units INTEGER DEFAULT 0,
    net_value NUMERIC DEFAULT 0,
    negative_value NUMERIC DEFAULT 0,
    positive_value NUMERIC DEFAULT 0,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Unique constraint
    UNIQUE(branch_name, laboratory)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_laboratories_branch ON public.branch_laboratories(branch_name);
CREATE INDEX IF NOT EXISTS idx_branch_laboratories_status ON public.branch_laboratories(status);
CREATE INDEX IF NOT EXISTS idx_branch_laboratories_progress ON public.branch_laboratories(progress_percentage);

-- Enable RLS
ALTER TABLE public.branch_laboratories ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow public read branch_laboratories" ON public.branch_laboratories FOR SELECT USING (true);

-- Allow all to service role
CREATE POLICY "Allow all to service role branch_laboratories" ON public.branch_laboratories FOR ALL USING (true) WITH CHECK (true);

-- Create function to auto-update last_updated timestamp
CREATE OR REPLACE FUNCTION update_branch_laboratories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_branch_laboratories_timestamp ON public.branch_laboratories;
CREATE TRIGGER update_branch_laboratories_timestamp
    BEFORE UPDATE ON public.branch_laboratories
    FOR EACH ROW
    EXECUTE FUNCTION update_branch_laboratories_timestamp();
