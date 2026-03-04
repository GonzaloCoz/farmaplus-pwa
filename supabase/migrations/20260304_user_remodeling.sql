-- Migration: User and Branch Remodeling
-- Description: Updates profiles, branches, and initializes monitor data for new branches.

BEGIN;

-- 1. DESACTIVATE OLD PROFILES
-- Administradores y Zonales que se retiran
UPDATE public.profiles
SET active = false
WHERE username IN (
    'carlos.fraga', 
    'nicolas.momeno', 
    'azanovello', 
    'cmcgarva', 
    'emendoza', 
    'jparedes', 
    'jarredondo'
);

-- 2. UPDATE EXISTING BRANCH NAMES
UPDATE public.branches SET name = 'Devoto II' WHERE name = 'devoto ii';
UPDATE public.branches SET name = 'San Isidro' WHERE name IN ('San Isidro I', 'sanisidroi');
UPDATE public.branches SET slug = 'sanisidro' WHERE name = 'San Isidro';

-- 3. INSERT NEW BRANCHES
INSERT INTO public.branches (name, slug)
VALUES 
    ('Escobar', 'escobar'),
    ('Devoto III', 'devotoiii'),
    ('Palermo IV', 'palermoiv')
ON CONFLICT (slug) DO NOTHING;

-- 4. INSERT/UPDATE NEW PROFILES
-- Nadia Diaz (Admin)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('ndiaz', 'Nadia Diaz', 'admin', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Nadia Diaz', role = 'admin', active = true;

-- Federico Formicelli (Mod/Zonal)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('fformichelli', 'Federico Formicelli', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Federico Formicelli', role = 'mod', active = true;

-- Juan Gorbaran (Mod/Zonal)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('jgorbaran', 'Juan Gorbaran', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Juan Gorbaran', role = 'mod', active = true;

-- 5. INITIALIZE MONITOR DATA FOR NEW BRANCHES
-- Creamos los registros base en branch_laboratories para que aparezcan en el Monitor/Dashboard
-- Recorremos las sucursales nuevas y las categorías estándar.

DO $$
DECLARE
    new_branch RECORD;
    cat TEXT;
    categories TEXT[] := ARRAY['Medicamentos', 'Perfumería', 'Accesorios', 'Varios'];
BEGIN
    FOR new_branch IN (SELECT name FROM public.branches WHERE name IN ('Escobar', 'Devoto III', 'Palermo IV')) LOOP
        FOREACH cat IN ARRAY categories LOOP
            INSERT INTO public.branch_laboratories (
                branch_name, 
                laboratory, 
                category, 
                total_items, 
                pending_items, 
                controlled_items, 
                adjusted_items, 
                progress_percentage,
                status
            )
            VALUES (
                new_branch.name,
                'GENERAL', -- Default lab entry for visibility
                cat,
                0, 0, 0, 0, 0,
                'pending'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

COMMIT;
