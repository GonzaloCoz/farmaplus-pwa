-- Relaxed policies for PWA context where maybe not all admins have 'admin' role in profiles table yet
-- Drop existing policies first
drop policy if exists "Admins can view all audit logs" on public.audit_logs;
drop policy if exists "Users can insert audit logs" on public.audit_logs;

-- New Policies
-- Allow ANY authenticated user to insert logs (needed for logging actions)
create policy "Authenticated users can insert audit logs"
    on public.audit_logs for insert
    with check (auth.role() = 'authenticated');

-- Allow ANY authenticated user to view logs (for now, to debug visibility)
-- In a stricter app, we would enforce role check, but let's first ensure data flow works.
create policy "Authenticated users can view audit logs"
    on public.audit_logs for select
    using (auth.role() = 'authenticated');
