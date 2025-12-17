-- Tabla para Sesiones de Control de Vencimientos
CREATE TABLE IF NOT EXISTS public.expiration_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sector text NOT NULL,
    branch_name text NOT NULL,
    start_time bigint NOT NULL, -- Guardamos timestamp numérico para compatibilidad
    end_time bigint,
    status text NOT NULL, -- 'active' | 'completed'
    total_products integer DEFAULT 0,
    total_units integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Tabla para Items de Vencimientos
CREATE TABLE IF NOT EXISTS public.expiration_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES public.expiration_sessions(id) ON DELETE CASCADE,
    ean text NOT NULL,
    product_name text NOT NULL,
    batches jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array de BatchInfo
    total_quantity integer DEFAULT 0,
    timestamp bigint NOT NULL,
    synced integer DEFAULT 1, -- 1 ya que nace en la nube
    branch_name text NOT NULL, -- Denormalizado para facilitar consultas por sucursal
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_expiration_sessions_branch ON public.expiration_sessions(branch_name);
CREATE INDEX IF NOT EXISTS idx_expiration_sessions_status ON public.expiration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_expiration_items_session ON public.expiration_items(session_id);
CREATE INDEX IF NOT EXISTS idx_expiration_items_branch ON public.expiration_items(branch_name);
CREATE INDEX IF NOT EXISTS idx_expiration_items_ean ON public.expiration_items(ean);

-- RLS (Row Level Security)
ALTER TABLE public.expiration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiration_items ENABLE ROW LEVEL SECURITY;

-- Policies (Simplificadas: todo autenticado puede leer/escribir por ahora, el filtro se hace en la app y por branch_name)
-- En producción se debería validar contra auth.uid() -> profile -> branch_name

CREATE POLICY "Enable read access for all users" ON public.expiration_sessions FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.expiration_sessions FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON public.expiration_items FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.expiration_items FOR ALL USING (true);
