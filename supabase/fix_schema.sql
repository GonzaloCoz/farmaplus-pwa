
-- Fix Schema: Add missing columns if table already existed

-- 1. Ensure 'branches' table exists (in case it failed too)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb
);

-- 2. Modify 'profiles' to add branch_id if missing
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 3. Ensure role column exists (just in case)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'branch';

-- 4. Add constraint if not exists (handling via DO block is complex in simple SQL editor, skipping specific constraint check for now, trusting column add)
