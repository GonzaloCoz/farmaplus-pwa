-- Fix 'RLS Policy Always True' Warnings (v2)
-- This script restricts overly permissive policies that were allowing public/anonymous writes.
-- v2 Changes: Added explicit type casting (::text) for user_id comparisons to avoid "operator does not exist: uuid = text" errors.

-- 1. Fix 'branches' and 'profiles' (Service Role policies should be explicit)
DROP POLICY IF EXISTS "Allow all to service role" ON public.branches;
CREATE POLICY "Allow all to service role" ON public.branches TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all to service role profiles" ON public.profiles;
CREATE POLICY "Allow all to service role profiles" ON public.profiles TO service_role USING (true) WITH CHECK (true);

-- 2. Fix 'zonal_branches'
DROP POLICY IF EXISTS "Allow all to service role zonal_branches" ON public.zonal_branches;
CREATE POLICY "Allow all to service role zonal_branches" ON public.zonal_branches TO service_role USING (true) WITH CHECK (true);

-- 3. Fix 'branch_laboratories'
DROP POLICY IF EXISTS "Allow all to service role branch_laboratories" ON public.branch_laboratories;
CREATE POLICY "Allow all to service role branch_laboratories" ON public.branch_laboratories TO service_role USING (true) WITH CHECK (true);


-- 4. Fix 'inventories' (Was public, now restrict to authenticated)
DROP POLICY IF EXISTS "Allow public insert/update inventories" ON public.inventories;
DROP POLICY IF EXISTS "Allow public delete inventories" ON public.inventories;
DROP POLICY IF EXISTS "Allow public insert" ON public.inventories;
DROP POLICY IF EXISTS "Allow public update" ON public.inventories;

CREATE POLICY "Allow authenticated insert/update inventories" ON public.inventories 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);


-- 5. Fix 'inventory_adjustments'
DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory_adjustments;
CREATE POLICY "Allow authenticated insert inventory_adjustments" ON public.inventory_adjustments 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);


-- 6. Fix 'products' (Public -> Authenticated)
DROP POLICY IF EXISTS "Allow public insert" ON public.products;
DROP POLICY IF EXISTS "Allow public update" ON public.products;

CREATE POLICY "Allow authenticated insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- 7. Fix 'notifications' (Public -> Authenticated)
DROP POLICY IF EXISTS "Public insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public update own notifications" ON public.notifications;

-- Insert: Any auth user can create a notification
CREATE POLICY "Authenticated insert notifications" ON public.notifications 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Update: Only own notifications - Casting to text to prevent uuid vs text errors
CREATE POLICY "Authenticated update own notifications" ON public.notifications 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid()::text = user_id::text) 
    WITH CHECK (auth.uid()::text = user_id::text);


-- 8. Fix 'audit_logs' (Public insert -> Authenticated)
DROP POLICY IF EXISTS "Public insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated insert audit logs" ON public.audit_logs 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);


-- 9. Fix 'precount_sessions' (Was 'Enable all access', restrict to authenticated)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.precount_sessions;
DROP POLICY IF EXISTS "Users can delete sessions" ON public.precount_sessions;
DROP POLICY IF EXISTS "Users can insert sessions" ON public.precount_sessions;
DROP POLICY IF EXISTS "Users can update sessions" ON public.precount_sessions;

-- Read access
CREATE POLICY "Authenticated select sessions" ON public.precount_sessions FOR SELECT TO authenticated USING (true);

-- Write access (ensure ownership)
CREATE POLICY "Authenticated insert sessions" ON public.precount_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated update own sessions" ON public.precount_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated delete own sessions" ON public.precount_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 10. Fix 'branch_goals'
DROP POLICY IF EXISTS "Enable insert/update for all users" ON public.branch_goals;
CREATE POLICY "Authenticated manage branch_goals" ON public.branch_goals FOR ALL TO authenticated USING (true);
