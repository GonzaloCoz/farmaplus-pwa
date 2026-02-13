-- ==========================================
-- Inventory Lock System RPC
-- Manages manual lock/unlock for branch inventories
-- ==========================================

CREATE OR REPLACE FUNCTION public.toggle_branch_lock(
    p_branch_name TEXT,
    p_is_locked BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_clean_branch TEXT;
BEGIN
    -- 1. Normalize branch name (same as save_branch_config)
    v_clean_branch := UPPER(TRIM(p_branch_name));
    v_clean_branch := REPLACE(v_clean_branch, 'Á', 'A');
    v_clean_branch := REPLACE(v_clean_branch, 'É', 'E');
    v_clean_branch := REPLACE(v_clean_branch, 'Í', 'I');
    v_clean_branch := REPLACE(v_clean_branch, 'Ó', 'O');
    v_clean_branch := REPLACE(v_clean_branch, 'Ú', 'U');
    v_clean_branch := REPLACE(v_clean_branch, 'Ñ', 'N');
    
    -- 2. Ensure CONFIG_LOCK product exists
    INSERT INTO public.products (ean, name, category, laboratory, cost)
    VALUES ('CONFIG_LOCK', 'Configuración: Estado de Bloqueo', 'SISTEMA', '_CONFIG_', 0)
    ON CONFLICT (ean) DO NOTHING;
    
    -- 3. Delete existing lock config
    DELETE FROM public.inventories
    WHERE (branch_name = v_clean_branch OR branch_name ILIKE p_branch_name)
      AND laboratory = '_CONFIG_'
      AND ean = 'CONFIG_LOCK';
    
    -- 4. Insert new lock status (1 = locked, 0 = unlocked)
    INSERT INTO public.inventories (
        branch_name,
        laboratory,
        ean,
        quantity,
        system_quantity,
        status,
        category,
        updated_at
    )
    VALUES (
        v_clean_branch,
        '_CONFIG_',
        'CONFIG_LOCK',
        CASE WHEN p_is_locked THEN 1 ELSE 0 END,
        0,
        'pending',
        'SISTEMA',
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.toggle_branch_lock(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_branch_lock(TEXT, BOOLEAN) TO anon;
