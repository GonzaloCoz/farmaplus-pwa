-- DIAGNOSTIC: Verificar disparadores en branch_laboratories (FIXED)
DO $$
DECLARE
    tg_list TEXT;
BEGIN
    SELECT string_agg(tgname || ' (' || tgenabled::text || ')', ', ') INTO tg_list
    FROM pg_trigger
    WHERE tgrelid = 'public.branch_laboratories'::regclass
      AND tgisinternal = false;
      
    RAISE EXCEPTION 'Disparadores encontrados: %', COALESCE(tg_list, 'Ninguno');
END $$;
