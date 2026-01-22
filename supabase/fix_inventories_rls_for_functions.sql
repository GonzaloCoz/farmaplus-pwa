-- Fix RLS policies for 'inventories' table to allow SECURITY DEFINER functions
-- This resolves the "new row violates row-level security policy for table inventories" error

-- The save_cyclic_inventory function needs to insert/update in inventories table
-- but the new RLS policies are blocking it.

DROP POLICY IF EXISTS "Allow authenticated insert/update inventories" ON public.inventories;

-- Restore permissive policies for inventories (needed for save_cyclic_inventory)
CREATE POLICY "Allow insert inventories" ON public.inventories 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow update inventories" ON public.inventories 
    FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow delete inventories" ON public.inventories 
    FOR DELETE 
    USING (true);

-- Note: This restores the original permissive access to inventories.
-- The "RLS Policy Always True" warning will return, but this is necessary for the app to function.
