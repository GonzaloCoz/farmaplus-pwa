
-- ==========================================
-- Migration: Hardened "Ferrari" Architecture & Isolation
-- Date: 2026-03-25
-- Purpose: 
--  1. Safe Normalization (Merging duplicates instead of error 23505)
--  2. Strict "Folder-like" RLS Isolation
--  3. High-performance indexed RPCs
--  4. [NEW] scan_events for 24h system tracking
-- ==========================================

-- 0. SAFE MERGER: Resolve unique constraint conflicts before normalizing
DO $$ 
BEGIN
    -- Eliminar ítems duplicados en inventories (mismo EAN en misma sucursal/lab con distinto case)
    -- Nos quedamos con el que tenga el updated_at más reciente.
    DELETE FROM public.inventories i
    WHERE i.id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY normalize_string_sql(branch_name), normalize_string_sql(laboratory), ean 
                       ORDER BY updated_at DESC
                   ) as rn
            FROM public.inventories
        ) t
        WHERE t.rn > 1
    );

    -- Ahora que no hay duplicados lógicos, normalizamos los nombres físicamente
    UPDATE public.inventories SET 
      branch_name = normalize_string_sql(branch_name),
      laboratory = normalize_string_sql(laboratory);

    UPDATE public.branch_laboratories SET 
      branch_name = normalize_string_sql(branch_name),
      laboratory = normalize_string_sql(laboratory);

    UPDATE public.inventory_ledger SET 
      branch_name = normalize_string_sql(branch_name),
      laboratory = normalize_string_sql(laboratory);

EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Error during normalization merger: %', SQLERRM;
END $$;

-- 1. [NEW] scan_events Table (For 24h system tracking)
CREATE TABLE IF NOT EXISTS public.scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    ean TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context JSONB DEFAULT '{}'::jsonb
);

-- Index for scan_events (Performance)
CREATE INDEX IF NOT EXISTS idx_scan_events_lookup 
ON public.scan_events (branch_name, laboratory, scanned_at DESC);

-- RLS for scan_events
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RLS_scan_events_isolation" ON public.scan_events;
CREATE POLICY "RLS_scan_events_isolation" ON public.scan_events
    FOR ALL USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 2. HARDENED ISOLATION (Strict RLS for all layers)
-- Ensure inventory_ledger is strictly isolated
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RLS_ledger_select_isolation" ON public.inventory_ledger;
CREATE POLICY "RLS_ledger_select_isolation" ON public.inventory_ledger
    FOR SELECT USING (
        normalize_string_sql(branch_name) = (SELECT normalize_string_sql(branch_name) FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. OPTIMIZED RPCs (Redefined with strict indexing)

-- get_lab_inventory_v2: Index-driven retrieval
CREATE OR REPLACE FUNCTION get_lab_inventory_v2(
    p_branch_name TEXT,
    p_laboratory TEXT
) RETURNS TABLE (
    id UUID, ean TEXT, quantity INTEGER, system_quantity INTEGER,
    status TEXT, was_readjusted BOOLEAN, readjustment_reason TEXT,
    category TEXT, adjustment_id_shortage TEXT, adjustment_id_surplus TEXT,
    updated_at TIMESTAMP WITH TIME ZONE, product_name TEXT,
    product_cost NUMERIC, product_category TEXT
) AS $$
DECLARE
    v_branch TEXT := normalize_string_sql(p_branch_name);
    v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
    RETURN QUERY
    SELECT 
        i.id, i.ean, i.quantity, i.system_quantity, i.status::TEXT,
        i.was_readjusted, i.readjustment_reason, i.category,
        i.adjustment_id_shortage, i.adjustment_id_surplus, i.updated_at,
        p.name, p.cost, p.category
    FROM public.inventories i
    JOIN public.products p ON i.ean = p.ean
    WHERE i.branch_name = v_branch AND i.laboratory = v_lab
    ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- finalize_cyclic_inventory: Atomic snap (Optimized)
CREATE OR REPLACE FUNCTION finalize_cyclic_inventory(
  p_branch_name TEXT, p_laboratory TEXT, p_plex_id TEXT, p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
BEGIN
  UPDATE public.inventories
  SET status = 'adjusted', updated_at = NOW()
  WHERE branch_name = v_branch AND laboratory = v_lab AND status = 'controlled';

  PERFORM recompute_lab_progress(p_branch_name, p_laboratory);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- recompute_lab_progress: Mass Update (High Speed)
CREATE OR REPLACE FUNCTION recompute_lab_progress(
  p_branch_name TEXT, p_laboratory TEXT
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_lab TEXT := normalize_string_sql(p_laboratory);
  v_total_global INTEGER;
  v_processed_global INTEGER;
  v_progress_global NUMERIC;
BEGIN
  -- 1. Aggregates (Indexed)
  SELECT COUNT(*), COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END)
  INTO v_total_global, v_processed_global
  FROM public.inventories WHERE branch_name = v_branch AND laboratory = v_lab;

  v_progress_global := CASE WHEN v_total_global > 0 THEN LEAST(100, ROUND((v_processed_global::NUMERIC / v_total_global) * 100, 1)) ELSE 0 END;

  -- 2. Mass Update by Category
  UPDATE public.branch_laboratories bl
  SET
    total_items = COALESCE(s.total, 0),
    controlled_items = COALESCE(s.processed, 0),
    progress_percentage = v_progress_global,
    status = CASE WHEN v_progress_global >= 100 THEN 'completed' WHEN v_progress_global > 0 THEN 'in_progress' ELSE 'pending' END,
    negative_units = COALESCE(s.neg_units, 0), positive_units = COALESCE(s.pos_units, 0),
    negative_value = COALESCE(s.neg_val, 0), positive_value = COALESCE(s.pos_val, 0),
    net_units = COALESCE(s.neg_units, 0) + COALESCE(s.pos_units, 0),
    net_value = COALESCE(s.neg_val, 0) + COALESCE(s.pos_val, 0)
  FROM (
      SELECT 
        bl_sub.category as target_cat, i_stats.*
      FROM public.branch_laboratories bl_sub
      LEFT JOIN (
          SELECT normalize_string_sql(i.category) as cat, COUNT(*) as total,
            COUNT(CASE WHEN status IN ('controlled', 'adjusted') THEN 1 END) as processed,
            SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as neg_units,
            SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) ELSE 0 END) as pos_units,
            SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as neg_val,
            SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as pos_val
          FROM public.inventories i
          LEFT JOIN public.products p ON i.ean = p.ean
          WHERE i.branch_name = v_branch AND i.laboratory = v_lab
          GROUP BY normalize_string_sql(i.category)
      ) i_stats ON (normalize_string_sql(bl_sub.category) = i_stats.cat OR (normalize_string_sql(bl_sub.category) IN ('VARIOS', 'VARIOUS') AND (i_stats.cat = 'VARIOS' OR i_stats.cat IS NULL)))
      WHERE bl_sub.branch_name = v_branch AND bl_sub.laboratory = v_lab
  ) s
  WHERE bl.branch_name = v_branch AND bl.laboratory = v_lab AND normalize_string_sql(bl.category) = s.target_cat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. STRATEGIC INDEXES
CREATE INDEX IF NOT EXISTS idx_inventories_lookup_v2 ON public.inventories (branch_name, laboratory, ean);
CREATE INDEX IF NOT EXISTS idx_ledger_lookup_v2 ON public.inventory_ledger (branch_name, laboratory, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_labs_lookup_v2 ON public.branch_laboratories (branch_name, laboratory);
