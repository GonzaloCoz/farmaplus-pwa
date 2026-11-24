-- Procedimientos transaccionales idempotentes con verificacion de aislamiento celular
-- y control obligatorio contra `bandeja_entrada`.

CREATE OR REPLACE FUNCTION public.registrar_asiento_mayor_remoto(
    p_id_idempotencia TEXT,
    p_sucursal_id SMALLINT,
    p_laboratorio TEXT,
    p_ronda SMALLINT,
    p_folio_remoto TEXT,
    p_operacion_baja_id TEXT,
    p_operacion_alta_id TEXT,
    p_diferencia_neta NUMERIC(14, 2),
    p_hash_actual TEXT,
    p_hash_carga TEXT,
    p_ruta_respaldo_s3 TEXT DEFAULT NULL
)
RETURNS TABLE (
    asiento_id UUID,
    duplicado BOOLEAN,
    folio TEXT,
    hash_registrado TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existente RECORD;
    v_hash_previo TEXT;
    v_asiento_id UUID;
BEGIN
    IF NOT public.operador_tiene_acceso_sucursal(p_sucursal_id) THEN
        RAISE EXCEPTION 'Acceso celular denegado para sucursal %', p_sucursal_id
            USING ERRCODE = '42501';
    END IF;

    IF p_id_idempotencia IS NULL OR length(trim(p_id_idempotencia)) = 0 THEN
        RAISE EXCEPTION 'id_idempotencia obligatorio' USING ERRCODE = '22023';
    END IF;

    -- Serializa la cadena del libro mayor dentro de una misma celula sin bloquear al resto.
    PERFORM pg_advisory_xact_lock(7100, p_sucursal_id::INTEGER);

    SELECT lm.id, lm.folio_remoto, lm.hash_actual
    INTO v_existente
    FROM libro_mayor lm
    WHERE lm.id_idempotencia = p_id_idempotencia
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_existente.id, TRUE, v_existente.folio_remoto, v_existente.hash_actual;
        RETURN;
    END IF;

    INSERT INTO bandeja_entrada (id_idempotencia, sucursal_id, destino, hash_carga)
    VALUES (p_id_idempotencia, p_sucursal_id, 'cierre_ciclico', p_hash_carga)
    ON CONFLICT (id_idempotencia) DO NOTHING;

    SELECT COALESCE(
        (
            SELECT lm.hash_actual
            FROM libro_mayor lm
            WHERE lm.sucursal_id = p_sucursal_id
            ORDER BY lm.creado_en DESC, lm.id DESC
            LIMIT 1
        ),
        'GENESIS'
    )
    INTO v_hash_previo;

    INSERT INTO libro_mayor (
        id_idempotencia,
        sucursal_id,
        laboratorio,
        ronda,
        folio_remoto,
        operacion_baja_id,
        operacion_alta_id,
        diferencia_neta,
        hash_previo,
        hash_actual,
        ruta_respaldo_s3
    )
    VALUES (
        p_id_idempotencia,
        p_sucursal_id,
        trim(p_laboratorio),
        p_ronda,
        trim(p_folio_remoto),
        p_operacion_baja_id,
        p_operacion_alta_id,
        p_diferencia_neta,
        v_hash_previo,
        p_hash_actual,
        p_ruta_respaldo_s3
    )
    RETURNING id INTO v_asiento_id;

    RETURN QUERY SELECT v_asiento_id, FALSE, trim(p_folio_remoto), p_hash_actual;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pase_vencimiento_remoto(
    p_id_idempotencia TEXT,
    p_lote_origen_id UUID,
    p_sucursal_origen SMALLINT,
    p_sucursal_destino SMALLINT,
    p_numero_envio_local TEXT,
    p_cantidad BIGINT,
    p_hash_carga TEXT
)
RETURNS TABLE (
    pase_id UUID,
    duplicado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existente_id UUID;
    v_pase_id UUID;
BEGIN
    IF NOT public.operador_tiene_acceso_sucursal(p_sucursal_origen) THEN
        RAISE EXCEPTION 'Acceso celular denegado para sucursal %', p_sucursal_origen
            USING ERRCODE = '42501';
    END IF;

    IF p_sucursal_origen = p_sucursal_destino OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Parametros de pase invalidos' USING ERRCODE = '22023';
    END IF;

    SELECT pv.id
    INTO v_existente_id
    FROM pases_vencimientos pv
    WHERE pv.id_idempotencia = p_id_idempotencia
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_existente_id, TRUE;
        RETURN;
    END IF;

    INSERT INTO bandeja_entrada (id_idempotencia, sucursal_id, destino, hash_carga)
    VALUES (p_id_idempotencia, p_sucursal_origen, 'pase_vencimiento', p_hash_carga)
    ON CONFLICT (id_idempotencia) DO NOTHING;

    UPDATE lotes_vencimientos
    SET estado = 'en_pase',
        sucursal_destino = p_sucursal_destino,
        numero_envio_local = trim(p_numero_envio_local)
    WHERE id = p_lote_origen_id
      AND sucursal_id = p_sucursal_origen
      AND estado = 'activo';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lote origen no disponible para pase' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO pases_vencimientos (
        id_idempotencia,
        lote_origen_id,
        sucursal_origen,
        sucursal_destino,
        numero_envio_local,
        cantidad,
        estado
    )
    VALUES (
        p_id_idempotencia,
        p_lote_origen_id,
        p_sucursal_origen,
        p_sucursal_destino,
        trim(p_numero_envio_local),
        p_cantidad,
        'registrado'
    )
    RETURNING id INTO v_pase_id;

    RETURN QUERY SELECT v_pase_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_lote_colector_remoto(
    p_id_idempotencia TEXT,
    p_sesion_id UUID,
    p_sucursal_id SMALLINT,
    p_codigo TEXT,
    p_producto_id TEXT,
    p_descripcion TEXT,
    p_cantidad BIGINT,
    p_ubicacion TEXT,
    p_terminal_id TEXT,
    p_hash_carga TEXT
)
RETURNS TABLE (
    lectura_id UUID,
    duplicado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existente_id UUID;
    v_nueva_lectura_id UUID;
BEGIN
    IF NOT public.operador_tiene_acceso_sucursal(p_sucursal_id) THEN
        RAISE EXCEPTION 'Acceso celular denegado para sucursal %', p_sucursal_id
            USING ERRCODE = '42501';
    END IF;

    SELECT lc.id
    INTO v_existente_id
    FROM lecturas_colector lc
    WHERE lc.id_idempotencia = p_id_idempotencia
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_existente_id, TRUE;
        RETURN;
    END IF;

    INSERT INTO bandeja_entrada (id_idempotencia, sucursal_id, destino, hash_carga)
    VALUES (p_id_idempotencia, p_sucursal_id, 'lectura_colector', p_hash_carga)
    ON CONFLICT (id_idempotencia) DO NOTHING;

    INSERT INTO lecturas_colector (
        id_idempotencia,
        sesion_id,
        sucursal_id,
        codigo,
        producto_id,
        descripcion,
        cantidad,
        ubicacion,
        terminal_id
    )
    VALUES (
        p_id_idempotencia,
        p_sesion_id,
        p_sucursal_id,
        trim(p_codigo),
        NULLIF(trim(COALESCE(p_producto_id, '')), ''),
        trim(p_descripcion),
        p_cantidad,
        trim(p_ubicacion),
        trim(p_terminal_id)
    )
    RETURNING id INTO v_nueva_lectura_id;

    RETURN QUERY SELECT v_nueva_lectura_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_asiento_mayor_remoto(
    TEXT, SMALLINT, TEXT, SMALLINT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_pase_vencimiento_remoto(
    TEXT, UUID, SMALLINT, SMALLINT, TEXT, BIGINT, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_lote_colector_remoto(
    TEXT, UUID, SMALLINT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.registrar_asiento_mayor_remoto(
    TEXT, SMALLINT, TEXT, SMALLINT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pase_vencimiento_remoto(
    TEXT, UUID, SMALLINT, SMALLINT, TEXT, BIGINT, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_lote_colector_remoto(
    TEXT, UUID, SMALLINT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT
) TO authenticated;
