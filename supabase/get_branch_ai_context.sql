-- ========================================================
-- RPC: get_branch_ai_context
-- Descripcion: Obtiene estadisticas detalladas en tiempo real de una sucursal
--              Optimizado para usar indices y evitar escaneos de tabla completa.
-- ========================================================

CREATE OR REPLACE FUNCTION public.get_branch_ai_context(p_branch_name TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_labs INT := 0;
  v_completed_labs INT := 0;
  v_in_progress_labs INT := 0;
  v_total_items INT := 0;
  v_controlled_items INT := 0;
  v_progress_percent INT := 0;
  v_items_controlled_today INT := 0;
  v_net_value NUMERIC := 0;
  v_abs_value NUMERIC := 0;
  v_discrepant_count INT := 0;
  v_max_faltante JSONB := '{}'::JSONB;
  v_max_sobrante JSONB := '{}'::JSONB;
  v_active_labs TEXT := '';
  v_pending_labs TEXT := '';
  v_ar_today TIMESTAMP;
BEGIN
  -- Definir el inicio de hoy en zona horaria Argentina (GMT-3)
  v_ar_today := timezone('America/Argentina/Buenos_Aires', now())::date;

  -- 1. Estadisticas de laboratorios desde branch_laboratories (Uso de indice idx_branch_laboratories_branch)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COALESCE(SUM(total_items), 0),
    COALESCE(SUM(controlled_items), 0)
  INTO 
    v_total_labs, v_completed_labs, v_in_progress_labs, v_total_items, v_controlled_items
  FROM public.branch_laboratories
  WHERE branch_name = p_branch_name;

  -- Porcentaje global
  IF v_total_items > 0 THEN
    v_progress_percent := ROUND((v_controlled_items::NUMERIC / v_total_items) * 100);
  END IF;

  -- 2. Lista de laboratorios activos (Uso de indice idx_branch_laboratories_branch, max 3 para aligerar contexto)
  SELECT COALESCE(string_agg(lab_entry, E'\n'), '')
  INTO v_active_labs
  FROM (
    SELECT DISTINCT '- ' || laboratory || ': Progreso ' || progress_percentage || '%' AS lab_entry
    FROM public.branch_laboratories
    WHERE branch_name = p_branch_name AND status = 'in_progress'
    LIMIT 3
  ) sub;

  -- 3. Cantidad de items controlados hoy (Uso de indice idx_inventories_lookup_v2)
  SELECT COUNT(*)
  INTO v_items_controlled_today
  FROM public.inventories
  WHERE branch_name = p_branch_name
    AND status IN ('controlled', 'adjusted')
    AND timezone('America/Argentina/Buenos_Aires', updated_at) >= v_ar_today;

  -- 4. Discrepancias y Totales Monetarios (Uso de indice idx_inventories_lookup_v2)
  SELECT 
    COALESCE(SUM((i.quantity - i.system_quantity) * p.cost), 0),
    COALESCE(SUM(ABS((i.quantity - i.system_quantity) * p.cost)), 0),
    COUNT(*) FILTER (WHERE i.quantity != i.system_quantity)
  INTO 
    v_net_value, v_abs_value, v_discrepant_count
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE i.branch_name = p_branch_name
    AND i.status IN ('controlled', 'adjusted');

  -- 5. Obtener el producto con Mayor Faltante (Uso de indice idx_inventories_lookup_v2)
  SELECT jsonb_build_object(
    'name', p.name,
    'ean', i.ean,
    'value', (i.quantity - i.system_quantity) * p.cost,
    'units', i.quantity - i.system_quantity,
    'lab', i.laboratory
  ) INTO v_max_faltante
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE i.branch_name = p_branch_name
    AND i.status IN ('controlled', 'adjusted')
    AND i.quantity < i.system_quantity
  ORDER BY (i.quantity - i.system_quantity) * p.cost ASC
  LIMIT 1;

  -- 6. Obtener el producto con Mayor Sobrante (Uso de indice idx_inventories_lookup_v2)
  SELECT jsonb_build_object(
    'name', p.name,
    'ean', i.ean,
    'value', (i.quantity - i.system_quantity) * p.cost,
    'units', i.quantity - i.system_quantity,
    'lab', i.laboratory
  ) INTO v_max_sobrante
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE i.branch_name = p_branch_name
    AND i.status IN ('controlled', 'adjusted')
    AND i.quantity > i.system_quantity
  ORDER BY (i.quantity - i.system_quantity) * p.cost DESC
  LIMIT 1;

  -- Construir el JSON de respuesta final
  v_result := jsonb_build_object(
    'total_labs', v_total_labs,
    'completed_labs', v_completed_labs,
    'in_progress_labs', v_in_progress_labs,
    'pending_labs', v_total_labs - v_completed_labs,
    'progress_percent', v_progress_percent,
    'items_controlled_today', v_items_controlled_today,
    'active_labs_list', v_active_labs,
    'net_value', v_net_value,
    'abs_value', v_abs_value,
    'discrepant_count', v_discrepant_count,
    'max_faltante', COALESCE(v_max_faltante, '{}'::JSONB),
    'max_sobrante', COALESCE(v_max_sobrante, '{}'::JSONB)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_branch_ai_context TO anon, authenticated, service_role;
