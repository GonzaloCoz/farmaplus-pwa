-- Migration: Create requests table for Farmaplus PWA
-- Description: Centralized requests table for lab removals, adjustments, and branch requests

CREATE TABLE IF NOT EXISTS public.requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'Baja de Laboratorio',
    branch_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    category TEXT,
    round INTEGER,
    reason TEXT NOT NULL,
    comments TEXT,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast retrieval by branch and status
CREATE INDEX IF NOT EXISTS idx_requests_branch_name ON public.requests (branch_name);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_requested_at ON public.requests (requested_at DESC);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users and public
CREATE POLICY "Allow select on requests"
    ON public.requests
    FOR SELECT
    USING (true);

-- Allow insert access
CREATE POLICY "Allow insert on requests"
    ON public.requests
    FOR INSERT
    WITH CHECK (true);

-- Allow update access
CREATE POLICY "Allow update on requests"
    ON public.requests
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow delete access
CREATE POLICY "Allow delete on requests"
    ON public.requests
    FOR DELETE
    USING (true);

-- Enable Realtime publication for instant live updates across all clients
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
