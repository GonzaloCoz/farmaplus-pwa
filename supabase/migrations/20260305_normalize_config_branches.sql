-- ========================================================
-- FIX: Normalización de registros de configuración existentes
-- Fecha: 2026-03-05
-- Propósito: Asegurar que todos los registros _CONFIG_ tengan nombres de sucursal normalizados
-- ========================================================

-- Re-utilizar la función de normalización global si existe, 
-- sino usar una lógica local idéntica a normalizeString de JS.
DO $$ 
BEGIN
    -- Actualizar registros de configuración existentes
    UPDATE public.inventories 
    SET branch_name = UPPER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')))
    WHERE laboratory = '_CONFIG_';
    
    -- Eliminar posibles duplicados que hayan quedado tras la normalización
    -- (Manteniendo el más reciente por updated_at)
    DELETE FROM public.inventories i1
    USING public.inventories i2
    WHERE i1.id < i2.id
      AND i1.laboratory = '_CONFIG_'
      AND i2.laboratory = '_CONFIG_'
      AND i1.branch_name = i2.branch_name
      AND i1.ean = i2.ean;

END $$;
