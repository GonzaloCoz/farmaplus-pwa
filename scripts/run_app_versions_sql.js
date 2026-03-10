
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sql = `
-- Create the app_versions table
CREATE TABLE IF NOT EXISTS public.app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL UNIQUE,
    release_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    published_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comments for documentation
COMMENT ON TABLE public.app_versions IS 'Stores application version history and controls the active version forced on clients.';

-- RLS Policies
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Everyone can read versions
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_versions' AND policyname = 'Anyone can view app versions'
    ) THEN
        CREATE POLICY "Anyone can view app versions" 
        ON public.app_versions FOR SELECT 
        USING (true);
    END IF;
END $$;

-- Only authenticated users (admins) can insert/update (we will rely on App-level role checking, but require auth at DB level)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_versions' AND policyname = 'Authenticated users can manage app versions'
    ) THEN
        CREATE POLICY "Authenticated users can manage app versions" 
        ON public.app_versions FOR ALL 
        USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create a function to ensure only ONE version is active at a time
CREATE OR REPLACE FUNCTION public.ensure_single_active_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        -- Set all other versions to inactive
        UPDATE public.app_versions 
        SET is_active = false 
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce single active version
DROP TRIGGER IF EXISTS trg_single_active_version ON public.app_versions;
CREATE TRIGGER trg_single_active_version
BEFORE INSERT OR UPDATE ON public.app_versions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_version();

-- Enable Realtime for the table so clients can listen for new active versions
DO $$ BEGIN
    -- Add to supabase_realtime publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_versions;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`;

async function runMigration() {
    console.log("Executing SQL directly via Supabase RPC...");
    // Note: supabase-js doesn't allow raw SQL execution natively. 
    // Wait, I should just use the REST API table creation bypass or a tool if available, 
    // actually, let's create a Postgres client script instead since supabase-js does not support arbitrary SQL queries.
}

runMigration();
