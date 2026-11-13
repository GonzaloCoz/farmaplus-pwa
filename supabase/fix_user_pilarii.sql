-- ===========================================================================
-- FIX: Reparación de Usuario pilarii en auth.users (GoTrue 500 Fix)
-- Motivo del error 500: GoTrue requiere que las columnas de tokens no sean NULL,
-- sino cadenas vacías (''). De lo contrario Go falla con:
-- "sql: Scan error: converting NULL to string is unsupported -> Database error querying schema"
-- ===========================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_branch_id UUID;
    v_password TEXT := 'farmaplus';
BEGIN
    -- 1. Obtener ID de la sucursal Pilar II
    SELECT id INTO v_branch_id FROM public.branches WHERE slug = 'pilarii';
    
    -- Si no existiera, la creamos
    IF v_branch_id IS NULL THEN
        INSERT INTO public.branches (name, slug)
        VALUES ('Pilar II', 'pilarii')
        RETURNING id INTO v_branch_id;
    END IF;

    -- 2. Limpieza completa de registros huérfanos/incompletos de pilarii
    DELETE FROM auth.identities WHERE identity_data->>'email' = 'pilarii@farmaplus.system';
    DELETE FROM auth.users WHERE email = 'pilarii@farmaplus.system';

    -- 3. Generar UUID limpio
    v_user_id := gen_random_uuid();

    -- 4. Inserción con TODOS los campos de texto requeridos por GoTrue en '' (no NULL)
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
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
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Farmacia Pilar II"}'::jsonb,
        'authenticated',
        'authenticated',
        false,
        now(),
        now(),
        '',
        null,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    );

    -- 5. Inserción en auth.identities vinculada al UUID
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

    -- 6. Inserción o actualización en public.profiles
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

    RAISE NOTICE '✓ Usuario pilarii reparado con éxito. ID: %, Branch: %', v_user_id, v_branch_id;
END $$;
