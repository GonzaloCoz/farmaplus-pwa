CREATE OR REPLACE FUNCTION public.temp_get_all_ledgers()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(l)) INTO v_result
  FROM (
    SELECT id, folio, branch_name, laboratory, category, total_items_adjusted, created_at, user_name, total_counted_items, total_shortage_value, total_surplus_value
    FROM public.inventory_ledger
    ORDER BY created_at DESC
    LIMIT 20
  ) l;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.temp_get_ledger_items(p_ledger_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(li)) INTO v_result
  FROM public.inventory_ledger_items li
  WHERE li.ledger_id = p_ledger_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.temp_get_all_ledgers() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.temp_get_ledger_items(UUID) TO anon, authenticated, service_role;
