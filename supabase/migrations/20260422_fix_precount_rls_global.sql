-- Migration: Fix PreCount RLS for Global Sessions
-- Date: 2026-04-22
-- Purpose: Allow branch users to see sessions with no branch_id (global) and fix NULL comparisons.

-- 1. Sessions Policies (Update SELECT)
DROP POLICY IF EXISTS "Sessions SELECT isolation" ON public.precount_sessions;

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
  OR
  branch_id IS NULL -- Allow seeing global sessions
);

-- 2. Sessions Policies (Update ALL)
DROP POLICY IF EXISTS "Sessions ALL isolation" ON public.precount_sessions;

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
  OR
  (branch_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'mod')
  )
  OR
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  OR
  (branch_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
);
