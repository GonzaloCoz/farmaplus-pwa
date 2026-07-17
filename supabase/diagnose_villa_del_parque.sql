-- ============================================================
-- DIAGNÓSTICO ESPECÍFICO: ¿Por qué Villa del Parque II aparece duplicado?
-- Fecha: 2026-06-24
-- Ejecutar bloque por bloque en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- EXPLICACIÓN DEL PROBLEMA RAÍZ:
-- 
-- La función normalizeString() en el frontend hace:
--   "Villa del Parque II" → trim → NFD → quitar acentos → UPPER → "VILLA DEL PARQUE II"
--
-- La vista branch_summaries agrupa por:
--   LOWER(TRIM(bl.branch_name)) → "villa del parque ii"
--
-- PERO en branch_laboratories, los branch_name están como "VILLA DEL PARQUE II"
-- (la migración 20260303 los normalizó a UPPER).
--
-- Mientras que la tabla `branches` tiene "Villa del Parque II" (formato display).
--
-- El monitor (getBranchesSummaryLite) itera BRANCH_NAMES y busca un match con:
--   normalizeString(s.branch_name) === normalizeString(branchName)
--
-- Si hay DOS entradas en branch_summaries con el mismo branch_key normalizado
-- (por ejemplo, una es "VILLA DEL PARQUE II" y otra "Villa del Parque II"),
-- se hace un .find() y se encuentra solo UNA, pero la vista podría tener
-- datos de ambas versiones que no se consolidaron bien.
--
-- EJECUTÁ ESTOS QUERIES PARA CONFIRMAR:
-- ============================================================

-- 1. ¿Cuántas filas tiene "Villa del Parque II" en branch_laboratories?
--    (Busca TODAS las variantes)
SELECT 
    id,
    branch_name,
    laboratory,
    category,
    total_items,
    controlled_items,
    progress_percentage,
    status,
    created_at,
    last_updated
FROM public.branch_laboratories
WHERE LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) 
    LIKE '%villa del parque ii%'
ORDER BY branch_name, laboratory, category;

-- 2. ¿Hay variantes del nombre? (la clave del problema)
SELECT 
    branch_name,
    COUNT(*) AS filas,
    COUNT(DISTINCT laboratory) AS labs_distintos,
    SUM(total_items) AS total_items
FROM public.branch_laboratories
WHERE LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) 
    LIKE '%villa del parque%'
GROUP BY branch_name
ORDER BY branch_name;

-- 3. ¿Qué devuelve branch_summaries para "Villa del Parque"?
SELECT *
FROM public.branch_summaries
WHERE LOWER(branch_name) LIKE '%villa del parque%'
ORDER BY branch_name;

-- 4. TODAS las variantes de branch_name en branch_laboratories (GLOBAL)
--    Muestra grupos donde hay más de una escritura del mismo nombre
SELECT 
    LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) AS normalizado,
    ARRAY_AGG(DISTINCT branch_name) AS variaciones,
    COUNT(DISTINCT branch_name) AS cant_variantes
FROM public.branch_laboratories
GROUP BY LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
HAVING COUNT(DISTINCT branch_name) > 1
ORDER BY normalizado;

-- 5. VERIFICAR: ¿La vista branch_summaries genera duplicados?
--    Si hay 2+ filas para el mismo nombre normalizado, ESE es el bug
SELECT 
    LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) AS normalizado,
    COUNT(*) AS filas_en_summaries,
    ARRAY_AGG(branch_name) AS nombres_en_vista
FROM public.branch_summaries
GROUP BY LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
HAVING COUNT(*) > 1
ORDER BY normalizado;

-- 6. ¿Existe "Villa del Parque II" en la tabla branches?
SELECT id, name, slug, created_at
FROM public.branches
WHERE name ILIKE '%villa del parque%'
ORDER BY name;

-- 7. ¿Hay datos en inventories para Villa del Parque II?
SELECT 
    branch_name,
    COUNT(*) AS registros,
    COUNT(DISTINCT laboratory) AS labs,
    MIN(updated_at) AS primer_registro,
    MAX(updated_at) AS ultimo_update
FROM public.inventories
WHERE LOWER(TRIM(TRANSLATE(branch_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))) 
    LIKE '%villa del parque ii%'
GROUP BY branch_name;
