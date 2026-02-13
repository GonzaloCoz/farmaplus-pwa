-- ======================================================
-- SAVE BRANCH CONFIG RPC (Fix para Error 409)
-- Ejecutar en el Editor SQL de Supabase
-- ======================================================

CREATE OR REPLACE FUNCTION public.save_branch_config(
  p_branch_name TEXT,
  p_days INTEGER,
  p_start_date_seconds INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_clean_branch TEXT;
BEGIN
    -- 1. Normalización idéntica a la del resto del sistema
    v_clean_branch := UPPER(TRIM(p_branch_name));
    v_clean_branch := REPLACE(v_clean_branch, 'Á', 'A');
    v_clean_branch := REPLACE(v_clean_branch, 'É', 'E');
    v_clean_branch := REPLACE(v_clean_branch, 'Í', 'I');
    v_clean_branch := REPLACE(v_clean_branch, 'Ó', 'O');
    v_clean_branch := REPLACE(v_clean_branch, 'Ú', 'U');

    -- 2. Limpieza de registros de configuración previos (Case-Insensitive)
    DELETE FROM public.inventories
    WHERE (branch_name = v_clean_branch OR branch_name ILIKE p_branch_name)
      AND laboratory = '_CONFIG_';
      
    -- 3. ENSURE CONFIG PRODUCTS EXIST (Fix for FK constraint "inventories_ean_fkey")
    -- Inserción en la tabla de productos para que las llaves foráneas no fallen
    INSERT INTO public.products (ean, name, category, laboratory, cost)
    VALUES 
        ('CONFIG_DAYS', 'Configuración: Días del Ciclo', 'SISTEMA', '_CONFIG_', 0),
        ('CONFIG_START_DATE', 'Configuración: Fecha de Inicio', 'SISTEMA', '_CONFIG_', 0)
    ON CONFLICT (ean) DO NOTHING;

    -- 4. Inserción de Días
    INSERT INTO public.inventories (
        branch_name, 
        laboratory, 
        ean, 
        quantity, 
        system_quantity, 
        status, 
        category,
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
        NOW()
    );
    
    -- 5. Inserción de Fecha de Inicio (si existe)
    IF p_start_date_seconds IS NOT NULL THEN
        INSERT INTO public.inventories (
            branch_name, 
            laboratory, 
            ean, 
            quantity, 
            system_quantity, 
            status, 
            category,
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
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.save_branch_config TO anon, authenticated;
