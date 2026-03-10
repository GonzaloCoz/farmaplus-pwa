-- Script para alterar la poliítica RLS de app_versions
-- Permite inserts bajo rol auth

-- Borrar política previa
DROP POLICY IF EXISTS "Authenticated users can manage app versions" ON public.app_versions;

-- Nueva política con WITH CHECK
CREATE POLICY "Authenticated users can manage app versions"
ON public.app_versions
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
