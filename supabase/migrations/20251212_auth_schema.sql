
-- Create Tables for Auth & Branches

-- 1. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb
);

-- 2. Profiles Table (Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'branch', 'auditor')),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS Policies (Simple for now: public read for auth users)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (or public for now since we have custom auth)
CREATE POLICY "Allow public read branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);

-- Allow insert/update only to admins (we simulate this later via app logic or auth.uid)
CREATE POLICY "Allow all to service role" ON public.branches USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to service role profiles" ON public.profiles USING (true) WITH CHECK (true);
