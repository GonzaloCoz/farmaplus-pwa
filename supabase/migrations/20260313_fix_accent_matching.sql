
-- ==========================================
-- Migration: Accent-Insensitive Laboratory Fetching
-- Date: 2026-03-13
-- Purpose: Robust laboratory inventory retrieval using normalization
-- ==========================================

CREATE OR REPLACE FUNCTION get_lab_inventory_v2(
    p_branch_name TEXT,
    p_laboratory TEXT
) RETURNS TABLE (
    id UUID,
    ean TEXT,
    quantity INTEGER,
    system_quantity INTEGER,
    status TEXT,
    was_readjusted BOOLEAN,
    readjustment_reason TEXT,
    category TEXT,
    adjustment_id_shortage TEXT,
    adjustment_id_surplus TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    product_name TEXT,
    product_cost NUMERIC,
    product_category TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.ean,
        i.quantity,
        i.system_quantity,
        i.status::TEXT,
        i.was_readjusted,
        i.readjustment_reason,
        i.category,
        i.adjustment_id_shortage,
        i.adjustment_id_surplus,
        i.updated_at,
        p.name as product_name,
        p.cost as product_cost,
        p.category as product_category
    FROM public.inventories i
    JOIN public.products p ON i.ean = p.ean
    WHERE normalize_string_sql(i.branch_name) = normalize_string_sql(p_branch_name)
      AND normalize_string_sql(i.laboratory) = normalize_string_sql(p_laboratory)
    ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_lab_inventory_v2(TEXT, TEXT) TO authenticated, anon;
