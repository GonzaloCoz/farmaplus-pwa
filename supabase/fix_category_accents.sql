-- ======================================================
-- NORMALIZACIÓN DE CATEGORÍAS (Fix para Acentos)
-- Ejecutar en el Editor SQL de Supabase para corregir
-- datos históricos inconsistentes.
-- ======================================================

-- Función auxiliar para remover acentos (Simulando normalizeString)
CREATE OR REPLACE FUNCTION public.normalize_category(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := UPPER(TRIM(input_text));
    result := REPLACE(result, 'Á', 'A');
    result := REPLACE(result, 'É', 'E');
    result := REPLACE(result, 'Í', 'I');
    result := REPLACE(result, 'Ó', 'O');
    result := REPLACE(result, 'Ú', 'U');
    -- Casos especiales o nulos
    IF result IS NULL OR result = '' THEN
        result := 'VARIOS';
    END IF;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 1. Actualizar tabla de Inventarios (Items)
UPDATE public.inventories 
SET category = public.normalize_category(category);

-- 2. Actualizar tabla de Metadatos (Dashboard)
UPDATE public.branch_laboratories 
SET category = public.normalize_category(category);

-- 3. Actualizar Historial de Ajustes
UPDATE public.inventory_adjustments 
SET category = public.normalize_category(category);

-- 4. Actualizar Reportes Inmutables
UPDATE public.inventory_reports 
SET category = public.normalize_category(category);

-- Eliminar función auxiliar tras el uso (opcional)
-- DROP FUNCTION public.normalize_category(TEXT);

-- NOTA: Si después de ejecutar esto ves laboratorios duplicados en el dashboard,
-- pulsa el botón "Mantenimiento DB" en la interfaz para consolidar.
