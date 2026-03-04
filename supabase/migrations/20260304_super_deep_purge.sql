-- ==========================================
-- SUPER DEEP PURGE: Limpieza Total de Laboratorio
-- Fecha: 2026-03-04
-- ==========================================

CREATE OR REPLACE FUNCTION purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_branch_name_sql(p_branch_name);
  v_lab TEXT := TRIM(p_laboratory);
BEGIN
  -- 1. Borrar items del Ledger (contabilidad SAP)
  DELETE FROM public.inventory_ledger_items
  WHERE ledger_id IN (
    SELECT id FROM public.inventory_ledger 
    WHERE branch_name = v_branch AND laboratory ILIKE v_lab
  );

  -- 2. Borrar encabezados del Ledger
  DELETE FROM public.inventory_ledger 
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;

  -- 3. Borrar Snapshots de Reportes
  DELETE FROM public.inventory_reports 
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;

  -- 4. Borrar histórico de ajustes (legacy)
  DELETE FROM public.inventory_adjustments 
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;

  -- 5. Borrar listado de inventario
  DELETE FROM public.inventories 
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;
  
  -- 6. Resetear metadatos de la sucursal
  UPDATE public.branch_laboratories SET
    total_items = 0, 
    controlled_items = 0, 
    adjusted_items = 0, 
    pending_items = 0,
    progress_percentage = 0, status = 'pending', net_value = 0,
    negative_value = 0, positive_value = 0, total_system_units = 0, net_units = 0
  WHERE branch_name = v_branch AND laboratory ILIKE v_lab;

  -- 7. Audit Log del Reinicio
  INSERT INTO public.audit_logs (action, entity_type, branch_id, details)
  VALUES ('LAB_RESET_DEEP', 'INVENTORY', v_branch, jsonb_build_object('lab', v_lab, 'reset_type', 'complete_purge'));

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
