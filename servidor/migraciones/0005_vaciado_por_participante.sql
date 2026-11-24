-- Corte de vaciado individual por participante en conversaciones directas.
-- Permite que un operador vacie/oculte su historial sin afectar al otro participante ni borrar mensajes en BD.

ALTER TABLE public.conversaciones_directas
    ADD COLUMN IF NOT EXISTS vaciado_menor_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vaciado_mayor_en TIMESTAMPTZ;

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
       AND NEW.vaciado_menor_en IS DISTINCT FROM OLD.vaciado_menor_en THEN
        RAISE EXCEPTION 'Solo el operador menor puede actualizar su marca de vaciado'
            USING ERRCODE = '42501';
    END IF;

    IF v_uid IS DISTINCT FROM OLD.operador_mayor
       AND NEW.vaciado_mayor_en IS DISTINCT FROM OLD.vaciado_mayor_en THEN
        RAISE EXCEPTION 'Solo el operador mayor puede actualizar su marca de vaciado'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_actualizacion_conv_directa ON public.conversaciones_directas;
CREATE TRIGGER trg_validar_actualizacion_conv_directa
    BEFORE UPDATE ON public.conversaciones_directas
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_actualizacion_conv_directa();

GRANT UPDATE (ultimo_movimiento_en, vaciado_menor_en, vaciado_mayor_en)
    ON TABLE public.conversaciones_directas TO authenticated;

DROP POLICY IF EXISTS rls_conv_directas_actualizacion ON public.conversaciones_directas;
CREATE POLICY rls_conv_directas_actualizacion ON public.conversaciones_directas
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) IN (operador_menor, operador_mayor))
    WITH CHECK ((SELECT auth.uid()) IN (operador_menor, operador_mayor));
