-- Create Returns Table
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    branch_name TEXT NOT NULL,
    product_ean TEXT NOT NULL,
    product_name TEXT NOT NULL,
    supplier TEXT,
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('expired', 'damaged', 'recall', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    expiration_date DATE,
    return_auth_code TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Policies

-- Users can view returns from their assigned branch (or all if admin)
-- Simplify for now: Authenticated users can view/insert/update
CREATE POLICY "Authenticated users full access to returns" ON public.returns
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_returns_branch_name ON public.returns(branch_name);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(status);
