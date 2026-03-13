
-- Migración de nombres de sucursal para Las Cañitas
-- Unifica 'Las Canitas' (sin ñ) y variantes a 'Las Cañitas' (con ñ)

BEGIN;

-- 1. Actualizar inventories (Datos de productos)
UPDATE inventories 
SET branch_name = 'Las Cañitas' 
WHERE branch_name ILIKE 'Las Canitas' 
   OR branch_name ILIKE 'LAS CANITAS';

-- 2. Actualizar branch_laboratories (Configuración de labs y progreso)
UPDATE branch_laboratories 
SET branch_name = 'Las Cañitas' 
WHERE branch_name ILIKE 'Las Canitas' 
   OR branch_name ILIKE 'LAS CANITAS';

-- 3. Actualizar logs de actividad
UPDATE activity_logs
SET branch_name = 'Las Cañitas'
WHERE branch_name ILIKE 'Las Canitas'
   OR branch_name ILIKE 'LAS CANITAS';

COMMIT;
