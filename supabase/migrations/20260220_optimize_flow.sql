-- ==========================================
-- Migración: Optimizar Flujo de Inventario (Proteger Historial)
-- ==========================================

-- Redefinir purge_lab_inventory para NO borrar de inventory_adjustments
CREATE OR REPLACE FUNCTION purge_lab_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := TRIM(p_branch_name);
  v_lab TEXT := TRIM(p_laboratory);
BEGIN
  -- 1. Borrar TODOS los items de inventories (ajustados, controlados, pendientes)
  DELETE FROM public.inventories
  WHERE branch_name ILIKE v_branch
    AND laboratory ILIKE v_lab;

  -- IMPORTANTE: Ya no borramos de public.inventory_adjustments
  -- para que el historial perdure incluso si se resube el Excel base.

  -- 2. Resetear metadata en branch_laboratories (no borrar, para que el lab siga visible)
  UPDATE public.branch_laboratories
  SET
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
  WHERE branch_name ILIKE v_branch
    AND laboratory ILIKE v_lab;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION purge_lab_inventory(TEXT, TEXT) IS
  'Reiniciar laboratorio: borra inventarios y resetea metadata, PERO CONSERVA EL HISTORIAL.';

-- Grant permissions again just in case
GRANT EXECUTE ON FUNCTION purge_lab_inventory TO anon, authenticated;
