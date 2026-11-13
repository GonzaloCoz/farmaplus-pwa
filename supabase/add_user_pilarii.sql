-- ===========================================================================
-- Script de Creación / Alta de Usuario para Sucursal: PILAR II
-- Usuario: pilarii
-- Email: pilarii@farmaplus.system
-- Contraseña inicial: farmaplus
-- ===========================================================================

DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_branch_id UUID;
    v_password TEXT := 'farmaplus';
BEGIN
    -- 1. Asegurar la sucursal en public.branches (si no existe, se crea)
    INSERT INTO public.branches (name, slug)
    VALUES ('Pilar II', 'pilarii')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_branch_id;

    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id FROM public.branches WHERE slug = 'pilarii';
    END IF;

    -- 2. Limpieza preventiva en auth si ya existiera el email para evitar duplicados huérfanos
    DELETE FROM auth.identities WHERE identity_data->>'email' = 'pilarii@farmaplus.system';
    DELETE FROM auth.users WHERE email = 'pilarii@farmaplus.system';

    -- 3. Crear usuario en auth.users con tokens vacíos
    -- NOTA: No incluir "confirmed_at" porque es una columna generada automáticamente por Postgres
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        phone_change,
        phone_change_token,
        reauthentication_token
    )
    VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'pilarii@farmaplus.system',
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Farmacia Pilar II"}'::jsonb,
        'authenticated',
        'authenticated',
        false,
        now(),
        now(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    );

    -- 4. Crear identidad en auth.identities para Supabase GoTrue
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', 'pilarii@farmaplus.system'),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
    );

    -- 5. Crear o actualizar perfil en public.profiles
    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        role,
        branch_id,
        active
    )
    VALUES (
        v_user_id,
        'pilarii',
        'Farmacia Pilar II',
        'branch',
        v_branch_id,
        true
    )
    ON CONFLICT (username) DO UPDATE SET
        id = EXCLUDED.id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        active = true;

    RAISE NOTICE 'Sucursal Pilar II (ID: %) y Usuario pilarii (ID: %) creados exitosamente.', v_branch_id, v_user_id;
END $$;
