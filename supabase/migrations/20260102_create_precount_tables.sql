-- Create precount_sessions table
CREATE TABLE IF NOT EXISTS precount_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed'
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id), -- Creator
    branch_id UUID REFERENCES branches(id), -- Optional link to branch
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create precount_items table
CREATE TABLE IF NOT EXISTS precount_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES precount_sessions(id) ON DELETE CASCADE,
    ean TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    scanned_at TIMESTAMPTZ DEFAULT now(),
    scanned_by UUID REFERENCES auth.users(id) -- Who scanned it
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE precount_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE precount_items;

-- RLS Policies (Simple loose policies for now to ensure functionality)
ALTER TABLE precount_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE precount_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to do everything (adjust as needed for production)
CREATE POLICY "Enable all access for authenticated users" ON precount_sessions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON precount_items
    FOR ALL USING (auth.role() = 'authenticated');
