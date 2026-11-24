-- Habilita la anulacion (borrado) de mensajes propios en conversaciones directas y grupos.
-- Cero cambios a tablas o datos existentes de produccion.

GRANT DELETE ON TABLE public.mensajes_directos TO authenticated;
GRANT DELETE ON TABLE public.mensajes_grupo TO authenticated;

DROP POLICY IF EXISTS rls_mensajes_directos_borrado ON public.mensajes_directos;
CREATE POLICY rls_mensajes_directos_borrado ON public.mensajes_directos
    FOR DELETE TO authenticated
    USING (
        remitente_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id = conversacion_id
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

DROP POLICY IF EXISTS rls_mensajes_grupo_borrado ON public.mensajes_grupo;
CREATE POLICY rls_mensajes_grupo_borrado ON public.mensajes_grupo
    FOR DELETE TO authenticated
    USING (
        remitente_id = (SELECT auth.uid())
        AND public.es_miembro_grupo_mensajeria(grupo_id)
    );
