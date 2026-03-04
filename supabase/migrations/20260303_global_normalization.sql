-- ========================================================
-- Migración: Normalización Global de Sucursales (Sistema Irrompible)
-- Asegura que "Morón", "MORON", "moron" sean tratados como una sola entidad
-- ========================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Helper Function (Internal Use)
CREATE OR REPLACE FUNCTION normalize_branch_name_sql(p_name TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN TRIM(UPPER(unaccent(p_name)));
END;
$$ LANGUAGE plpgsql;

-- 2. Normalizar Tablas de Datos
UPDATE public.inventories SET branch_name = normalize_branch_name_sql(branch_name);
UPDATE public.inventory_adjustments SET branch_name = normalize_branch_name_sql(branch_name);
UPDATE public.inventory_reports SET branch_name = normalize_branch_name_sql(branch_name);

-- 3. Normalizar y Fusionar Metadata (branch_laboratories)
-- Usamos una tabla temporal para evitar conflictos de llave única durante el update
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Tabla temporal con los datos ya sumados/colapsados por nombre normalizado
    CREATE TEMP TABLE tmp_labs_merged AS
    SELECT 
        normalize_branch_name_sql(branch_name) as clean_branch,
        laboratory,
        category,
        SUM(total_items) as total_items,
        SUM(controlled_items) as controlled_items,
        SUM(adjusted_items) as adjusted_items,
        SUM(pending_items) as pending_items,
        MAX(progress_percentage) as progress_percentage,
        SUM(total_system_units) as total_system_units,
        SUM(net_units) as net_units,
        SUM(net_value) as net_value,
        SUM(negative_value) as negative_value,
        SUM(positive_value) as positive_value,
        CASE WHEN MAX(progress_percentage) >= 100 THEN 'completed'::text 
             WHEN MAX(progress_percentage) > 0 THEN 'in_progress'::text 
             ELSE 'pending'::text END as status
    FROM public.branch_laboratories
    GROUP BY 1, 2, 3;

    -- Limpiar la tabla original
    DELETE FROM public.branch_laboratories;

    -- Reinsertar los valores ya normalizados y fusionados
    INSERT INTO public.branch_laboratories (
        branch_name, laboratory, category, 
        total_items, controlled_items, adjusted_items, pending_items,
        progress_percentage, total_system_units, net_units, 
        net_value, negative_value, positive_value, status
    )
    SELECT 
        clean_branch, laboratory, category,
        total_items, controlled_items, adjusted_items, pending_items,
        progress_percentage, total_system_units, net_units,
        net_value, negative_value, positive_value, status
    FROM tmp_labs_merged;

    DROP TABLE tmp_labs_merged;
END $$;

-- 4. Actualizar RPCs para normalizar parámetros de entrada automáticamente
-- save_cyclic_inventory_v2 (Ya modificado en la app, pero aquí lo blindamos en el motor)
CREATE OR REPLACE FUNCTION save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
  v_branch TEXT := normalize_branch_name_sql(p_branch_name);
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Sync Products
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

    -- Upsert Inventory (Normalized)
    INSERT INTO public.inventories (
      branch_name, laboratory, ean, quantity, system_quantity, 
      status, was_readjusted, category, adjustment_id_shortage, 
      adjustment_id_surplus, updated_at
    )
    VALUES (
      v_branch, p_laboratory, item->>'ean',
      (item->>'countedQuantity')::INTEGER,
      (item->>'systemQuantity')::INTEGER,
      item->>'status',
      COALESCE((item->>'wasReadjusted')::BOOLEAN, FALSE),
      COALESCE(item->>'category', 'Varios'),
      item->>'shortageId', item->>'surplusId', NOW()
    )
    ON CONFLICT (branch_name, laboratory, ean) DO UPDATE SET 
      quantity = EXCLUDED.quantity, system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status, was_readjusted = EXCLUDED.was_readjusted,
      category = EXCLUDED.category, adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
      adjustment_id_surplus = EXCLUDED.adjustment_id_surplus, updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- purge_lab_inventory (Blindado)
CREATE OR REPLACE FUNCTION purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_branch_name_sql(p_branch_name);
  v_lab TEXT := TRIM(p_laboratory);
BEGIN
  DELETE FROM public.inventories WHERE branch_name = v_branch AND laboratory ILIKE v_lab;
  DELETE FROM public.inventory_adjustments WHERE branch_name = v_branch AND laboratory ILIKE v_lab;
  
  UPDATE public.branch_laboratories SET
    total_items = 0, controlled_items = 0, adjusted_items = 0, pending_items = 0,
    progress_percentage = 0, status = 'pending', net_value = 0,
    negative_value = 0, positive_value = 0, total_system_units = 0, net_units = 0
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
