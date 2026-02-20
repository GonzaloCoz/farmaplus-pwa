-- ==========================================
-- Migración: Fix Inventory History logic and item adjustment IDs
-- ==========================================

-- 1. Agregar columnas a la tabla inventories para guardar los IDs exactos por producto
ALTER TABLE public.inventories ADD COLUMN IF NOT EXISTS adjustment_id_shortage TEXT;
ALTER TABLE public.inventories ADD COLUMN IF NOT EXISTS adjustment_id_surplus TEXT;

-- 2. Modificar el RPC para guardar esos IDs
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
      adjustment_id_shortage,
      adjustment_id_surplus,
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
      item->>'shortageId',
      item->>'surplusId',
      NOW()
    )
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status,
      was_readjusted = EXCLUDED.was_readjusted,
      category = EXCLUDED.category,
      adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
      adjustment_id_surplus = EXCLUDED.adjustment_id_surplus,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_cyclic_inventory_v2 TO anon, authenticated;
