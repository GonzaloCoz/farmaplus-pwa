-- FIX: App Versions & Inventories RLS/Conflicts

-- 1. Restore access to app_versions
-- We allow authenticated users to view and manage versions (Publishing)
DROP POLICY IF EXISTS "Anyone can view app versions" ON public.app_versions;
DROP POLICY IF EXISTS "Authenticated users can manage app versions" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_read" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_insert" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_update" ON public.app_versions;

CREATE POLICY "Allow authenticated read app_versions" ON public.app_versions 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert app_versions" ON public.app_versions 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update app_versions" ON public.app_versions 
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Ensure Inventories has full access for authenticated users
-- (Sometimes FOR ALL doesn't behave as expected with complex triggers/view dependencies)
DROP POLICY IF EXISTS "Allow authenticated insert/update inventories" ON public.inventories;
DROP POLICY IF EXISTS "Authenticated manage inventories" ON public.inventories;

CREATE POLICY "Authenticated manage inventories" ON public.inventories 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 3. Grant permissions explicitly (Just in case)
GRANT ALL ON TABLE public.app_versions TO authenticated;
GRANT ALL ON TABLE public.inventories TO authenticated;
GRANT ALL ON TABLE public.branch_laboratories TO authenticated;
