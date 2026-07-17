-- SQL Script: Sembrar artículos de ayuda adicionales en public.help_articles
-- Copiá y pegá este script en el SQL Editor de tu Supabase (supabase.halu.com.ar) para entrenar al Asistente de IA.

INSERT INTO public.help_articles (title, content, category, keywords, suggested_action)
VALUES 
(
    'Impersonación y Cambio de Sucursal', 
    'Los administradores y moderadores pueden simular o "impersonar" cualquier sucursal del sistema para auditar su estado actual. Para hacerlo, simplemente ve al Dashboard y haz clic sobre la fila de la sucursal que quieras inspeccionar. Para salir de la simulación y regresar a la vista global ("Casa Central"), haz clic nuevamente sobre la misma fila de la sucursal seleccionada.', 
    'administracion', 
    ARRAY['impersonar', 'simular', 'sucursal', 'cambiar', 'alternar', 'casa central', 'global', 'perfil'], 
    '{"label": "Ir al Dashboard", "route": "/", "type": "navigate"}'::jsonb
),
(
    'Actualizaciones del Sistema y PWA', 
    'La aplicación se actualiza de forma automática en segundo plano mediante tecnología PWA. Cuando hay una nueva versión disponible, el sistema limpia la caché y muestra una notificación silenciosa con la opción "Ver novedades". En Configuración -> Sistema, los administradores pueden forzar una actualización para todas las sucursales o utilizar el botón de simulación para probar el flujo del actualizador sin riesgo.', 
    'sistema', 
    ARRAY['actualizar', 'actualizacion', 'version', 'novedades', 'pwa', 'sileo', 'probar', 'forzar'], 
    '{"label": "Ir a Configuración", "route": "/settings", "type": "navigate"}'::jsonb
),
(
    'Importación de Laboratorios desde Excel', 
    'Para dar de alta o actualizar laboratorios de forma masiva, los administradores pueden subir un archivo Excel (.xlsx o .csv). El procedimiento es: 1. Ir a Configuración -> Panel de Administración. 2. Seleccionar la sucursal de destino en el menú desplegable. 3. Subir el archivo Excel con las columnas correspondientes (EAN, Nombre, Laboratorio, etc.) usando el botón de importación.', 
    'administracion', 
    ARRAY['importar', 'cargar', 'excel', 'subir', 'laboratorios', 'productos', 'xlsx', 'csv'], 
    '{"label": "Ir a Configuración", "route": "/settings", "type": "navigate"}'::jsonb
),
(
    'Colores y Estados de Inventarios Cíclicos', 
    'En el listado de inventarios cíclicos, los laboratorios se agrupan visualmente por estados representados con colores:\n- Gris (Pendientes): Laboratorios que aún no se han empezado a contar.\n- Amarillo (En Progreso): Laboratorios donde se iniciaron conteos pero no han sido finalizados ni ajustados.\n- Verde (Completados): Laboratorios cuyos conteos fueron auditados, cerrados y el stock ajustado correctamente.', 
    'inventario', 
    ARRAY['color', 'colores', 'estado', 'estados', 'gris', 'amarillo', 'verde', 'progreso', 'pendiente', 'completado'], 
    '{"label": "Ir a Inventarios", "route": "/cyclic-inventory", "type": "navigate"}'::jsonb
)
ON CONFLICT (title) DO UPDATE 
SET content = EXCLUDED.content,
    category = EXCLUDED.category,
    keywords = EXCLUDED.keywords,
    suggested_action = EXCLUDED.suggested_action;
