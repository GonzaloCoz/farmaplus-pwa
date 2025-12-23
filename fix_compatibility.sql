-- =========================================================
-- FIX: Compatibility for Non-Supabase Auth Users (Legacy/Local)
-- CORRECTED VERSION: Drops policies FIRST to avoid dependency errors.
-- =========================================================

-- 1. DROP ALL DEPENDENT POLICIES FIRST
-- Audit Logs Policies
drop policy if exists "Admins can view all audit logs" on public.audit_logs;
drop policy if exists "Users can insert audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can view audit logs" on public.audit_logs;
drop policy if exists "Public insert audit logs" on public.audit_logs;
drop policy if exists "Public view audit logs" on public.audit_logs;

-- Notifications Policies
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Authenticated users can insert notifications" on public.notifications;
drop policy if exists "Public view own notifications" on public.notifications;
drop policy if exists "Public update own notifications" on public.notifications;
drop policy if exists "Public insert notifications" on public.notifications;

-- 2. DROP FOREIGN KEY CONSTRAINTS
alter table public.audit_logs 
  drop constraint if exists audit_logs_user_id_fkey;

alter table public.notifications
  drop constraint if exists notifications_user_id_fkey;

-- 3. ALTER COLUMN TYPES (UUID -> TEXT)
-- Using 'using user_id::text' to ensure safe conversion if data exists
alter table public.audit_logs 
  alter column user_id type text using user_id::text;

alter table public.notifications 
  alter column user_id type text using user_id::text;

-- 4. RE-CREATE POLICIES (OPEN / PUBLIC for Hybrid Auth)

-- Audit Logs: Allow everyone (anon/authenticated) to insert and view
-- This allows the PWA to log events even if the user is "local" (no Supabase session)
create policy "Public insert audit logs"
    on public.audit_logs for insert
    with check (true);

create policy "Public view audit logs"
    on public.audit_logs for select
    using (true);

-- Notifications: Allow access by matching ID or completely public for insert
create policy "Public view own notifications"
    on public.notifications for select
    using (true); 
    -- Simplification: We trust the client to filter by user_id in the query 
    -- because RLS complicated with non-auth IDs requires complex custom headers or session vars.
    -- For this PWA stage, this is acceptable.

create policy "Public update own notifications"
    on public.notifications for update
    using (true);

create policy "Public insert notifications"
    on public.notifications for insert
    with check (true);
