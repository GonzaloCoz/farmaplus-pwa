-- Migration: Fix branch config normalization and active round mismatch
-- Date: 2026-07-17
-- Purpose:
--   1. Re-define save_branch_config and save_bulk_branch_config using normalize_string_sql.
--   2. Align single save_branch_config to write config into the active round (not hardcoded round 1).
--   3. Repair existing inventories configuration rows (unifying names and backfilling configs to active rounds).

-- 1. Redefine save_branch_config to be consistent with rounds and normalization
CREATE OR REPLACE FUNCTION public.save_branch_config(
  p_branch_name TEXT,
  p_days INTEGER,
  p_start_date_seconds INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_clean_branch TEXT;
    v_round INTEGER;
BEGIN
    -- Consistent normalization using normalize_string_sql
    v_clean_branch := public.normalize_string_sql(p_branch_name);

    -- Get active round for this branch
    SELECT COALESCE(
      (
        SELECT quantity::INTEGER 
        FROM public.inventories 
        WHERE public.normalize_string_sql(branch_name) = public.normalize_string_sql(v_clean_branch)
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_ROUND' 
          AND round = 1 
        LIMIT 1
      ),
      1
    ) INTO v_round;

    -- Ensure CONFIG products exist
    INSERT INTO public.products (ean, name, category, laboratory, cost)
    VALUES 
        ('CONFIG_DAYS', 'Configuración: Días del Ciclo', 'SISTEMA', '_CONFIG_', 0),
        ('CONFIG_START_DATE', 'Configuración: Fecha de Inicio', 'SISTEMA', '_CONFIG_', 0)
    ON CONFLICT (ean) DO NOTHING;

    -- Upsert CONFIG_DAYS for active round
    INSERT INTO public.inventories (
        branch_name, 
        laboratory, 
        ean, 
        quantity, 
        system_quantity, 
        status, 
        category,
        round,
        updated_at
    )
    VALUES (
        v_clean_branch, 
        '_CONFIG_', 
        'CONFIG_DAYS', 
        p_days, 
        0, 
        'pending', 
        'SISTEMA',
        v_round,
        NOW()
    )
    ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    
    -- Upsert CONFIG_START_DATE for active round
    IF p_start_date_seconds IS NOT NULL THEN
        INSERT INTO public.inventories (
            branch_name, 
            laboratory, 
            ean, 
            quantity, 
            system_quantity, 
            status, 
            category,
            round,
            updated_at
        )
        VALUES (
            v_clean_branch, 
            '_CONFIG_', 
            'CONFIG_START_DATE', 
            p_start_date_seconds, 
            0, 
            'pending', 
            'SISTEMA',
            v_round,
            NOW()
        )
        ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
        DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine save_bulk_branch_config to be consistent with normalization
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
    -- Consistent normalization using normalize_string_sql
    v_clean_branch := public.normalize_string_sql(v_branch_name);

    -- Get active round for this branch
    SELECT COALESCE(
      (
        SELECT quantity::INTEGER 
        FROM public.inventories 
        WHERE public.normalize_string_sql(branch_name) = public.normalize_string_sql(v_clean_branch)
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_ROUND' 
          AND round = 1 
        LIMIT 1
      ),
      1
    ) INTO v_round;

    -- Upsert CONFIG_DAYS for active round
    INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
    VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_DAYS', p_days, 0, 'pending', 'SISTEMA', v_round, NOW())
    ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

    -- Upsert CONFIG_START_DATE for active round
    IF p_start_date_seconds IS NOT NULL THEN
      INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
      VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_START_DATE', p_start_date_seconds, 0, 'pending', 'SISTEMA', v_round, NOW())
      ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Database Repair: Unify configuration branch names and copy configs to active rounds
DO $$
DECLARE
  r RECORD;
  v_active_round INTEGER;
BEGIN
  -- 1. Deduplicate configuration rows to prevent unique key index conflicts
  DELETE FROM public.inventories i1
  WHERE laboratory = '_CONFIG_'
    AND EXISTS (
      SELECT 1 FROM public.inventories i2
      WHERE i2.laboratory = '_CONFIG_'
        AND i2.ean = i1.ean
        AND i2.round = i1.round
        AND public.normalize_string_sql(i2.branch_name) = public.normalize_string_sql(i1.branch_name)
        AND (
          (i2.branch_name = public.normalize_string_sql(i2.branch_name) AND i1.branch_name != public.normalize_string_sql(i1.branch_name))
          OR
          (
            (i2.branch_name = public.normalize_string_sql(i2.branch_name) OR i1.branch_name != public.normalize_string_sql(i1.branch_name))
            AND i2.ctid < i1.ctid
          )
        )
    );

  -- 2. Unify all config branch names using normalize_string_sql (e.g. NUÑEZ -> NUNEZ, Villa Urquiza III -> VILLA URQUIZA III)
  UPDATE public.inventories 
  SET branch_name = public.normalize_string_sql(branch_name)
  WHERE laboratory = '_CONFIG_';

  -- Loop through each branch to copy configs to active rounds if missing
  FOR r IN 
    SELECT DISTINCT branch_name 
    FROM public.inventories 
    WHERE laboratory = '_CONFIG_'
  LOOP
    -- Get active round
    SELECT COALESCE(quantity::INTEGER, 1) INTO v_active_round
    FROM public.inventories
    WHERE branch_name = r.branch_name
      AND laboratory = '_CONFIG_'
      AND ean = 'CONFIG_ROUND'
      AND round = 1;
      
    IF v_active_round > 1 THEN
      -- Copy CONFIG_DAYS if missing for the active round
      IF NOT EXISTS (
        SELECT 1 FROM public.inventories 
        WHERE branch_name = r.branch_name 
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_DAYS' 
          AND round = v_active_round
      ) THEN
        INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
        SELECT branch_name, laboratory, ean, quantity, system_quantity, status, category, v_active_round, NOW()
        FROM public.inventories
        WHERE branch_name = r.branch_name
          AND laboratory = '_CONFIG_'
          AND ean = 'CONFIG_DAYS'
          AND round = 1
        LIMIT 1;
      END IF;

      -- Copy CONFIG_START_DATE if missing for the active round
      IF NOT EXISTS (
        SELECT 1 FROM public.inventories 
        WHERE branch_name = r.branch_name 
          AND laboratory = '_CONFIG_' 
          AND ean = 'CONFIG_START_DATE' 
          AND round = v_active_round
      ) THEN
        INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, round, updated_at)
        SELECT branch_name, laboratory, ean, quantity, system_quantity, status, category, v_active_round, NOW()
        FROM public.inventories
        WHERE branch_name = r.branch_name
          AND laboratory = '_CONFIG_'
          AND ean = 'CONFIG_START_DATE'
          AND round = 1
        LIMIT 1;
      END IF;
    END IF;
  END LOOP;
END;
$$;
