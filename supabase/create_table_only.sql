-- Run this ONLY if the table doesn't exist yet
CREATE TABLE IF NOT EXISTS public.branch_laboratories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.branch_laboratories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.branch_laboratories FOR SELECT USING (true);
