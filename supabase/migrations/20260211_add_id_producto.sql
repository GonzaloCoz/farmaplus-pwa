-- Migration: Add id_producto to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS id_producto TEXT;

-- Index for performance (optional but recommended if searching by this ID)
CREATE INDEX IF NOT EXISTS idx_products_id_producto ON public.products(id_producto);

-- Ensure DELETE policy exists for the clearing function
DROP POLICY IF EXISTS "Allow authenticated delete products" ON public.products;
CREATE POLICY "Allow authenticated delete products" ON public.products FOR DELETE USING (true);

-- Update save_cyclic_inventory_v2 to handle id_producto
DROP FUNCTION IF EXISTS save_cyclic_inventory_v2(TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- A. Update/Insert Product (Ensuring correct category/laboratory)
    INSERT INTO public.products (ean, name, cost, category, laboratory, id_producto)
    VALUES (
      item->>'ean',
      item->>'name',
      (item->>'cost')::NUMERIC,
      COALESCE(item->>'category', 'Varios'),
      p_laboratory,
      item->>'id_producto'
    )
    ON CONFLICT (ean) DO UPDATE SET
      category = EXCLUDED.category,
      cost = EXCLUDED.cost,
      id_producto = COALESCE(EXCLUDED.id_producto, products.id_producto);

    -- B. Upsert Inventory
    INSERT INTO public.inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      was_readjusted,
      category,
      updated_at
    )
    VALUES (
      p_branch_name,
      p_laboratory,
      item->>'ean',
      (item->>'countedQuantity')::INTEGER,
      (item->>'systemQuantity')::INTEGER,
      item->>'status',
      COALESCE((item->>'wasReadjusted')::BOOLEAN, FALSE),
      COALESCE(item->>'category', 'Varios'),
      NOW()
    )
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status,
      was_readjusted = EXCLUDED.was_readjusted,
      category = EXCLUDED.category,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update search_products_optimized to return id_producto
DROP FUNCTION IF EXISTS search_products_optimized(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION search_products_optimized(
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    ean TEXT,
    name TEXT,
    cost NUMERIC,
    category TEXT,
    laboratory TEXT,
    id_producto TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        ean,
        name,
        cost,
        category,
        laboratory,
        id_producto
    FROM products
    WHERE 
        ean ILIKE p_query || '%'
        OR name ILIKE '%' || p_query || '%'
        OR id_producto ILIKE p_query || '%'
    ORDER BY 
        CASE WHEN ean = p_query THEN 0 ELSE 1 END,
        CASE WHEN id_producto = p_query THEN 0 ELSE 1 END,
        CASE WHEN name ILIKE p_query || '%' THEN 0 ELSE 1 END,
        name
    LIMIT p_limit;
$$;

-- Update get_product_by_ean to return id_producto
DROP FUNCTION IF EXISTS get_product_by_ean(TEXT);
CREATE OR REPLACE FUNCTION get_product_by_ean(p_ean TEXT)
RETURNS TABLE (
    ean TEXT,
    name TEXT,
    cost NUMERIC,
    category TEXT,
    laboratory TEXT,
    id_producto TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        ean,
        name,
        cost,
        category,
        laboratory,
        id_producto
    FROM products
    WHERE ean = p_ean
    LIMIT 1;
$$;

-- Grant permissions again
GRANT EXECUTE ON FUNCTION save_cyclic_inventory_v2 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_products_optimized TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_product_by_ean TO anon, authenticated;

-- Fix Foreign Key Constraint to allow Cascading Deletes
-- This prevents the "violates foreign key constraint inventories_ean_fkey" error
DO $$
BEGIN
    -- Only attempt to modify if the table and constraint exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventories') THEN
        -- Drop the existing constraint if it exists (Supabase default name or manual name)
        ALTER TABLE public.inventories DROP CONSTRAINT IF EXISTS inventories_ean_fkey;
        
        -- Add it back with ON DELETE CASCADE
        ALTER TABLE public.inventories 
        ADD CONSTRAINT inventories_ean_fkey 
        FOREIGN KEY (ean) REFERENCES public.products(ean) 
        ON DELETE CASCADE;
    END IF;
END $$;
