-- ==============================================================================
-- Tabla: precount_serials
-- Guarda los números de serie, lote, vencimiento y GTIN de productos trazables
-- capturados mediante DataMatrix durante el inventario (Zebra y Colector PC).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.precount_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.precount_sessions(id) ON DELETE CASCADE,
    location_tag TEXT NOT NULL DEFAULT 'GENERAL',
    id_producto TEXT NOT NULL,
    ean TEXT,
    gtin TEXT,
    serial TEXT,
    lot TEXT,
    expiry TEXT,
    no_serial BOOLEAN NOT NULL DEFAULT FALSE,
    raw_datamatrix TEXT,
    device_id TEXT,
    device_name TEXT,
    scanned_by TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_precount_serials_session 
    ON public.precount_serials (session_id);

CREATE INDEX IF NOT EXISTS idx_precount_serials_session_loc 
    ON public.precount_serials (session_id, location_tag);

CREATE INDEX IF NOT EXISTS idx_precount_serials_session_prod 
    ON public.precount_serials (session_id, id_producto);

-- Índice único parcial: no permite duplicar la misma serie física del mismo producto en la misma sesión
-- (permite múltiples registros si no_serial = TRUE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_precount_serials_session_gtin_serial 
    ON public.precount_serials (session_id, gtin, serial) 
    WHERE no_serial = FALSE AND serial IS NOT NULL AND TRIM(serial) != '';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.precount_serials ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para anon y authenticated (offline-first sync)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir lectura precount_serials" ON public.precount_serials;
    DROP POLICY IF EXISTS "Permitir insercion precount_serials" ON public.precount_serials;
    DROP POLICY IF EXISTS "Permitir actualizacion precount_serials" ON public.precount_serials;
    DROP POLICY IF EXISTS "Permitir borrado precount_serials" ON public.precount_serials;
END $$;

CREATE POLICY "Permitir lectura precount_serials" 
    ON public.precount_serials FOR SELECT 
    USING (true);

CREATE POLICY "Permitir insercion precount_serials" 
    ON public.precount_serials FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir actualizacion precount_serials" 
    ON public.precount_serials FOR UPDATE 
    USING (true);

CREATE POLICY "Permitir borrado precount_serials" 
    ON public.precount_serials FOR DELETE 
    USING (true);

-- Agregar a la publicación realtime si no está agregada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'precount_serials'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.precount_serials;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignorar si la publicación no existe o permisos insuficientes
END $$;
