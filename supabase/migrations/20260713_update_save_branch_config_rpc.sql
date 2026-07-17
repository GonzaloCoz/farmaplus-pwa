-- Migration: Update save_branch_config to preserve round configurations
-- Date: 2026-07-13
-- Purpose: Protect CONFIG_ROUND and CONFIG_ROUND_* entries from being deleted during config saves.

CREATE OR REPLACE FUNCTION public.save_branch_config(
  p_branch_name TEXT,
  p_days INTEGER,
  p_start_date_seconds INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_clean_branch TEXT;
BEGIN
    -- 1. Normalization
    v_clean_branch := UPPER(TRIM(p_branch_name));
    v_clean_branch := REPLACE(v_clean_branch, 'Á', 'A');
    v_clean_branch := REPLACE(v_clean_branch, 'É', 'E');
    v_clean_branch := REPLACE(v_clean_branch, 'Í', 'I');
    v_clean_branch := REPLACE(v_clean_branch, 'Ó', 'O');
    v_clean_branch := REPLACE(v_clean_branch, 'Ú', 'U');

    -- 2. Delete ONLY days and start date config records to preserve round settings
    DELETE FROM public.inventories
    WHERE (branch_name = v_clean_branch OR branch_name ILIKE p_branch_name)
      AND laboratory = '_CONFIG_'
      AND ean IN ('CONFIG_DAYS', 'CONFIG_START_DATE');
      
    -- 3. Ensure config products exist
    INSERT INTO public.products (ean, name, category, laboratory, cost)
    VALUES 
        ('CONFIG_DAYS', 'Configuración: Días del Ciclo', 'SISTEMA', '_CONFIG_', 0),
        ('CONFIG_START_DATE', 'Configuración: Fecha de Inicio', 'SISTEMA', '_CONFIG_', 0)
    ON CONFLICT (ean) DO NOTHING;

    -- 4. Insert Cycle Days Config
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
        1, -- Always round 1 for configuration rows to keep constraint unique
        NOW()
    );
    
    -- 5. Insert Start Date Config
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
            1, -- Always round 1 for configuration rows to keep constraint unique
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.save_branch_config TO anon, authenticated;
