-- ========================================================
-- FIX: finalize_cyclic_inventory RPC (Params Mismatch)
-- Fecha: 2026-03-05
-- Propósito: Sincronizar parámetros con el frontend (shortage_id, surplus_id)
--            y evitar errores 400 por firma de función incorrecta.
-- ========================================================

CREATE OR REPLACE FUNCTION public.finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_shortage_id TEXT,
  p_surplus_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
  v_user_name TEXT;
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  -- 1. Obtener nombre del usuario para auditoría (opcional)
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;

  -- 2. Contar controlados (usando normalización para no omitir ninguno)
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  -- Si no hay nada controlado, simplemente salimos (o lanzamos excepción si se prefiere rigor)
  IF v_controlled_count = 0 THEN
    -- Opcional: Podríamos no lanzar excepción para evitar errores visuales si ya se guardó
    -- pero para "Ferrari Engine" es mejor ser estricto.
    RAISE EXCEPTION 'No hay artículos controlados para finalizar en la sucursal %.', p_branch_name;
  END IF;

  -- 3. Registrar en inventory_adjustments (Audit Trail)
  -- Nota: El frontend también guarda en el Ledger SAP, pero mantenemos esto por compatibilidad
  -- con el monitor principal y reportes antiguos.
  INSERT INTO public.inventory_adjustments (
      branch_name, 
      laboratory, 
      total_adjustments, 
      net_value, 
      notes, 
      created_by, 
      adjustment_id_shortage,
      adjustment_id_surplus
  ) VALUES (
      p_branch_name,
      p_laboratory,
      v_controlled_count,
      0, 
      'Cierre de recuento. Usuario: ' || COALESCE(v_user_name, 'Desconocido'),
      p_user_id,
      p_shortage_id,
      p_surplus_id
  );

  -- 4. "El Snap": Pasar todo lo controlado a ajustado
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW(),
      adjustment_id_shortage = CASE WHEN quantity < system_quantity THEN p_shortage_id ELSE adjustment_id_shortage END,
      adjustment_id_surplus = CASE WHEN quantity > system_quantity THEN p_surplus_id ELSE adjustment_id_surplus END
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(laboratory) = v_lab
    AND status = 'controlled';

  -- 5. Recalcular progreso final para el Monitor
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_cyclic_inventory TO anon, authenticated, service_role;
