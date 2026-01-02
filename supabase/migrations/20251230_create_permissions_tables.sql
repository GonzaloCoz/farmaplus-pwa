-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create role_permissions table
-- Note: 'role' is a text column in profiles table, not a separate table, so we reference it as text.
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role TEXT NOT NULL,
    permission_code TEXT NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(role, permission_code)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
-- Permissions are readable by everyone authenticated (to check their own perms)
CREATE POLICY "Permissions are viewable by everyone" ON public.permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Role Permissions are viewable by everyone authenticated
CREATE POLICY "Role Permissions are viewable by everyone" ON public.role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only Super Admins (gcoz) or Admins can manage permissions (Rules to be refined or handled by app logic overrides initially)
-- For now, allow read-only for most, writes restricted effectively by UI logic but enforced here for safety if possible.
-- Since we don't have a robust "is_super_admin" database flag yet beyond hardcoded, we will allow 'admin' role to insert for now, or just 'authenticated' if we rely on app logic (risky).
-- Let's stick to safe defaults: Read access for everyone. Write access: we'll run seeds manually or via RPC.
-- Actually, the Admin UI needs to write.
-- Let's check 'admin' role for policies.

-- Policy for updating/inserting role_permissions (Only admins)
-- Assuming we have a way to check user role in RLS:
-- (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Seed Permissions
INSERT INTO public.permissions (code, description, category) VALUES
('VIEW_ADMIN_DASHBOARD', 'Ver el panel de administración principal', 'Dashboard'),
('MANAGE_INVENTORY_CONFIG', 'Configurar parámetros de inventario', 'Inventario'),
('VIEW_BRANCH_MONITOR', 'Ver el monitor de estado de sucursales', 'Dashboard'),
('EDIT_SETTINGS', 'Editar configuraciones globales', 'Sistema'),
('IMPERSONATE_BRANCH', 'Simular ser otra sucursal', 'Debug'),
('EDIT_DASHBOARD_LAYOUT', 'Modificar la disposición de widgets', 'Dashboard'),
('MANAGE_CALENDAR_EVENTS', 'Crear y editar eventos en el calendario', 'Calendario'),
('MANAGE_USERS', 'Crear y modificar usuarios (Solo Super Admin)', 'Usuarios')
ON CONFLICT (code) DO NOTHING;

-- Seed Role Assignments (Based on existing config)
-- Admin Role
INSERT INTO public.role_permissions (role, permission_code) VALUES
('admin', 'VIEW_ADMIN_DASHBOARD'),
('admin', 'MANAGE_INVENTORY_CONFIG'),
('admin', 'VIEW_BRANCH_MONITOR'),
('admin', 'EDIT_SETTINGS'),
('admin', 'IMPERSONATE_BRANCH'),
('admin', 'EDIT_DASHBOARD_LAYOUT'),
('admin', 'MANAGE_CALENDAR_EVENTS')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Mod Role
INSERT INTO public.role_permissions (role, permission_code) VALUES
('mod', 'VIEW_BRANCH_MONITOR'),
('mod', 'VIEW_ADMIN_DASHBOARD'),
('mod', 'EDIT_DASHBOARD_LAYOUT'),
('mod', 'MANAGE_CALENDAR_EVENTS'),
('mod', 'MANAGE_INVENTORY_CONFIG')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Branch Role (None currently, keeping empty)
