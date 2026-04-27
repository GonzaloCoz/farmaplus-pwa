-- ==========================================
-- Unify Branch Names (Fix Ñ and Accents)
-- Date: 2026-04-24
-- ==========================================

-- 1. Unify 'Las Cañitas' (Merge 'LAS CANITAS' into 'Las Cañitas')
UPDATE public.branch_laboratories 
SET branch_name = 'Las Cañitas' 
WHERE branch_name IN ('LAS CANITAS', 'LAS CAÑITAS', 'Las Canitas');

UPDATE public.inventories 
SET branch_name = 'Las Cañitas' 
WHERE branch_name IN ('LAS CANITAS', 'LAS CAÑITAS', 'Las Canitas');

-- 2. Unify 'Nuñez' (Rename 'NUNEZ' to 'Nuñez')
UPDATE public.branch_laboratories 
SET branch_name = 'Nuñez' 
WHERE branch_name IN ('NUNEZ', 'NUÑEZ', 'Nunez');

UPDATE public.inventories 
SET branch_name = 'Nuñez' 
WHERE branch_name IN ('NUNEZ', 'NUÑEZ', 'Nunez');

-- 3. General Normalization for other common ones
UPDATE public.branch_laboratories SET branch_name = 'Morón' WHERE branch_name = 'MORON';
UPDATE public.inventories SET branch_name = 'Morón' WHERE branch_name = 'MORON';

UPDATE public.branch_laboratories SET branch_name = 'Gonzalez Catán' WHERE branch_name IN ('GONZALEZ CATAN', 'GONZALEZ CATAN II', 'GONZALEZ CATAN III');
UPDATE public.inventories SET branch_name = 'Gonzalez Catán' WHERE branch_name IN ('GONZALEZ CATAN', 'GONZALEZ CATAN II', 'GONZALEZ CATAN III');

-- 4. Recompute summaries to reflect changes
-- (Note: branch_summaries is a VIEW, so it will update automatically)
