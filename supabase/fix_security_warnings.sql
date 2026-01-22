-- Fix 'Function Search Path Mutable' warnings
-- Security Definer functions should have a fixed search_path to prevent privilege escalation attacks.

-- 1. update_branch_laboratories_timestamp()
ALTER FUNCTION public.update_branch_laboratories_timestamp() SET search_path = public;

-- 2. save_cyclic_inventory(p_branch_name text, p_laboratory text, p_items jsonb)
ALTER FUNCTION public.save_cyclic_inventory(text, text, jsonb) SET search_path = public;

-- 3. get_session_summary(p_session_id UUID)
ALTER FUNCTION public.get_session_summary(uuid) SET search_path = public;

-- 4. get_product_by_ean(p_ean TEXT)
ALTER FUNCTION public.get_product_by_ean(text) SET search_path = public;

-- 5. upsert_precount_item(p_session_id UUID, p_ean TEXT, p_product_name TEXT, p_quantity INTEGER, p_user_id UUID)
ALTER FUNCTION public.upsert_precount_item(uuid, text, text, integer, uuid) SET search_path = public;

-- 6. search_products_optimized(p_query TEXT, p_limit INTEGER)
ALTER FUNCTION public.search_products_optimized(text, integer) SET search_path = public;

-- 7. manage_inventory_event(p_action TEXT, p_id UUID, p_title TEXT, p_branch TEXT, p_sector TEXT, p_date DATE)
ALTER FUNCTION public.manage_inventory_event(text, uuid, text, text, text, date) SET search_path = public;
