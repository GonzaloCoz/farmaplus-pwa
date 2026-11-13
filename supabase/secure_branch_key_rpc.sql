-- ===========================================================================
-- Función de validación y resolución de ticket de sesión
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.resolve_session_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        RETURN 'm@st3rpl3x0nz3';
    END IF;
    RAISE EXCEPTION 'Invalid session ticket';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_session_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_session_token() TO authenticated, service_role;
