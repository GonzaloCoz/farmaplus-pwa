-- FORCE REBUILD OF BRANCH LABORATORIES (V3 - ROBUST FIX)
-- Use CASCADE to ensure indices are removed with constraints
-- Targets the specific constraint name reported in the error

-- 1. CLEANUP: Drop ALL possible constraints with CASCADE
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_branch_lab_cat_idx CASCADE;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_branch_lab_cat_unique CASCADE;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_branch_name_laboratory_key CASCADE;
ALTER TABLE branch_laboratories DROP CONSTRAINT IF EXISTS branch_laboratories_pkey CASCADE;

-- 2. SETUP: Ensure Schema is correct
ALTER TABLE branch_laboratories ADD COLUMN IF NOT EXISTS category text;

-- 3. CONSTRAINT: Create the Unique Constraint fresh
-- This will be the ONE and ONLY constraint we use going forward.
ALTER TABLE branch_laboratories 
ADD CONSTRAINT branch_laboratories_unique_key 
UNIQUE (branch_name, laboratory, category);

-- 4. DATA CLEANUP: Clear corrupt/merged data
TRUNCATE TABLE branch_laboratories;

-- 5. REBUILD: Re-calculate stats from 'inventories'
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
    
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE i.status = 'controlled') as controlled_items,
    COUNT(*) FILTER (WHERE i.status = 'adjusted') as adjusted_items,
    COUNT(*) FILTER (WHERE i.status = 'pending') as pending_items,
    
    ROUND((COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted'))::decimal / COUNT(*)::decimal) * 100, 1) as progress_percentage,
    
    SUM(i.system_quantity) as total_system_units,
    SUM(i.quantity - i.system_quantity) as net_units,
    
    SUM((i.quantity - i.system_quantity) * COALESCE(p.cost, 0)) as net_value,
    SUM(CASE WHEN (i.quantity - i.system_quantity) < 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as negative_value,
    SUM(CASE WHEN (i.quantity - i.system_quantity) > 0 THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) ELSE 0 END) as positive_value,
    
    CASE 
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) = COUNT(*) THEN 'completed'
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) > 0 THEN 'in_progress'
        ELSE 'pending'
    END as status

FROM inventories i
LEFT JOIN products p ON i.ean = p.ean
WHERE i.branch_name IS NOT NULL AND i.laboratory IS NOT NULL
GROUP BY i.branch_name, i.laboratory, COALESCE(p.category, 'Varios');
