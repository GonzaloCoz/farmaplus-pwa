-- ========================================================
-- FIX FINAL: Sincronización Ferrari + Purga Blindada (Acentos e IDs)
-- Fecha: 2026-03-04
-- ========================================================

-- 1. Asegurar extensión unaccent (requerida para normalizar)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Función de Normalización Universal (Mismo criterio que JS)
CREATE OR REPLACE FUNCTION normalize_string_sql(p_text TEXT) 
RETURNS TEXT AS $$
BEGIN
    -- Trim, Upper, y quitar acentos (igual que normalizeString en React)
    RETURN TRIM(UPPER(unaccent(p_text)));
END;
$$ LANGUAGE plpgsql;

-- 3. Blindar Recompute Lab Progress (Para que contadores no fallen por acentos)
CREATE OR REPLACE FUNCTION recompute_lab_progress(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_total_in_inventories INTEGER;
  v_processed INTEGER;
  v_total_denominator INTEGER;
  v_progress NUMERIC;
  v_status TEXT;
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- Contar procesados usando normalización
  SELECT COUNT(*) INTO v_processed
  FROM public.inventories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status IN ('controlled', 'adjusted');

  -- Contar totales usando normalización
  SELECT COUNT(*) INTO v_total_in_inventories
  FROM public.inventories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab;

  -- GUARD: Si está vacío, no bajar el progreso (Auto-Archive Guard)
  IF v_total_in_inventories = 0 THEN
    RETURN;
  END IF;

  v_total_denominator := GREATEST(v_total_in_inventories, 1);
  v_progress := ROUND((v_processed::NUMERIC / v_total_denominator) * 100);

  v_status := CASE
    WHEN v_progress >= 100 THEN 'completed'
    WHEN v_progress > 0 THEN 'in_progress'
    ELSE 'pending'
  END;

  UPDATE public.branch_laboratories
  SET
    total_items = v_total_in_inventories,
    progress_percentage = LEAST(100, v_progress),
    status = v_status,
    controlled_items = (SELECT count(*) from inventories where normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab AND status = 'controlled'),
    adjusted_items = (SELECT count(*) from inventories where normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab AND status = 'adjusted'),
    pending_items = (SELECT count(*) from inventories where normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab AND status = 'pending')
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Blindar Purga Profunda (Soluciona "el excel sigue ahí")
CREATE OR REPLACE FUNCTION public.purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- Borrar todo rastro usando normalización estricta
  DELETE FROM public.inventory_ledger_items
  WHERE ledger_id IN (SELECT id FROM public.inventory_ledger WHERE normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab);
  
  DELETE FROM public.inventory_ledger WHERE normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab;
  DELETE FROM public.inventory_reports WHERE normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab;
  DELETE FROM public.inventory_adjustments WHERE normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab;
  DELETE FROM public.inventories WHERE normalize_string_sql(branch_name) = v_branch AND normalize_string_sql(laboratory) = v_lab;
  
  -- Reset Total en Metadata
  UPDATE public.branch_laboratories SET
    total_items = 0, controlled_items = 0, adjusted_items = 0, pending_items = 0,
    progress_percentage = 0, status = 'pending', net_value = 0,
    negative_value = 0, positive_value = 0, total_system_units = 0, net_units = 0
  WHERE normalize_string_sql(branch_name) = v_branch 
  AND normalize_string_sql(laboratory) = v_lab;

  -- Audit Log
  INSERT INTO public.audit_logs (action, entity_type, branch_id, details)
  VALUES ('LAB_RESET_DEEP', 'INVENTORY', p_branch_name, jsonb_build_object('lab', p_laboratory));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CORREGIR Finalización Ferrari (Soluciona Error 400 y Nombres de Columnas)
CREATE OR REPLACE FUNCTION finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_plex_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
  v_user_name TEXT;
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- Obtener nombre del usuario
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;

  -- Contar controlados (usando normalización para no omitir ninguno)
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  IF v_controlled_count = 0 THEN
    RAISE EXCEPTION 'No hay artículos controlados para finalizar.';
  END IF;

  -- [ELIMINADO] La inserción en inventory_adjustments se delega al frontend 
  -- para que incluya los IDs de ajuste y los montos calculados ($).

  -- 2. "El Snap": Pasar todo lo controlado a ajustado
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW()
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  -- 3. Recalcular progreso final
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. LIMPIEZA DE BASURA (Opcional: Borrar ajustes en $0 creados por el error anterior)
DELETE FROM public.inventory_adjustments 
WHERE shortage_value = 0 AND surplus_value = 0 AND (adjustment_id_shortage IS NULL OR adjustment_id_shortage = '');
