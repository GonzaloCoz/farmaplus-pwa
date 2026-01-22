-- Enable RLS on precount tables as reported in security advisories
-- Policies already exist, but RLS enforcement needs to be turned on.

ALTER TABLE public.precount_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precount_items ENABLE ROW LEVEL SECURITY;

-- Optional: Verify policies exist (re-applying them is harmless if 'IF NOT EXISTS' is used, 
-- but since the error confims they exist, we just enable RLS).

-- Just in case they were missing or we want to be sure:
-- CREATE POLICY "Enable all access for authenticated users" ON public.precount_sessions
--    FOR ALL USING (auth.role() = 'authenticated');

-- CREATE POLICY "Enable all access for authenticated users" ON public.precount_items
--    FOR ALL USING (auth.role() = 'authenticated');
