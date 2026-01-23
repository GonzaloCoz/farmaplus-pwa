-- ==========================================
-- PROFESSIONAL FIX: CATEGORY ISOLATION & RESIDUE CLEARING
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. ADD CATEGORY TO INVENTORIES TABLE
-- Storing category directly in inventories allows for independent category management and better performance
ALTER TABLE public.inventories ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. POPULATE EXISTING CATEGORIES
-- Join with products to fill the new column for old data
UPDATE public.inventories i
SET category = p.category
FROM public.products p
WHERE i.ean = p.ean AND i.category IS NULL;

-- Default to 'Varios' if still null
UPDATE public.inventories SET category = 'Varios' WHERE category IS NULL;

-- 3. ENSURE CONFLICT CONSTRAINT (If not present)
-- We need a reliable constraint for the upsert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventories_branch_lab_ean_unique') THEN
        ALTER TABLE public.inventories ADD CONSTRAINT inventories_branch_lab_ean_unique UNIQUE (branch_name, laboratory, ean);
    END IF;
END $$;

-- 4. RPC: CLEAR PENDING RESIDUE
-- Deletes 'pending' items for specific categories to avoid "ghosts" from previous uploads
CREATE OR REPLACE FUNCTION clear_lab_pending_residue(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_categories TEXT[]
) RETURNS VOID AS $$
BEGIN
  DELETE FROM public.inventories
  WHERE branch_name = p_branch_name
    AND laboratory = p_laboratory
    AND status = 'pending'
    AND (category = ANY(p_categories) OR category IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: IMPROVED SAVE CYCLIC INVENTORY
-- Now handles the category column and ensures product metadata is updated if it changed
CREATE OR REPLACE FUNCTION save_cyclic_inventory_v2(
  p_branch_name TEXT,
  p_laboratory TEXT,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- A. Update/Insert Product (Ensuring correct category/laboratory)
    INSERT INTO public.products (ean, name, cost, category, laboratory)
    VALUES (
      item->>'ean',
      item->>'name',
      (item->>'cost')::NUMERIC,
      COALESCE(item->>'category', 'Varios'),
      p_laboratory
    )
    ON CONFLICT (ean) DO UPDATE SET
      category = EXCLUDED.category, -- Update category if it changed in the Excel
      cost = EXCLUDED.cost;         -- Update cost to match newest Excel

    -- B. Upsert Inventory
    INSERT INTO public.inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      was_readjusted,
      category, -- NEW: Store category here too
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
      NOW()
    )
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      system_quantity = EXCLUDED.system_quantity,
      status = EXCLUDED.status,
      was_readjusted = EXCLUDED.was_readjusted,
      category = EXCLUDED.category,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PERMISSIONS
GRANT EXECUTE ON FUNCTION clear_lab_pending_residue TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_cyclic_inventory_v2 TO anon, authenticated;
