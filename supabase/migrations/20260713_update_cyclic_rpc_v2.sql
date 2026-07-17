-- Migration: Recreate get_lab_inventory_v2 and save_cyclic_inventory_v2 to support rounds
-- Date: 2026-07-13
-- Purpose: Auto-resolve active round for product category during fetch and save.

-- 1. Drop old signatures to avoid overloading mismatches
DROP FUNCTION IF EXISTS public.get_lab_inventory_v2(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.save_cyclic_inventory_v2(TEXT, TEXT, JSONB) CASCADE;

-- 2. Recreate get_lab_inventory_v2
CREATE OR REPLACE FUNCTION public.get_lab_inventory_v2(
    p_branch_name TEXT,
    p_laboratory TEXT
) RETURNS TABLE (
    id UUID, ean TEXT, quantity INTEGER, system_quantity INTEGER,
    status TEXT, was_readjusted BOOLEAN, readjustment_reason TEXT,
    category TEXT, adjustment_id_shortage TEXT, adjustment_id_surplus TEXT,
    updated_at TIMESTAMP WITH TIME ZONE, product_name TEXT,
    product_cost NUMERIC, product_category TEXT, round INTEGER
) AS $$
DECLARE
    v_branch TEXT := normalize_string_sql(p_branch_name);
    v_lab TEXT := normalize_string_sql(p_laboratory);
    v_category TEXT;
    v_round INTEGER;
BEGIN
    -- Find category of lab to resolve its active round (fully qualified to avoid parameter conflicts)
    SELECT bl.category INTO v_category 
    FROM public.branch_laboratories bl
    WHERE normalize_string_sql(bl.branch_name) = v_branch 
      AND normalize_string_sql(bl.laboratory) = v_lab
    LIMIT 1;

    -- Resolve active round (fully qualified to avoid quantity/branch_name conflicts)
    v_round := COALESCE(
      (
        SELECT inv.quantity::INTEGER 
        FROM public.inventories inv
        WHERE normalize_string_sql(inv.branch_name) = v_branch 
          AND inv.laboratory = '_CONFIG_' 
          AND inv.ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(v_category, 'Varios')))
      ),
      1
    );

    RETURN QUERY
    SELECT 
        i.id, i.ean, i.quantity, i.system_quantity, i.status::TEXT,
        i.was_readjusted, i.readjustment_reason, i.category,
        i.adjustment_id_shortage, i.adjustment_id_surplus, i.updated_at,
        p.name, p.cost, p.category, i.round
    FROM public.inventories i
    JOIN public.products p ON i.ean = p.ean
    WHERE i.branch_name = v_branch 
      AND i.laboratory = v_lab 
      AND i.round = v_round
    ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate save_cyclic_inventory_v2
CREATE OR REPLACE FUNCTION public.save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
  v_current_status TEXT;
  v_round INTEGER;
  v_branch TEXT := normalize_string_sql(p_branch_name);
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- A. Update/Insert Product
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

    -- B. Resolve active round for the category of the item
    IF p_laboratory = '_CONFIG_' THEN
      v_round := 1;
    ELSE
      v_round := COALESCE(
        (
          SELECT quantity::INTEGER 
          FROM public.inventories 
          WHERE branch_name = v_branch 
            AND laboratory = '_CONFIG_' 
            AND ean = 'CONFIG_ROUND_' || UPPER(TRIM(COALESCE(item->>'category', 'Varios')))
        ),
        1
      );
    END IF;

    -- C. Upsert Inventory with status check
    SELECT status INTO v_current_status
    FROM public.inventories
    WHERE branch_name = v_branch AND laboratory = p_laboratory AND ean = (item->>'ean') AND round = v_round;

    -- If already adjusted and not trying to reopen as controlled, skip.
    IF v_current_status = 'adjusted' AND (item->>'status') != 'controlled' THEN
        CONTINUE;
    END IF;

    -- Upsert with round column
    INSERT INTO public.inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      was_readjusted,
      readjustment_reason,
      category,
      adjustment_id_shortage,
      adjustment_id_surplus,
      round,
      updated_at
    )
    VALUES (
      v_branch,
      p_laboratory,
      item->>'ean',
      (item->>'countedQuantity')::INTEGER,
      (item->>'systemQuantity')::INTEGER,
      item->>'status',
      COALESCE((item->>'wasReadjusted')::BOOLEAN, FALSE),
      item->>'readjustmentReason',
      COALESCE(item->>'category', 'Varios'),
      item->>'shortageId',
      item->>'surplusId',
      v_round,
      NOW()
    )
    ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status,
      was_readjusted = EXCLUDED.was_readjusted,
      readjustment_reason = EXCLUDED.readjustment_reason,
      category = EXCLUDED.category,
      adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
      adjustment_id_surplus = EXCLUDED.adjustment_id_surplus,
      updated_at = NOW();
      
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_lab_inventory_v2 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_cyclic_inventory_v2 TO anon, authenticated, service_role;
