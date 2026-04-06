-- Migration: Add Location Tracking to PreCount
-- Description: Enables tagging items by physical location and tracking open/closed status for each zone.

-- 1. Add location_tag column to precount_items if it doesn't exist
ALTER TABLE public.precount_items ADD COLUMN IF NOT EXISTS location_tag TEXT;

-- 2. Create table for tracking zone status within a session
CREATE TABLE IF NOT EXISTS public.precount_location_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.precount_sessions(id) ON DELETE CASCADE,
    location_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
    opened_by UUID REFERENCES auth.users(id),
    closed_by UUID REFERENCES auth.users(id),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    UNIQUE(session_id, location_tag)
);

-- 3. Enable RLS
ALTER TABLE public.precount_location_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.precount_location_status
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Update the upsert_precount_item RPC to include location_tag
-- Drop existing versions to avoid signature conflicts
DROP FUNCTION IF EXISTS upsert_precount_item(UUID, TEXT, TEXT, INTEGER, UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_session_id UUID,
    p_ean TEXT,
    p_product_name TEXT,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_id_producto TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_id UUID DEFAULT NULL,
    p_location_tag TEXT DEFAULT NULL -- Added parameter
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
    device_name TEXT,
    location_tag TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
    v_current_quantity INTEGER;
    v_location_status TEXT;
BEGIN
    -- 0. Check if the location is closed
    IF p_location_tag IS NOT NULL THEN
        SELECT status INTO v_location_status
        FROM precount_location_status
        WHERE session_id = p_session_id AND location_tag = p_location_tag;
        
        IF v_location_status = 'closed' THEN
            RAISE EXCEPTION 'La zona % ya se encuentra cerrada para esta sesión.', p_location_tag;
        END IF;
    END IF;

    -- 1. Determine which ID to use for existing check
    IF p_id IS NOT NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.id = p_id;
    END IF;

    -- 2. If not found by ID, check by session + ean + device_id + location_tag
    -- Note: We include location_tag in the grouping so products in different zones are tracked separately
    -- although with high-speed scanning it's better to keep one entry per device/ean and just tag it.
    -- But since we want "tracability perfect", we should probably have one entry per session+ean+location_tag+device.
    IF v_item_id IS NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.session_id = p_session_id 
        AND i.ean = p_ean
        AND (i.device_id = p_device_id OR (i.device_id IS NULL AND p_device_id IS NULL))
        AND (i.location_tag = p_location_tag OR (i.location_tag IS NULL AND p_location_tag IS NULL))
        LIMIT 1;
    END IF;

    IF v_item_id IS NOT NULL THEN
        -- UPDATE existing
        UPDATE precount_items
        SET quantity = v_current_quantity + p_quantity,
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto),
            device_name = COALESCE(p_device_name, precount_items.device_name),
            scanned_by = COALESCE(p_user_id, precount_items.scanned_by, auth.uid()),
            location_tag = COALESCE(p_location_tag, precount_items.location_tag)
        WHERE precount_items.id = v_item_id;
        
        RETURN QUERY
        SELECT 
            i.id, i.session_id, i.ean, i.product_name, i.quantity, i.scanned_at, i.scanned_by, i.id_producto, i.device_id, i.device_name, i.location_tag
        FROM precount_items i
        WHERE i.id = v_item_id;
    ELSE
        -- INSERT new
        RETURN QUERY
        INSERT INTO precount_items (id, session_id, ean, product_name, quantity, scanned_by, id_producto, device_id, device_name, location_tag)
        VALUES (COALESCE(p_id, gen_random_uuid()), p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()), p_id_producto, p_device_id, p_device_name, p_location_tag)
        RETURNING precount_items.id, precount_items.session_id, precount_items.ean, precount_items.product_name, precount_items.quantity, precount_items.scanned_at, precount_items.scanned_by, precount_items.id_producto, precount_items.device_id, precount_items.device_name, precount_items.location_tag;
    END IF;
END;
$$;

-- 5. Helper function to open/close locations
CREATE OR REPLACE FUNCTION toggle_precount_location(
    p_session_id UUID,
    p_location_tag TEXT,
    p_status TEXT, -- 'open' | 'closed'
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO precount_location_status (session_id, location_tag, status, opened_by, opened_at)
    VALUES (p_session_id, p_location_tag, p_status, COALESCE(p_user_id, auth.uid()), NOW())
    ON CONFLICT (session_id, location_tag) 
    DO UPDATE SET 
        status = p_status,
        closed_by = CASE WHEN p_status = 'closed' THEN COALESCE(p_user_id, auth.uid()) ELSE precount_location_status.closed_by END,
        closed_at = CASE WHEN p_status = 'closed' THEN NOW() ELSE precount_location_status.closed_at END;
        
    SELECT json_build_object(
        'session_id', session_id,
        'location_tag', location_tag,
        'status', status,
        'closed_at', closed_at
    ) INTO v_result
    FROM precount_location_status
    WHERE session_id = p_session_id AND location_tag = p_location_tag;
    
    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_precount_location TO authenticated;

-- Enable Realtime for location status
ALTER PUBLICATION supabase_realtime ADD TABLE precount_location_status;
