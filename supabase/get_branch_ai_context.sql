-- ========================================================
-- RPC: get_branch_ai_context
-- Descripcion: Obtiene estadisticas detalladas en tiempo real de una sucursal
--              para alimentar el contexto del Asistente de IA.
--              Resuelve el cuello de botella de rendimiento.
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
  v_normalized_branch TEXT;
BEGIN
  -- Normalizar nombre de la sucursal para las busquedas
  v_normalized_branch := LOWER(TRIM(p_branch_name));
  
  -- Definir el inicio de hoy en zona horaria Argentina (GMT-3)
  v_ar_today := timezone('America/Argentina/Buenos_Aires', now())::date;

  -- 1. Estadisticas de laboratorios desde branch_laboratories
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COALESCE(SUM(total_items), 0),
    COALESCE(SUM(controlled_items), 0)
  INTO 
    v_total_labs, v_completed_labs, v_in_progress_labs, v_total_items, v_controlled_items
  FROM public.branch_laboratories
  WHERE LOWER(TRIM(branch_name)) = v_normalized_branch;

  -- Porcentaje global
  IF v_total_items > 0 THEN
    v_progress_percent := ROUND((v_controlled_items::NUMERIC / v_total_items) * 100);
  END IF;

  -- 2. Lista de laboratorios activos (deduplicados, max 5)
  SELECT COALESCE(string_agg(lab_entry, E'\n'), '')
  INTO v_active_labs
  FROM (
    SELECT DISTINCT '- ' || laboratory || ': Progreso ' || progress_percentage || '%' AS lab_entry
    FROM public.branch_laboratories
    WHERE LOWER(TRIM(branch_name)) = v_normalized_branch AND status = 'in_progress'
    LIMIT 5
  ) sub;

  -- 3. Cantidad de items controlados hoy
  SELECT COUNT(*)
  INTO v_items_controlled_today
  FROM public.inventories
  WHERE LOWER(TRIM(branch_name)) = v_normalized_branch
    AND status IN ('controlled', 'adjusted')
    AND timezone('America/Argentina/Buenos_Aires', updated_at) >= v_ar_today;

  -- 4. Discrepancias y Totales Monetarios
  SELECT 
    COALESCE(SUM((i.quantity - i.system_quantity) * p.cost), 0),
    COALESCE(SUM(ABS((i.quantity - i.system_quantity) * p.cost)), 0),
    COUNT(*) FILTER (WHERE i.quantity != i.system_quantity)
  INTO 
    v_net_value, v_abs_value, v_discrepant_count
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE LOWER(TRIM(i.branch_name)) = v_normalized_branch
    AND i.status IN ('controlled', 'adjusted');

  -- 5. Obtener el producto con Mayor Faltante (diferencia monetaria mas negativa)
  SELECT jsonb_build_object(
    'name', p.name,
    'ean', i.ean,
    'value', (i.quantity - i.system_quantity) * p.cost,
    'units', i.quantity - i.system_quantity,
    'lab', i.laboratory
  ) INTO v_max_faltante
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE LOWER(TRIM(i.branch_name)) = v_normalized_branch
    AND i.status IN ('controlled', 'adjusted')
    AND i.quantity < i.system_quantity
  ORDER BY (i.quantity - i.system_quantity) * p.cost ASC
  LIMIT 1;

  -- 6. Obtener el producto con Mayor Sobrante (diferencia monetaria mas positiva)
  SELECT jsonb_build_object(
    'name', p.name,
    'ean', i.ean,
    'value', (i.quantity - i.system_quantity) * p.cost,
    'units', i.quantity - i.system_quantity,
    'lab', i.laboratory
  ) INTO v_max_sobrante
  FROM public.inventories i
  JOIN public.products p ON i.ean = p.ean
  WHERE LOWER(TRIM(i.branch_name)) = v_normalized_branch
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
