import { supabase } from "@/integrations/supabase/client";

export interface ReturnItem {
    id: string;
    branch_name: string;
    product_ean: string;
    product_name: string;
    supplier?: string;
    quantity: number;
    reason: 'expired' | 'damaged' | 'recall' | 'other';
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    expiration_date?: string;
    return_auth_code?: string;
    notes?: string;
    created_at: string;
    user_id?: string;
}

export type CreateReturnDTO = Omit<ReturnItem, 'id' | 'created_at' | 'updated_at' | 'status'>;
export type UpdateReturnDTO = Partial<Omit<ReturnItem, 'id' | 'created_at' | 'branch_name' | 'product_ean'>>;

export const returnsService = {
    async getAll(branchName?: string): Promise<ReturnItem[]> {
        let query = supabase
            // @ts-ignore
            .from('returns')
            .select('*')
            .order('created_at', { ascending: false });

        if (branchName) {
            query = query.eq('branch_name', branchName);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ReturnItem[];
    },

    async create(item: CreateReturnDTO): Promise<ReturnItem> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            // @ts-ignore
            .from('returns')
            .insert({
                ...item,
                user_id: user?.id,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data as ReturnItem;
    },

    async update(id: string, updates: UpdateReturnDTO): Promise<ReturnItem> {
        const { data, error } = await supabase
            // @ts-ignore
            .from('returns')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as ReturnItem;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            // @ts-ignore
            .from('returns')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
