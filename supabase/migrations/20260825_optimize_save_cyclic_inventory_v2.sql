-- Migration: High-Performance save_cyclic_inventory_v2 with clean snake_case JSON schema
-- Fixes duplicate column name error (code 42701) and ensures accurate stock quantities

CREATE OR REPLACE FUNCTION public.save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := p_laboratory;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN;
  END IF;

  -- 1. Bulk Upsert Products
  INSERT INTO public.products (ean, name, cost, category, laboratory, id_producto)
  SELECT 
    TRIM(x.ean),
    x.name,
    COALESCE(x.cost, 0),
    COALESCE(NULLIF(TRIM(x.category), ''), 'Varios'),
    v_lab,
    x.id_producto
  FROM jsonb_to_recordset(p_items) AS x(
    ean TEXT,
    name TEXT,
    cost NUMERIC,
    category TEXT,
    id_producto TEXT
  )
  WHERE x.ean IS NOT NULL AND TRIM(x.ean) != ''
  ON CONFLICT (ean) DO UPDATE SET
    category = EXCLUDED.category,
    cost = EXCLUDED.cost,
    id_producto = COALESCE(EXCLUDED.id_producto, products.id_producto);

  -- 2. Bulk Upsert Inventories with active rounds resolution
  WITH raw_items AS (
    SELECT 
      TRIM(x.ean) AS ean,
      COALESCE(x.counted_quantity, x.system_quantity, 0) AS counted_qty,
      COALESCE(x.system_quantity, 0) AS system_qty,
      COALESCE(NULLIF(TRIM(x.status), ''), 'pending') AS status,
      COALESCE(x.was_readjusted, false) AS was_readjusted,
      x.readjustment_reason,
      COALESCE(NULLIF(TRIM(x.category), ''), 'Varios') AS category,
      x.shortage_id,
      x.surplus_id
    FROM jsonb_to_recordset(p_items) AS x(
      ean TEXT,
      counted_quantity INTEGER,
      system_quantity INTEGER,
      status TEXT,
      was_readjusted BOOLEAN,
      readjustment_reason TEXT,
      category TEXT,
      shortage_id TEXT,
      surplus_id TEXT
    )
    WHERE x.ean IS NOT NULL AND TRIM(x.ean) != ''
  ),
  rounds_map AS (
    SELECT 
      SUBSTRING(ean FROM 14) AS cat_upper,
      quantity::INTEGER AS round_val
    FROM public.inventories
    WHERE (branch_name = v_branch OR normalize_string_sql(branch_name) = v_branch)
      AND laboratory = '_CONFIG_'
      AND ean LIKE 'CONFIG_ROUND_%'
  ),
  global_round AS (
    SELECT COALESCE(
      (
        SELECT quantity::INTEGER 
        FROM public.inventories 
        WHERE (branch_name = v_branch OR normalize_string_sql(branch_name) = v_branch)
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_ROUND'
        LIMIT 1
      ),
      1
    ) AS val
  ),
  items_with_round AS (
    SELECT 
      r.*,
      CASE 
        WHEN v_lab = '_CONFIG_' THEN 1
        ELSE COALESCE(rm.round_val, gr.val, 1)
      END AS resolved_round
    FROM raw_items r
    CROSS JOIN global_round gr
    LEFT JOIN rounds_map rm ON rm.cat_upper = UPPER(TRIM(r.category))
  )
  INSERT INTO public.inventories (
    branch_name, laboratory, ean, quantity, system_quantity,
    status, was_readjusted, readjustment_reason, category,
    adjustment_id_shortage, adjustment_id_surplus, round, updated_at
  )
  SELECT 
    v_branch,
    v_lab,
    i.ean,
    i.counted_qty,
    i.system_qty,
    i.status,
    i.was_readjusted,
    i.readjustment_reason,
    i.category,
    i.shortage_id,
    i.surplus_id,
    i.resolved_round,
    NOW()
  FROM items_with_round i
  LEFT JOIN public.inventories existing 
    ON (existing.branch_name = v_branch OR normalize_string_sql(existing.branch_name) = v_branch)
    AND existing.laboratory = v_lab
    AND existing.ean = i.ean
    AND existing.round = i.resolved_round
  -- Si ya está 'adjusted' y no intenta reabrirlo como 'controlled', no sobreescribir
  WHERE existing.status IS NULL OR existing.status != 'adjusted' OR i.status = 'controlled'
  ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    system_quantity = EXCLUDED.system_quantity,
    status = EXCLUDED.status,
    was_readjusted = EXCLUDED.was_readjusted,
    readjustment_reason = EXCLUDED.readjustment_reason,
    category = EXCLUDED.category,
    adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
    adjustment_id_surplus = EXCLUDED.adjustment_id_surplus,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_cyclic_inventory_v2(TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
