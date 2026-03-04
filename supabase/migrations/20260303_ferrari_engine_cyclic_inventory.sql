-- ==========================================
-- ARCHITECTURE V2: "Motor Ferrari" para Inventario Cíclico
-- Date: 2026-03-03
-- Purpose: RLS Strict Isolation, Audit logs with plex_id, and atomic Finalize RPC
-- ==========================================

-- 1. STRICT RLS: Carpetas Virtuales por Sucursal
-- Aseguramos que las políticas RLS aíslen de verdad los datos basados en el perfil del usuario.
-- Se asume que el usuario autenticado tiene su sucursal definida en `public.profiles.branch_name` o es admin.

ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores conflictivas si existieran (opcional, pero buena práctica si hacemos rediseño)
DROP POLICY IF EXISTS "Sucursales leen solo sus inventarios" ON public.inventories;
DROP POLICY IF EXISTS "Sucursales modifican solo sus inventarios" ON public.inventories;

-- Políticas para INVENTORIES
CREATE POLICY "RLS_inventories_select" ON public.inventories
    FOR SELECT USING (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "RLS_inventories_insert" ON public.inventories
    FOR INSERT WITH CHECK (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "RLS_inventories_update" ON public.inventories
    FOR UPDATE USING (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "RLS_inventories_delete" ON public.inventories
    FOR DELETE USING (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Políticas para BRANCH_LABORATORIES
DROP POLICY IF EXISTS "Allow public read branch_laboratories" ON public.branch_laboratories;

CREATE POLICY "RLS_branch_laboratories_select" ON public.branch_laboratories
    FOR SELECT USING (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "RLS_branch_laboratories_all" ON public.branch_laboratories
    FOR ALL USING (
        branch_name = (SELECT branch_name FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 2. AUDIT LOGS: Agregar plex_id a los ajustes
-- Modificamos inventory_adjustments para aceptar el plex_id opcional
ALTER TABLE public.inventory_adjustments ADD COLUMN IF NOT EXISTS plex_id TEXT;

-- 3. EL SNAP: RPC para finalizar el inventario de manera atómica
CREATE OR REPLACE FUNCTION finalize_cyclic_inventory(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_plex_id TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_controlled_count INT;
BEGIN
  -- Verificar cuántos ítems hay controlados
  SELECT COUNT(*) INTO v_controlled_count
  FROM public.inventories
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  IF v_controlled_count = 0 THEN
    RAISE EXCEPTION 'No hay artículos controlados para finalizar.';
  END IF;

  -- 1. Registrar evento de auditoría en la tabla (opcional pero recomendado)
  INSERT INTO public.inventory_adjustments (
      branch_name, laboratory, total_adjustments, net_value, notes, created_by, plex_id
  ) VALUES (
      p_branch_name,
      p_laboratory,
      v_controlled_count,
      0, -- El net_value real requeriría sumarizar, lo simplificamos aquí o delegamos a triggers
      'Cierre de recuento desde app. ' || v_controlled_count || ' artículos ajustados.',
      p_user_id,
      p_plex_id
  );

  -- 2. "El Snap": Pasar atómicamente todo lo controlado a ajustado
  UPDATE public.inventories
  SET status = 'adjusted',
      updated_at = NOW()
  WHERE branch_name ILIKE TRIM(p_branch_name)
    AND laboratory ILIKE TRIM(p_laboratory)
    AND status = 'controlled';

  -- 3. Forzar el recálculo realizado en migraciones anteriores
  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finalize_cyclic_inventory TO anon, authenticated;


-- 4. CARGA INTELIGENTE (Ignorar Ajustados viejos)
-- Reemplazamos save_cyclic_inventory_v2 para que haga un "DO NOTHING" o ignore
-- actualizaciones de artículos que ya están en estado 'adjusted'
CREATE OR REPLACE FUNCTION save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
  v_current_status TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- A. Update/Insert Product (Ensuring correct category/laboratory)
    INSERT INTO public.products (ean, name, cost, category, laboratory, id_producto)
    VALUES (
      item->>'ean',
      item->>'name',
      (item->>'cost')::NUMERIC,
      COALESCE(item->>'category', 'Varios'),
      p_laboratory,
      item->>'id_producto'
    )
    ON CONFLICT (ean) DO UPDATE SET
      category = EXCLUDED.category,
      cost = EXCLUDED.cost,
      id_producto = COALESCE(EXCLUDED.id_producto, products.id_producto);

    -- B. Upsert Inventory con chequeo de estado
    -- Primero vemos si ya existe y está 'adjusted'
    SELECT status INTO v_current_status
    FROM public.inventories
    WHERE branch_name = p_branch_name AND laboratory = p_laboratory AND ean = (item->>'ean');

    IF v_current_status = 'adjusted' THEN
        -- Si está ajustado, IGNORAMOS silenciosamente esta línea del Excel. "Protección de Hierro".
        CONTINUE;
    END IF;

    -- Si no está ajustado, hacemos el upsert normal
    INSERT INTO public.inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      was_readjusted,
      category,
      adjustment_id_shortage,
      adjustment_id_surplus,
      updated_at
    )
    VALUES (
      p_branch_name,
      p_laboratory,
      item->>'ean',
      (item->>'countedQuantity')::INTEGER,
      (item->>'systemQuantity')::INTEGER,
      item->>'status',
      COALESCE((item->>'wasReadjusted')::BOOLEAN, FALSE),
      COALESCE(item->>'category', 'Varios'),
      item->>'shortageId',
      item->>'surplusId',
      NOW()
    )
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status,
      was_readjusted = EXCLUDED.was_readjusted,
      category = EXCLUDED.category,
      adjustment_id_shortage = EXCLUDED.adjustment_id_shortage,
      adjustment_id_surplus = EXCLUDED.adjustment_id_surplus,
      updated_at = NOW();
      
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
