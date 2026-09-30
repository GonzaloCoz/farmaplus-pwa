-- ==============================================================================
-- VALIDACIÓN ATÓMICA DE PIN DE SESIÓN PARA COLECTORAS ZEBRA Y TERMINALES
-- Fecha: 2026-09-21
-- Permite a dispositivos con rol anon validar el PIN de 6 dígitos generado por el Admin
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_precount_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_clean_pin TEXT := TRIM(p_pin);
    v_branch_name TEXT := '';
BEGIN
    SELECT s.id, s.sector, s.branch_id, s.start_time, s.status, s.sync_pin
    INTO v_session
    FROM public.precount_sessions s
    WHERE s.sync_pin = v_clean_pin AND s.status = 'active'
    ORDER BY s.start_time DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'PIN_NOT_FOUND', 
            'message', 'PIN no encontrado o la sesión de inventario ya no está activa'
        );
    END IF;

    -- Obtener nombre de la sucursal si existe branch_id
    IF v_session.branch_id IS NOT NULL THEN
        SELECT name INTO v_branch_name FROM public.branches WHERE id = v_session.branch_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'sector', v_session.sector,
        'branch_id', v_session.branch_id,
        'branch_name', COALESCE(v_branch_name, v_session.sector, 'Sucursal'),
        'sync_pin', v_session.sync_pin,
        'status', v_session.status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_precount_pin(TEXT) TO anon, authenticated, service_role;
