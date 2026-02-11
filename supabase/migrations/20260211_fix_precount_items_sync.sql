-- Migration: Add id_producto to precount_items table and update upsert function
ALTER TABLE public.precount_items ADD COLUMN IF NOT EXISTS id_producto TEXT;

-- Update the upsert RPC to handle id_producto
DROP FUNCTION IF EXISTS upsert_precount_item(UUID, TEXT, TEXT, INTEGER, UUID);

CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_session_id UUID,
    p_ean TEXT,
    p_product_name TEXT,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_id_producto TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    ean TEXT,
    product_name TEXT,
    quantity INTEGER,
    scanned_at TIMESTAMPTZ,
    scanned_by UUID,
    id_producto TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id UUID;
    v_new_quantity INTEGER;
BEGIN
    -- Buscar item existente por sesión y EAN
    SELECT precount_items.id, precount_items.quantity 
    INTO v_existing_id, v_new_quantity
    FROM precount_items
    WHERE precount_items.session_id = p_session_id 
    AND precount_items.ean = p_ean
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Actualizar cantidad existente
        UPDATE precount_items
        SET quantity = v_new_quantity + p_quantity,
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto)
        WHERE precount_items.id = v_existing_id;
        
        -- Retornar item actualizado
        RETURN QUERY
        SELECT 
            i.id, i.session_id, i.ean, i.product_name, i.quantity, i.scanned_at, i.scanned_by, i.id_producto
        FROM precount_items i
        WHERE i.id = v_existing_id;
    ELSE
        -- Insertar nuevo item
        RETURN QUERY
        INSERT INTO precount_items (session_id, ean, product_name, quantity, scanned_by, id_producto)
        VALUES (p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()), p_id_producto)
        RETURNING id, session_id, ean, product_name, quantity, scanned_at, scanned_by, id_producto;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
