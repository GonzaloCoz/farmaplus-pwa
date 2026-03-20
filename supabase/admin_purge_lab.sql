-- ==========================================
-- RPC to purge a specific laboratory for a branch (ADMIN ONLY)
-- Includes password protection and audit logging
-- ==========================================

CREATE OR REPLACE FUNCTION admin_purge_lab_inventory_v1(
    p_branch_name TEXT,
    p_lab_name TEXT,
    p_password TEXT,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_count_inv INTEGER;
    v_count_meta INTEGER;
    v_count_adj INTEGER;
BEGIN
    -- 1. Security Check: Password
    -- Note: In a real production system, this should be compared against a salted hash in a secrets table.
    -- For this specific request, we use the hardcoded "pistacho" check within the DB function.
    IF p_password <> 'pistacho' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Contraseña administrativa incorrecta'
        );
    END IF;

    -- 2. Perform Deletion
    -- Delete from inventories
    DELETE FROM public.inventories 
    WHERE branch_name ILIKE p_branch_name 
    AND laboratory ILIKE p_lab_name;
    GET DIAGNOSTICS v_count_inv = ROW_COUNT;

    -- Delete from branch_laboratories (metadata/progress)
    DELETE FROM public.branch_laboratories 
    WHERE branch_name ILIKE p_branch_name
    AND laboratory ILIKE p_lab_name;
    GET DIAGNOSTICS v_count_meta = ROW_COUNT;

    -- Delete from inventory_adjustments (history summaries)
    DELETE FROM public.inventory_adjustments 
    WHERE branch_name ILIKE p_branch_name
    AND laboratory ILIKE p_lab_name;
    GET DIAGNOSTICS v_count_adj = ROW_COUNT;

    -- Delete from inventory_reports (snapshots/PDFs)
    DELETE FROM public.inventory_reports 
    WHERE branch_name ILIKE p_branch_name
    AND laboratory ILIKE p_lab_name;

    -- Delete from inventory_ledger_items (via ledger_id)
    DELETE FROM public.inventory_ledger_items
    WHERE ledger_id IN (
        SELECT id FROM public.inventory_ledger 
        WHERE branch_name ILIKE p_branch_name 
        AND laboratory ILIKE p_lab_name
    );

    -- Delete from inventory_ledger
    DELETE FROM public.inventory_ledger
    WHERE branch_name ILIKE p_branch_name
    AND laboratory ILIKE p_lab_name;

    -- 3. Log the action in audit_logs
    INSERT INTO public.audit_logs (
        user_id, 
        branch_id, 
        action, 
        entity_type, 
        entity_id, 
        details
    )
    VALUES (
        p_user_id, 
        NULL, -- Could be resolved from branch_name if needed
        'ADMIN_PURGE_LAB', 
        'laboratory', 
        p_lab_name, 
        json_build_object(
            'branch', p_branch_name, 
            'lab', p_lab_name,
            'timestamp', now(),
            'rows_affected', json_build_object(
                'inventories', v_count_inv,
                'metadata', v_count_meta,
                'adjustments', v_count_adj
            )
        )
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'El laboratorio ' || p_lab_name || ' ha sido reiniciado correctamente para la sucursal ' || p_branch_name,
        'deleted_items', v_count_inv
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
