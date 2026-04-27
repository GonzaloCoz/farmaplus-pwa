-- FIX: Restore Authenticated access to tables restricted to service_role
-- This fixes the issue where the dashboard (Monitor de Sucursales) showed empty data.

-- 1. branch_laboratories
DROP POLICY IF EXISTS "Allow authenticated select branch_laboratories" ON public.branch_laboratories;
CREATE POLICY "Allow authenticated select branch_laboratories" ON public.branch_laboratories 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 2. zonal_branches
DROP POLICY IF EXISTS "Allow authenticated select zonal_branches" ON public.zonal_branches;
CREATE POLICY "Allow authenticated select zonal_branches" ON public.zonal_branches 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 3. branches
DROP POLICY IF EXISTS "Allow authenticated select branches" ON public.branches;
CREATE POLICY "Allow authenticated select branches" ON public.branches 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 4. profiles
DROP POLICY IF EXISTS "Allow authenticated select profiles" ON public.profiles;
CREATE POLICY "Allow authenticated select profiles" ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING (true);
