-- Optimización de rendimiento para consultas frecuentes de inventario
-- Fecha: 2026-01-23
-- Autor: Assistant

-- 1. Índice para búsquedas rápidas en la tabla principal de inventarios
-- Este índice acelera dramáticamente las cargas de:
-- "Dame todos los ítems de la sucursal X, laboratorio Y"
-- "Dame solo los items 'controlados' de la sucursal X"
CREATE INDEX IF NOT EXISTS idx_inventories_lookup 
ON public.inventories (branch_name, laboratory, status);

-- 2. Índice para historial de ajustes
-- Acelera la carga de la pestaña "Historial" en el detalle del inventario
-- Ordena automáticamente por fecha descendente sin costo extra de CPU
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_lookup 
ON public.inventory_adjustments (branch_name, laboratory, created_at DESC);

-- Comentarios explicativos
COMMENT ON INDEX idx_inventories_lookup IS 'Optimiza filtrado por sucursal+laboratorio+estado';
COMMENT ON INDEX idx_inventory_adjustments_lookup IS 'Optimiza carga de historial ordenado por fecha';
