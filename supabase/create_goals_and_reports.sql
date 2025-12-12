-- Tabla para Metas de Sucursal (Reemplaza lab_sucu.xlsx)
CREATE TABLE IF NOT EXISTS public.branch_goals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name text NOT NULL,
    total_labs_goal integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT branch_goals_branch_name_key UNIQUE (branch_name)
);

-- Tabla para Reportes de Cierre de Inventario (Snapshots inmutables)
CREATE TABLE IF NOT EXISTS public.inventory_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name text NOT NULL,
    laboratory text NOT NULL,
    snapshot_data jsonb NOT NULL, -- Lista completa de items y su estado
    financial_summary jsonb NOT NULL, -- Negative, Positive, Net, Units
    user_name text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS (Row Level Security) - Opcional pero recomendado
ALTER TABLE public.branch_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso básicas (Permitir todo a usuarios autenticados por ahora para mantener compatibilidad)
CREATE POLICY "Enable read access for all users" ON public.branch_goals FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON public.branch_goals FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON public.inventory_reports FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.inventory_reports FOR INSERT WITH CHECK (true);

-- Indices para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS inventory_reports_branch_lab_idx ON public.inventory_reports (branch_name, laboratory);
CREATE INDEX IF NOT EXISTS inventory_reports_created_at_idx ON public.inventory_reports (created_at DESC);
