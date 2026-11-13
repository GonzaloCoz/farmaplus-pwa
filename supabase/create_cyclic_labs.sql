-- ===========================================================================
-- DDL: Tabla para el Nuevo Sistema de Inventario Cíclico
-- Nombre: cyclic_labs
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.cyclic_labs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vinculación de Sucursal
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    branch_slug TEXT NOT NULL,                         -- 'pilarii', 'barracas'

    -- Identificación directa por ID numérico de Plex
    plex_lab_id INTEGER NOT NULL,                      -- laboratorios.IDLaboratorio
    laboratory TEXT NOT NULL,                          -- Nombre canónico
    category TEXT NOT NULL,                            -- MEDICAMENTOS, PERFUMERIA, ACCESORIOS, VARIOS

    -- Ciclo de Vida y Estados
    state TEXT NOT NULL DEFAULT 'active',              -- 'active' | 'hibernated' | 'stockout'
    status TEXT NOT NULL DEFAULT 'pending',            -- 'pending' | 'in_progress' | 'completed'

    -- Cadencia del Cluster
    cycle_days INTEGER NOT NULL DEFAULT 90,            -- 60, 90, 120
    round INTEGER NOT NULL DEFAULT 1,

    -- Métricas de Conteo de SKUs
    total_items INTEGER DEFAULT 0,
    controlled_items INTEGER DEFAULT 0,
    adjusted_items INTEGER DEFAULT 0,
    progress_percentage NUMERIC(5, 1) DEFAULT 0,

    -- Métricas de Unidades (Alimentan el Monitor de Avance)
    system_units INTEGER DEFAULT 0,
    counted_units INTEGER DEFAULT 0,
    surplus_units INTEGER DEFAULT 0,                   -- Sobrantes (+)
    shortage_units INTEGER DEFAULT 0,                  -- Faltantes (-)
    net_units INTEGER DEFAULT 0,                       -- Neto
    
    -- Métricas Monetarias (Alimentan Ajustes $ y Balance $)
    adjustment_value NUMERIC(15, 2) DEFAULT 0,         -- Ajustes $
    balance_value NUMERIC(15, 2) DEFAULT 0,            -- Balance $

    -- Banderas de Auditoría
    has_negative_stock BOOLEAN DEFAULT false,          -- Alerta compras sin ingresar en Plex

    -- Trazabilidad
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Restricción única limpia por sucursal, ID laboratorio, categoría y vuelta
    CONSTRAINT cyclic_labs_unique_key UNIQUE (branch_slug, plex_lab_id, category, round)
);

-- Índices de alta velocidad
CREATE INDEX IF NOT EXISTS idx_cyclic_labs_branch_round 
    ON public.cyclic_labs (branch_slug, round);

CREATE INDEX IF NOT EXISTS idx_cyclic_labs_lookup 
    ON public.cyclic_labs (branch_slug, plex_lab_id);

CREATE INDEX IF NOT EXISTS idx_cyclic_labs_state 
    ON public.cyclic_labs (branch_slug, state, status);

-- Seguridad RLS
ALTER TABLE public.cyclic_labs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cyclic_labs_all_access" ON public.cyclic_labs;
CREATE POLICY "cyclic_labs_all_access" 
    ON public.cyclic_labs 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

GRANT ALL ON public.cyclic_labs TO authenticated, anon, service_role;
