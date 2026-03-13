-- ========================================================
-- Migración: Permitir Re-ajustes en save_cyclic_inventory_v2
-- Fecha: 2026-03-13
-- ========================================================

CREATE OR REPLACE FUNCTION public.save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
  v_current_status TEXT;
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

    -- B. Upsert Inventory con chequeo de estado
    SELECT status INTO v_current_status
    FROM public.inventories
    WHERE branch_name = p_branch_name AND laboratory = p_laboratory AND ean = (item->>'ean');

    -- CAMBIO CRÍTICO: Permitir actualización si el nuevo estado es 'controlled' (re-ajuste)
    -- even if the current status is 'adjusted'.
    IF v_current_status = 'adjusted' AND (item->>'status') != 'controlled' THEN
        -- Si está ajustado y NO estamos intentando re-abrirlo, ignoramos.
        CONTINUE;
    END IF;

    -- Upsert normal
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
      item->>'readjustmentReason',
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
      readjustment_reason = EXCLUDED.readjustment_reason,
      category = EXCLUDED.category,
      adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
      adjustment_id_surplus = EXCLUDED.adjustment_id_surplus,
      updated_at = NOW();
      
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_cyclic_inventory_v2 TO anon, authenticated, service_role;
