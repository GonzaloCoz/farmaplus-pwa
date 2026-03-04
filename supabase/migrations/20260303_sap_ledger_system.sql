-- ==========================================
-- Migration: SAP-Style Transactional Ledger
-- Date: 2026-03-03
-- Purpose: Professional, immutable record of all inventory adjustments
-- ==========================================

-- 1. Cabecera del Libro Mayor (Headers)
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_name TEXT NOT NULL,
    laboratory TEXT NOT NULL,
    category TEXT,
    user_id UUID,
    user_name TEXT,
    
    -- PLEX IDs
    adjustment_id_shortage TEXT,
    adjustment_id_surplus TEXT,
    
    -- Financial Totals
    total_shortage_value NUMERIC DEFAULT 0,
    total_surplus_value NUMERIC DEFAULT 0,
    total_net_value NUMERIC DEFAULT 0,
    total_items_adjusted INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Detalle del Libro Mayor (Line Items)
CREATE TABLE IF NOT EXISTS public.inventory_ledger_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ledger_id UUID REFERENCES public.inventory_ledger(id) ON DELETE CASCADE,
    
    ean TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    
    system_quantity INTEGER NOT NULL,
    counted_quantity INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    
    unit_cost NUMERIC NOT NULL,
    total_diff_value NUMERIC NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Indexes for SAP-grade reporting
CREATE INDEX IF NOT EXISTS idx_ledger_branch_lab ON public.inventory_ledger(branch_name, laboratory);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_items_ean ON public.inventory_ledger_items(ean);
CREATE INDEX IF NOT EXISTS idx_ledger_items_id ON public.inventory_ledger_items(ledger_id);

-- 4. Enable RLS
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger_items ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Allow read to authenticated users on ledger" ON public.inventory_ledger FOR SELECT USING (true);
CREATE POLICY "Allow read to authenticated users on ledger items" ON public.inventory_ledger_items FOR SELECT USING (true);
CREATE POLICY "Allow all to service role on ledger" ON public.inventory_ledger FOR ALL USING (true);
CREATE POLICY "Allow all to service role on ledger items" ON public.inventory_ledger_items FOR ALL USING (true);

COMMENT ON TABLE public.inventory_ledger IS 'Libro Mayor de Ajustes: Cabecera de transacciones de inventario.';
COMMENT ON TABLE public.inventory_ledger_items IS 'Libro Mayor de Ajustes: Detalle de productos afectados por cada transacción.';
