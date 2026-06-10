-- ==========================================
-- Consulta: IDs de Ajuste por Laboratorio
-- Sucursal: Caballito III
-- Fuente: inventory_adjustments (historial)
-- ==========================================
-- Muestra 3 columnas:
--   1. Laboratorio (nombre)
--   2. ID de Alta (sobrantes / surplus)
--   3. ID de Baja (faltantes / shortage)
--
-- Si un laboratorio tiene múltiples ajustes (re-ajustes),
-- los IDs se concatenan separados por coma.
-- ==========================================

SELECT
    laboratory                          AS "Laboratorio",
    STRING_AGG(
        DISTINCT adjustment_id_surplus,
        ', ' ORDER BY adjustment_id_surplus
    ) FILTER (WHERE adjustment_id_surplus IS NOT NULL AND adjustment_id_surplus <> '')
                                        AS "ID de Alta",
    STRING_AGG(
        DISTINCT adjustment_id_shortage,
        ', ' ORDER BY adjustment_id_shortage
    ) FILTER (WHERE adjustment_id_shortage IS NOT NULL AND adjustment_id_shortage <> '')
                                        AS "ID de Baja"
FROM public.inventory_adjustments
WHERE UPPER(TRIM(branch_name)) = 'CABALLITO III'
GROUP BY laboratory
ORDER BY laboratory;
