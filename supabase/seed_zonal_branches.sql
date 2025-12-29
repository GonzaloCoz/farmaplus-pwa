
-- Seed Data: Zonal Branch Assignments
-- Date: 2025-12-29
-- Purpose: Assign branches to zonal moderators

-- Insert zonal branch assignments
-- This uses subqueries to get the correct IDs from profiles and branches tables

-- Christian Mac Garva (cmcgarva) - 12 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'cmcgarva'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Barracas',
    'Belgrano III',
    'Berazategui II',
    'Caballito II',
    'Chacarita',
    'Las Cañitas',
    'Pompeya',
    'Recoleta V',
    'Villa Crespo',
    'Villa del Parque',
    'Villa del Parque II'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;

-- Andrés Zanovello (azanovello) - 11 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'azanovello'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Beccar',
    'Devoto',
    'devoto II',
    'Pilar',
    'San Isidro I',
    'San Isidro II',
    'San Miguel',
    'Villa Ballester',
    'Villa Ballester II',
    'Villa Urquiza',
    'Villa Urquiza II',
    'Villa Urquiza III'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;

-- Javier Paredes (jparedes) - 11 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'jparedes'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Belgrano',
    'Belgrano II',
    'Belgrano V',
    'Belgrano VI',
    'Palermo II',
    'Parque Centenario',
    'Parque Patricios',
    'Retiro',
    'Retiro II'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;

-- Jorge Arredondo (jarredondo) - 13 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'jarredondo'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Belgrano IV',
    'Caballito III',
    'Caballito IV',
    'Nuñez',
    'Palermo',
    'Palermo III',
    'Recoleta',
    'Recoleta II',
    'Recoleta III',
    'Recoleta IV'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;

-- Diego Ruiz (druiz) - 10 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'druiz'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Belgrano VII',
    'Belgrano VIII',
    'Berazategui',
    'Caballito',
    'Flores',
    'Microcentro',
    'Microcentro II',
    'Quilmes',
    'Tribunales'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;

-- Javier Mendoza (emendoza) - 11 branches
INSERT INTO public.zonal_branches (zonal_id, branch_id)
SELECT 
    (SELECT id FROM public.profiles WHERE username = 'emendoza'),
    b.id
FROM public.branches b
WHERE b.name IN (
    'Gonzales Catan',
    'Gonzales Catan II',
    'Gonzales Catan III',
    'Mercedes',
    'Morón',
    'Padua',
    'Ramos Mejia',
    'Ramos Mejia II',
    'Ramos Mejia III',
    'Saladillo',
    'Villa Luro'
)
ON CONFLICT (zonal_id, branch_id) DO NOTHING;
