-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    branch_id TEXT, -- Can be branch name or UUID
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin can view all
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert (everyone for now, as actions happen by logged in users)
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
