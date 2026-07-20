-- Migration: Fix RLS policies on inventories and branch_laboratories for configs and mod role
-- Date: 2026-07-17

-- 1. inventories SELECT policy
DROP POLICY IF EXISTS "RLS_inventories_select" ON public.inventories;
CREATE POLICY "RLS_inventories_select" ON public.inventories
    FOR SELECT USING (
        laboratory = '_CONFIG_'
        OR normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );

-- 2. inventories INSERT policy
DROP POLICY IF EXISTS "RLS_inventories_insert" ON public.inventories;
CREATE POLICY "RLS_inventories_insert" ON public.inventories
    FOR INSERT WITH CHECK (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );

-- 3. inventories UPDATE policy
DROP POLICY IF EXISTS "RLS_inventories_update" ON public.inventories;
CREATE POLICY "RLS_inventories_update" ON public.inventories
    FOR UPDATE USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );

-- 4. inventories DELETE policy
DROP POLICY IF EXISTS "RLS_inventories_delete" ON public.inventories;
CREATE POLICY "RLS_inventories_delete" ON public.inventories
    FOR DELETE USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );

-- 5. branch_laboratories SELECT policy
DROP POLICY IF EXISTS "RLS_branch_laboratories_select" ON public.branch_laboratories;
CREATE POLICY "RLS_branch_laboratories_select" ON public.branch_laboratories
    FOR SELECT USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );

-- 6. branch_laboratories ALL policy
DROP POLICY IF EXISTS "RLS_branch_laboratories_all" ON public.branch_laboratories;
CREATE POLICY "RLS_branch_laboratories_all" ON public.branch_laboratories
    FOR ALL USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'mod')
    );
