-- Secure access to inventory_events (v3 - Idempotent Fix)
-- 1. Cleaning: Drop ALL potential previous policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Allow public access" ON inventory_events;
DROP POLICY IF EXISTS "Public Read Access" ON inventory_events; -- This matches the one causing conflict
DROP POLICY IF EXISTS "Allow all for auth" ON inventory_events;

-- 2. Create the Read-Only policy
CREATE POLICY "Public Read Access"
ON inventory_events
FOR SELECT
TO anon
USING (true);

-- 3. Function/RPC for Secure Writes
DROP FUNCTION IF EXISTS manage_inventory_event; 

CREATE OR REPLACE FUNCTION manage_inventory_event(
    p_action TEXT,
    p_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_branch TEXT DEFAULT NULL,
    p_sector TEXT DEFAULT NULL,
    p_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    IF p_action = 'CREATE' THEN
        INSERT INTO inventory_events (title, branch_name, sector, date)
        VALUES (p_title, p_branch, p_sector, p_date)
        RETURNING id, created_at INTO v_new_id, v_created_at;
        
        RETURN jsonb_build_object(
            'id', v_new_id, 
            'title', p_title, 
            'branch_name', p_branch, 
            'sector', p_sector, 
            'date', p_date,
            'created_at', v_created_at
        );
        
    ELSIF p_action = 'DELETE' THEN
        DELETE FROM inventory_events WHERE id = p_id;
        RETURN jsonb_build_object('status', 'deleted', 'id', p_id);
    END IF;
END;
$$;

-- 4. Grant Permissions
GRANT EXECUTE ON FUNCTION manage_inventory_event TO anon;
GRANT EXECUTE ON FUNCTION manage_inventory_event TO authenticated;
