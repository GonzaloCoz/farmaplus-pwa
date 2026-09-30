-- ==============================================================================
-- TABLA Y PRESENCIA REALTIME PARA TERMINALES Y COLECTORES ZEBRA
-- Fecha: 2026-09-21
-- ==============================================================================

-- 1. Tabla de dispositivos conectados por sesión
CREATE TABLE IF NOT EXISTS public.precount_connected_devices (
    device_id TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES public.precount_sessions(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'zebra',
    device_model TEXT NOT NULL DEFAULT 'Zebra TC22',
    battery_level INTEGER DEFAULT 100,
    is_charging BOOLEAN DEFAULT FALSE,
    current_location TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'online',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, session_id)
);

-- 2. Habilitar Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'precount_connected_devices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE precount_connected_devices;
    END IF;
END $$;

-- 3. RLS
ALTER TABLE public.precount_connected_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for precount_connected_devices" ON public.precount_connected_devices;
CREATE POLICY "Allow all for precount_connected_devices" 
    ON public.precount_connected_devices 
    FOR ALL TO anon, authenticated, service_role 
    USING (true) 
    WITH CHECK (true);

-- 4. Actualizar verify_precount_pin para registrar el dispositivo de inmediato
DROP FUNCTION IF EXISTS public.verify_precount_pin(TEXT);
DROP FUNCTION IF EXISTS public.verify_precount_pin(TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.verify_precount_pin(
    p_pin TEXT,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_device_model TEXT DEFAULT NULL,
    p_battery INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_clean_pin TEXT := TRIM(p_pin);
    v_branch_name TEXT := '';
    v_dev_id TEXT;
    v_dev_name TEXT;
BEGIN
    SELECT s.id, s.sector, s.branch_id, s.start_time, s.status, s.sync_pin
    INTO v_session
    FROM public.precount_sessions s
    WHERE s.sync_pin = v_clean_pin AND s.status = 'active'
    ORDER BY s.start_time DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'PIN_NOT_FOUND', 
            'message', 'PIN no encontrado o la sesión de inventario ya no está activa'
        );
    END IF;

    IF v_session.branch_id IS NOT NULL THEN
        SELECT name INTO v_branch_name FROM public.branches WHERE id = v_session.branch_id;
    END IF;

    v_dev_id := COALESCE(NULLIF(TRIM(p_device_id), ''), 'ZEBRA-' || SUBSTRING(gen_random_uuid()::text, 1, 8));
    v_dev_name := COALESCE(NULLIF(TRIM(p_device_name), ''), 'Zebra TC22');

    INSERT INTO public.precount_connected_devices (
        device_id, session_id, device_name, device_type, device_model, battery_level, status, last_seen
    ) VALUES (
        v_dev_id, v_session.id, v_dev_name, 'zebra', COALESCE(NULLIF(TRIM(p_device_model), ''), 'Zebra TC22'), COALESCE(p_battery, 100), 'online', NOW()
    )
    ON CONFLICT (device_id, session_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        device_model = EXCLUDED.device_model,
        battery_level = EXCLUDED.battery_level,
        status = 'online',
        last_seen = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'sector', v_session.sector,
        'branch_id', v_session.branch_id,
        'branch_name', COALESCE(v_branch_name, v_session.sector, 'Sucursal'),
        'sync_pin', v_session.sync_pin,
        'device_id', v_dev_id,
        'status', v_session.status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_precount_pin(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;

-- Procedimiento para actualizar ubicación y batería de terminal en tiempo real
DROP FUNCTION IF EXISTS public.update_device_presence(UUID, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.update_device_presence(
    p_session_id UUID,
    p_device_id TEXT,
    p_current_location TEXT DEFAULT NULL,
    p_battery INTEGER DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.precount_connected_devices
    SET current_location = p_current_location,
        battery_level = COALESCE(p_battery, battery_level),
        last_seen = NOW(),
        status = 'online'
    WHERE session_id = p_session_id AND device_id = p_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_device_presence(UUID, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
