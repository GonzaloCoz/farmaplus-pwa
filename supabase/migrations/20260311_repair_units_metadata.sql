
-- ==========================================
-- SCRIPT COMPLETO: Agregar columnas + Reparar datos
-- Ejecutar TODO junto en el Editor SQL de Supabase
-- ==========================================

-- PASO 1: Crear las columnas si no existen
ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS negative_units INTEGER DEFAULT 0;

ALTER TABLE public.branch_laboratories 
ADD COLUMN IF NOT EXISTS positive_units INTEGER DEFAULT 0;

-- PASO 2: Reparar los datos con valores reales desde inventories + products
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT DISTINCT branch_name, laboratory, category FROM public.branch_laboratories) LOOP
        UPDATE public.branch_laboratories bl
        SET 
            negative_units = COALESCE(s.neg_units, 0),
            positive_units = COALESCE(s.pos_units, 0),
            negative_value = COALESCE(s.neg_val, 0),
            positive_value = COALESCE(s.pos_val, 0),
            net_units = COALESCE(s.neg_units + s.pos_units, 0),
            net_value = COALESCE(s.neg_val + s.pos_val, 0)
        FROM (
            SELECT 
                SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as neg_units,
                SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as pos_units,
                SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as neg_val,
                SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as pos_val
            FROM public.inventories i
            LEFT JOIN public.products p ON i.ean = p.ean
            WHERE i.branch_name = r.branch_name 
              AND i.laboratory = r.laboratory 
              AND (
                  i.category = r.category 
                  OR (r.category = 'VARIOS' AND (i.category IS NULL OR i.category = ''))
                  OR (r.category = 'Varios' AND (i.category IS NULL OR i.category = ''))
              )
        ) s
        WHERE bl.branch_name = r.branch_name 
          AND bl.laboratory = r.laboratory 
          AND bl.category = r.category;
    END LOOP;
END $$;
