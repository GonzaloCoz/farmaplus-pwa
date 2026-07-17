-- ============================================================
-- DIAGNÓSTICO: Sucursales Duplicadas
-- Fecha: 2026-06-24
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- Ejecutar cada bloque por separado para analizar los resultados.

-- ============================================================
-- 1. DUPLICADOS EXACTOS en tabla `branches`
--    Busca nombres idénticos (no debería haber por el UNIQUE, pero por las dudas)
-- ============================================================
SELECT 
    name,
    slug,
    id,
    created_at,
    config
FROM public.branches
ORDER BY name, created_at;

-- ============================================================
-- 2. DUPLICADOS POR NORMALIZACIÓN en tabla `branches`
--    Detecta variantes por mayúsculas, acentos o espacios extra.
--    Ej: "Morón" vs "MORON", "Las Cañitas" vs "Las Canitas"
-- ============================================================
SELECT 
    UPPER(TRIM(TRANSLATE(name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) AS nombre_normalizado,
    COUNT(*) AS cantidad_variantes,
    ARRAY_AGG(name ORDER BY created_at) AS variaciones_nombre,
    ARRAY_AGG(slug ORDER BY created_at) AS variaciones_slug,
    ARRAY_AGG(id ORDER BY created_at) AS ids,
    ARRAY_AGG(created_at ORDER BY created_at) AS fechas_creacion
FROM public.branches
GROUP BY UPPER(TRIM(TRANSLATE(name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
HAVING COUNT(*) > 1
ORDER BY nombre_normalizado;

-- ============================================================
-- 3. DUPLICADOS POR SLUG similar
--    Detecta slugs que apuntan a la misma sucursal lógica
-- ============================================================
SELECT 
    REPLACE(REPLACE(REPLACE(slug, 'ii', ''), 'iii', ''), 'iv', '') AS slug_base,
    slug,
    name,
    id,
    created_at
FROM public.branches
WHERE slug IN (
    SELECT s1.slug
    FROM public.branches s1
    JOIN public.branches s2 ON s1.id != s2.id
    AND UPPER(TRIM(TRANSLATE(s1.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) 
      = UPPER(TRIM(TRANSLATE(s2.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
)
ORDER BY name, created_at;

-- ============================================================
-- 4. SUCURSALES HUÉRFANAS: existen en `branches` pero nadie las usa
--    (sin profiles, sin inventarios, sin branch_laboratories)
-- ============================================================
SELECT 
    b.id,
    b.name,
    b.slug,
    b.created_at,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.branch_id = b.id) AS cant_profiles,
    (SELECT COUNT(*) FROM public.branch_laboratories bl WHERE bl.branch_name = b.name) AS cant_labs,
    (SELECT COUNT(*) FROM public.inventories i WHERE i.branch_name = b.name) AS cant_inventarios,
    (SELECT COUNT(*) FROM public.inventories i WHERE i.branch_name = UPPER(TRIM(TRANSLATE(b.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))) AS cant_inventarios_normalizado
FROM public.branches b
ORDER BY b.name;

-- ============================================================
-- 5. BRANCH NAMES en `branch_laboratories` que NO existen en `branches`
--    Detecta branch_names que se crearon fuera de la tabla branches
-- ============================================================
SELECT DISTINCT 
    bl.branch_name AS branch_name_en_labs,
    b.name AS branch_name_en_branches,
    b.id AS branch_id,
    CASE 
        WHEN b.id IS NULL THEN '⚠️ NO EXISTE en branches'
        ELSE '✅ OK'
    END AS estado
FROM public.branch_laboratories bl
LEFT JOIN public.branches b ON b.name = bl.branch_name
ORDER BY estado DESC, bl.branch_name;

-- ============================================================
-- 6. BRANCH NAMES en `inventories` que NO existen en `branches`
--    (usando match normalizado)
-- ============================================================
SELECT DISTINCT 
    i.branch_name AS branch_name_en_inventories,
    b.name AS branch_name_en_branches,
    CASE 
        WHEN b.id IS NULL THEN '⚠️ NO EXISTE en branches'
        ELSE '✅ OK'
    END AS estado,
    COUNT(*) AS cant_registros
FROM public.inventories i
LEFT JOIN public.branches b 
    ON UPPER(TRIM(TRANSLATE(b.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) = i.branch_name
GROUP BY i.branch_name, b.name, b.id
ORDER BY estado DESC, i.branch_name;

-- ============================================================
-- 7. DUPLICADOS en `branch_laboratories`
--    Mismo branch_name + laboratory aparece más de una vez
-- ============================================================
SELECT 
    branch_name,
    laboratory,
    COUNT(*) AS duplicados,
    ARRAY_AGG(id ORDER BY created_at) AS ids,
    ARRAY_AGG(created_at ORDER BY created_at) AS fechas,
    ARRAY_AGG(total_items ORDER BY created_at) AS total_items_cada_uno
FROM public.branch_laboratories
GROUP BY branch_name, laboratory
HAVING COUNT(*) > 1
ORDER BY branch_name, laboratory;

-- ============================================================
-- 8. VARIANTES DE NOMBRE por normalización en `branch_laboratories`
--    Ej: "MORON" vs "Morón", "LAS CANITAS" vs "Las Cañitas"
-- ============================================================
SELECT 
    UPPER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) AS normalizado,
    COUNT(DISTINCT branch_name) AS cant_variantes,
    ARRAY_AGG(DISTINCT branch_name) AS variaciones,
    SUM(total_items) AS total_items_global,
    MIN(created_at) AS primera_aparicion,
    MAX(last_updated) AS ultima_actualizacion
FROM public.branch_laboratories
GROUP BY UPPER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
HAVING COUNT(DISTINCT branch_name) > 1
ORDER BY normalizado;

-- ============================================================
-- 9. TIMELINE: Cuándo se creó cada sucursal en `branches`
-- ============================================================
SELECT 
    name,
    slug,
    created_at,
    created_at::date AS fecha,
    AGE(NOW(), created_at) AS antigüedad
FROM public.branches
ORDER BY created_at DESC;

-- ============================================================
-- 10. RESUMEN EJECUTIVO
-- ============================================================
SELECT 
    'Total sucursales en branches' AS metrica,
    COUNT(*)::text AS valor
FROM public.branches
UNION ALL
SELECT 
    'Branch names distintos en branch_laboratories',
    COUNT(DISTINCT branch_name)::text
FROM public.branch_laboratories
UNION ALL
SELECT 
    'Branch names distintos en inventories',
    COUNT(DISTINCT branch_name)::text
FROM public.inventories
UNION ALL
SELECT 
    'Branch names en labs SIN match en branches',
    COUNT(DISTINCT bl.branch_name)::text
FROM public.branch_laboratories bl
LEFT JOIN public.branches b ON b.name = bl.branch_name
WHERE b.id IS NULL
UNION ALL
SELECT 
    'Branch names en inventories SIN match en branches',
    COUNT(DISTINCT i.branch_name)::text
FROM public.inventories i
LEFT JOIN public.branches b ON b.name = i.branch_name
WHERE b.id IS NULL;
