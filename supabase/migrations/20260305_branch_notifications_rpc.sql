-- RPC: Enviar notificación a toda una sucursal
-- Fecha: 2026-03-05
-- Propósito: Permitir que administradores (ghcoz) envíen anuncios masivos

CREATE OR REPLACE FUNCTION send_branch_notification(
  p_branch_name TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_category TEXT DEFAULT 'ANUNCIO'
) RETURNS VOID AS $$
DECLARE
  v_branch_id UUID;
  v_user_record RECORD;
BEGIN
  -- 1. Buscar el ID de la sucursal basado en el nombre (normalizado o no)
  -- Intentamos exacto primero, si no buscamos con el helper de normalización si existe
  SELECT id INTO v_branch_id FROM public.branches 
  WHERE name = p_branch_name OR name = UPPER(TRIM(p_branch_name)) LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal % no encontrada.', p_branch_name;
  END IF;

  -- 2. Insertar una notificación para cada usuario activo de esa sucursal
  -- Insertamos directamente en public.notifications para disparar el Realtime de Supabase
  INSERT INTO public.notifications (user_id, title, message, type, category, is_read, created_at)
  SELECT id, p_title, p_message, p_type, p_category, false, NOW()
  FROM public.profiles
  WHERE branch_id = v_branch_id AND active = true;

  -- 3. Log de auditoría
  INSERT INTO public.audit_logs (action, entity_type, branch_id, details)
  VALUES ('ADMIN_ANNOUNCEMENT', 'NOTIFICATION', p_branch_name, jsonb_build_object(
      'title', p_title,
      'target_branch', p_branch_name,
      'message', p_message
  ));

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_branch_notification TO authenticated, service_role;

COMMENT ON FUNCTION send_branch_notification IS 'Envía una notificación a todos los usuarios de una sucursal específica.';
