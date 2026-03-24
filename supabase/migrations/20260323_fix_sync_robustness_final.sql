-- =============================================
-- Migración: Robustez de Sincronización (VERSION FINAL - LIMPIEZA PROFUNDA)
-- =============================================

-- 1. Asegurar columnas de dispositivo
ALTER TABLE public.precount_items 
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS device_name TEXT;

-- 2. LIMPIEZA TOTAL DE VERSIONES ANTIGUAS (Soportando sobrecarga)
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    -- Buscamos todas las funciones con este nombre en el esquema public
    FOR func_record IN 
        SELECT oid::regprocedure as proc_name
        FROM pg_proc 
        WHERE proname = 'upsert_precount_item'
          AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION ' || func_record.proc_name;
        RAISE NOTICE 'Borrando función: %', func_record.proc_name;
    END LOOP; 
END $$;

-- 3. Crear la nueva versión robusta
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
    SELECT i.id INTO v_existing_id FROM precount_items i
    WHERE i.id = p_id OR (i.session_id = p_session_id AND i.ean = p_ean AND i.device_id = p_device_id)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE precount_items SET 
            quantity = p_quantity, 
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto),
            device_name = COALESCE(p_device_name, precount_items.device_name),
            scanned_by = COALESCE(p_user_id, precount_items.scanned_by)
        WHERE precount_items.id = v_existing_id;
        
        RETURN QUERY SELECT * FROM precount_items WHERE precount_items.id = v_existing_id;
    ELSE
        RETURN QUERY INSERT INTO precount_items (id, session_id, ean, product_name, quantity, scanned_by, id_producto, device_id, device_name)
        VALUES (p_id, p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()), p_id_producto, p_device_id, p_device_name)
        RETURNING *;
    END IF;
END;
$$;

-- 4. Otorgar permisos (ahora sin ambigüedad)
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_precount_item TO anon;
GRANT EXECUTE ON FUNCTION upsert_precount_item TO service_role;
