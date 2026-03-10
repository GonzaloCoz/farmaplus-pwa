-- ========================================================
-- REPARACIÓN DEFINITIVA DE RLS PARA APP_VERSIONS
-- Ejecuta este script completo en el SQL Editor de Supabase
-- ========================================================

-- 1. Deshabilitar RLS momentáneamente para limpiar
ALTER TABLE public.app_versions DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas previas (limpieza total)
DROP POLICY IF EXISTS "Anyone can view app versions" ON public.app_versions;
DROP POLICY IF EXISTS "Authenticated users can manage app versions" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_select_policy" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_insert_policy" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_update_policy" ON public.app_versions;
DROP POLICY IF EXISTS "allow_all_select" ON public.app_versions;
DROP POLICY IF EXISTS "allow_auth_insert" ON public.app_versions;
DROP POLICY IF EXISTS "allow_auth_update" ON public.app_versions;

-- 3. Volver a habilitar RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas ultra-simples para evitar errores de validación
-- LECTURA: Permitida para todos
CREATE POLICY "app_versions_read" ON public.app_versions FOR SELECT USING (true);

-- INSERCIÓN: Permitida para cualquier usuario autenticado 
-- (Usamos condición genérica para evitar fallos de UID)
CREATE POLICY "app_versions_insert" ON public.app_versions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ACTUALIZACIÓN: Permitida para cualquier usuario autenticado
CREATE POLICY "app_versions_update" ON public.app_versions FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. Asegurar que las columnas tengan permisos de uso para el rol authenticated
GRANT ALL ON TABLE public.app_versions TO authenticated;
GRANT ALL ON TABLE public.app_versions TO service_role;
