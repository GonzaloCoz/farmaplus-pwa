-- ==============================================================================
-- Migración: get_branch_monitor_summary RPC (Consolidado Ultra-Rápido con Rubros)
-- Fecha: 2026-10-27
-- Propósito: 
--   1. Agregación nativa en PostgreSQL en ~25ms (1 sola petición a Supabase).
--   2. Desglose detallado por rubro (Medicamentos, Perfumería, Accesorios, Varios)
--      con badges de controlados/pendientes, gauges de avance, unidades y montos ($).
--   3. Implementado en SQL puro (LANGUAGE sql) para máxima velocidad y cero conflictos
--      de variables PL/pgSQL.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_branch_monitor_summary(INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_branch_monitor_summary(
    p_round INTEGER DEFAULT 2,
    p_days_count INTEGER DEFAULT 12
)
RETURNS TABLE (
    norm_branch TEXT,
    branch_name TEXT,
    round INTEGER,
    assigned_days INTEGER,
    days_elapsed INTEGER,
    days_remaining INTEGER,
    start_date TIMESTAMPTZ,
    deployment_date TEXT,
    total_labs INTEGER,
    controlled_labs INTEGER,
    progress NUMERIC,
    total_items INTEGER,
    controlled_items INTEGER,
    positive_units NUMERIC,
    negative_units NUMERIC,
    net_units NUMERIC,
    total_deviation_units NUMERIC,
    total_system_units NUMERIC,
    adjustments_value NUMERIC,
    balance_value NUMERIC,
    status TEXT,
    activity_data JSONB,
    last_adjustment JSONB,
    categories JSONB,
    last_updated TIMESTAMPTZ
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH 
params AS (
    SELECT 
        (timezone('America/Argentina/Buenos_Aires', now()))::DATE as v_today,
        timezone('America/Argentina/Buenos_Aires', ((timezone('America/Argentina/Buenos_Aires', now()))::DATE - (p_days_count - 1))::TIMESTAMP) as v_start_activity,
        '2026-07-21 03:00:00+00'::TIMESTAMPTZ as v_default_start
),

-- 1. Agregados principales generales desde branch_laboratories
lab_aggs AS (
    SELECT 
        public.normalize_string_sql(bl.branch_name) as b_norm,
        MAX(bl.branch_name) as b_name,
        COUNT(*)::INTEGER as agg_total_labs,
        COUNT(*) FILTER (
            WHERE bl.status IN ('completed', 'controlado') OR bl.progress_percentage >= 100
        )::INTEGER as agg_controlled_labs,
        SUM(COALESCE(bl.total_items, 0))::INTEGER as agg_total_items,
        SUM(COALESCE(bl.controlled_items, 0) + COALESCE(bl.adjusted_items, 0))::INTEGER as agg_controlled_items,
        SUM(COALESCE(bl.positive_units, 0))::NUMERIC as agg_positive_units,
        SUM(COALESCE(bl.negative_units, 0))::NUMERIC as agg_negative_units,
        SUM(COALESCE(bl.net_units, 0))::NUMERIC as agg_net_units,
        SUM(COALESCE(bl.total_system_units, 0))::NUMERIC as agg_total_system_units,
        ROUND(SUM(COALESCE(bl.positive_value, 0) + ABS(COALESCE(bl.negative_value, 0)))::NUMERIC, 2) as agg_adjustments_value,
        ROUND(SUM(COALESCE(bl.net_value, 0))::NUMERIC, 2) as agg_balance_value,
        MAX(bl.last_updated) as agg_last_updated
    FROM public.branch_laboratories bl
    WHERE bl.round = p_round AND bl.laboratory != '_CONFIG_'
    GROUP BY public.normalize_string_sql(bl.branch_name)
),

-- 2. Agregados por cada uno de los 4 rubros (Medicamentos, Perfumería, Accesorios, Varios)
cat_aggs AS (
    SELECT 
        public.normalize_string_sql(bl.branch_name) as b_norm,
        CASE 
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%MEDIC%' THEN 'MEDICAMENTOS'
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%PERF%' THEN 'PERFUMERIA'
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%ACCES%' THEN 'ACCESORIOS'
            ELSE 'VARIOS'
        END as c_key,
        COUNT(*)::INTEGER as c_total_labs,
        COUNT(*) FILTER (
            WHERE bl.status IN ('completed', 'controlado') OR bl.progress_percentage >= 100
        )::INTEGER as c_controlled_labs,
        COUNT(*) FILTER (
            WHERE (bl.status IN ('in_progress', 'por_controlar') OR bl.progress_percentage > 0)
              AND bl.status NOT IN ('completed', 'controlado')
              AND (bl.progress_percentage IS NULL OR bl.progress_percentage < 100)
        )::INTEGER as c_in_progress_labs,
        COUNT(*) FILTER (
            WHERE (bl.status IS NULL OR bl.status = 'pending' OR bl.status = 'pendiente')
              AND (bl.progress_percentage IS NULL OR bl.progress_percentage = 0)
        )::INTEGER as c_pending_labs,
        SUM(COALESCE(bl.total_items, 0))::INTEGER as c_total_items,
        SUM(COALESCE(bl.controlled_items, 0) + COALESCE(bl.adjusted_items, 0))::INTEGER as c_controlled_items,
        SUM(COALESCE(bl.positive_units, 0))::NUMERIC as c_positive_units,
        SUM(COALESCE(bl.negative_units, 0))::NUMERIC as c_negative_units,
        SUM(COALESCE(bl.net_units, 0))::NUMERIC as c_net_units,
        SUM(COALESCE(bl.total_system_units, 0))::NUMERIC as c_total_system_units,
        ROUND(SUM(COALESCE(bl.positive_value, 0) + ABS(COALESCE(bl.negative_value, 0)))::NUMERIC, 2) as c_adjustments_value,
        ROUND(SUM(COALESCE(bl.negative_value, 0))::NUMERIC, 2) as c_negative_value,
        ROUND(SUM(COALESCE(bl.positive_value, 0))::NUMERIC, 2) as c_positive_value,
        ROUND(SUM(COALESCE(bl.net_value, 0))::NUMERIC, 2) as c_balance_value
    FROM public.branch_laboratories bl
    WHERE bl.round = p_round AND bl.laboratory != '_CONFIG_'
    GROUP BY 
        public.normalize_string_sql(bl.branch_name),
        CASE 
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%MEDIC%' THEN 'MEDICAMENTOS'
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%PERF%' THEN 'PERFUMERIA'
            WHEN UPPER(TRIM(COALESCE(bl.category, '')))::TEXT LIKE '%ACCES%' THEN 'ACCESORIOS'
            ELSE 'VARIOS'
        END
),

-- 3. Construcción del mapa JSONB de los 4 rubros por sucursal
branch_cats_json AS (
    SELECT 
        ca.b_norm,
        jsonb_object_agg(
            ca.c_key,
            jsonb_build_object(
                'category', ca.c_key,
                'totalLabs', ca.c_total_labs,
                'controlledLabs', ca.c_controlled_labs,
                'inProgressLabs', ca.c_in_progress_labs,
                'pendingLabs', ca.c_pending_labs,
                'progress', CASE WHEN ca.c_total_labs > 0 THEN ROUND((ca.c_controlled_labs::NUMERIC / ca.c_total_labs::NUMERIC) * 100, 1) ELSE 0 END,
                'totalItems', ca.c_total_items,
                'controlledItems', ca.c_controlled_items,
                'positiveUnits', ca.c_positive_units,
                'negativeUnits', ca.c_negative_units,
                'netUnits', ca.c_net_units,
                'totalDeviationUnits', (ca.c_positive_units + ABS(ca.c_negative_units)),
                'totalSystemUnits', ca.c_total_system_units,
                'adjustmentsValue', ca.c_adjustments_value,
                'negativeValue', ca.c_negative_value,
                'positiveValue', ca.c_positive_value,
                'balanceValue', ca.c_balance_value
            )
        ) as cat_data
    FROM cat_aggs ca
    GROUP BY ca.b_norm
),

-- 4. Configuraciones de días y fechas desde inventories _CONFIG_
branch_configs AS (
    SELECT 
        public.normalize_string_sql(i.branch_name) as b_norm,
        COALESCE(
            MAX(CASE WHEN i.ean = 'CONFIG_DAYS' AND i.round = p_round THEN i.quantity ELSE NULL END),
            MAX(CASE WHEN i.ean = 'CONFIG_DAYS' THEN i.quantity ELSE NULL END),
            150
        )::INTEGER as cfg_assigned_days,
        COALESCE(
            MAX(CASE WHEN i.ean = 'CONFIG_START_DATE' AND i.round = p_round THEN i.quantity ELSE NULL END),
            MAX(CASE WHEN i.ean = 'CONFIG_START_DATE' THEN i.quantity ELSE NULL END)
        )::BIGINT as cfg_start_epoch
    FROM public.inventories i
    WHERE i.laboratory = '_CONFIG_'
      AND i.ean IN ('CONFIG_DAYS', 'CONFIG_START_DATE')
    GROUP BY public.normalize_string_sql(i.branch_name)
),

-- 5. Serie temporal de N días (para construir el sparkline diario)
dates_series AS (
    SELECT 
        (p.v_today - (p_days_count - 1) + s.idx)::DATE as b_date,
        to_char(p.v_today - (p_days_count - 1) + s.idx, 'YYYY-MM-DD') as iso_date,
        to_char(p.v_today - (p_days_count - 1) + s.idx, 'DD/MM') as short_date,
        s.idx as sort_idx
    FROM params p
    CROSS JOIN generate_series(0, p_days_count - 1) as s(idx)
),

-- 6. Ajustes diarios agrupados por sucursal y fecha
adj_daily AS (
    SELECT 
        public.normalize_string_sql(ia.branch_name) as b_norm,
        (timezone('America/Argentina/Buenos_Aires', ia.created_at))::DATE as adj_date,
        COUNT(*)::INTEGER as day_count,
        SUM(ABS(COALESCE(ia.total_units_adjusted, 0)))::INTEGER as day_units
    FROM public.inventory_adjustments ia
    CROSS JOIN params p
    WHERE ia.created_at >= p.v_start_activity
    GROUP BY public.normalize_string_sql(ia.branch_name), (timezone('America/Argentina/Buenos_Aires', ia.created_at))::DATE
),

-- 7. Último ajuste registrado por sucursal
adj_last AS (
    SELECT DISTINCT ON (public.normalize_string_sql(ia.branch_name))
        public.normalize_string_sql(ia.branch_name) as b_norm,
        ia.created_at as last_created,
        ia.laboratory as last_lab,
        ABS(COALESCE(ia.total_units_adjusted, 0))::INTEGER as last_units
    FROM public.inventory_adjustments ia
    CROSS JOIN params p
    WHERE ia.created_at >= p.v_start_activity
    ORDER BY public.normalize_string_sql(ia.branch_name), ia.created_at DESC
),

-- 8. Construcción del JSON array de actividad diaria
branch_activity_json AS (
    SELECT 
        la_sub.b_norm,
        jsonb_agg(
            jsonb_build_object(
                'date', ds.iso_date,
                'shortDate', ds.short_date,
                'count', COALESCE(ad.day_count, 0),
                'units', COALESCE(ad.day_units, 0)
            ) ORDER BY ds.sort_idx
        ) as act_points
    FROM (SELECT DISTINCT la_in.b_norm FROM lab_aggs la_in) la_sub
    CROSS JOIN dates_series ds
    LEFT JOIN adj_daily ad ON ad.b_norm = la_sub.b_norm AND ad.adj_date = ds.b_date
    GROUP BY la_sub.b_norm
)

-- 9. Query final unificada
SELECT 
    la.b_norm::TEXT,
    la.b_name::TEXT,
    p_round::INTEGER,
    COALESCE(bc.cfg_assigned_days, 150)::INTEGER,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(
        CASE WHEN bc.cfg_start_epoch IS NOT NULL THEN to_timestamp(bc.cfg_start_epoch) ELSE NULL END,
        p.v_default_start
    ))) / 86400))::INTEGER,
    GREATEST(0, COALESCE(bc.cfg_assigned_days, 150) - GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(
        CASE WHEN bc.cfg_start_epoch IS NOT NULL THEN to_timestamp(bc.cfg_start_epoch) ELSE NULL END,
        p.v_default_start
    ))) / 86400))::INTEGER)::INTEGER,
    COALESCE(
        CASE WHEN bc.cfg_start_epoch IS NOT NULL THEN to_timestamp(bc.cfg_start_epoch) ELSE NULL END,
        p.v_default_start
    )::TIMESTAMPTZ,
    to_char(COALESCE(
        CASE WHEN bc.cfg_start_epoch IS NOT NULL THEN to_timestamp(bc.cfg_start_epoch) ELSE NULL END,
        p.v_default_start
    ), 'DD/MM')::TEXT,
    la.agg_total_labs::INTEGER,
    la.agg_controlled_labs::INTEGER,
    CASE 
        WHEN la.agg_total_labs > 0 THEN ROUND(((la.agg_controlled_labs::NUMERIC / la.agg_total_labs::NUMERIC) * 100), 1)
        ELSE 0::NUMERIC 
    END,
    la.agg_total_items::INTEGER,
    la.agg_controlled_items::INTEGER,
    la.agg_positive_units::NUMERIC,
    la.agg_negative_units::NUMERIC,
    la.agg_net_units::NUMERIC,
    (la.agg_positive_units + ABS(la.agg_negative_units))::NUMERIC,
    la.agg_total_system_units::NUMERIC,
    la.agg_adjustments_value::NUMERIC,
    la.agg_balance_value::NUMERIC,
    CASE 
        WHEN la.agg_total_labs > 0 AND la.agg_controlled_labs >= la.agg_total_labs THEN 'completed'::TEXT
        WHEN (COALESCE(bc.cfg_assigned_days, 150) - GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(
            CASE WHEN bc.cfg_start_epoch IS NOT NULL THEN to_timestamp(bc.cfg_start_epoch) ELSE NULL END,
            p.v_default_start
        ))) / 86400))::INTEGER) <= 0 AND COALESCE(bc.cfg_assigned_days, 150) > 0 THEN 'delayed'::TEXT
        WHEN la.agg_controlled_labs > 0 OR la.agg_controlled_items > 0 THEN 'active'::TEXT
        ELSE 'pending'::TEXT
    END,
    COALESCE(baj.act_points, '[]'::JSONB),
    CASE 
        WHEN al.last_created IS NOT NULL THEN jsonb_build_object(
            'createdAt', al.last_created,
            'laboratory', al.last_lab,
            'units', al.last_units
        )
        ELSE NULL 
    END,
    COALESCE(bcj.cat_data, '{}'::JSONB),
    la.agg_last_updated
FROM lab_aggs la
CROSS JOIN params p
LEFT JOIN branch_configs bc ON bc.b_norm = la.b_norm
LEFT JOIN branch_activity_json baj ON baj.b_norm = la.b_norm
LEFT JOIN adj_last al ON al.b_norm = la.b_norm
LEFT JOIN branch_cats_json bcj ON bcj.b_norm = la.b_norm
ORDER BY la.b_norm;
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_monitor_summary(INTEGER, INTEGER) TO anon, authenticated, service_role;
