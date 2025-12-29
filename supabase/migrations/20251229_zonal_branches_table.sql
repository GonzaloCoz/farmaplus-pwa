
-- Migration: Create zonal_branches junction table
-- Date: 2025-12-29
-- Purpose: Map zonal moderators to their assigned branches

-- Create the junction table
CREATE TABLE IF NOT EXISTS public.zonal_branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zonal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(zonal_id, branch_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_zonal_branches_zonal_id ON public.zonal_branches(zonal_id);
CREATE INDEX IF NOT EXISTS idx_zonal_branches_branch_id ON public.zonal_branches(branch_id);

-- Enable RLS
ALTER TABLE public.zonal_branches ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow public read zonal_branches" ON public.zonal_branches FOR SELECT USING (true);

-- Allow all to service role
CREATE POLICY "Allow all to service role zonal_branches" ON public.zonal_branches USING (true) WITH CHECK (true);
