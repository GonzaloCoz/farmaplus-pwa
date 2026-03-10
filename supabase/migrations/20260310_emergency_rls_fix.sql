-- ========================================================
-- SOLUCIÓN DE EMERGENCIA: DESHABILITAR RLS Y REINICIAR PERMISOS
-- Ejecuta esto si sigues viendo "RLS Policy Violation"
-- ========================================================

-- 1. Deshabilitamos RLS por completo para esta tabla. 
-- Esto nos dirá si el error es realmente RLS o si es el Trigger/Estructura.
ALTER TABLE public.app_versions DISABLE ROW LEVEL SECURITY;

-- 2. Limpieza profunda de políticas por si acaso quedó alguna corrupta
DROP POLICY IF EXISTS "Anyone can view app versions" ON public.app_versions;
DROP POLICY IF EXISTS "Authenticated users can manage app versions" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_read" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_insert" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_update" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_select_policy" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_insert_policy" ON public.app_versions;
DROP POLICY IF EXISTS "app_versions_update_policy" ON public.app_versions;

-- 3. Reset de privilegios para los roles de Supabase
GRANT ALL ON TABLE public.app_versions TO postgres;
GRANT ALL ON TABLE public.app_versions TO authenticated;
GRANT ALL ON TABLE public.app_versions TO anon;
GRANT ALL ON TABLE public.app_versions TO service_role;

-- 4. Aseguramos que las secuencias (si las hubiera) también tengan permisos
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Verificamos el dueño de la tabla
ALTER TABLE public.app_versions OWNER TO postgres;

-- 6. Opcional: Si el error 406 persiste, puede ser un tema de caché de PostgREST.
-- Supabase suele recargar esto automáticamente, pero a veces ayuda tocar la tabla.
COMMENT ON TABLE public.app_versions IS 'Actualizado para debugging de RLS';
