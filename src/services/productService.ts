// Product Service - Supabase Integration

import { supabase } from '@/integrations/supabase/client';

export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
    laboratory?: string;
    stock: number;
}

// Get all products from Supabase
export async function getAllProducts(): Promise<Product[]> {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }

        return (data || []).map(item => ({
            ean: item.ean,
            name: item.name,
            cost: item.cost || 0,
            salePrice: item.sale_price || 0,
            category: item.category || undefined,
            laboratory: item.laboratory || undefined,
            stock: item.stock || 0
        }));
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        return [];
    }
}

// Search products by name or EAN
export async function searchProducts(query: string, limit: number = 50): Promise<Product[]> {
    try {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${query}%,ean.ilike.%${query}%`)
            .limit(limit)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error searching products:', error);
            return [];
        }

        return (data || []).map(item => ({
            ean: item.ean,
            name: item.name,
            cost: item.cost || 0,
            salePrice: item.sale_price || 0,
            category: item.category || undefined,
            laboratory: item.laboratory || undefined,
            stock: item.stock || 0
        }));
    } catch (error) {
        console.error('Error in searchProducts:', error);
        return [];
    }
}

// Get product by EAN
export async function getProductByEAN(ean: string): Promise<Product | undefined> {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('ean', ean)
            .maybeSingle();

        if (error) {
            console.error('Error fetching product by EAN:', error);
            return undefined;
        }

        if (!data) {
            return undefined;
        }

        return {
            ean: data.ean,
            name: data.name,
            cost: data.cost || 0,
            salePrice: data.sale_price || 0,
            category: data.category || undefined,
            laboratory: data.laboratory || undefined,
            stock: data.stock || 0
        };
    } catch (error) {
        console.error('Error in getProductByEAN:', error);
        return undefined;
    }
}

// Add multiple products (upsert to avoid duplicates)
export async function addProducts(products: Product[]): Promise<void> {
    try {
        const productsToInsert = products.map(p => ({
            ean: p.ean,
            name: p.name,
            cost: p.cost,
            sale_price: p.salePrice,
            category: p.category || null,
            laboratory: p.laboratory || null,
            stock: p.stock || 0
        }));

        const { error } = await supabase
            .from('products')
            .upsert(productsToInsert, { onConflict: 'ean' });

        if (error) {
            console.error('Error adding products:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in addProducts:', error);
        throw error;
    }
}

// Ensure config product exists (stub for compatibility)
export async function ensureConfigProduct(): Promise<void> {
    // No-op in cloud mode
}

// Get total product count
export async function getProductCount(): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error counting products:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error in getProductCount:', error);
        return 0;
    }
}

// Get laboratories assigned to a specific branch
export async function getLaboratoriesForBranch(branchName: string): Promise<{ name: string, category: string }[]> {
    try {
        const { data, error } = await supabase
            .from('branch_laboratories')
            .select('laboratory, category')
            .eq('branch_name', branchName);

        if (error) {
            console.error('Error fetching laboratories for branch:', error);
            return [];
        }

        return (data || []).map(item => ({
            name: item.laboratory,
            category: item.category || 'Sin categoría'
        }));
    } catch (error) {
        console.error('Error in getLaboratoriesForBranch:', error);
        return [];
    }
}

// Get count of laboratories per branch
export async function getAllBranchLabCounts(): Promise<Record<string, number>> {
    try {
        const { data, error } = await supabase
            .from('branch_laboratories')
            .select('branch_name');

        if (error) {
            console.error('Error fetching branch lab counts:', error);
            return {};
        }

        const counts: Record<string, number> = {};
        (data || []).forEach(item => {
            counts[item.branch_name] = (counts[item.branch_name] || 0) + 1;
        });

        return counts;
    } catch (error) {
        console.error('Error in getAllBranchLabCounts:', error);
        return {};
    }
}

// Clear all products (admin only)
export async function clearProducts(): Promise<void> {
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .neq('ean', ''); // Delete all

        if (error) {
            console.error('Error clearing products:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in clearProducts:', error);
        throw error;
    }
}

// Stub for compatibility - in cloud mode, data is always in Supabase
export async function loadDefaultData(): Promise<boolean> {
    return false;
}
