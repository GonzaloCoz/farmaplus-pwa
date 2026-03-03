-- ==========================================
-- RPC: Purga TOTAL de TODO el sistema (Pre-Lanzamiento)
-- Elimina TODOS los inventarios, ajustes, resúmenes y resetea metadata
-- Restringido conceptualmente para uso administrativo (gcoz)
-- ==========================================

CREATE OR REPLACE FUNCTION purge_all_inventory_data() 
RETURNS VOID AS $$
BEGIN
  -- 0. Subir el tiempo de espera a 5 minutos por si hay bloqueos
  PERFORM set_config('statement_timeout', '300000', true);

  -- 1. TRUNCATE masivo
  TRUNCATE TABLE 
    public.inventories, 
    public.inventory_adjustments, 
    public.inventory_reports,
    public.branch_summaries,
    public.precount_sessions,
    public.audit_logs
  RESTART IDENTITY CASCADE;

  -- 2. Reseteo metadata
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
    net_units = 0,
    last_updated = timezone('utc'::text, now())
  WHERE true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION purge_all_inventory_data() IS
  'Purga masiva de datos de inventario proyectado para limpieza antes del lanzamiento oficial.';
