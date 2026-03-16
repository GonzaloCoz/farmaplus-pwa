
-- 1. Training Categories Table
CREATE TABLE IF NOT EXISTS public.training_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT, -- Lucide icon name or Solar icon name
    color TEXT, -- Hex color or CSS class
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Training Posts Table
CREATE TABLE IF NOT EXISTS public.training_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Flexible structure for Notion-style blocks
    snippet TEXT, -- Short summary for the card view
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.training_categories(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    image_url TEXT, -- Optional cover image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Training Comments Table
CREATE TABLE IF NOT EXISTS public.training_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.training_posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Training Reactions Table
CREATE TABLE IF NOT EXISTS public.training_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.training_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji_code TEXT NOT NULL, -- e.g., 'like', 'celebrate', 'heart'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id, emoji_code)
);

-- 5. Training Read Log (Analytics)
CREATE TABLE IF NOT EXISTS public.training_read_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.training_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id)
);

-- Add updated_at trigger for posts
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_training_posts_updated
    BEFORE UPDATE ON public.training_posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS POLICIES

-- Enable RLS
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_read_log ENABLE ROW LEVEL SECURITY;

-- 1. Categories: read for all, write for admins
CREATE POLICY "Categories are viewable by everyone" ON public.training_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.training_categories USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Posts: read for all (published), admins see all. write for admins
CREATE POLICY "Published posts are viewable by everyone" ON public.training_posts 
    FOR SELECT USING (
        status = 'published' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage posts" ON public.training_posts 
    FOR ALL 
    TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Comments: read for all, write for owners, admins can delete
CREATE POLICY "Comments are viewable by everyone" ON public.training_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.training_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their comments" ON public.training_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users and admins can delete comments" ON public.training_comments FOR DELETE USING (
    auth.uid() = author_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Reactions: read for all, write/delete for owners
CREATE POLICY "Reactions are viewable by everyone" ON public.training_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their reactions" ON public.training_reactions USING (auth.uid() = user_id);

-- 5. Read Log: admins see all, users insert their own
CREATE POLICY "Admins can view all read logs" ON public.training_read_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can record their reads" ON public.training_read_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own read logs" ON public.training_read_log FOR SELECT USING (auth.uid() = user_id);

-- Default categories
INSERT INTO public.training_categories (name, icon, color) VALUES
('General', 'Notebook', '#3b82f6'),
('Novedades', 'Bell', '#ef4444'),
('Tutoriales', 'BookOpen', '#10b981'),
('Normativas', 'ShieldCheck', '#f59e0b')
ON CONFLICT (name) DO NOTHING;
