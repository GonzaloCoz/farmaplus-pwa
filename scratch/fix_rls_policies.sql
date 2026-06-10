-- ========================================================
-- SCRIPT DE MIGRACIÓN: Corrección de RLS para inventory_ledger
-- Ejecutar en el Editor SQL de tu panel de Supabase
-- ========================================================

-- 1. Corregir política SELECT para public.inventory_ledger
-- La política anterior buscaba 'profiles.branch_name', pero la columna real es 'profiles.branch_id' que conecta con 'branches(name)'.
DROP POLICY IF EXISTS "RLS_ledger_select_isolation" ON public.inventory_ledger;
CREATE POLICY "RLS_ledger_select_isolation" ON public.inventory_ledger
    FOR SELECT USING (
        normalize_string_sql(branch_name) = (
            SELECT normalize_string_sql(b.name) 
            FROM public.profiles p 
            JOIN public.branches b ON p.branch_id = b.id 
            WHERE p.id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 2. Corregir política INSERT para public.inventory_ledger
DROP POLICY IF EXISTS "Allow insert to authenticated users on ledger" ON public.inventory_ledger;
CREATE POLICY "Allow insert to authenticated users on ledger" ON public.inventory_ledger 
    FOR INSERT WITH CHECK (
        normalize_string_sql(branch_name) = (
            SELECT normalize_string_sql(b.name) 
            FROM public.profiles p 
            JOIN public.branches b ON p.branch_id = b.id 
            WHERE p.id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Crear política de UPDATE para public.inventory_ledger (Faltaba en la base de datos)
-- Permite a los usuarios autorizados modificar los IDs de ajuste de sesiones ya finalizadas.
DROP POLICY IF EXISTS "Allow update to authenticated users on ledger" ON public.inventory_ledger;
CREATE POLICY "Allow update to authenticated users on ledger" ON public.inventory_ledger 
    FOR UPDATE USING (
        normalize_string_sql(branch_name) = (
            SELECT normalize_string_sql(b.name) 
            FROM public.profiles p 
            JOIN public.branches b ON p.branch_id = b.id 
            WHERE p.id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
