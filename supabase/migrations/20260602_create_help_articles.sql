-- Migration: Create Help Articles Table and Search Functionality
-- Description: Estructura de base de conocimiento (RAG) para el chat de IA, permitiendo buscar artículos de ayuda dinámicamente.

-- 1. Crear tabla de artículos de ayuda
CREATE TABLE IF NOT EXISTS public.help_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}'::TEXT[],
    suggested_action JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- 3. Crear política de lectura para usuarios autenticados
CREATE POLICY "Enable read access for all authenticated users" ON public.help_articles
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Crear función de búsqueda difusa por palabras clave y coincidencias de texto
CREATE OR REPLACE FUNCTION public.search_help_articles(p_query TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    suggested_action JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id, h.title, h.content, h.category, h.suggested_action
    FROM public.help_articles h
    WHERE 
        -- Coincidencia por palabras clave (intersección de arrays)
        h.keywords && ARRAY(
            SELECT LOWER(word) 
            FROM regexp_split_to_table(p_query, '\s+') AS word 
            WHERE length(word) > 2
        )
        -- O coincidencia parcial de texto en título o contenido
        OR EXISTS (
            SELECT 1 
            FROM regexp_split_to_table(p_query, '\s+') AS word 
            WHERE length(word) > 2 
              AND (LOWER(h.title) LIKE '%' || LOWER(word) || '%' OR LOWER(h.content) LIKE '%' || LOWER(word) || '%')
        )
    LIMIT 3;
END;
$$;

-- 5. Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.search_help_articles TO authenticated;

-- 6. Sembrar (seed) artículos de ayuda iniciales
INSERT INTO public.help_articles (title, content, category, keywords, suggested_action)
VALUES 
(
    'Cómo realizar un Inventario Cíclico', 
    'El inventario cíclico consiste en controlar periódicamente el stock físico contra el sistema, organizado por laboratorios. El proceso a seguir es:\n1. Realizar el conteo físico de los productos en las góndolas/cajoneras.\n2. Cargar las cantidades contadas en la aplicación en el laboratorio correspondiente.\n3. Revisar la pantalla de Diferencias de Stock.\n4. Si hay discrepancias, hacer un re-control físico.\n5. Una vez confirmado, presionar "Finalizar Laboratorio" para que se genere el ajuste en el sistema.', 
    'inventario', 
    ARRAY['inventario', 'ciclico', 'laboratorio', 'conteo', 'finalizar', 'ajuste'], 
    '{"label": "Ir a Inventario Cíclico", "route": "/cyclic-inventory", "type": "navigate"}'::jsonb
),
(
    'Cómo controlar fechas de Vencimiento', 
    'El control de vencimientos sirve para registrar lotes y fechas de caducidad de los productos. Contamos con un semáforo visual:\n- Rojo: Productos que vencen en menos de 3 meses. Deben ser retirados o puestos en promoción.\n- Amarillo: Productos que vencen en un rango de 3 a 6 meses.\n- Verde: Productos con vencimiento superior a 6 meses.\nPara registrar vencimientos, ingresá a la sección correspondiente, seleccioná el sector, cargá el EAN, lote y fecha de vencimiento.', 
    'vencimiento', 
    ARRAY['vence', 'vencimiento', 'vencimientos', 'lote', 'lotes', 'semaforo', 'caducidad', 'rojo', 'amarillo'], 
    '{"label": "Ir a Vencimientos", "route": "/stock/expiration-control", "type": "navigate"}'::jsonb
),
(
    'Auditoría y Diferencias de Stock', 
    'Las diferencias de stock muestran la brecha entre la cantidad teórica en sistema y la cantidad física contada. Las diferencias pueden ser:\n- Faltantes (valores negativos): se detectaron menos unidades físicamente de las que indica el sistema.\n- Sobrantes (valores positivos): se detectaron más unidades físicamente.\nAntes de finalizar un laboratorio, es obligatorio auditar y re-controlar físicamente las diferencias grandes para evitar ajustes erróneos.', 
    'inventario', 
    ARRAY['diferencia', 'diferencias', 'sobrante', 'faltante', 'auditoria', 'desvio', 'desvios'], 
    '{"label": "Ver Reportes", "route": "/reports", "type": "navigate"}'::jsonb
),
(
    'Soporte Técnico y Reportes de Error', 
    'Si encontrás algún problema técnico con la aplicación, discrepancias que no coinciden tras múltiples re-controles, o necesitas ayuda del equipo central de inventarios, podés enviar una alerta directa por Microsoft Teams.\nEl mensaje debe indicar la sucursal, el laboratorio afectado y una breve descripción del problema.', 
    'soporte', 
    ARRAY['soporte', 'ayuda', 'error', 'falla', 'problema', 'teams', 'alerta', 'asistencia'], 
    '{"label": "Reportar a Soporte", "target": "Hola, necesito asistencia técnica con el sistema.", "type": "teams"}'::jsonb
)
ON CONFLICT (title) DO UPDATE 
SET content = EXCLUDED.content,
    category = EXCLUDED.category,
    keywords = EXCLUDED.keywords,
    suggested_action = EXCLUDED.suggested_action;
