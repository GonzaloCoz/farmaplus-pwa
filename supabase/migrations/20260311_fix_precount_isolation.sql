-- Migration: Fix PreCount Session Isolation and RLS
-- Date: 2026-03-11
-- Purpose: Ensure sessions are private to branches, except for admins and mods.

-- 1. Drop old permissive policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.precount_sessions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.precount_items;

-- 2. Sessions Policies
-- SELECT: Admins/Mods see all, Branch users see their own
CREATE POLICY "Sessions SELECT isolation" ON public.precount_sessions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'mod')
  )
  OR
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

-- ALL (INSERT/UPDATE/DELETE): Same criteria
CREATE POLICY "Sessions ALL isolation" ON public.precount_sessions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'mod')
  )
  OR
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'mod')
  )
  OR
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

-- 3. Items Policies
-- These inherit the isolation from the sessions they belong to
CREATE POLICY "Items isolation inherited" ON public.precount_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.precount_sessions s
    WHERE s.id = session_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.precount_sessions s
    WHERE s.id = session_id
  )
);

-- 4. Enable RLS (just in case)
ALTER TABLE public.precount_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precount_items ENABLE ROW LEVEL SECURITY;
