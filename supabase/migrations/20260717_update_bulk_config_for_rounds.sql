-- Migration: Update save_bulk_branch_config for multi-round support
-- Date: 2026-07-17
-- Purpose: Support saving configurations for the active round of each branch, preserving history of previous rounds, and fix conflicts.

CREATE OR REPLACE FUNCTION public.save_bulk_branch_config(
  p_branch_names text[],
  p_days integer,
  p_start_date_seconds numeric DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_branch_name text;
  v_clean_branch text;
  v_round integer;
BEGIN
  -- Ensure CONFIG products exist
  INSERT INTO public.products (ean, name, category, laboratory, cost)
  VALUES 
      ('CONFIG_DAYS', 'Configuración: Días del Ciclo', 'SISTEMA', '_CONFIG_', 0),
      ('CONFIG_START_DATE', 'Configuración: Fecha de Inicio', 'SISTEMA', '_CONFIG_', 0)
  ON CONFLICT (ean) DO NOTHING;

  FOREACH v_branch_name IN ARRAY p_branch_names
  LOOP
    -- Normalización consistente
    v_clean_branch := UPPER(TRIM(TRANSLATE(v_branch_name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')));

    -- Obtener la ronda activa actual de la sucursal (por defecto 1)
    SELECT COALESCE(
      (
        SELECT quantity::INTEGER 
        FROM public.inventories 
        WHERE LOWER(TRIM(branch_name)) = LOWER(TRIM(v_clean_branch)) 
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_ROUND' 
          AND round = 1 
        LIMIT 1
      ),
      1
    ) INTO v_round;

    -- Upsert CONFIG_DAYS para la ronda activa
    INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
    VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_DAYS', p_days, 0, 'pending', 'SISTEMA', v_round, NOW())
    ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

    -- Upsert CONFIG_START_DATE para la ronda activa
    IF p_start_date_seconds IS NOT NULL THEN
      INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
      VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_START_DATE', p_start_date_seconds, 0, 'pending', 'SISTEMA', v_round, NOW())
      ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_bulk_branch_config TO anon, authenticated;
