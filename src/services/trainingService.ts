
import { supabase } from "@/integrations/supabase/client";

export interface TrainingCategory {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    created_at: string;
}

export interface TrainingPost {
    id: string;
    title: string;
    content: any; // JSONB
    snippet?: string;
    author_id: string;
    category_id?: string;
    tags: string[];
    status: 'draft' | 'published' | 'archived';
    image_url?: string;
    created_at: string;
    updated_at: string;
    author?: {
        full_name: string;
        username: string;
    };
    category?: TrainingCategory;
    reactions_count?: Record<string, number>;
    user_reaction?: string;
    is_read?: boolean;
}

export interface TrainingComment {
    id: string;
    post_id: string;
    author_id: string;
    content: string;
    is_edited: boolean;
    created_at: string;
    updated_at: string;
    author?: {
        full_name: string;
        username: string;
    };
}

export const trainingService = {
    /**
     * Fetch all published posts
     */
    async getPosts(filters?: { categoryId?: string; tag?: string; search?: string }) {
        let query = (supabase as any)
            .from('training_posts')
            .select(`
                *,
                author:profiles(full_name, username),
                category:training_categories(*)
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (filters?.categoryId) {
            query = query.eq('category_id', filters.categoryId);
        }
        if (filters?.tag) {
            query = query.contains('tags', [filters.tag]);
        }
        if (filters?.search) {
            query = query.or(`title.ilike.%${filters.search}%,snippet.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as unknown as TrainingPost[];
    },

    /**
     * Fetch a single post with detailed info
     */
    async getPostById(id: string) {
        const { data, error } = await (supabase as any)
            .from('training_posts')
            .select(`
                *,
                author:profiles(full_name, username),
                category:training_categories(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as TrainingPost;
    },

    /**
     * Fetch comments for a post
     */
    async getComments(postId: string) {
        const { data, error } = await (supabase as any)
            .from('training_comments')
            .select(`
                *,
                author:profiles(full_name, username)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as unknown as TrainingComment[];
    },

    /**
     * Add a comment
     */
    async addComment(postId: string, content: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data, error } = await (supabase as any)
            .from('training_comments')
            .insert({
                post_id: postId,
                author_id: user.id,
                content
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Manage reactions
     */
    async toggleReaction(postId: string, emojiCode: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // Check if reaction exists
        const { data: existing } = await (supabase as any)
            .from('training_reactions')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .eq('emoji_code', emojiCode)
            .maybeSingle();

        if (existing) {
            const { error } = await (supabase as any)
                .from('training_reactions')
                .delete()
                .eq('id', (existing as any).id);
            if (error) throw error;
            return { action: 'removed' };
        } else {
            const { error } = await (supabase as any)
                .from('training_reactions')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    emoji_code: emojiCode
                });
            if (error) throw error;
            return { action: 'added' };
        }
    },

    /**
     * Mark post as read
     */
    async markAsRead(postId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await (supabase as any)
            .from('training_read_log')
            .upsert({
                post_id: postId,
                user_id: user.id
            }, { onConflict: 'post_id,user_id' });
        
        if (error && error.code !== '23505') { // Ignore unique violation if it happens
            console.error("Error marking as read:", error);
        }
    },

    /**
     * Get categories
     */
    async getCategories() {
        const { data, error } = await (supabase as any)
            .from('training_categories')
            .select('*')
            .order('name');
        
        if (error) throw error;
        return data as unknown as TrainingCategory[];
    },

    /**
     * Admin: Create Post
     */
    async createPost(post: Partial<TrainingPost>) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await (supabase as any)
            .from('training_posts')
            .insert({
                ...post,
                author_id: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data as unknown as TrainingPost;
    },

    /**
     * Admin: Update Post
     */
    async updatePost(id: string, post: Partial<TrainingPost>) {
        const { data, error } = await (supabase as any)
            .from('training_posts')
            .update(post)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Admin: Delete Post
     */
    async deletePost(id: string) {
        const { error } = await (supabase as any)
            .from('training_posts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
