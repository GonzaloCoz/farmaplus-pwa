CREATE OR REPLACE FUNCTION public.temp_get_all_ledgers()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(l)) INTO v_result
  FROM (
    SELECT id, folio, branch_name, laboratory, category, total_items_adjusted, created_at, user_name
    FROM public.inventory_ledger
    ORDER BY created_at DESC
    LIMIT 20
  ) l;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.temp_get_all_ledgers() TO anon, authenticated, service_role;
