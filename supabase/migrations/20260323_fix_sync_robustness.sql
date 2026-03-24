-- =============================================
-- Migración: Robustez de Sincronización Pre-Conteo
-- =============================================

-- 1. Asegurar columnas de dispositivo en precount_items
ALTER TABLE public.precount_items 
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS device_name TEXT;

-- 2. Actualizar función RPC para incluir soporte total de campos y evitar duplicados por dispositivo
CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_id UUID,
    p_session_id UUID,
    p_ean TEXT,
    p_product_name TEXT,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_id_producto TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    ean TEXT,
    product_name TEXT,
    quantity INTEGER,
    scanned_at TIMESTAMPTZ,
    scanned_by UUID,
    id_producto TEXT,
    device_id TEXT,
    device_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id UUID;
BEGIN
    -- Intentar encontrar por ID local primariamente (si ya se sincronizó antes)
    -- O por la combinación (sesión, ean, dispositivo) para evitar duplicados en la misma terminal
    SELECT i.id INTO v_existing_id
    FROM precount_items i
    WHERE i.id = p_id 
       OR (i.session_id = p_session_id AND i.ean = p_ean AND i.device_id = p_device_id)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Actualizar existente (manteniendo el UUID original si es el caso)
        UPDATE precount_items
        SET quantity = p_quantity, 
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto),
            device_name = COALESCE(p_device_name, precount_items.device_name),
            scanned_by = COALESCE(p_user_id, precount_items.scanned_by)
        WHERE precount_items.id = v_existing_id;
        
        RETURN QUERY
        SELECT * FROM precount_items WHERE precount_items.id = v_existing_id;
    ELSE
        -- Insertar nuevo con el UUID del frontend para mantener consistencia
        RETURN QUERY
        INSERT INTO precount_items (id, session_id, ean, product_name, quantity, scanned_by, id_producto, device_id, device_name)
        VALUES (p_id, p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()), p_id_producto, p_device_id, p_device_name)
        RETURNING *;
    END IF;
END;
$$;

-- Grant permissions again to be sure
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_precount_item TO anon;
GRANT EXECUTE ON FUNCTION upsert_precount_item TO service_role;
