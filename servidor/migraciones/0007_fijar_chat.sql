-- Fijado individual de chats directos y grupos por participante (estilo WhatsApp).
-- Cero cambios a tablas o datos existentes de produccion.

ALTER TABLE public.conversaciones_directas
    ADD COLUMN IF NOT EXISTS fijado_menor BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fijado_mayor BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.miembros_grupo_mensajeria
    ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.validar_actualizacion_conv_directa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF NEW.id <> OLD.id
       OR NEW.operador_menor <> OLD.operador_menor
       OR NEW.operador_mayor <> OLD.operador_mayor
       OR NEW.creado_en <> OLD.creado_en THEN
        RAISE EXCEPTION 'Participantes de conversacion inmutables'
            USING ERRCODE = '42501';
    END IF;

    IF v_uid IS DISTINCT FROM OLD.operador_menor
       AND (
           NEW.vaciado_menor_en IS DISTINCT FROM OLD.vaciado_menor_en
           OR NEW.fijado_menor IS DISTINCT FROM OLD.fijado_menor
       ) THEN
        RAISE EXCEPTION 'Solo el operador menor puede actualizar su estado en la conversacion'
            USING ERRCODE = '42501';
    END IF;

    IF v_uid IS DISTINCT FROM OLD.operador_mayor
       AND (
           NEW.vaciado_mayor_en IS DISTINCT FROM OLD.vaciado_mayor_en
           OR NEW.fijado_mayor IS DISTINCT FROM OLD.fijado_mayor
       ) THEN
        RAISE EXCEPTION 'Solo el operador mayor puede actualizar su estado en la conversacion'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

GRANT UPDATE (ultimo_movimiento_en, vaciado_menor_en, vaciado_mayor_en, fijado_menor, fijado_mayor)
    ON TABLE public.conversaciones_directas TO authenticated;
