-- ==============================================================================
-- Migration: Fix Ledger RLS Policies for Branch Users & Public Clients
-- Date: 2026-09-30
-- Description: Unblocks SELECT queries on inventory_ledger and inventory_ledger_items
--              so branch users, local network clients, and production clients can
--              view Folios and counted items history without fallback to legacy tables.
-- ==============================================================================

-- 1. Grant base permissions to roles
GRANT ALL ON TABLE public.inventory_ledger TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventory_ledger_items TO anon, authenticated, service_role;

-- 2. Ensure RLS is active
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger_items ENABLE ROW LEVEL SECURITY;

-- 3. Reset and fix SELECT policy for inventory_ledger
DROP POLICY IF EXISTS "RLS_ledger_select_isolation" ON public.inventory_ledger;
DROP POLICY IF EXISTS "Allow select to authenticated users on ledger" ON public.inventory_ledger;
DROP POLICY IF EXISTS "Allow public read on ledger" ON public.inventory_ledger;

CREATE POLICY "Allow public read on ledger" ON public.inventory_ledger
    FOR SELECT
    USING (true);

-- 4. Reset and fix SELECT policy for inventory_ledger_items
DROP POLICY IF EXISTS "Allow read to authenticated users on ledger items" ON public.inventory_ledger_items;
DROP POLICY IF EXISTS "Allow public read on ledger items" ON public.inventory_ledger_items;

CREATE POLICY "Allow public read on ledger items" ON public.inventory_ledger_items
    FOR SELECT
    USING (true);

-- 5. Keep INSERT policies robust for all client updates
DROP POLICY IF EXISTS "Allow insert to authenticated users on ledger" ON public.inventory_ledger;
CREATE POLICY "Allow insert to authenticated users on ledger" ON public.inventory_ledger
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert to authenticated users on ledger items" ON public.inventory_ledger_items;
CREATE POLICY "Allow insert to authenticated users on ledger items" ON public.inventory_ledger_items
    FOR INSERT
    WITH CHECK (true);
