-- ==============================================================================
-- FARMAPLUS PWA - MIGRACIÓN DE CONCURRENCIA, BLOQUEO ATÓMICO Y REALTIME DE SECTORES
-- Fecha: 2026-09-14
-- ==============================================================================

-- 1. Enriquecer tabla precount_location_status con trazabilidad de operadores y terminales
ALTER TABLE public.precount_location_status 
    ADD COLUMN IF NOT EXISTS opened_by_user TEXT,
    ADD COLUMN IF NOT EXISTS opened_by_device TEXT,
    ADD COLUMN IF NOT EXISTS opened_by_device_id TEXT,
    ADD COLUMN IF NOT EXISTS closed_by_user TEXT,
    ADD COLUMN IF NOT EXISTS closed_by_device TEXT,
    ADD COLUMN IF NOT EXISTS closed_by_device_id TEXT;

-- Índice para optimizar consultas de bloqueo por sesión y sector
CREATE INDEX IF NOT EXISTS idx_precount_location_status_session_tag 
    ON public.precount_location_status (session_id, location_tag);

-- 2. Asegurar que la tabla esté en la publicación de Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'precount_location_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE precount_location_status;
    END IF;
END $$;

-- 3. Procedimiento atómico de apertura y validación de sectores (claim_or_validate_location)
-- Evita condiciones de carrera: ningún operador puede pisar a otro si el sector ya está abierto.
CREATE OR REPLACE FUNCTION claim_or_validate_location(
    p_session_id UUID,
    p_location_tag TEXT,
    p_user_id UUID DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tag TEXT;
    v_existing RECORD;
    v_has_preconfigured BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
    v_uid UUID := COALESCE(p_user_id, auth.uid());
    v_user_name TEXT := COALESCE(NULLIF(TRIM(p_user_name), ''), 'Operador');
    v_device_name TEXT := COALESCE(NULLIF(TRIM(p_device_name), ''), 'Terminal');
BEGIN
    IF p_session_id IS NULL OR p_location_tag IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_ARGUMENTS',
            'message', 'Faltan parámetros requeridos (session_id o location_tag).'
        );
    END IF;

    v_tag := UPPER(TRIM(p_location_tag));

    -- Verificar si el sector ya existe en precount_location_status
    SELECT * INTO v_existing
    FROM public.precount_location_status
    WHERE session_id = p_session_id AND UPPER(location_tag) = v_tag
    FOR UPDATE; -- Bloqueo a nivel de fila para garantizar atomicidad absoluta

    IF FOUND THEN
        -- Caso 1: El sector ya fue cerrado/contabilizado
        IF v_existing.status = 'closed' THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ALREADY_CLOSED',
                'location_tag', v_tag,
                'closed_by_user', v_existing.closed_by_user,
                'closed_by_device', v_existing.closed_by_device,
                'closed_at', v_existing.closed_at,
                'message', 'El sector ya fue contabilizado y cerrado.'
            );
        END IF;

        -- Caso 2: El sector está abierto por OTRA terminal/operador
        IF v_existing.status = 'open' 
           AND v_existing.opened_by_device_id IS NOT NULL 
           AND p_device_id IS NOT NULL 
           AND v_existing.opened_by_device_id <> p_device_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'OCCUPIED',
                'location_tag', v_tag,
                'opened_by_user', v_existing.opened_by_user,
                'opened_by_device', v_existing.opened_by_device,
                'opened_at', v_existing.opened_at,
                'message', 'El sector ya está siendo operado por otro usuario.'
            );
        END IF;

        -- Caso 3: El sector estaba disponible o el mismo operador se re-engancha
        UPDATE public.precount_location_status
        SET status = 'open',
            opened_by = COALESCE(v_uid, opened_by),
            opened_by_user = v_user_name,
            opened_by_device = v_device_name,
            opened_by_device_id = COALESCE(p_device_id, opened_by_device_id),
            opened_at = COALESCE(opened_at, v_now),
            updated_at = v_now
        WHERE id = v_existing.id;

        RETURN jsonb_build_object(
            'success', true,
            'code', 'GRANTED',
            'location_tag', v_tag,
            'message', 'Sector asignado correctamente.'
        );
    ELSE
        -- No existe el registro en precount_location_status.
        -- Verificar si la sesión tiene sectores preconfigurados
        SELECT EXISTS (
            SELECT 1 FROM public.precount_location_status WHERE session_id = p_session_id
        ) INTO v_has_preconfigured;

        -- Si el administrador ya precargó la lista de sectores y este código no está en ella:
        IF v_has_preconfigured THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'NOT_CONFIGURED',
                'location_tag', v_tag,
                'message', 'El sector no está dentro de los sectores preconfigurados para este inventario.'
            );
        END IF;

        -- Si la sesión aún no tiene sectores preconfigurados (modo libre / inicial):
        INSERT INTO public.precount_location_status (
            session_id,
            location_tag,
            status,
            opened_by,
            opened_by_user,
            opened_by_device,
            opened_by_device_id,
            opened_at,
            created_at,
            updated_at
        ) VALUES (
            p_session_id,
            v_tag,
            'open',
            v_uid,
            v_user_name,
            v_device_name,
            p_device_id,
            v_now,
            v_now,
            v_now
        );

        RETURN jsonb_build_object(
            'success', true,
            'code', 'GRANTED',
            'location_tag', v_tag,
            'message', 'Sector abierto y registrado.'
        );
    END IF;
END;
$$;

-- 4. Procedimiento atómico de cierre de sector (close_precount_location)
CREATE OR REPLACE FUNCTION close_precount_location(
    p_session_id UUID,
    p_location_tag TEXT,
    p_user_id UUID DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tag TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_uid UUID := COALESCE(p_user_id, auth.uid());
    v_user_name TEXT := COALESCE(NULLIF(TRIM(p_user_name), ''), 'Operador');
    v_device_name TEXT := COALESCE(NULLIF(TRIM(p_device_name), ''), 'Terminal');
BEGIN
    IF p_session_id IS NULL OR p_location_tag IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_ARGUMENTS',
            'message', 'Faltan parámetros requeridos.'
        );
    END IF;

    v_tag := UPPER(TRIM(p_location_tag));

    -- Upsert para asegurar que si no existía el registro, quede asentado el cierre
    INSERT INTO public.precount_location_status (
        session_id,
        location_tag,
        status,
        closed_by,
        closed_by_user,
        closed_by_device,
        closed_by_device_id,
        closed_at,
        created_at,
        updated_at
    ) VALUES (
        p_session_id,
        v_tag,
        'closed',
        v_uid,
        v_user_name,
        v_device_name,
        p_device_id,
        v_now,
        v_now,
        v_now
    )
    ON CONFLICT (session_id, location_tag)
    DO UPDATE SET
        status = 'closed',
        closed_by = v_uid,
        closed_by_user = v_user_name,
        closed_by_device = v_device_name,
        closed_by_device_id = COALESCE(p_device_id, precount_location_status.closed_by_device_id),
        closed_at = v_now,
        updated_at = v_now;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'CLOSED_CONFIRMED',
        'location_tag', v_tag,
        'closed_at', v_now,
        'message', 'Sector cerrado y sellado con éxito.'
    );
END;
$$;

-- 5. Procedimiento para precargar masivamente sectores antes de iniciar inventario (seed_precount_locations)
CREATE OR REPLACE FUNCTION seed_precount_locations(
    p_session_id UUID,
    p_locations TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    loc TEXT;
    v_count INTEGER := 0;
BEGIN
    IF p_session_id IS NULL OR p_locations IS NULL THEN
        RETURN jsonb_build_object('success', false, 'count', 0);
    END IF;

    FOREACH loc IN ARRAY p_locations
    LOOP
        IF TRIM(loc) <> '' THEN
            INSERT INTO public.precount_location_status (
                session_id,
                location_tag,
                status,
                created_at,
                updated_at
            ) VALUES (
                p_session_id,
                UPPER(TRIM(loc)),
                'open',
                NOW(),
                NOW()
            )
            ON CONFLICT (session_id, location_tag) DO NOTHING;
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count,
        'session_id', p_session_id
    );
END;
$$;

-- 6. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION claim_or_validate_location(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION close_precount_location(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION seed_precount_locations(UUID, TEXT[]) TO authenticated, anon, service_role;
