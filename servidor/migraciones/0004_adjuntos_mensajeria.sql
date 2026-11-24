-- Bucket privado para adjuntos cifrados de extremo a extremo (E2EE) en mensajeria.
-- Cero cambios a tablas o datos existentes de produccion (inventarios, perfiles, etc.).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mensajeria-sellada',
    'mensajeria-sellada',
    false,
    15728640, -- 15 MB maximo por archivo cifrado
    ARRAY['application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Politicas RLS sobre storage.objects restringidas a participantes de la conversacion
-- Ruta canonica: <conversacion_id>/<mensaje_id>/<indice>
DROP POLICY IF EXISTS "Lectura adjuntos mensajeria sellada" ON storage.objects;
CREATE POLICY "Lectura adjuntos mensajeria sellada"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'mensajeria-sellada'
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

DROP POLICY IF EXISTS "Insercion adjuntos mensajeria sellada" ON storage.objects;
CREATE POLICY "Insercion adjuntos mensajeria sellada"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'mensajeria-sellada'
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

DROP POLICY IF EXISTS "Actualizacion adjuntos mensajeria sellada" ON storage.objects;
CREATE POLICY "Actualizacion adjuntos mensajeria sellada"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'mensajeria-sellada'
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    )
    WITH CHECK (
        bucket_id = 'mensajeria-sellada'
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );

DROP POLICY IF EXISTS "Borrado adjuntos mensajeria sellada" ON storage.objects;
CREATE POLICY "Borrado adjuntos mensajeria sellada"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'mensajeria-sellada'
        AND EXISTS (
            SELECT 1
            FROM public.conversaciones_directas c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND (SELECT auth.uid()) IN (c.operador_menor, c.operador_mayor)
        )
    );
