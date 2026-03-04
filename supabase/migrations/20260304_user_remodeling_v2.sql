-- Migration: User and Branch Remodeling + Zonal Mapping
-- Description: Updates profiles, branches, initializes monitor and MAPS ZONAL BRANCHES.

BEGIN;

-- 1. DESACTIVATE OLD PROFILES
-- Administradores y Zonales que se retiran
UPDATE public.profiles
SET active = false
WHERE username IN (
    'carlos.fraga', 
    'nicolas.momeno', 
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
    ('Palermo IV', 'palermoiv'),
    ('Boedo', 'boedo')
ON CONFLICT (slug) DO NOTHING;

-- 4. INSERT/UPDATE MOD/ADMIN PROFILES
-- Nadia Diaz (Admin)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('ndiaz', 'Nadia Diaz', 'admin', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Nadia Diaz', role = 'admin', active = true;

-- Federico Formicelli (Mod)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('fformichelli', 'Federico Formicelli', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Federico Formicelli', role = 'mod', active = true;

-- Juan Gorbaran (Mod)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('jgorbaran', 'Juan Gorbaran', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Juan Gorbaran', role = 'mod', active = true;

-- Diego Ruiz (Mod - en caso de que no esté)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('druiz', 'Diego Ruiz', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Diego Ruiz', role = 'mod', active = true;

-- Andres Zanovello (Mod - Asegurar que está activo)
INSERT INTO public.profiles (username, full_name, role, active)
VALUES ('azanovello', 'Andres Zanovello', 'mod', true)
ON CONFLICT (username) DO UPDATE 
SET full_name = 'Andres Zanovello', role = 'mod', active = true;

-- 5. INITIALIZE MONITOR DATA FOR NEW BRANCHES
DO $$
DECLARE
    new_branch RECORD;
    cat TEXT;
    categories TEXT[] := ARRAY['Medicamentos', 'Perfumería', 'Accesorios', 'Varios'];
BEGIN
    FOR new_branch IN (SELECT name FROM public.branches WHERE name IN ('Escobar', 'Devoto III', 'Palermo IV', 'Boedo')) LOOP
        FOREACH cat IN ARRAY categories LOOP
            INSERT INTO public.branch_laboratories (
                branch_name, laboratory, category, total_items, pending_items, controlled_items, adjusted_items, progress_percentage, status
            )
            VALUES (new_branch.name, 'GENERAL', cat, 0, 0, 0, 0, 0, 'pending')
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 6. MAP ZONAL BRANCHES (CLEAN START)
-- Primero limpiamos las vinculaciones de los moderadores actuales para evitar duplicados o basura antigua
DELETE FROM public.zonal_branches 
WHERE zonal_id IN (SELECT id FROM public.profiles WHERE username IN ('azanovello', 'druiz', 'fformichelli', 'jgorbaran'));

-- Función auxiliar para insertar vinculaciones por nombre de usuario y nombre de sucursal
DO $$
DECLARE
    v_zonal_id UUID;
    v_branch_id UUID;
    
    -- Listas de mapeo
    v_azanovello_branches TEXT[] := ARRAY['Barracas', 'Beccar', 'Devoto', 'Devoto II', 'Devoto III', 'Escobar', 'Parque Patricios', 'Pilar', 'Pompeya', 'San Isidro', 'San Isidro II', 'San Miguel', 'Villa del Parque', 'Villa del Parque II', 'Villa Luro', 'Villa Urquiza', 'Villa Urquiza II', 'Villa Urquiza III'];
    v_druiz_branches TEXT[] := ARRAY['Belgrano', 'Belgrano IV', 'Belgrano VII', 'Belgrano VIII', 'Berazategui', 'Berazategui II', 'Boedo', 'Microcentro', 'Microcentro II', 'Nuñez', 'Palermo IV', 'Quilmes', 'Retiro', 'Retiro II', 'Tribunales'];
    v_fformichelli_branches TEXT[] := ARRAY['Caballito', 'Caballito II', 'Caballito III', 'Caballito IV', 'Chacarita', 'Flores', 'Las Cañitas', 'Parque Centenario', 'Ramos Mejia', 'Ramos Mejia II', 'Ramos Mejia III', 'Recoleta', 'Recoleta II', 'Recoleta III', 'Recoleta IV', 'Recoleta V'];
    v_jgorbaran_branches TEXT[] := ARRAY['Belgrano II', 'Belgrano III', 'Belgrano V', 'Belgrano VI', 'Gonzalez Catan', 'Gonzalez Catan II', 'Gonzalez Catan III', 'Mercedes', 'Morón', 'Padua', 'Palermo', 'Palermo II', 'Palermo III', 'Saladillo', 'Villa Ballester', 'Villa Ballester II', 'Villa Crespo'];
    
    v_branch_name TEXT;
BEGIN
    -- Andres Zanovello
    SELECT id INTO v_zonal_id FROM public.profiles WHERE username = 'azanovello';
    IF v_zonal_id IS NOT NULL THEN
        FOREACH v_branch_name IN ARRAY v_azanovello_branches LOOP
            SELECT id INTO v_branch_id FROM public.branches WHERE name = v_branch_name;
            IF v_branch_id IS NOT NULL THEN
                INSERT INTO public.zonal_branches (zonal_id, branch_id) VALUES (v_zonal_id, v_branch_id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- Diego Ruiz
    SELECT id INTO v_zonal_id FROM public.profiles WHERE username = 'druiz';
    IF v_zonal_id IS NOT NULL THEN
        FOREACH v_branch_name IN ARRAY v_druiz_branches LOOP
            SELECT id INTO v_branch_id FROM public.branches WHERE name = v_branch_name;
            IF v_branch_id IS NOT NULL THEN
                INSERT INTO public.zonal_branches (zonal_id, branch_id) VALUES (v_zonal_id, v_branch_id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- Federico Formicelli
    SELECT id INTO v_zonal_id FROM public.profiles WHERE username = 'fformichelli';
    IF v_zonal_id IS NOT NULL THEN
        FOREACH v_branch_name IN ARRAY v_fformichelli_branches LOOP
            SELECT id INTO v_branch_id FROM public.branches WHERE name = v_branch_name;
            IF v_branch_id IS NOT NULL THEN
                INSERT INTO public.zonal_branches (zonal_id, branch_id) VALUES (v_zonal_id, v_branch_id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- Juan Gorbaran
    SELECT id INTO v_zonal_id FROM public.profiles WHERE username = 'jgorbaran';
    IF v_zonal_id IS NOT NULL THEN
        FOREACH v_branch_name IN ARRAY v_jgorbaran_branches LOOP
            SELECT id INTO v_branch_id FROM public.branches WHERE name = v_branch_name;
            IF v_branch_id IS NOT NULL THEN
                INSERT INTO public.zonal_branches (zonal_id, branch_id) VALUES (v_zonal_id, v_branch_id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;
END $$;

COMMIT;
