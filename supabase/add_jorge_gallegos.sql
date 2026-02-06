-- PASO 1: Crear el usuario en la tabla de Autenticación de Supabase
-- Ejecutar esto en el SQL Editor de Supabase (requiere permisos de admin de base de datos)
-- NOTA: El password por defecto será 'farmaplus', pero se recomienda cambiarlo.

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
BEGIN
    -- 1. Insertar en auth.users si no existe
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jgallegos@farmaplus.system') THEN
        INSERT INTO auth.users (
            id, 
            instance_id, 
            email, 
            encrypted_password, 
            email_confirmed_at, 
            raw_app_meta_data, 
            raw_user_meta_data, 
            role, 
            confirmation_token
        )
        VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            'jgallegos@farmaplus.system',
            crypt('farmaplus', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Jorge Gallegos"}',
            'authenticated',
            ''
        );
    ELSE
        SELECT id INTO new_user_id FROM auth.users WHERE email = 'jgallegos@farmaplus.system';
    END IF;

    -- 2. Asegurar que el perfil exista en public.profiles vinculado al ID anterior
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
        new_user_id,
        'jgallegos',
        'Jorge Gallegos',
        'admin'
    )
    ON CONFLICT (username) DO UPDATE SET
        id = EXCLUDED.id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    RAISE NOTICE 'Usuario jgallegos creado exitosamente con ID %', new_user_id;
END $$;
