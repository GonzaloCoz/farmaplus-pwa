-- FORCE REBUILD OF BRANCH LABORATORIES
-- This script will:
-- 1. Ensure the Unique Constraint exists (in case the previous script failed or wasn't run)
-- 2. Truncate (Clear) the metadata table to remove incorrect merged rows
-- 3. Re-calculate and Insert stats for every Branch+Laboratoy+Category found in 'inventories'

-- PART 1: Schema Safety Check (Repeated from previous step)
ALTER TABLE branch_laboratories ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_branch_name_laboratory_key;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS branch_laboratories_branch_lab_cat_idx ON branch_laboratories (branch_name, laboratory, category);
-- Ensure it accepts the constraint as unique
ALTER TABLE branch_laboratories ADD CONSTRAINT branch_laboratories_branch_lab_cat_unique UNIQUE USING INDEX branch_laboratories_branch_lab_cat_idx;


-- PART 2: Clean Slate
TRUNCATE TABLE branch_laboratories;


-- PART 3: Rebuild from Inventories (The Single Source of Truth)
-- We join with PRODUCTS to get the Cost and Category (if inventory snapshot is missing it)
INSERT INTO branch_laboratories (
    branch_name,
    laboratory,
    category,
    total_items,
    controlled_items,
    adjusted_items,
    pending_items,
    progress_percentage,
    total_system_units,
    net_units,
    net_value,
    negative_value,
    positive_value,
    status
)
SELECT
    i.branch_name,
    i.laboratory,
    COALESCE(p.category, 'Varios') as category,
    
    -- Counts
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE i.status = 'controlled') as controlled_items,
    COUNT(*) FILTER (WHERE i.status = 'adjusted') as adjusted_items,
    COUNT(*) FILTER (WHERE i.status = 'pending') as pending_items,
    
    -- Progress % (Controlled + Adjusted) / Total
    ROUND((COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted'))::decimal / COUNT(*)::decimal) * 100, 1) as progress_percentage,
    
    -- Units
    SUM(i.system_quantity) as total_system_units,
    SUM(i.quantity - i.system_quantity) as net_units,
    
    -- Financials (Using Product Cost)
    SUM((i.quantity - i.system_quantity) * COALESCE(p.cost, 0)) as net_value,
    SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as negative_value,
    SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as positive_value,
    
    -- Overall Status
    CASE 
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) = COUNT(*) THEN 'completed'
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) > 0 THEN 'in_progress'
        ELSE 'pending'
    END as status

FROM inventories i
LEFT JOIN products p ON i.ean = p.ean
WHERE i.branch_name IS NOT NULL AND i.laboratory IS NOT NULL
GROUP BY i.branch_name, i.laboratory, COALESCE(p.category, 'Varios');
