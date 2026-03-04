-- ==========================================
-- RPC: Purga total de un laboratorio (Reiniciar)
-- Elimina inventarios, historial, y resetea metadata sin borrar el lab
-- Usa SECURITY DEFINER para garantizar que funcione siempre
-- ==========================================

CREATE OR REPLACE FUNCTION purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := TRIM(p_branch_name);
  v_lab TEXT := TRIM(p_laboratory);
BEGIN
  -- 1. Borrar items (SOLO pendientes y controlados)
  DELETE FROM public.inventories
  WHERE branch_name ILIKE v_branch
    AND laboratory ILIKE v_lab
    AND status != 'adjusted';

  -- 2. NO borramos historial de ajustes (debe ser permanente)

  -- 3. Calcular stats basados en lo que QUEDÓ (los ajustados)
  -- Buscamos los valores reales de los items que quedaron en inventories
  UPDATE public.branch_laboratories bl
  SET
    total_items = sub.count,
    controlled_items = sub.count,
    adjusted_items = sub.count,
    pending_items = 0,
    progress_percentage = CASE WHEN sub.count > 0 THEN 100 ELSE 0 END,
    status = CASE WHEN sub.count > 0 THEN 'completed' ELSE 'pending' END,
    net_value = sub.net_val,
    negative_value = sub.neg_val,
    positive_value = sub.pos_val,
    net_units = sub.net_units,
    total_system_units = sub.sys_units
  FROM (
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM((quantity - system_quantity) * COALESCE((SELECT cost FROM products p WHERE p.ean = i.ean LIMIT 1), 0)), 0) as net_val,
      COALESCE(SUM(CASE WHEN (quantity - system_quantity) < 0 THEN (quantity - system_quantity) * COALESCE((SELECT cost FROM products p WHERE p.ean = i.ean LIMIT 1), 0) ELSE 0 END), 0) as neg_val,
      COALESCE(SUM(CASE WHEN (quantity - system_quantity) > 0 THEN (quantity - system_quantity) * COALESCE((SELECT cost FROM products p WHERE p.ean = i.ean LIMIT 1), 0) ELSE 0 END), 0) as pos_val,
      COALESCE(SUM(quantity - system_quantity), 0) as net_units,
      COALESCE(SUM(system_quantity), 0) as sys_units
    FROM public.inventories i
    WHERE i.branch_name ILIKE v_branch AND i.laboratory ILIKE v_lab
  ) sub
  WHERE bl.branch_name ILIKE v_branch AND bl.laboratory ILIKE v_lab;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION purge_lab_inventory(TEXT, TEXT) IS
  'Reiniciar laboratorio: borra inventarios, historial y resetea metadata. Mantiene el lab visible.';
