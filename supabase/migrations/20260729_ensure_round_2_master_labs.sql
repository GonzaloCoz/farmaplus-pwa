-- Migration: Ensure all master laboratories from round 1 exist in branch_laboratories for round 2
-- Date: 2026-07-29
-- GUARANTEE: NO INVENTORY DATA OR USER COUNTS ARE DELETED. ONLY CREATES MISSING PENDING METADATA ROWS FOR ROUND 2.

-- 1. Insert missing laboratories from round 1 into round 2 as pending
INSERT INTO public.branch_laboratories (
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
    status,
    round,
    created_at,
    last_updated
)
SELECT 
    bl.branch_name,
    bl.laboratory,
    bl.category,
    bl.total_items,
    0, -- controlled_items
    0, -- adjusted_items
    bl.total_items, -- pending_items
    0, -- progress_percentage
    0, 0, 0, 0, 0,
    'pending'::TEXT,
    2, -- round 2
    NOW(),
    NOW()
FROM public.branch_laboratories bl
WHERE bl.round = 1
ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(category)), round) DO NOTHING;

-- 2. Recompute progress for any labs that have inventory records in round 2
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT DISTINCT branch_name, laboratory, round 
        FROM public.inventories 
        WHERE laboratory != '_CONFIG_' AND round = 2
    LOOP
        PERFORM public.recompute_lab_progress(r.branch_name, r.laboratory, r.round);
    END LOOP;
END;
$$;
