-- Grupos de mensajeria empresarial cifrados de extremo a extremo (E2EE) para MiPlus.
-- Tablas nuevas e independientes; cero cambios a tablas o datos existentes de produccion.

CREATE TABLE IF NOT EXISTS public.grupos_mensajeria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 2 AND 80),
    descripcion TEXT,
    creado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ultimo_movimiento_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.miembros_grupo_mensajeria (
    grupo_id UUID NOT NULL REFERENCES public.grupos_mensajeria(id) ON DELETE CASCADE,
    operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL DEFAULT 'miembro' CHECK (rol IN ('administrador', 'miembro')),
    vaciado_en TIMESTAMPTZ,
    ultimo_leido_en TIMESTAMPTZ,
    unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (grupo_id, operador_id)
);

CREATE TABLE IF NOT EXISTS public.mensajes_grupo (
    id UUID PRIMARY KEY,
    grupo_id UUID NOT NULL REFERENCES public.grupos_mensajeria(id) ON DELETE CASCADE,
    remitente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sobre_sellado BYTEA NOT NULL CHECK (octet_length(sobre_sellado) >= 28),
    editado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ
);

-- Indices para RLS, claves foraneas y consultas ordenadas
CREATE INDEX IF NOT EXISTS idx_grupos_mensajeria_movimiento
    ON public.grupos_mensajeria (ultimo_movimiento_en DESC);

CREATE INDEX IF NOT EXISTS idx_miembros_grupo_operador
    ON public.miembros_grupo_mensajeria (operador_id, grupo_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_grupo_fecha
    ON public.mensajes_grupo (grupo_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_grupo_remitente
    ON public.mensajes_grupo (remitente_id);

-- Funciones auxiliares para RLS (evitan recursion en miembros_grupo_mensajeria)
CREATE OR REPLACE FUNCTION public.es_miembro_grupo_mensajeria(p_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.miembros_grupo_mensajeria m
        WHERE m.grupo_id = p_grupo_id
          AND m.operador_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.es_admin_grupo_mensajeria(p_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.miembros_grupo_mensajeria m
        WHERE m.grupo_id = p_grupo_id
          AND m.operador_id = (SELECT auth.uid())
          AND m.rol = 'administrador'
    );
$$;

REVOKE ALL ON FUNCTION public.es_miembro_grupo_mensajeria(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_admin_grupo_mensajeria(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_miembro_grupo_mensajeria(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_grupo_mensajeria(UUID) TO authenticated;

-- Trigger de marca de actividad del grupo al insertar mensaje
CREATE OR REPLACE FUNCTION public.tocar_movimiento_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.grupos_mensajeria
    SET ultimo_movimiento_en = GREATEST(ultimo_movimiento_en, NEW.creado_en)
    WHERE id = NEW.grupo_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tocar_movimiento_grupo ON public.mensajes_grupo;
CREATE TRIGGER trg_tocar_movimiento_grupo
    AFTER INSERT ON public.mensajes_grupo
    FOR EACH ROW
    EXECUTE FUNCTION public.tocar_movimiento_grupo();

-- Proteccion de campos inmutables en mensajes_grupo
CREATE OR REPLACE FUNCTION public.validar_actualizacion_mensaje_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.id <> OLD.id
       OR NEW.grupo_id <> OLD.grupo_id
       OR NEW.remitente_id <> OLD.remitente_id
       OR NEW.creado_en <> OLD.creado_en THEN
        RAISE EXCEPTION 'Campos inmutables de mensaje de grupo no pueden modificarse'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_actualizacion_mensaje_grupo ON public.mensajes_grupo;
CREATE TRIGGER trg_validar_actualizacion_mensaje_grupo
    BEFORE UPDATE ON public.mensajes_grupo
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_actualizacion_mensaje_grupo();

-- Privilegios minimos y bloqueo a anon
REVOKE ALL ON TABLE public.grupos_mensajeria FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.miembros_grupo_mensajeria FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.mensajes_grupo FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.grupos_mensajeria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.miembros_grupo_mensajeria TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mensajes_grupo TO authenticated;

ALTER TABLE public.grupos_mensajeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_grupo_mensajeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_grupo ENABLE ROW LEVEL SECURITY;

-- Politicas grupos_mensajeria
CREATE POLICY rls_grupos_lectura ON public.grupos_mensajeria
    FOR SELECT TO authenticated
    USING (
        creado_por = (SELECT auth.uid())
        OR public.es_miembro_grupo_mensajeria(id)
    );

CREATE POLICY rls_grupos_insercion ON public.grupos_mensajeria
    FOR INSERT TO authenticated
    WITH CHECK (creado_por = (SELECT auth.uid()));

CREATE POLICY rls_grupos_actualizacion ON public.grupos_mensajeria
    FOR UPDATE TO authenticated
    USING (public.es_admin_grupo_mensajeria(id))
    WITH CHECK (public.es_admin_grupo_mensajeria(id));

CREATE POLICY rls_grupos_borrado ON public.grupos_mensajeria
    FOR DELETE TO authenticated
    USING (public.es_admin_grupo_mensajeria(id));

-- Politicas miembros_grupo_mensajeria
CREATE POLICY rls_miembros_grupo_lectura ON public.miembros_grupo_mensajeria
    FOR SELECT TO authenticated
    USING (public.es_miembro_grupo_mensajeria(grupo_id));

CREATE POLICY rls_miembros_grupo_insercion ON public.miembros_grupo_mensajeria
    FOR INSERT TO authenticated
    WITH CHECK (
        public.es_admin_grupo_mensajeria(grupo_id)
        OR EXISTS (
            SELECT 1
            FROM public.grupos_mensajeria g
            WHERE g.id = grupo_id
              AND g.creado_por = (SELECT auth.uid())
        )
    );

CREATE POLICY rls_miembros_grupo_actualizacion ON public.miembros_grupo_mensajeria
    FOR UPDATE TO authenticated
    USING (operador_id = (SELECT auth.uid()))
    WITH CHECK (operador_id = (SELECT auth.uid()));

CREATE POLICY rls_miembros_grupo_borrado ON public.miembros_grupo_mensajeria
    FOR DELETE TO authenticated
    USING (
        operador_id = (SELECT auth.uid())
        OR public.es_admin_grupo_mensajeria(grupo_id)
    );

-- Politicas mensajes_grupo
CREATE POLICY rls_mensajes_grupo_lectura ON public.mensajes_grupo
    FOR SELECT TO authenticated
    USING (public.es_miembro_grupo_mensajeria(grupo_id));

CREATE POLICY rls_mensajes_grupo_insercion ON public.mensajes_grupo
    FOR INSERT TO authenticated
    WITH CHECK (
        remitente_id = (SELECT auth.uid())
        AND public.es_miembro_grupo_mensajeria(grupo_id)
    );

CREATE POLICY rls_mensajes_grupo_actualizacion ON public.mensajes_grupo
    FOR UPDATE TO authenticated
    USING (
        remitente_id = (SELECT auth.uid())
        AND public.es_miembro_grupo_mensajeria(grupo_id)
    )
    WITH CHECK (
        remitente_id = (SELECT auth.uid())
        AND public.es_miembro_grupo_mensajeria(grupo_id)
    );

-- Extender acceso de Storage `mensajeria-sellada` para adjuntos de grupos
DROP POLICY IF EXISTS "Lectura adjuntos grupo mensajeria" ON storage.objects;
CREATE POLICY "Lectura adjuntos grupo mensajeria"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'mensajeria-sellada'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.es_miembro_grupo_mensajeria(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Insercion adjuntos grupo mensajeria" ON storage.objects;
CREATE POLICY "Insercion adjuntos grupo mensajeria"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'mensajeria-sellada'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.es_miembro_grupo_mensajeria(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Actualizacion adjuntos grupo mensajeria" ON storage.objects;
CREATE POLICY "Actualizacion adjuntos grupo mensajeria"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'mensajeria-sellada'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.es_miembro_grupo_mensajeria(((storage.foldername(name))[1])::uuid)
    )
    WITH CHECK (
        bucket_id = 'mensajeria-sellada'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.es_miembro_grupo_mensajeria(((storage.foldername(name))[1])::uuid)
    );

-- Publicacion en Supabase Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grupos_mensajeria'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.grupos_mensajeria;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'miembros_grupo_mensajeria'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.miembros_grupo_mensajeria;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensajes_grupo'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_grupo;
        END IF;
    END IF;
END;
$$;
