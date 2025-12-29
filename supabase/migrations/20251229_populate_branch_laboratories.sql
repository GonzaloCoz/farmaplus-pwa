-- Populate branch_laboratories from branch_goals and existing inventories
-- This script creates entries for all branch-laboratory combinations
-- and updates with real progress data where inventories exist

-- Step 1: Get all unique branch-laboratory combinations from inventories table
-- This gives us the laboratories that have been used in each branch
INSERT INTO public.branch_laboratories (
    branch_name,
    laboratory,
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
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE i.status = 'controlled') as controlled_items,
    COUNT(*) FILTER (WHERE i.status = 'adjusted') as adjusted_items,
    COUNT(*) FILTER (WHERE i.status = 'pending') as pending_items,
    ROUND(
        (COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted'))::numeric / 
         NULLIF(COUNT(*), 0)::numeric) * 100, 
        1
    ) as progress_percentage,
    SUM(CASE WHEN i.status IN ('controlled', 'adjusted') THEN i.system_quantity ELSE 0 END) as total_system_units,
    SUM(CASE WHEN i.status IN ('controlled', 'adjusted') THEN (i.quantity - i.system_quantity) ELSE 0 END) as net_units,
    SUM(CASE 
        WHEN i.status IN ('controlled', 'adjusted') 
        THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) 
        ELSE 0 
    END) as net_value,
    SUM(CASE 
        WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) < 0
        THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) 
        ELSE 0 
    END) as negative_value,
    SUM(CASE 
        WHEN i.status IN ('controlled', 'adjusted') AND (i.quantity - i.system_quantity) > 0
        THEN (i.quantity - i.system_quantity) * COALESCE(p.cost, 0) 
        ELSE 0 
    END) as positive_value,
    CASE 
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) = COUNT(*) AND COUNT(*) > 0 
        THEN 'completed'
        WHEN COUNT(*) FILTER (WHERE i.status IN ('controlled', 'adjusted')) > 0 
        THEN 'in_progress'
        ELSE 'pending'
    END as status
FROM public.inventories i
LEFT JOIN public.products p ON i.ean = p.ean
WHERE i.laboratory != '_CONFIG_'  -- Exclude config entries
GROUP BY i.branch_name, i.laboratory
ON CONFLICT (branch_name, laboratory) 
DO UPDATE SET
    total_items = EXCLUDED.total_items,
    controlled_items = EXCLUDED.controlled_items,
    adjusted_items = EXCLUDED.adjusted_items,
    pending_items = EXCLUDED.pending_items,
    progress_percentage = EXCLUDED.progress_percentage,
    total_system_units = EXCLUDED.total_system_units,
    net_units = EXCLUDED.net_units,
    net_value = EXCLUDED.net_value,
    negative_value = EXCLUDED.negative_value,
    positive_value = EXCLUDED.positive_value,
    status = EXCLUDED.status,
    last_updated = timezone('utc'::text, now());

-- Step 2: Verify the results
SELECT 
    branch_name,
    COUNT(*) as total_laboratories,
    SUM(total_items) as total_items_across_labs,
    SUM(controlled_items) as total_controlled,
    ROUND(AVG(progress_percentage), 1) as avg_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_labs,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_labs,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_labs
FROM public.branch_laboratories
GROUP BY branch_name
ORDER BY branch_name;
