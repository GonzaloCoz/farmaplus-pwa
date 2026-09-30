-- ==============================================================================
-- FARMAPLUS PWA - MIGRACIÓN DE SOPORTE PARA POSICIONES Y ESTADO DE CONTEO
-- Fecha: 2026-09-08
-- ==============================================================================

-- 1. Crear tabla para el seguimiento de estados de posiciones (Góndolas, Muebles, etc.)
CREATE TABLE IF NOT EXISTS public.precount_location_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.precount_sessions(id) ON DELETE CASCADE,
    location_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
    opened_by UUID REFERENCES auth.users(id),
    closed_by UUID REFERENCES auth.users(id),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, location_tag)
);

-- 2. Habilitar Seguridad por Fila (RLS) permisiva para terminales y admin
ALTER TABLE public.precount_location_status ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable all access for precount_location_status" ON public.precount_location_status;
    CREATE POLICY "Enable all access for precount_location_status" 
    ON public.precount_location_status
    FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 3. Habilitar Supabase Realtime para que los colectores y el admin sincronicen en vivo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'precount_location_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE precount_location_status;
    END IF;
END $$;

-- 4. Asegurar columna location_tag e índice en precount_items
ALTER TABLE public.precount_items ADD COLUMN IF NOT EXISTS location_tag TEXT;
CREATE INDEX IF NOT EXISTS idx_precount_items_session_location 
ON public.precount_items (session_id, location_tag);

-- 5. Eliminar versiones anteriores sobrecargadas para evitar conflicto de ambigüedad en PostgreSQL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'upsert_precount_item'
    )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;

    FOR r IN (
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'batch_upsert_precount_items'
    )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- 6. Función de upsert unitario de item con validación de posición abierta
CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_ean TEXT DEFAULT NULL,
    p_product_name TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1,
    p_user_id UUID DEFAULT NULL,
    p_id_producto TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_location_tag TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
    v_current_quantity INTEGER;
    v_location_status TEXT;
BEGIN
    -- Verificar si la posición fue cerrada por el usuario o administrador
    IF p_location_tag IS NOT NULL AND p_session_id IS NOT NULL THEN
        SELECT status INTO v_location_status
        FROM precount_location_status
        WHERE session_id = p_session_id AND location_tag = p_location_tag;
        
        IF v_location_status = 'closed' THEN
            RAISE EXCEPTION 'La posición % se encuentra cerrada para esta sesión.', p_location_tag;
        END IF;
    END IF;

    -- Buscar item existente
    IF p_id IS NOT NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.id = p_id;
    END IF;

    IF v_item_id IS NULL AND p_session_id IS NOT NULL AND p_ean IS NOT NULL THEN
        SELECT i.id, i.quantity INTO v_item_id, v_current_quantity
        FROM precount_items i
        WHERE i.session_id = p_session_id 
          AND i.ean = p_ean
          AND (i.device_id = p_device_id OR (i.device_id IS NULL AND p_device_id IS NULL))
          AND (i.location_tag = p_location_tag OR (i.location_tag IS NULL AND p_location_tag IS NULL))
        LIMIT 1;
    END IF;

    IF v_item_id IS NOT NULL THEN
        UPDATE precount_items
        SET quantity = v_current_quantity + p_quantity,
            scanned_at = NOW(),
            id_producto = COALESCE(p_id_producto, precount_items.id_producto),
            product_name = COALESCE(p_product_name, precount_items.product_name),
            device_name = COALESCE(p_device_name, precount_items.device_name),
            location_tag = COALESCE(p_location_tag, precount_items.location_tag)
        WHERE id = v_item_id;
    ELSE
        INSERT INTO precount_items (
            id, session_id, ean, product_name, quantity, 
            scanned_by, id_producto, device_id, device_name, location_tag, scanned_at
        ) VALUES (
            COALESCE(p_id, gen_random_uuid()),
            p_session_id,
            p_ean,
            p_product_name,
            p_quantity,
            COALESCE(p_user_id, auth.uid()),
            p_id_producto,
            p_device_id,
            p_device_name,
            p_location_tag,
            NOW()
        );
    END IF;
END;
$$;

-- 7. Función de carga por lotes (Batch) con soporte para location_tag
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
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id UUID, 
        session_id UUID, 
        ean TEXT, 
        product_name TEXT, 
        quantity INTEGER, 
        scanned_by UUID, 
        id_producto TEXT, 
        device_id TEXT, 
        device_name TEXT,
        location_tag TEXT
    )
    LOOP
        PERFORM upsert_precount_item(
            item.id,
            item.session_id,
            item.ean,
            item.product_name,
            item.quantity,
            item.scanned_by,
            item.id_producto,
            item.device_id,
            item.device_name,
            item.location_tag
        );
    END LOOP;
END;
$$;

-- 8. Permisos específicos con firma de argumentos explícita (evita ambigüedad en Postgres)
GRANT EXECUTE ON FUNCTION upsert_precount_item(UUID, UUID, TEXT, TEXT, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION batch_upsert_precount_items(JSONB) TO authenticated, anon, service_role;
