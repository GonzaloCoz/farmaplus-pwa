-- ==========================================
-- FINAL RLS & PERMISSIONS FIX: Cyclic Inventory
-- Run this in the Supabase SQL Editor if you get 401/42501 errors
-- ==========================================

-- 1. SCHEMA USAGE
-- Without this, anon users cannot see the public schema at all
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. TABLE PERMISSIONS (GRANTS)
-- RLS only works if the user has permission to at least attempt the operation
GRANT ALL ON TABLE public.branch_laboratories TO anon, authenticated;
GRANT ALL ON TABLE public.inventory_adjustments TO anon, authenticated;
GRANT ALL ON TABLE public.inventory_reports TO anon, authenticated;
GRANT ALL ON TABLE public.inventories TO anon, authenticated;
GRANT ALL ON TABLE public.products TO anon, authenticated;
GRANT ALL ON TABLE public.branch_goals TO anon, authenticated;
GRANT ALL ON TABLE public.zonal_branches TO anon, authenticated;
GRANT ALL ON TABLE public.profiles TO anon, authenticated;

-- 3. SEQUENCE PERMISSIONS
-- Required if sequences are used for ID generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. RLS POLICIES (OPEN ACCESS)
-- Restore access to branch_laboratories for real-time monitoring
DROP POLICY IF EXISTS "Allow all to service role branch_laboratories" ON public.branch_laboratories;
DROP POLICY IF EXISTS "Allow authenticated management of branch_laboratories" ON public.branch_laboratories;
DROP POLICY IF EXISTS "Allow public management of branch_laboratories" ON public.branch_laboratories;

CREATE POLICY "Allow public management of branch_laboratories" ON public.branch_laboratories FOR ALL USING (true) WITH CHECK (true);

-- Ensure inventory_adjustments has full access for history saving
DROP POLICY IF EXISTS "Allow authenticated management of inventory_adjustments" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "Allow public management of inventory_adjustments" ON public.inventory_adjustments;

CREATE POLICY "Allow public management of inventory_adjustments" ON public.inventory_adjustments FOR ALL USING (true) WITH CHECK (true);

-- Ensure inventory_reports has full access for snapshot saving
DROP POLICY IF EXISTS "Allow authenticated management of inventory_reports" ON public.inventory_reports;
DROP POLICY IF EXISTS "Allow public management of inventory_reports" ON public.inventory_reports;

CREATE POLICY "Allow public management of inventory_reports" ON public.inventory_reports FOR ALL USING (true) WITH CHECK (true);

-- Ensure inventories table has full access
DROP POLICY IF EXISTS "Allow authenticated management of inventories" ON public.inventories;
DROP POLICY IF EXISTS "Allow public management of inventories" ON public.inventories;

CREATE POLICY "Allow public management of inventories" ON public.inventories FOR ALL USING (true) WITH CHECK (true);

-- Ensure branch_goals and zonal_branches are readable
DROP POLICY IF EXISTS "Allow public read zonal_branches" ON public.zonal_branches;
CREATE POLICY "Allow public read zonal_branches" ON public.zonal_branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public management of branch_goals" ON public.branch_goals;
CREATE POLICY "Allow public management of branch_goals" ON public.branch_goals FOR ALL USING (true) WITH CHECK (true);

