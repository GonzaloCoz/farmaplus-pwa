-- Esquema base consolidado de MiPlus (PostgreSQL / Supabase)
-- 24 tablas estrictas aisladas por celula (`sucursal_id`) y protegidas con RLS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Maestro de celulas operativas (sucursales)
CREATE TABLE IF NOT EXISTS sucursales (
    id SMALLINT PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    sigla TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    subred TEXT NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Operadores habilitados y su rol jerarquico
CREATE TABLE IF NOT EXISTS operadores (
    id UUID PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    nombre_completo TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('administrador', 'zonal', 'sucursal', 'colector')),
    sucursal_origen SMALLINT NOT NULL REFERENCES sucursales(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Matriz de asignacion celular para supervisores zonales
CREATE TABLE IF NOT EXISTS operadores_sucursales (
    operador_id UUID NOT NULL REFERENCES operadores(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    PRIMARY KEY (operador_id, sucursal_id)
);

-- 4. Vinculaciones efimeras por codigo PIN de 6 digitos para colectores en LAN
CREATE TABLE IF NOT EXISTS sesiones_colector_pin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo_pin CHAR(6) NOT NULL CHECK (codigo_pin ~ '^[0-9]{6}$'),
    terminal_id TEXT NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Registro de instantaneas Merkle BLAKE3 del padron alojado en Object Storage S3
CREATE TABLE IF NOT EXISTS versiones_padron (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    raiz_merkle TEXT NOT NULL,
    total_articulos INTEGER NOT NULL CHECK (total_articulos >= 0),
    ruta_objeto_s3 TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Parametros tipados de ventana y bloqueo para conteos ciclicos por sucursal
CREATE TABLE IF NOT EXISTS configuraciones_ciclo (
    sucursal_id SMALLINT PRIMARY KEY REFERENCES sucursales(id) ON DELETE CASCADE,
    dias_asignados SMALLINT NOT NULL DEFAULT 30 CHECK (dias_asignados > 0),
    inicio_ciclo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bloqueo_manual BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Nomina de laboratorios asignados por celula, rubro y ronda
CREATE TABLE IF NOT EXISTS laboratorios_ciclicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    laboratorio TEXT NOT NULL,
    rubro TEXT NOT NULL,
    ronda SMALLINT NOT NULL DEFAULT 1 CHECK (ronda >= 1),
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sucursal_id, laboratorio, rubro, ronda)
);

-- 8. Solicitudes de exclusion de laboratorio (Criterio B)
CREATE TABLE IF NOT EXISTS solicitudes_baja_laboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    laboratorio TEXT NOT NULL,
    rubro TEXT NOT NULL,
    motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    resuelto_por UUID REFERENCES operadores(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_en TIMESTAMPTZ
);

-- 9. Cabeceras de conteos ciclicos en curso o cerrados
CREATE TABLE IF NOT EXISTS conteos_ciclicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    laboratorio TEXT NOT NULL,
    rubro TEXT NOT NULL,
    ronda SMALLINT NOT NULL DEFAULT 1,
    estado TEXT NOT NULL DEFAULT 'abierto',
    avance_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0,
    exactitud_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Renglones auditados dentro de cada conteo ciclico
CREATE TABLE IF NOT EXISTS renglones_ciclicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id UUID NOT NULL REFERENCES conteos_ciclicos(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    existencia_sistema BIGINT NOT NULL,
    cantidad_contada BIGINT NOT NULL,
    costo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    precio NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'controlado', 'ajustado')),
    operacion_baja_id TEXT,
    operacion_alta_id TEXT,
    UNIQUE (conteo_id, producto_id)
);

-- 11. Libro mayor inmutable encadenado con BLAKE3 por celula
CREATE TABLE IF NOT EXISTS libro_mayor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_idempotencia TEXT NOT NULL UNIQUE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    laboratorio TEXT NOT NULL,
    ronda SMALLINT NOT NULL,
    folio_remoto TEXT NOT NULL UNIQUE,
    operacion_baja_id TEXT,
    operacion_alta_id TEXT,
    diferencia_neta NUMERIC(14, 2) NOT NULL,
    hash_previo TEXT NOT NULL,
    hash_actual TEXT NOT NULL,
    ruta_respaldo_s3 TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Sesiones de colector movil y mostrador
CREATE TABLE IF NOT EXISTS sesiones_colector (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierta',
    creado_por UUID REFERENCES operadores(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ
);

-- 13. Ubicaciones fisicas de gondola y deposito con codigo QR
CREATE TABLE IF NOT EXISTS ubicaciones_qr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo_ubicacion TEXT NOT NULL,
    titulo TEXT NOT NULL,
    subtitulo TEXT,
    abierta_por UUID REFERENCES operadores(id),
    estado TEXT NOT NULL DEFAULT 'abierta',
    UNIQUE (sucursal_id, codigo_ubicacion)
);

-- 14. Lecturas capturadas por colectores con idempotencia estricta
CREATE TABLE IF NOT EXISTS lecturas_colector (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_idempotencia TEXT NOT NULL UNIQUE,
    sesion_id UUID NOT NULL REFERENCES sesiones_colector(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    producto_id TEXT,
    descripcion TEXT NOT NULL,
    cantidad BIGINT NOT NULL,
    ubicacion TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Series trazables ANMAT GS1 DataMatrix o contingencia
CREATE TABLE IF NOT EXISTS series_trazables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES sesiones_colector(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL,
    gtin TEXT NOT NULL,
    serie TEXT NOT NULL,
    lote TEXT,
    vencimiento DATE,
    sin_matriz BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (sucursal_id, gtin, serie)
);

-- 16. Distribucion equitativa de recuentos de diferencias por operador
CREATE TABLE IF NOT EXISTS repartos_recuento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES sesiones_colector(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    operador_id UUID REFERENCES operadores(id),
    producto_id TEXT NOT NULL,
    diferencia_esperada BIGINT NOT NULL,
    cantidad_recontada BIGINT,
    estado TEXT NOT NULL DEFAULT 'asignado'
);

-- 17. Resumen de auditorias de productos con stock sin lecturas de conteo
CREATE TABLE IF NOT EXISTS auditorias_no_inventariados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES sesiones_colector(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    total_articulos INTEGER NOT NULL CHECK (total_articulos >= 0),
    unidades_sistema BIGINT NOT NULL,
    valor_costo_total NUMERIC(14, 2) NOT NULL,
    ruta_archivo_s3 TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Sesiones mensuales de control de vencimientos
CREATE TABLE IF NOT EXISTS sesiones_vencimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierta',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Lotes de vencimientos indexados por fecha y estado operativo
CREATE TABLE IF NOT EXISTS lotes_vencimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES sesiones_vencimientos(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    numero_lote TEXT NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    cantidad BIGINT NOT NULL CHECK (cantidad >= 0),
    estado TEXT NOT NULL CHECK (estado IN ('activo', 'vendido', 'en_pase', 'devuelto', 'destruido')),
    sucursal_destino SMALLINT REFERENCES sucursales(id),
    numero_envio_local TEXT
);

-- 20. Registro de pases de mercaderia proxima a vencer entre sucursales
CREATE TABLE IF NOT EXISTS pases_vencimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_idempotencia TEXT NOT NULL UNIQUE,
    lote_origen_id UUID NOT NULL REFERENCES lotes_vencimientos(id) ON DELETE CASCADE,
    sucursal_origen SMALLINT NOT NULL REFERENCES sucursales(id),
    sucursal_destino SMALLINT NOT NULL REFERENCES sucursales(id),
    numero_envio_local TEXT NOT NULL,
    cantidad BIGINT NOT NULL CHECK (cantidad > 0),
    estado TEXT NOT NULL DEFAULT 'registrado',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. Material de capacitacion alojado en S3
CREATE TABLE IF NOT EXISTS publicaciones_formacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    resumen TEXT NOT NULL,
    categoria TEXT NOT NULL,
    ruta_contenido_s3 TEXT NOT NULL,
    publicado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. Avance de capacitacion por operador y celula
CREATE TABLE IF NOT EXISTS progreso_formacion (
    operador_id UUID NOT NULL REFERENCES operadores(id) ON DELETE CASCADE,
    publicacion_id UUID NOT NULL REFERENCES publicaciones_formacion(id) ON DELETE CASCADE,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    completado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (operador_id, publicacion_id)
);

-- 23. Manifiesto firmado Ed25519 de versiones de escritorio
CREATE TABLE IF NOT EXISTS versiones_aplicacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version_semantica TEXT NOT NULL UNIQUE,
    hash_blake3 TEXT NOT NULL,
    firma_ed25519 TEXT NOT NULL,
    ruta_instalador_s3 TEXT NOT NULL,
    obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
    publicado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Bandeja de entrada de idempotencia extrema a extremo
CREATE TABLE IF NOT EXISTS bandeja_entrada (
    id_idempotencia TEXT PRIMARY KEY,
    sucursal_id SMALLINT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    destino TEXT NOT NULL,
    hash_carga TEXT NOT NULL,
    procesado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices operativos esenciales por celula
CREATE INDEX IF NOT EXISTS idx_libro_mayor_sucursal_fecha ON libro_mayor(sucursal_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_lecturas_colector_sesion ON lecturas_colector(sesion_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimientos_fecha ON lotes_vencimientos(sucursal_id, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_bandeja_entrada_sucursal ON bandeja_entrada(sucursal_id, procesado_en DESC);

-- Funciones auxiliares de aislamiento celular
CREATE OR REPLACE FUNCTION public.operador_actual_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT o.rol
    FROM operadores o
    WHERE o.id = auth.uid() AND o.activo = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.operador_tiene_acceso_sucursal(p_sucursal_id SMALLINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM operadores o
        WHERE o.id = auth.uid()
          AND o.activo = TRUE
          AND (
              o.rol = 'administrador'
              OR (o.rol IN ('sucursal', 'colector') AND o.sucursal_origen = p_sucursal_id)
              OR (
                  o.rol = 'zonal'
                  AND EXISTS (
                      SELECT 1
                      FROM operadores_sucursales os
                      WHERE os.operador_id = o.id
                        AND os.sucursal_id = p_sucursal_id
                  )
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.operador_actual_rol() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.operador_tiene_acceso_sucursal(SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operador_actual_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.operador_tiene_acceso_sucursal(SMALLINT) TO authenticated;

-- Bloqueo absoluto a `anon` en las 24 tablas
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Habilitacion obligatoria de RLS en las 24 tablas
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadores_sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_colector_pin ENABLE ROW LEVEL SECURITY;
ALTER TABLE versiones_padron ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones_ciclo ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratorios_ciclicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_baja_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos_ciclicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE renglones_ciclicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE libro_mayor ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_colector ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturas_colector ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_trazables ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartos_recuento ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditorias_no_inventariados ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_vencimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_vencimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pases_vencimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicaciones_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE versiones_aplicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandeja_entrada ENABLE ROW LEVEL SECURITY;

-- Politicas celulares estrictas para usuarios autenticados
CREATE POLICY rls_sucursales_lectura ON sucursales
    FOR SELECT TO authenticated
    USING (public.operador_tiene_acceso_sucursal(id));

CREATE POLICY rls_sucursales_admin ON sucursales
    FOR ALL TO authenticated
    USING (public.operador_actual_rol() = 'administrador')
    WITH CHECK (public.operador_actual_rol() = 'administrador');

CREATE POLICY rls_operadores_propio ON operadores
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.operador_actual_rol() = 'administrador');

CREATE POLICY rls_operadores_admin ON operadores
    FOR ALL TO authenticated
    USING (public.operador_actual_rol() = 'administrador')
    WITH CHECK (public.operador_actual_rol() = 'administrador');

CREATE POLICY rls_operadores_sucursales_acceso ON operadores_sucursales
    FOR SELECT TO authenticated
    USING (operador_id = auth.uid() OR public.operador_actual_rol() = 'administrador');

CREATE POLICY rls_sesiones_pin_celula ON sesiones_colector_pin
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_versiones_padron_celula ON versiones_padron
    FOR SELECT TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_versiones_padron_escritura ON versiones_padron
    FOR INSERT TO authenticated
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_configuraciones_ciclo_celula ON configuraciones_ciclo
    FOR SELECT TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_configuraciones_ciclo_admin ON configuraciones_ciclo
    FOR ALL TO authenticated
    USING (public.operador_actual_rol() IN ('administrador', 'zonal') AND public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_actual_rol() IN ('administrador', 'zonal') AND public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_laboratorios_ciclicos_celula ON laboratorios_ciclicos
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_bajas_lab_celula ON solicitudes_baja_laboratorio
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_conteos_ciclicos_celula ON conteos_ciclicos
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_renglones_ciclicos_celula ON renglones_ciclicos
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_libro_mayor_lectura ON libro_mayor
    FOR SELECT TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_sesiones_colector_celula ON sesiones_colector
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_ubicaciones_qr_celula ON ubicaciones_qr
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_lecturas_colector_celula ON lecturas_colector
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_series_trazables_celula ON series_trazables
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_repartos_recuento_celula ON repartos_recuento
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_auditorias_no_inv_celula ON auditorias_no_inventariados
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_sesiones_vencimientos_celula ON sesiones_vencimientos
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_lotes_vencimientos_celula ON lotes_vencimientos
    FOR ALL TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_pases_vencimientos_celula ON pases_vencimientos
    FOR ALL TO authenticated
    USING (
        public.operador_tiene_acceso_sucursal(sucursal_origen)
        OR public.operador_tiene_acceso_sucursal(sucursal_destino)
    )
    WITH CHECK (public.operador_tiene_acceso_sucursal(sucursal_origen));

CREATE POLICY rls_publicaciones_formacion_lectura ON publicaciones_formacion
    FOR SELECT TO authenticated
    USING (publicado = TRUE OR public.operador_actual_rol() = 'administrador');

CREATE POLICY rls_progreso_formacion_celula ON progreso_formacion
    FOR ALL TO authenticated
    USING (operador_id = auth.uid() AND public.operador_tiene_acceso_sucursal(sucursal_id))
    WITH CHECK (operador_id = auth.uid() AND public.operador_tiene_acceso_sucursal(sucursal_id));

CREATE POLICY rls_versiones_aplicacion_lectura ON versiones_aplicacion
    FOR SELECT TO authenticated
    USING (public.operador_actual_rol() IS NOT NULL);

CREATE POLICY rls_bandeja_entrada_lectura ON bandeja_entrada
    FOR SELECT TO authenticated
    USING (public.operador_tiene_acceso_sucursal(sucursal_id));
