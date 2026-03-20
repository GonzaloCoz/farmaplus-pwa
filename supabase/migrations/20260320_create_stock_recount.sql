-- Recreate table to change created_by to TEXT and fix RLS policies
DROP TABLE IF EXISTS stock_recount_items;
DROP TABLE IF EXISTS stock_recount_assignments;
DROP TABLE IF EXISTS stock_recount_sessions;

-- Create stock recount sessions table
CREATE TABLE stock_recount_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    access_code TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    created_by TEXT, -- Changed from UUID to TEXT to support custom auth ids
    status TEXT NOT NULL DEFAULT 'waiting', 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    excel_data JSONB
);

-- Create stock recount assignments table
CREATE TABLE stock_recount_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES stock_recount_sessions(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create stock recount items table
CREATE TABLE stock_recount_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES stock_recount_sessions(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES stock_recount_assignments(id) ON DELETE SET NULL,
    ean TEXT NOT NULL,
    product_name TEXT NOT NULL,
    lab TEXT, -- Added new Laboratory column
    system_qty NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    initial_qty NUMERIC NOT NULL DEFAULT 0, -- Added initial count from column N
    counted_qty NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    counted_at TIMESTAMPTZ,
    counted_by TEXT
);

-- Enable RLS
ALTER TABLE stock_recount_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_recount_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_recount_items ENABLE ROW LEVEL SECURITY;

-- Create public RLS policies because users might be logged in via fallback methods (anon)
CREATE POLICY "Allow public select stock_recount_sessions" ON stock_recount_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_recount_sessions" ON stock_recount_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stock_recount_sessions" ON stock_recount_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stock_recount_sessions" ON stock_recount_sessions FOR DELETE USING (true);

CREATE POLICY "Allow public select stock_recount_assignments" ON stock_recount_assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_recount_assignments" ON stock_recount_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stock_recount_assignments" ON stock_recount_assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stock_recount_assignments" ON stock_recount_assignments FOR DELETE USING (true);

CREATE POLICY "Allow public select stock_recount_items" ON stock_recount_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_recount_items" ON stock_recount_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stock_recount_items" ON stock_recount_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stock_recount_items" ON stock_recount_items FOR DELETE USING (true);

-- Ensure Realtime is enabled
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_recount_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_recount_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_recount_items;
