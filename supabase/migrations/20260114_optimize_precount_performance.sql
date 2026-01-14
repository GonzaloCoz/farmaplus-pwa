-- =====================================================
-- Optimización de Performance para Pre-Conteo
-- =====================================================
-- Fecha: 2026-01-14
-- Objetivo: Mejorar velocidad de queries y sincronización en tiempo real

-- =====================================================
-- ÍNDICES PARA PRECOUNT_ITEMS
-- =====================================================

-- Índice para cargar items por sesión ordenados por fecha (query más común)
CREATE INDEX IF NOT EXISTS idx_precount_items_session_scanned 
ON precount_items(session_id, scanned_at DESC);

-- Índice para búsquedas por EAN dentro de una sesión
CREATE INDEX IF NOT EXISTS idx_precount_items_session_ean 
ON precount_items(session_id, ean);

-- Índice para filtrar por usuario que escaneó
CREATE INDEX IF NOT EXISTS idx_precount_items_scanned_by 
ON precount_items(scanned_by);

-- =====================================================
-- ÍNDICES PARA PRECOUNT_SESSIONS
-- =====================================================

-- Índice para obtener sesiones activas ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_precount_sessions_status_time 
ON precount_sessions(status, start_time DESC) 
WHERE status = 'active';

-- Índice para sesiones por usuario
CREATE INDEX IF NOT EXISTS idx_precount_sessions_user 
ON precount_sessions(user_id, start_time DESC);

-- =====================================================
-- ÍNDICES PARA PRODUCTS
-- =====================================================

-- Índice para búsqueda exacta por EAN (ya debería existir como PK, pero lo aseguramos)
CREATE INDEX IF NOT EXISTS idx_products_ean 
ON products(ean);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_products_name_lower 
ON products(LOWER(name));

-- Índice compuesto para búsquedas mixtas (nombre o EAN)
CREATE INDEX IF NOT EXISTS idx_products_search 
ON products(name, ean);

-- Índice adicional para búsquedas por nombre (optimiza ILIKE)
-- Nota: Para mejor performance con ILIKE, considera habilitar pg_trgm en el futuro
CREATE INDEX IF NOT EXISTS idx_products_name_pattern 
ON products(name text_pattern_ops);

-- =====================================================
-- FUNCIONES RPC OPTIMIZADAS
-- =====================================================

-- Función para agregar o actualizar item en una sola operación
CREATE OR REPLACE FUNCTION upsert_precount_item(
    p_session_id UUID,
    p_ean TEXT,
    p_product_name TEXT,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    ean TEXT,
    product_name TEXT,
    quantity INTEGER,
    scanned_at TIMESTAMPTZ,
    scanned_by UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id UUID;
    v_new_quantity INTEGER;
BEGIN
    -- Buscar item existente
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
            scanned_at = NOW()
        WHERE precount_items.id = v_existing_id;
        
        -- Retornar item actualizado
        RETURN QUERY
        SELECT * FROM precount_items
        WHERE precount_items.id = v_existing_id;
    ELSE
        -- Insertar nuevo item
        RETURN QUERY
        INSERT INTO precount_items (session_id, ean, product_name, quantity, scanned_by)
        VALUES (p_session_id, p_ean, p_product_name, p_quantity, COALESCE(p_user_id, auth.uid()))
        RETURNING *;
    END IF;
END;
$$;

-- Función para obtener resumen de sesión sin cargar todos los items
CREATE OR REPLACE FUNCTION get_session_summary(p_session_id UUID)
RETURNS TABLE (
    total_products BIGINT,
    total_units BIGINT,
    last_updated TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(DISTINCT id)::BIGINT as total_products,
        COALESCE(SUM(quantity), 0)::BIGINT as total_units,
        MAX(scanned_at) as last_updated
    FROM precount_items
    WHERE session_id = p_session_id;
$$;

-- Función para búsqueda optimizada de productos
CREATE OR REPLACE FUNCTION search_products_optimized(
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    ean TEXT,
    name TEXT,
    cost NUMERIC,
    sale_price NUMERIC,
    category TEXT,
    laboratory TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        ean,
        name,
        cost,
        sale_price,
        category,
        laboratory
    FROM products
    WHERE 
        ean ILIKE p_query || '%'
        OR name ILIKE '%' || p_query || '%'
    ORDER BY 
        -- Priorizar coincidencias exactas de EAN
        CASE WHEN ean = p_query THEN 0 ELSE 1 END,
        -- Luego coincidencias que empiezan con el query
        CASE WHEN name ILIKE p_query || '%' THEN 0 ELSE 1 END,
        -- Finalmente ordenar por nombre
        name
    LIMIT p_limit;
$$;

-- Función para obtener producto por EAN (más rápida que query directo)
CREATE OR REPLACE FUNCTION get_product_by_ean(p_ean TEXT)
RETURNS TABLE (
    ean TEXT,
    name TEXT,
    cost NUMERIC,
    sale_price NUMERIC,
    category TEXT,
    laboratory TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        ean,
        name,
        cost,
        sale_price,
        category,
        laboratory
    FROM products
    WHERE ean = p_ean
    LIMIT 1;
$$;

-- =====================================================
-- PERMISOS
-- =====================================================

-- Permitir a usuarios autenticados usar las funciones RPC
GRANT EXECUTE ON FUNCTION upsert_precount_item TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_summary TO authenticated;
GRANT EXECUTE ON FUNCTION search_products_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_by_ean TO authenticated;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON INDEX idx_precount_items_session_scanned IS 'Optimiza carga de items por sesión ordenados por fecha';
COMMENT ON INDEX idx_precount_sessions_status_time IS 'Optimiza búsqueda de sesiones activas';
COMMENT ON INDEX idx_products_name_pattern IS 'Optimiza búsquedas ILIKE en nombre de producto';

COMMENT ON FUNCTION upsert_precount_item IS 'Agrega o actualiza item en una sola operación atómica';
COMMENT ON FUNCTION get_session_summary IS 'Obtiene totales de sesión sin cargar todos los items';
COMMENT ON FUNCTION search_products_optimized IS 'Búsqueda optimizada de productos con ranking inteligente';
COMMENT ON FUNCTION get_product_by_ean IS 'Búsqueda rápida de producto por EAN exacto';
