
-- ==========================================
-- Migration: Fix RLS Normalization and Ledger Permissions
-- Date: 2026-03-13
-- Purpose: 1. Fix visibility issue caused by string case mismatch in RLS
--          2. Allow authenticated users to write to the ledger
-- ==========================================

-- 1. Fix INVENTORIES RLS (Use normalization for comparison)
DROP POLICY IF EXISTS "RLS_inventories_select" ON public.inventories;
CREATE POLICY "RLS_inventories_select" ON public.inventories
    FOR SELECT USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "RLS_inventories_insert" ON public.inventories;
CREATE POLICY "RLS_inventories_insert" ON public.inventories
    FOR INSERT WITH CHECK (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "RLS_inventories_update" ON public.inventories;
CREATE POLICY "RLS_inventories_update" ON public.inventories
    FOR UPDATE USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "RLS_inventories_delete" ON public.inventories;
CREATE POLICY "RLS_inventories_delete" ON public.inventories
    FOR DELETE USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 2. Fix BRANCH_LABORATORIES RLS
DROP POLICY IF EXISTS "RLS_branch_laboratories_select" ON public.branch_laboratories;
CREATE POLICY "RLS_branch_laboratories_select" ON public.branch_laboratories
    FOR SELECT USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "RLS_branch_laboratories_all" ON public.branch_laboratories;
CREATE POLICY "RLS_branch_laboratories_all" ON public.branch_laboratories
    FOR ALL USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Fix LEDGER Permissions (Allow INSERT to branch users)
DROP POLICY IF EXISTS "Allow insert to authenticated users on ledger" ON public.inventory_ledger;
CREATE POLICY "Allow insert to authenticated users on ledger" ON public.inventory_ledger 
    FOR INSERT WITH CHECK (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "Allow insert to authenticated users on ledger items" ON public.inventory_ledger_items;
CREATE POLICY "Allow insert to authenticated users on ledger items" ON public.inventory_ledger_items 
    FOR INSERT WITH CHECK (true); -- Detail items depend on header insert permission via foreign key anyway

-- 4. Audit Log
INSERT INTO public.audit_logs (action, entity_type, details)
VALUES ('SYSTEM_RLS_FIX', 'SYSTEM', '{"description": "Normalized branch_name comparison in RLS and added ledger INSERT policies"}');
