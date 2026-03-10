-- ========================================================
-- FEATURE: App Versioning & Forced Updates
-- Description: Creates the system to force client updates
-- Date: 2026-03-09
-- ========================================================

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
CREATE POLICY "Anyone can view app versions" 
ON public.app_versions FOR SELECT 
USING (true);

-- Only authenticated users (admins) can insert/update (we will rely on App-level role checking, but require auth at DB level)
CREATE POLICY "Authenticated users can manage app versions" 
ON public.app_versions FOR ALL 
USING (auth.role() = 'authenticated');

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_versions;
