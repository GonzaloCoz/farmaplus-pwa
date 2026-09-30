-- Script de Creación Exacta para Supabase GoTrue
-- Tamara Belen Da Costa Pinto (tbdacosta) & Ileana Celina Maldonado (imaldonado)
-- Contraseña: farmaplus

DO $$
DECLARE
    v_user_tamara UUID := gen_random_uuid();
    v_user_ileana UUID := gen_random_uuid();
    v_password TEXT := 'farmaplus';
BEGIN
    -- 1. Limpieza de registros previos
    DELETE FROM auth.identities WHERE identity_data->>'email' IN ('tbdacosta@farmaplus.system', 'imaldonado@farmaplus.system');
    DELETE FROM auth.users WHERE email IN ('tbdacosta@farmaplus.system', 'imaldonado@farmaplus.system');

    ---------------------------------------------------------------------------
    -- TAMARA (tbdacosta)
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
        updated_at
    )
    VALUES (
        v_user_tamara,
        '00000000-0000-0000-0000-000000000000',
        'tbdacosta@farmaplus.system',
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Tamara Belen Da Costa Pinto"}'::jsonb,
        'authenticated',
        'authenticated',
        false,
        now(),
        now()
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
        v_user_tamara,
        v_user_tamara,
        jsonb_build_object('sub', v_user_tamara::text, 'email', 'tbdacosta@farmaplus.system'),
        'email',
        v_user_tamara::text,
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (id, username, full_name, role, active)
    VALUES (v_user_tamara, 'tbdacosta', 'Tamara Belen Da Costa Pinto', 'admin', true)
    ON CONFLICT (username) DO UPDATE SET
        id = v_user_tamara,
        full_name = 'Tamara Belen Da Costa Pinto',
        role = 'admin',
        active = true;

    ---------------------------------------------------------------------------
    -- ILEANA (imaldonado)
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
        updated_at
    )
    VALUES (
        v_user_ileana,
        '00000000-0000-0000-0000-000000000000',
        'imaldonado@farmaplus.system',
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Ileana Celina Maldonado"}'::jsonb,
        'authenticated',
        'authenticated',
        false,
        now(),
        now()
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
        v_user_ileana,
        v_user_ileana,
        jsonb_build_object('sub', v_user_ileana::text, 'email', 'imaldonado@farmaplus.system'),
        'email',
        v_user_ileana::text,
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (id, username, full_name, role, active)
    VALUES (v_user_ileana, 'imaldonado', 'Ileana Celina Maldonado', 'admin', true)
    ON CONFLICT (username) DO UPDATE SET
        id = v_user_ileana,
        full_name = 'Ileana Celina Maldonado',
        role = 'admin',
        active = true;

    RAISE NOTICE '✓ Tamara e Ileana creadas con la estructura exacta.';
END $$;
