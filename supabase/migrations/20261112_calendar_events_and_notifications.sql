-- =============================================================================
-- MIGRACIÓN: Eventos de Calendario y Notificaciones por Rol (MiPlus)
-- Fecha: 2026-11-12
-- Propósito:
--   1. Crear tabla `public.calendar_events` con fecha local (`DATE`), rango
--      horario (`start_time`, `end_time`) y matriz `targets` (visibilidad en
--      calendario + envío de notificación para `admin`, `zonal`, `branch`).
--   2. Configurar índices, RLS estricto por rol y publicación en Supabase Realtime.
--   3. Crear RPC segura `public.notify_calendar_event` para emitir avisos en
--      `public.notifications` a los grupos seleccionados.
-- =============================================================================

-- 1. Tabla principal de eventos del calendario
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    event_date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    targets JSONB NOT NULL DEFAULT '{"admin":{"calendar":true,"notify":true},"zonal":{"calendar":true,"notify":true},"branch":{"calendar":true,"notify":true}}'::jsonb,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date
    ON public.calendar_events (event_date ASC, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by
    ON public.calendar_events (created_by);

-- Trigger de actualización de `updated_at`
CREATE OR REPLACE FUNCTION public.set_calendar_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
    BEFORE UPDATE ON public.calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION public.set_calendar_events_updated_at();

-- 2. Permisos y Row-Level Security (RLS)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.calendar_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_events TO authenticated;
GRANT ALL ON TABLE public.calendar_events TO service_role;

DROP POLICY IF EXISTS "calendar_events_select_by_role" ON public.calendar_events;
CREATE POLICY "calendar_events_select_by_role"
    ON public.calendar_events
    FOR SELECT
    TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active IS NOT FALSE
              AND (
                  p.role = 'admin'
                  OR (
                      p.role = 'mod'
                      AND (
                          COALESCE((calendar_events.targets -> 'zonal' ->> 'calendar')::boolean, false)
                          OR COALESCE((calendar_events.targets -> 'zonal' ->> 'notify')::boolean, false)
                      )
                  )
                  OR (
                      p.role = 'branch'
                      AND (
                          COALESCE((calendar_events.targets -> 'branch' ->> 'calendar')::boolean, false)
                          OR COALESCE((calendar_events.targets -> 'branch' ->> 'notify')::boolean, false)
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "calendar_events_insert_managers" ON public.calendar_events;
CREATE POLICY "calendar_events_insert_managers"
    ON public.calendar_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active IS NOT FALSE
              AND p.role IN ('admin', 'mod')
        )
    );

DROP POLICY IF EXISTS "calendar_events_update_managers" ON public.calendar_events;
CREATE POLICY "calendar_events_update_managers"
    ON public.calendar_events
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active IS NOT FALSE
              AND p.role IN ('admin', 'mod')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active IS NOT FALSE
              AND p.role IN ('admin', 'mod')
        )
    );

DROP POLICY IF EXISTS "calendar_events_delete_managers" ON public.calendar_events;
CREATE POLICY "calendar_events_delete_managers"
    ON public.calendar_events
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active IS NOT FALSE
              AND p.role IN ('admin', 'mod')
        )
    );

-- 3. RPC para enviar notificaciones del evento a los roles seleccionados
CREATE OR REPLACE FUNCTION public.notify_calendar_event(
    p_event_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_notify_admin BOOLEAN DEFAULT false,
    p_notify_zonal BOOLEAN DEFAULT false,
    p_notify_branch BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
    v_roles TEXT[] := ARRAY[]::TEXT[];
    v_inserted INTEGER := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    SELECT role
    INTO v_role
    FROM public.profiles
    WHERE id = v_uid
      AND active IS NOT FALSE;

    IF COALESCE(v_role, '') NOT IN ('admin', 'mod') THEN
        RAISE EXCEPTION 'Sin permisos para enviar notificaciones de calendario';
    END IF;

    IF p_notify_admin THEN
        v_roles := array_append(v_roles, 'admin');
    END IF;
    IF p_notify_zonal THEN
        v_roles := array_append(v_roles, 'mod');
    END IF;
    IF p_notify_branch THEN
        v_roles := array_append(v_roles, 'branch');
    END IF;

    IF array_length(v_roles, 1) IS NULL THEN
        RETURN 0;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        category,
        title,
        message,
        is_read,
        metadata,
        created_at
    )
    SELECT
        p.id,
        'info',
        'CALENDARIO',
        p_title,
        p_message,
        false,
        jsonb_build_object('event_id', p_event_id, 'source', 'calendar_events'),
        now()
    FROM public.profiles p
    WHERE p.active IS NOT FALSE
      AND p.role = ANY(v_roles);

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_calendar_event(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_calendar_event(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated, service_role;

-- 4. Limpieza automática de notificaciones al eliminar un evento del calendario
DROP POLICY IF EXISTS "Authenticated delete own notifications" ON public.notifications;
CREATE POLICY "Authenticated delete own notifications"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid())::text = user_id::text);

CREATE OR REPLACE FUNCTION public.cleanup_calendar_event_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE category = 'CALENDARIO'
      AND metadata ->> 'event_id' = OLD.id::text;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_calendar_event_notifications ON public.calendar_events;
CREATE TRIGGER trg_cleanup_calendar_event_notifications
    AFTER DELETE ON public.calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_calendar_event_notifications();

CREATE OR REPLACE FUNCTION public.delete_calendar_event_notifications(
    p_event_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
    v_deleted INTEGER := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    SELECT role
    INTO v_role
    FROM public.profiles
    WHERE id = v_uid
      AND active IS NOT FALSE;

    IF COALESCE(v_role, '') NOT IN ('admin', 'mod') THEN
        RAISE EXCEPTION 'Sin permisos para eliminar notificaciones de calendario';
    END IF;

    DELETE FROM public.notifications
    WHERE category = 'CALENDARIO'
      AND metadata ->> 'event_id' = p_event_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_calendar_event_notifications(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event_notifications(TEXT) TO authenticated, service_role;

-- 5. Publicación en Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'calendar_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
    END IF;
END;
$$;

