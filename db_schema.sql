-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. AUDIT LOG SYSTEM
-- ==========================================

create table if not exists public.audit_logs (
    id uuid not null default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id),
    branch_id text,
    action text not null,       -- e.g., 'STOCK_UPDATE', 'LOGIN', 'DELETE_ITEM'
    entity_type text not null,  -- e.g., 'PRODUCT', 'INVENTORY', 'SYSTEM'
    entity_id text,             -- ID of the affected record
    details jsonb,              -- Snapshot of changes: { "old": ..., "new": ... }
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policies
-- Admins can view all logs
create policy "Admins can view all audit logs"
    on public.audit_logs for select
    using (
        auth.uid() in (
            select id from public.profiles where role = 'admin'
        )
    );

-- Users can insert logs (via service)
create policy "Users can insert audit logs"
    on public.audit_logs for insert
    with check (
        auth.uid() = user_id
    );

-- ==========================================
-- 2. NOTIFICATION SYSTEM
-- ==========================================

create table if not exists public.notifications (
    id uuid not null default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) not null,
    type text not null check (type in ('info', 'success', 'warning', 'error')),
    category text not null,     -- e.g., 'STOCK', 'EXPIRATION', 'SYSTEM'
    title text not null,
    message text not null,
    is_read boolean not null default false,
    metadata jsonb,             -- e.g., { "link": "/stock/product/123" }
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
-- Users can only see and edit their own notifications
create policy "Users can view own notifications"
    on public.notifications for select
    using (auth.uid() = user_id);

create policy "Users can update own notifications"
    on public.notifications for update
    using (auth.uid() = user_id);

-- System functions (or admins) can insert notifications
-- For simplicity in this PWA, we allow authenticated users to create notifications 
-- (e.g., if one user triggers an action that notifies another, or proper backend triggers)
create policy "Authenticated users can insert notifications"
    on public.notifications for insert
    with check (auth.role() = 'authenticated');

-- Realtime subscription
alter publication supabase_realtime add table public.notifications;
