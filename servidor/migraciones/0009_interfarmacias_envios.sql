-- Tablas de Interfarmacias sincronizadas desde onze_center.envios / envioslineas (solo lectura para clientes).
-- Cero cambios a tablas existentes de produccion.

CREATE TABLE IF NOT EXISTS public.interfarmacias_envios (
    id_envio_global BIGINT PRIMARY KEY,
    id_envio BIGINT NOT NULL,
    suc_origen_id INTEGER NOT NULL,
    suc_origen_nombre TEXT NOT NULL,
    suc_destino_id INTEGER NOT NULL,
    suc_destino_nombre TEXT NOT NULL,
    fecha_envio TIMESTAMPTZ NOT NULL,
    fecha_recepcion TIMESTAMPTZ,
    id_estado_plex SMALLINT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('En tránsito', 'Recibido', 'Con diferencia', 'Auditado', 'Anulado')),
    total_skus INTEGER NOT NULL DEFAULT 0,
    unidades_enviadas NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unidades_recibidas NUMERIC(12, 2),
    operador_envio TEXT,
    operador_recepcion TEXT,
    descripcion TEXT,
    auditado BOOLEAN NOT NULL DEFAULT FALSE,
    auditado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    auditado_en TIMESTAMPTZ,
    observacion_auditoria TEXT,
    sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interfarmacias_lineas (
    id_envio_global BIGINT NOT NULL REFERENCES public.interfarmacias_envios(id_envio_global) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    id_producto BIGINT NOT NULL,
    ean TEXT NOT NULL DEFAULT '',
    producto TEXT NOT NULL,
    laboratorio TEXT NOT NULL DEFAULT '',
    rubro TEXT NOT NULL DEFAULT '',
    cantidad_enviada NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cantidad_recibida NUMERIC(12, 2),
    costo_ppp NUMERIC(14, 2) NOT NULL DEFAULT 0,
    lote_vto TEXT,
    lote_fecha_vto DATE,
    PRIMARY KEY (id_envio_global, id_producto, orden)
);

-- Indices para consultas ordenadas por fecha, filtro por sucursal/estado y join de subfilas
CREATE INDEX IF NOT EXISTS idx_interfarmacias_envios_fecha
    ON public.interfarmacias_envios (fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_interfarmacias_envios_origen
    ON public.interfarmacias_envios (suc_origen_id, fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_interfarmacias_envios_destino
    ON public.interfarmacias_envios (suc_destino_id, fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_interfarmacias_envios_estado
    ON public.interfarmacias_envios (estado, fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_interfarmacias_lineas_envio
    ON public.interfarmacias_lineas (id_envio_global, orden);

CREATE INDEX IF NOT EXISTS idx_interfarmacias_lineas_ean
    ON public.interfarmacias_lineas (ean);

-- Normalizacion simple para matchear nombres de sucursal entre Plex y public.branches
CREATE OR REPLACE FUNCTION public.normalizar_sucursal_interfarmacia(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT regexp_replace(
        lower(
            translate(
                coalesce(trim(p_texto), ''),
                'ÁÉÍÓÚÜÑáéíóúüñ',
                'AEIOUUNaeiouun'
            )
        ),
        '^(bs\s+as\s*-\s*|farmaplus\s+|farmacia\s+|sucursal\s+|suc\.?\s*)',
        ''
    );
$$;

-- Auxiliar RLS: admin/mod ven toda la red; sucursal ve solo donde es origen o destino
CREATE OR REPLACE FUNCTION public.puede_ver_envio_interfarmacia(p_origen TEXT, p_destino TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles pr
        LEFT JOIN public.branches br ON br.id = pr.branch_id
        WHERE pr.id = (SELECT auth.uid())
          AND pr.active = TRUE
          AND (
              pr.role IN ('admin', 'mod')
              OR (
                  pr.role = 'branch'
                  AND br.name IS NOT NULL
                  AND public.normalizar_sucursal_interfarmacia(br.name) IN (
                      public.normalizar_sucursal_interfarmacia(p_origen),
                      public.normalizar_sucursal_interfarmacia(p_destino)
                  )
              )
          )
    );
$$;

-- Auxiliar RLS: solo admin/mod pueden marcar como auditado
CREATE OR REPLACE FUNCTION public.es_auditor_interfarmacia()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE pr.id = (SELECT auth.uid())
          AND pr.active = TRUE
          AND pr.role IN ('admin', 'mod')
    );
$$;

REVOKE ALL ON FUNCTION public.normalizar_sucursal_interfarmacia(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.puede_ver_envio_interfarmacia(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_auditor_interfarmacia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_sucursal_interfarmacia(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_envio_interfarmacia(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_auditor_interfarmacia() TO authenticated;

-- RLS obligatorio en tablas expuestas
ALTER TABLE public.interfarmacias_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interfarmacias_lineas ENABLE ROW LEVEL SECURITY;

-- Permisos explicitos (solo lectura para clientes + update acotado de auditoria; sync usa service_role)
REVOKE ALL ON TABLE public.interfarmacias_envios FROM anon, authenticated;
REVOKE ALL ON TABLE public.interfarmacias_lineas FROM anon, authenticated;
GRANT SELECT ON TABLE public.interfarmacias_envios TO authenticated;
GRANT SELECT ON TABLE public.interfarmacias_lineas TO authenticated;
GRANT UPDATE (auditado, auditado_por, auditado_en, observacion_auditoria, estado)
    ON TABLE public.interfarmacias_envios TO authenticated;

DROP POLICY IF EXISTS rls_interfarmacias_envios_lectura ON public.interfarmacias_envios;
CREATE POLICY rls_interfarmacias_envios_lectura ON public.interfarmacias_envios
    FOR SELECT TO authenticated
    USING (public.puede_ver_envio_interfarmacia(suc_origen_nombre, suc_destino_nombre));

DROP POLICY IF EXISTS rls_interfarmacias_envios_auditoria ON public.interfarmacias_envios;
CREATE POLICY rls_interfarmacias_envios_auditoria ON public.interfarmacias_envios
    FOR UPDATE TO authenticated
    USING (public.es_auditor_interfarmacia())
    WITH CHECK (public.es_auditor_interfarmacia());

DROP POLICY IF EXISTS rls_interfarmacias_lineas_lectura ON public.interfarmacias_lineas;
CREATE POLICY rls_interfarmacias_lineas_lectura ON public.interfarmacias_lineas
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.interfarmacias_envios e
            WHERE e.id_envio_global = interfarmacias_lineas.id_envio_global
              AND public.puede_ver_envio_interfarmacia(e.suc_origen_nombre, e.suc_destino_nombre)
        )
    );
