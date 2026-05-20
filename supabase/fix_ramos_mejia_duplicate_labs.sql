-- ============================================================
-- FIX: Laboratorios duplicados por acento en Ramos Mejia
-- Ejecutar en el Editor SQL de Supabase (Dashboard > SQL Editor)
-- ============================================================
-- 
-- Problema: Algunos laboratorios aparecen duplicados porque
-- una versión tiene acento (ej: "ANDRÓMACO") y otra no ("ANDROMACO").
-- Este script detecta los pares, consolida los items en la versión
-- CON acento (canónica) y elimina la fila sin acento.
-- ============================================================

-- PASO 1: DIAGNÓSTICO – ver los duplicados actuales en Ramos Mejia
-- Ejecutá esto primero para confirmar qué pares existen.
SELECT
    UNACCENT(UPPER(TRIM(laboratory))) AS lab_normalizado,
    ARRAY_AGG(DISTINCT laboratory ORDER BY laboratory) AS variaciones,
    COUNT(DISTINCT laboratory) AS cantidad_variantes,
    SUM(total_items) AS total_items_combinado
FROM public.branch_laboratories
WHERE branch_name ILIKE '%Ramos Mejia%'
GROUP BY UNACCENT(UPPER(TRIM(laboratory)))
HAVING COUNT(DISTINCT laboratory) > 1
ORDER BY lab_normalizado;

-- ============================================================
-- PASO 2: CONSOLIDACIÓN
-- Suma los valores de la variante SIN acento hacia la variante
-- CON acento, luego elimina la fila sin acento.
-- Aplica sólo a branch_name = 'Ramos Mejia' (ajustar si difiere).
-- ============================================================

DO $$
DECLARE
    v_branch TEXT := 'Ramos Mejia'; -- Ajustar si el nombre exacto es distinto
    rec RECORD;
    v_canonical TEXT;
    v_duplicate TEXT;
    rows_merged INT := 0;
    rows_deleted INT := 0;
BEGIN

    -- Iteramos sobre cada grupo que tenga más de una variante del mismo lab
    FOR rec IN
        SELECT
            UNACCENT(UPPER(TRIM(laboratory))) AS lab_norm,
            ARRAY_AGG(laboratory ORDER BY
                -- Ponemos primero la variante CON acentos (es la canónica)
                (LENGTH(laboratory) - LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    laboratory, 'Á',''), 'É',''), 'Í',''), 'Ó',''), 'Ú',''))) DESC,
                laboratory
            ) AS variantes
        FROM public.branch_laboratories
        WHERE branch_name ILIKE v_branch
        GROUP BY UNACCENT(UPPER(TRIM(laboratory)))
        HAVING COUNT(DISTINCT laboratory) > 1
    LOOP
        -- La primera variante (con más acentos) es la canónica
        v_canonical  := rec.variantes[1];

        RAISE NOTICE 'Procesando grupo: % | Canónica: % | Variantes: %',
            rec.lab_norm, v_canonical, rec.variantes;

        -- Procesamos cada variante duplicada (todas menos la canónica)
        FOR i IN 2..array_length(rec.variantes, 1) LOOP
            v_duplicate := rec.variantes[i];

            RAISE NOTICE '  Fusionando "%" -> "%"', v_duplicate, v_canonical;

            -- 2a. Sumar items de la variante duplicada a la canónica
            UPDATE public.branch_laboratories dst
            SET
                total_items         = dst.total_items         + src.total_items,
                controlled_items    = dst.controlled_items    + src.controlled_items,
                adjusted_items      = dst.adjusted_items      + src.adjusted_items,
                pending_items       = dst.pending_items       + src.pending_items,
                total_system_units  = dst.total_system_units  + src.total_system_units,
                net_units           = dst.net_units           + src.net_units,
                net_value           = dst.net_value           + src.net_value,
                negative_value      = dst.negative_value      + src.negative_value,
                positive_value      = dst.positive_value      + src.positive_value,
                last_updated        = GREATEST(dst.last_updated, src.last_updated),
                -- Recalcular progreso
                status = CASE
                    WHEN (dst.total_items + src.total_items) > 0
                         AND ((dst.controlled_items + src.controlled_items) + (dst.adjusted_items + src.adjusted_items))
                              >= (dst.total_items + src.total_items)
                    THEN 'completed'
                    WHEN (dst.controlled_items + src.controlled_items + dst.adjusted_items + src.adjusted_items) > 0
                    THEN 'in_progress'
                    ELSE 'pending'
                END,
                progress_percentage = CASE
                    WHEN (dst.total_items + src.total_items) > 0
                    THEN LEAST(
                        ROUND(
                            ((dst.controlled_items + src.controlled_items + dst.adjusted_items + src.adjusted_items)::numeric
                            / (dst.total_items + src.total_items)::numeric) * 100, 1
                        ), 100)
                    ELSE 0
                END
            FROM public.branch_laboratories src
            WHERE dst.branch_name ILIKE v_branch
              AND dst.laboratory  = v_canonical
              AND src.branch_name ILIKE v_branch
              AND src.laboratory  = v_duplicate;

            GET DIAGNOSTICS rows_merged = ROW_COUNT;

            -- 2b. Eliminar la fila duplicada
            DELETE FROM public.branch_laboratories
            WHERE branch_name ILIKE v_branch
              AND laboratory = v_duplicate;

            GET DIAGNOSTICS rows_deleted = ROW_COUNT;

            RAISE NOTICE '  -> Fusión OK (%/% filas afectadas)', rows_merged, rows_deleted;
        END LOOP;
    END LOOP;

    RAISE NOTICE '====================================';
    RAISE NOTICE 'Consolidación completada para "%".', v_branch;
    RAISE NOTICE '====================================';
END $$;

-- ============================================================
-- PASO 3: VERIFICACIÓN FINAL
-- Debería devolver 0 filas si no quedan duplicados.
-- ============================================================
SELECT
    UNACCENT(UPPER(TRIM(laboratory))) AS lab_normalizado,
    ARRAY_AGG(DISTINCT laboratory ORDER BY laboratory) AS variaciones_restantes
FROM public.branch_laboratories
WHERE branch_name ILIKE '%Ramos Mejia%'
GROUP BY UNACCENT(UPPER(TRIM(laboratory)))
HAVING COUNT(DISTINCT laboratory) > 1
ORDER BY lab_normalizado;
