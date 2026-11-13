-- ===========================================================================
-- Script de Creación / Alta de Usuarios Administradores para Farmaplus
-- 1. María Sofía Fernandez Loyarte -> user: mfernandezloyarte
-- 2. María Sofía Suarez Vigil      -> user: msuarezvigil
-- Rol: admin
-- Contraseña inicial por defecto: farmaplus
-- ===========================================================================

DO $$
DECLARE
    v_user_fernandez UUID := gen_random_uuid();
    v_user_suarez UUID := gen_random_uuid();
    v_password TEXT := 'farmaplus';
BEGIN
    -- 1. Limpieza preventiva en profiles y auth (incluyendo el usuario anterior con typo msuarezvirgil)
    DELETE FROM public.profiles WHERE username IN ('msuarezvirgil', 'msuarezvigil');
    DELETE FROM auth.identities WHERE identity_data->>'email' IN (
        'mfernandezloyarte@farmaplus.system',
        'msuarezvirgil@farmaplus.system',
        'msuarezvigil@farmaplus.system'
    );
    DELETE FROM auth.users WHERE email IN (
        'mfernandezloyarte@farmaplus.system',
        'msuarezvirgil@farmaplus.system',
        'msuarezvigil@farmaplus.system'
    );

    ---------------------------------------------------------------------------
    -- 1. MARÍA SOFÍA FERNANDEZ LOYARTE (mfernandezloyarte)
    ---------------------------------------------------------------------------
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
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        reauthentication_token
    )
    VALUES (
        v_user_fernandez,
        '00000000-0000-0000-0000-000000000000',
        'mfernandezloyarte@farmaplus.system',
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"María Sofía Fernandez Loyarte"}'::jsonb,
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
        ''
    );

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
        v_user_fernandez,
        v_user_fernandez,
        jsonb_build_object('sub', v_user_fernandez::text, 'email', 'mfernandezloyarte@farmaplus.system'),
        'email',
        v_user_fernandez::text,
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        role,
        active
    )
    VALUES (
        v_user_fernandez,
        'mfernandezloyarte',
        'María Sofía Fernandez Loyarte',
        'admin',
        true
    )
    ON CONFLICT (username) DO UPDATE SET
        id = EXCLUDED.id,
        full_name = EXCLUDED.full_name,
        role = 'admin',
        active = true;

    ---------------------------------------------------------------------------
    -- 2. MARÍA SOFÍA SUAREZ VIGIL (msuarezvigil)
    ---------------------------------------------------------------------------
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
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        reauthentication_token
    )
    VALUES (
        v_user_suarez,
        '00000000-0000-0000-0000-000000000000',
        'msuarezvigil@farmaplus.system',
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"María Sofía Suarez Vigil"}'::jsonb,
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
        ''
    );

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
        v_user_suarez,
        v_user_suarez,
        jsonb_build_object('sub', v_user_suarez::text, 'email', 'msuarezvigil@farmaplus.system'),
        'email',
        v_user_suarez::text,
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        role,
        active
    )
    VALUES (
        v_user_suarez,
        'msuarezvigil',
        'María Sofía Suarez Vigil',
        'admin',
        true
    )
    ON CONFLICT (username) DO UPDATE SET
        id = EXCLUDED.id,
        full_name = EXCLUDED.full_name,
        role = 'admin',
        active = true;

    RAISE NOTICE '✓ Administradoras mfernandezloyarte y msuarezvigil creadas con éxito.';
END $$;
