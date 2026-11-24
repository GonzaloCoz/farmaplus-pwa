-- Mensajeria directa sellada de extremo a extremo (E2EE) para MiPlus.
-- Tablas nuevas e independientes sobre auth.users(id); cero alteraciones a tablas existentes en produccion.

CREATE TABLE IF NOT EXISTS public.extremos_mensajeria (
    operador_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    extremo_publico BYTEA NOT NULL CHECK (octet_length(extremo_publico) = 32),
    firma_identidad BYTEA NOT NULL CHECK (octet_length(firma_identidad) = 32),
    firma_extremo BYTEA NOT NULL CHECK (octet_length(firma_extremo) = 64),
    respaldo_extremo BYTEA,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversaciones_directas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operador_menor UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operador_mayor UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ultimo_movimiento_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_orden_participantes CHECK (operador_menor < operador_mayor),
    CONSTRAINT uq_par_participantes UNIQUE (operador_menor, operador_mayor)
);

CREATE TABLE IF NOT EXISTS public.mensajes_directos (
    id UUID PRIMARY KEY,
    conversacion_id UUID NOT NULL REFERENCES public.conversaciones_directas(id) ON DELETE CASCADE,
    remitente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sobre_sellado BYTEA NOT NULL CHECK (octet_length(sobre_sellado) >= 28),
    estado SMALLINT NOT NULL DEFAULT 1 CHECK (estado IN (1, 2, 3)),
    editado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ,
    leido_en TIMESTAMPTZ
);

-- Indices para RLS, claves foraneas y lecturas ordenadas
CREATE INDEX IF NOT EXISTS idx_conv_directas_menor
    ON public.conversaciones_directas (operador_menor, ultimo_movimiento_en DESC);

CREATE INDEX IF NOT EXISTS idx_conv_directas_mayor
    ON public.conversaciones_directas (operador_mayor, ultimo_movimiento_en DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_directos_conv_fecha
    ON public.mensajes_directos (conversacion_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_directos_remitente
    ON public.mensajes_directos (remitente_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_directos_no_leidos
    ON public.mensajes_directos (conversacion_id, estado)
    WHERE estado < 3;

-- Trigger de integridad: protege campos inmutables y separa edicion (remitente) de acuse (destinatario)
CREATE OR REPLACE FUNCTION public.validar_actualizacion_mensaje_directo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF NEW.id <> OLD.id
       OR NEW.conversacion_id <> OLD.conversacion_id
       OR NEW.remitente_id <> OLD.remitente_id
       OR NEW.creado_en <> OLD.creado_en THEN
        RAISE EXCEPTION 'Campos inmutables de mensaje directo no pueden modificarse'
            USING ERRCODE = '42501';
    END IF;

    -- El destinatario solo puede avanzar el estado de entrega/lectura (1 -> 2 -> 3)
    IF v_uid IS DISTINCT FROM OLD.remitente_id THEN
        IF NEW.sobre_sellado IS DISTINCT FROM OLD.sobre_sellado
           OR NEW.editado IS DISTINCT FROM OLD.editado
           OR NEW.actualizado_en IS DISTINCT FROM OLD.actualizado_en THEN
            RAISE EXCEPTION 'Solo el remitente puede editar el contenido del mensaje'
                USING ERRCODE = '42501';
        END IF;
        IF NEW.estado < OLD.estado THEN
            RAISE EXCEPTION 'El estado de lectura no puede retroceder'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_actualizacion_mensaje_directo ON public.mensajes_directos;
CREATE TRIGGER trg_validar_actualizacion_mensaje_directo
    BEFORE UPDATE ON public.mensajes_directos
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_actualizacion_mensaje_directo();

-- Actualiza la marca de actividad en la conversacion al insertar un mensaje
CREATE OR REPLACE FUNCTION public.tocar_movimiento_conversacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.conversaciones_directas
    SET ultimo_movimiento_en = GREATEST(ultimo_movimiento_en, NEW.creado_en)
    WHERE id = NEW.conversacion_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tocar_movimiento_conversacion ON public.mensajes_directos;
CREATE TRIGGER trg_tocar_movimiento_conversacion
    AFTER INSERT ON public.mensajes_directos
    FOR EACH ROW
    EXECUTE FUNCTION public.tocar_movimiento_conversacion();

-- Privilegios minimos y bloqueo absoluto a anon
REVOKE ALL ON TABLE public.extremos_mensajeria FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.conversaciones_directas FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.mensajes_directos FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.extremos_mensajeria TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.conversaciones_directas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.mensajes_directos TO authenticated;

-- RLS estricto
ALTER TABLE public.extremos_mensajeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones_directas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_directos ENABLE ROW LEVEL SECURITY;

-- Extremos publicos: cualquier operador autenticado puede leer el extremo publico de otro para cifrarle;
-- solo el titular puede registrar o rotar su propio extremo.
CREATE POLICY rls_extremos_lectura ON public.extremos_mensajeria
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY rls_extremos_insercion ON public.extremos_mensajeria
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = operador_id);

CREATE POLICY rls_extremos_actualizacion ON public.extremos_mensajeria
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = operador_id)
    WITH CHECK ((SELECT auth.uid()) = operador_id);

-- Conversaciones directas: solo participantes
CREATE POLICY rls_conv_directas_lectura ON public.conversaciones_directas
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) IN (operador_menor, operador_mayor));

CREATE POLICY rls_conv_directas_insercion ON public.conversaciones_directas
    FOR INSERT TO authenticated
    WITH CHECK (
        operador_menor < operador_mayor
        AND (SELECT auth.uid()) IN (operador_menor, operador_mayor)
    );

CREATE POLICY rls_conv_directas_borrado ON public.conversaciones_directas
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) IN (operador_menor, operador_mayor));

-- Mensajes directos: solo participantes de la conversacion padre
CREATE POLICY rls_mensajes_directos_lectura ON public.mensajes_directos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id = conversacion_id
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

CREATE POLICY rls_mensajes_directos_insercion ON public.mensajes_directos
    FOR INSERT TO authenticated
    WITH CHECK (
        remitente_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id = conversacion_id
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

CREATE POLICY rls_mensajes_directos_actualizacion ON public.mensajes_directos
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id = conversacion_id
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id = conversacion_id
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

-- Publicacion en Supabase Realtime (Postgres Changes)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversaciones_directas'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones_directas;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensajes_directos'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_directos;
        END IF;
    END IF;
END;
$$;
