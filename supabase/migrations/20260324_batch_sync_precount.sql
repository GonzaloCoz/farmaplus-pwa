-- Migration: Optimization for high-volume PreCount sync
-- 1. Create composite index to prevent Full Table Scans on upsert
CREATE INDEX IF NOT EXISTS idx_precount_items_session_ean_device 
ON public.precount_items (session_id, ean, device_id);

-- 2. Create a batch upsert function to reduce HTTP roundtrips
CREATE OR REPLACE FUNCTION batch_upsert_precount_items(
    p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
BEGIN
    -- We assume the JSONB is an array of objects matching the upsert_precount_item parameters
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id UUID, 
        session_id UUID, 
        ean TEXT, 
        product_name TEXT, 
        quantity INTEGER, 
        scanned_by UUID, 
        id_producto TEXT, 
        device_id TEXT, 
        device_name TEXT
    )
    LOOP
        -- Re-use the optimized single upsert logic
        PERFORM upsert_precount_item(
            item.id,
            item.session_id,
            item.ean,
            item.product_name,
            item.quantity,
            item.scanned_by,
            item.id_producto,
            item.device_id,
            item.device_name
        );
    END LOOP;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION batch_upsert_precount_items TO authenticated;
GRANT EXECUTE ON FUNCTION batch_upsert_precount_items TO anon;
GRANT EXECUTE ON FUNCTION batch_upsert_precount_items TO service_role;
