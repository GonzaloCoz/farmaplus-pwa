-- Migration: Add reset_category_round RPC
-- Date: 2026-07-13
-- Purpose: Initialize a new round for a specific category in a branch, resetting its laboratory progress.

DROP FUNCTION IF EXISTS public.reset_category_round(TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.reset_category_round(TEXT, TEXT, TEXT, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.reset_category_round(
  p_branch_name TEXT,
  p_category TEXT,
  p_next_round INTEGER
) RETURNS VOID AS $$
DECLARE
  v_branch TEXT := normalize_string_sql(p_branch_name);
  v_category TEXT := UPPER(TRIM(p_category));
  v_ean_key TEXT := 'CONFIG_ROUND_' || v_category;
BEGIN
  -- 1. Ensure CONFIG_ROUND product exists
  INSERT INTO public.products (ean, name, category, laboratory, cost)
  VALUES (v_ean_key, 'Configuración: Vuelta ' || p_category, 'SISTEMA', '_CONFIG_', 0)
  ON CONFLICT (ean) DO NOTHING;

  -- 2. Upsert config round value in inventories (always round 1 for configuration rows)
  INSERT INTO public.inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      category,
      round,
      updated_at
  )
  VALUES (
      v_branch, 
      '_CONFIG_', 
      v_ean_key, 
      p_next_round, 
      0, 
      'pending', 
      'SISTEMA',
      1,
      NOW()
  )
  ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(ean)), round) 
  DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      updated_at = NOW();

  -- 3. Copy laboratory layout from the previous round, resetting metrics to zero
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
      branch_name,
      laboratory,
      category,
      total_items,
      0, -- Reset controlled_items
      0, -- Reset adjusted_items
      total_items, -- Reset pending_items
      0, -- Reset progress
      0, -- Reset total_system_units
      0, -- Reset net_units
      0, -- Reset net_value
      0, -- Reset negative_value
      0, -- Reset positive_value
      'pending'::TEXT,
      p_next_round,
      NOW(),
      NOW()
  FROM public.branch_laboratories
  WHERE normalize_string_sql(branch_name) = v_branch
    AND normalize_string_sql(category) = v_category
    AND round = p_next_round - 1
  ON CONFLICT (LOWER(TRIM(branch_name)), LOWER(TRIM(laboratory)), LOWER(TRIM(category)), round) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.reset_category_round(TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
