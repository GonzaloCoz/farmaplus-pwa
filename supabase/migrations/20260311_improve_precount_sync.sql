-- Migration: Improve PreCount synchronization and add device tracking
-- Description: Adds device_id and device_name to precount_items, updates upsert RPC to handle them and fix ID mismatch.

-- 1. Add device identification columns
ALTER TABLE public.precount_items ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.precount_items ADD COLUMN IF NOT EXISTS device_name TEXT;

-- 2. Update the upsert RPC to be more robust
DROP FUNCTION IF EXISTS upsert_precount_item(UUID, TEXT, TEXT, INTEGER, UUID, TEXT);
DROP FUNCTION IF EXISTS upsert_precount_item(UUID, TEXT, TEXT, INTEGER, UUID); -- Older version

CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_session_id UUID,
    p_ean TEXT,
    p_product_name TEXT,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_id_producto TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_id UUID DEFAULT NULL -- Allow client to specify the UUID (fixes deletion mismatch)
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
    v_item_id UUID;
    v_current_quantity INTEGER;
BEGIN
    -- 1. Determine which ID to use for existing check
    -- If p_id is provided, check by that ID first
    IF p_id IS NOT NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.id = p_id;
    END IF;

    -- 2. If not found by ID, check by session + ean + device_id (to keep counts separate per device)
    IF v_item_id IS NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.session_id = p_session_id 
        AND i.ean = p_ean
        AND (i.device_id = p_device_id OR (i.device_id IS NULL AND p_device_id IS NULL))
        LIMIT 1;
    END IF;

    IF v_item_id IS NOT NULL THEN
        -- UPDATE existing
        UPDATE precount_items
        SET quantity = v_current_quantity + p_quantity,
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto),
            device_name = COALESCE(p_device_name, precount_items.device_name),
            scanned_by = COALESCE(p_user_id, precount_items.scanned_by, auth.uid())
        WHERE precount_items.id = v_item_id;
        
        RETURN QUERY
        SELECT 
            i.id, i.session_id, i.ean, i.product_name, i.quantity, i.scanned_at, i.scanned_by, i.id_producto, i.device_id, i.device_name
        FROM precount_items i
        WHERE i.id = v_item_id;
    ELSE
        -- INSERT new (using p_id if provided)
        RETURN QUERY
        INSERT INTO precount_items (id, session_id, ean, product_name, quantity, scanned_by, id_producto, device_id, device_name)
        VALUES (COALESCE(p_id, gen_random_uuid()), p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()), p_id_producto, p_device_id, p_device_name)
        RETURNING precount_items.id, precount_items.session_id, precount_items.ean, precount_items.product_name, precount_items.quantity, precount_items.scanned_at, precount_items.scanned_by, precount_items.id_producto, precount_items.device_id, precount_items.device_name;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
