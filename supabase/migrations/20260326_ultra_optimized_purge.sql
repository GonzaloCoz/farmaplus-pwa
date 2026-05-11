-- ==========================================
-- ULTRA OPTIMIZED PURGE: Fix para timeouts 57014
-- Fecha: 2026-03-26
-- ==========================================

-- Aseguramos que la normalización sea inmutable para permitir índices funcionales
CREATE OR REPLACE FUNCTION normalize_branch_name_sql(p_name TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN TRIM(UPPER(unaccent(p_name)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Índices funcionales para acelerar búsquedas insensibles a mayúsculas
CREATE INDEX IF NOT EXISTS idx_inventories_lab_upper ON public.inventories (branch_name, UPPER(laboratory));
CREATE INDEX IF NOT EXISTS idx_ledger_lab_upper ON public.inventory_ledger (branch_name, UPPER(laboratory));

CREATE OR REPLACE FUNCTION purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_branch_name_sql(p_branch_name);
  v_lab TEXT := TRIM(UPPER(p_laboratory));
BEGIN
  -- 1. Borrar items del Ledger (contabilidad SAP)
  -- Usamos USING para evitar el subquery IN que puede ser ineficiente en tablas grandes
  DELETE FROM public.inventory_ledger_items li
  USING public.inventory_ledger l
  WHERE li.ledger_id = l.id
    AND l.branch_name = v_branch 
    AND UPPER(l.laboratory) = v_lab;

  -- 2. Borrar encabezados del Ledger
  DELETE FROM public.inventory_ledger 
  WHERE branch_name = v_branch AND UPPER(laboratory) = v_lab;

  -- 3. Borrar Snapshots de Reportes
  DELETE FROM public.inventory_reports 
  WHERE branch_name = v_branch AND UPPER(laboratory) = v_lab;

  -- 4. Borrar histórico de ajustes
  DELETE FROM public.inventory_adjustments 
  WHERE branch_name = v_branch AND UPPER(laboratory) = v_lab;

  -- 5. Borrar listado de inventario principal
  DELETE FROM public.inventories 
  WHERE branch_name = v_branch AND UPPER(laboratory) = v_lab;
  
  -- 6. Resetear metadatos de la sucursal
  UPDATE public.branch_laboratories SET
    total_items = 0, 
    controlled_items = 0, 
    adjusted_items = 0, 
    pending_items = 0,
    progress_percentage = 0, 
    status = 'pending', 
    net_value = 0,
    negative_value = 0, 
    positive_value = 0, 
    total_system_units = 0, 
    net_units = 0
  WHERE branch_name = v_branch AND UPPER(laboratory) = v_lab;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (action, entity_type, branch_id, details)
  VALUES (
    'LAB_RESET_OPTIMIZED', 
    'INVENTORY', 
    v_branch, 
    jsonb_build_object('lab', v_lab, 'ts', now())
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
