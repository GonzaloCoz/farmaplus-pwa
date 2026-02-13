-- ==========================================
-- RPC to purge branch cyclic inventory data (FIXED)
-- ==========================================

CREATE OR REPLACE FUNCTION purge_branch_cyclic_inventory(p_branch_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Delete items from inventories (excluding configuration records)
    DELETE FROM public.inventories 
    WHERE branch_name ILIKE p_branch_name 
    AND laboratory <> '_CONFIG_';

    -- 2. Delete lab metadata (progress tracking)
    DELETE FROM public.branch_laboratories 
    WHERE branch_name ILIKE p_branch_name;

    -- 3. Delete adjustment history
    DELETE FROM public.inventory_adjustments 
    WHERE branch_name ILIKE p_branch_name;

    -- 4. Delete immutable reports (snapshots)
    DELETE FROM public.inventory_reports 
    WHERE branch_name ILIKE p_branch_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
