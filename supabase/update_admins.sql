-- Script de actualización para Usuarios Administradores de Farmaplus
-- Este script asegura que la estructura de la tabla sea correcta e inserta los datos.

-- 1. Crear tabla 'profiles' si no existe (básica)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
);

-- 2. Asegurar que existan las columnas necesarias (usando ALTER TABLE por si la tabla ya existía)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'branch';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_name text;

-- 3. Asegurar que 'username' sea único (necesario para la inserción 'upsert')
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Crear política de lectura pública (para permitir login)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- 6. Insertar o Actualizar los administradores permitidos
INSERT INTO public.profiles (username, full_name, role, branch_name)
VALUES
    ('gcoz', 'Gonzalo Coz', 'admin', 'Casa Central'),
    ('ediaz', 'Emanuel Diaz', 'admin', 'Casa Central'),
    ('ebustos', 'Ezequiel Bustos', 'admin', 'Casa Central'),
    ('nmomeno', 'Nicolas Momeño', 'admin', 'Casa Central'),
    ('cfraga', 'Carlos Fraga', 'admin', 'Casa Central')
ON CONFLICT (username) 
DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = 'admin',
    branch_name = 'Casa Central';

-- 7. Limpiar administradores antiguos (Opcional)
-- DELETE FROM public.profiles 
-- WHERE role = 'admin' 
-- AND username NOT IN ('gcoz', 'ediaz', 'ebustos', 'nmomeno', 'cfraga');

