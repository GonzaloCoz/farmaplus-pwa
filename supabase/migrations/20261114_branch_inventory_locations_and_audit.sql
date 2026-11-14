-- =============================================================================
-- MIGRACIÓN: Padrón de Ubicaciones QR Vigentes por Sucursal + Auditoría en Vivo
-- Fecha: 2026-11-14
-- =============================================================================

-- 1. Tabla de padrón vigente de ubicaciones por sucursal
CREATE TABLE IF NOT EXISTS public.branch_inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    location_tag TEXT NOT NULL,
    prefix TEXT NOT NULL,
    unit_number INTEGER NOT NULL DEFAULT 1,
    unit_total INTEGER NOT NULL DEFAULT 1,
    face_label TEXT,
    face_range TEXT,
    display_title TEXT NOT NULL,
    display_subtitle TEXT,
    category_badge TEXT,
    scan_instruction TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    CONSTRAINT uq_branch_inventory_locations_name_tag UNIQUE (branch_name, location_tag)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_locations_branch
    ON public.branch_inventory_locations (branch_name, is_active);

ALTER TABLE public.branch_inventory_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read branch inventory locations" ON public.branch_inventory_locations;
CREATE POLICY "Public read branch inventory locations"
    ON public.branch_inventory_locations
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated manage branch inventory locations" ON public.branch_inventory_locations;
CREATE POLICY "Authenticated manage branch inventory locations"
    ON public.branch_inventory_locations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT SELECT ON TABLE public.branch_inventory_locations TO anon;
GRANT ALL ON TABLE public.branch_inventory_locations TO authenticated, service_role;

-- 2. Enriquecer precount_location_status con título y rubro descriptivo
ALTER TABLE public.precount_location_status
    ADD COLUMN IF NOT EXISTS display_title TEXT,
    ADD COLUMN IF NOT EXISTS category_badge TEXT;

-- 3. Corregir seed_precount_locations para insertar en estado 'pending' (no 'open')
CREATE OR REPLACE FUNCTION public.seed_precount_locations(
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
                'pending',
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

-- 4. Snapshot automático de ubicaciones vigentes de la sucursal hacia una sesión
CREATE OR REPLACE FUNCTION public.seed_session_locations_from_branch(
    p_session_id UUID,
    p_branch_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_branch TEXT;
    v_inserted INTEGER := 0;
BEGIN
    IF p_session_id IS NULL OR COALESCE(TRIM(p_branch_name), '') = '' THEN
        RETURN jsonb_build_object('success', false, 'count', 0);
    END IF;

    v_clean_branch := UPPER(TRIM(p_branch_name));

    INSERT INTO public.precount_location_status (
        session_id,
        location_tag,
        status,
        display_title,
        category_badge,
        created_at,
        updated_at
    )
    SELECT
        p_session_id,
        UPPER(TRIM(l.location_tag)),
        'pending',
        l.display_title,
        l.category_badge,
        NOW(),
        NOW()
    FROM public.branch_inventory_locations l
    WHERE UPPER(TRIM(l.branch_name)) = v_clean_branch
      AND l.is_active = true
    ON CONFLICT (session_id, location_tag) DO UPDATE SET
        display_title = COALESCE(EXCLUDED.display_title, public.precount_location_status.display_title),
        category_badge = COALESCE(EXCLUDED.category_badge, public.precount_location_status.category_badge);

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_inserted,
        'session_id', p_session_id
    );
END;
$$;

-- 5. RPC de Auditoría en vivo por sesión (ubicaciones vigentes vs conteos)
CREATE OR REPLACE FUNCTION public.get_session_locations_audit(
    p_session_id UUID
)
RETURNS TABLE (
    location_tag TEXT,
    display_title TEXT,
    category_badge TEXT,
    status TEXT,
    opened_by_user TEXT,
    opened_by_device TEXT,
    opened_at TIMESTAMPTZ,
    closed_by_user TEXT,
    closed_by_device TEXT,
    closed_at TIMESTAMPTZ,
    sku_count BIGINT,
    total_units BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH item_agg AS (
        SELECT
            UPPER(TRIM(pi.location_tag)) AS tag,
            COUNT(DISTINCT pi.ean)::BIGINT AS sku_count,
            COALESCE(SUM(pi.quantity), 0)::BIGINT AS total_units
        FROM public.precount_items pi
        WHERE pi.session_id = p_session_id
          AND COALESCE(TRIM(pi.location_tag), '') <> ''
        GROUP BY UPPER(TRIM(pi.location_tag))
    )
    SELECT
        pls.location_tag,
        pls.display_title,
        pls.category_badge,
        pls.status,
        pls.opened_by_user,
        pls.opened_by_device,
        pls.opened_at,
        pls.closed_by_user,
        pls.closed_by_device,
        pls.closed_at,
        COALESCE(ia.sku_count, 0)::BIGINT AS sku_count,
        COALESCE(ia.total_units, 0)::BIGINT AS total_units
    FROM public.precount_location_status pls
    LEFT JOIN item_agg ia
        ON ia.tag = UPPER(TRIM(pls.location_tag))
    WHERE pls.session_id = p_session_id
    ORDER BY pls.location_tag ASC;
$$;

GRANT EXECUTE ON FUNCTION public.seed_precount_locations(UUID, TEXT[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.seed_session_locations_from_branch(UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_session_locations_audit(UUID) TO authenticated, anon, service_role;

-- 6. Garantizar que claim_or_validate_location NUNCA bloquee posiciones fuera de padrón (auditoría 100% no bloqueante)
CREATE OR REPLACE FUNCTION public.claim_or_validate_location(
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

    SELECT * INTO v_existing
    FROM public.precount_location_status
    WHERE session_id = p_session_id AND UPPER(location_tag) = v_tag
    FOR UPDATE;

    IF FOUND THEN
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
        -- Modo no bloqueante: si escanean una posición adicional que no estaba en el padrón QR, se registra y abre igual
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

GRANT EXECUTE ON FUNCTION public.claim_or_validate_location(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
