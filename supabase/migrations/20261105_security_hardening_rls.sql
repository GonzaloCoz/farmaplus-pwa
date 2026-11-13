-- =============================================================================
-- MIGRACIÓN: Hardening de RLS y RPCs (Auditoría Cloudflare Security Skill)
-- Fecha: 2026-11-05
-- Propósito:
--   1. Revocar permisos de escritura/borrado al rol público `anon` en `inventory_ledger`
--      (solo usuarios `authenticated` de MiPlus registran o auditan folios contables).
--   2. Revocar ejecución pública (`anon`) en `public.save_branch_config`.
--   3. Preparar políticas seguras para el bucket `laboratory-logos` (lectura pública,
--      escritura exclusiva para administradores).
-- =============================================================================

-- 1. Hardening de `public.inventory_ledger` (Mitigación CF-03)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.inventory_ledger FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_ledger TO authenticated;
GRANT ALL ON TABLE public.inventory_ledger TO service_role;

DROP POLICY IF EXISTS "ledger_insert_policy" ON public.inventory_ledger;
DROP POLICY IF EXISTS "ledger_update_policy" ON public.inventory_ledger;
DROP POLICY IF EXISTS "ledger_delete_policy" ON public.inventory_ledger;

-- Solo usuarios autenticados pueden insertar cierres en el libro mayor
CREATE POLICY "ledger_insert_policy"
    ON public.inventory_ledger
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Solo administradores o el autor del cierre pueden actualizar/eliminar registros del ledger
CREATE POLICY "ledger_update_policy"
    ON public.inventory_ledger
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'mod')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'mod')
        )
    );

CREATE POLICY "ledger_delete_policy"
    ON public.inventory_ledger
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- 2. Restringir `save_branch_config` únicamente a usuarios autenticados (Mitigación CF-03)
REVOKE EXECUTE ON FUNCTION public.save_branch_config(TEXT, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_branch_config(TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- 3. Bucket y políticas RLS para `laboratory-logos` (Mitigación NV-03)
INSERT INTO storage.buckets (id, name, public)
VALUES ('laboratory-logos', 'laboratory-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read laboratory logos" ON storage.objects;
CREATE POLICY "Public read laboratory logos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'laboratory-logos');

DROP POLICY IF EXISTS "Admin write laboratory logos" ON storage.objects;
CREATE POLICY "Admin write laboratory logos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'laboratory-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin update laboratory logos" ON storage.objects;
CREATE POLICY "Admin update laboratory logos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'laboratory-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin delete laboratory logos" ON storage.objects;
CREATE POLICY "Admin delete laboratory logos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'laboratory-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

