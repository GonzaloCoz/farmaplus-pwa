-- =============================================================================
-- MIGRACIÓN: Fotos de perfil de usuarios (Supabase Storage + public.profiles)
-- Fecha: 2026-11-11
-- Propósito:
--   1. Agregar columnas `avatar_url` y `avatar_mode` a `public.profiles`.
--   2. Permitir que cada usuario autenticado actualice su propio perfil
--      protegiendo columnas críticas (`role`, `permissions`, `branch_id`, `active`).
--   3. Crear el bucket público `avatars` (máx. 5 MB, PNG/JPG/WEBP) con RLS
--      por carpeta de usuario (`<auth.uid()>/avatar.<ext>`).
-- =============================================================================

-- 1. Columnas de avatar en `public.profiles`
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS avatar_mode TEXT DEFAULT 'initials' CHECK (avatar_mode IN ('initials', 'photo'));

-- 2. Trigger para proteger columnas privilegiadas si el usuario que edita no es admin
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Permitir todo a service_role / postgres (migraciones y backend)
    IF current_user IN ('postgres', 'service_role', 'supabase_admin')
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    SELECT role
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
    INTO v_role;

    -- Si no es administrador, impedir cambios en columnas de control de acceso
    IF COALESCE(v_role, '') <> 'admin' THEN
        NEW.role := OLD.role;
        NEW.permissions := OLD.permissions;
        NEW.branch_id := OLD.branch_id;
        NEW.active := OLD.active;
        NEW.username := OLD.username;
    END IF;

    -- Solo roles admin y mod (zonal) pueden modificar su full_name
    IF COALESCE(v_role, '') NOT IN ('admin', 'mod') THEN
        NEW.full_name := OLD.full_name;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 3. Política RLS de UPDATE en `public.profiles` (propio usuario o admin)
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
CREATE POLICY "Users can update own profile or admins can update any"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = 'admin'
        )
    )
    WITH CHECK (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = 'admin'
        )
    );

-- 4. Bucket `avatars` en Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Políticas RLS en `storage.objects` para el bucket `avatars`
-- Nota: Storage upsert requiere SELECT + INSERT + UPDATE.
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users insert own avatar" ON storage.objects;
CREATE POLICY "Users insert own avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

