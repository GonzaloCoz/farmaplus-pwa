-- ========================================================
-- Migration: Fix admin_purge_lab_inventory_v1 normalization
-- Date: 2026-05-26
-- ========================================================

CREATE OR REPLACE FUNCTION admin_purge_lab_inventory_v1(
    p_branch_name TEXT,
    p_lab_name TEXT,
    p_password TEXT,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_branch TEXT := public.normalize_string_sql(p_branch_name);
    v_lab TEXT := public.normalize_string_sql(p_lab_name);
    v_count_inv INTEGER;
    v_count_meta INTEGER;
    v_count_adj INTEGER;
BEGIN
    -- 1. Security Check: Password
    IF p_password <> 'pistacho' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Contraseña administrativa incorrecta'
        );
    END IF;

    -- 2. Perform Deletion using robust normalization
    -- Delete from public.inventory_ledger_items
    DELETE FROM public.inventory_ledger_items
    WHERE ledger_id IN (
        SELECT id FROM public.inventory_ledger 
        WHERE public.normalize_string_sql(branch_name) = v_branch 
        AND public.normalize_string_sql(laboratory) = v_lab
    );

    -- Delete from public.inventory_ledger
    DELETE FROM public.inventory_ledger
    WHERE public.normalize_string_sql(branch_name) = v_branch
    AND public.normalize_string_sql(laboratory) = v_lab;

    -- Delete from public.inventory_reports
    DELETE FROM public.inventory_reports 
    WHERE public.normalize_string_sql(branch_name) = v_branch
    AND public.normalize_string_sql(laboratory) = v_lab;

    -- Delete from public.inventory_adjustments (history summaries)
    DELETE FROM public.inventory_adjustments 
    WHERE public.normalize_string_sql(branch_name) = v_branch
    AND public.normalize_string_sql(laboratory) = v_lab;
    GET DIAGNOSTICS v_count_adj = ROW_COUNT;

    -- Delete from inventories 
    DELETE FROM public.inventories 
    WHERE public.normalize_string_sql(branch_name) = v_branch 
    AND public.normalize_string_sql(laboratory) = v_lab;
    GET DIAGNOSTICS v_count_inv = ROW_COUNT;

    -- Delete from branch_laboratories (metadata/progress)
    DELETE FROM public.branch_laboratories 
    WHERE public.normalize_string_sql(branch_name) = v_branch
    AND public.normalize_string_sql(laboratory) = v_lab;
    GET DIAGNOSTICS v_count_meta = ROW_COUNT;

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
        NULL,
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
