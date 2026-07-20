// Product Service - Supabase Integration

import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/lib/utils';

export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice?: number;
    category?: string;
    laboratory?: string;
    stock?: number;
    id_producto?: string;
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
            salePrice: (item as any).sale_price || 0,
            category: item.category || undefined,
            laboratory: item.laboratory || undefined,
            stock: (item as any).stock || 0,
            id_producto: item.id_producto || undefined
        }));
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        return [];
    }
}

// Search products by name or EAN (optimized with RPC)
export async function searchProducts(query: string, limit: number = 50): Promise<Product[]> {
    try {
        if (!query || query.trim().length === 0) {
            return [];
        }

        // Use optimized RPC function
        const { data, error } = await supabase.rpc('search_products_optimized', {
            p_query: query.trim(),
            p_limit: limit
        });

        if (error) {
            console.error('Error searching products:', error);
            return [];
        }

        const products = (data || []).map((item: any) => ({
            ean: item.ean,
            name: item.name,
            cost: item.cost || 0,
            salePrice: item.sale_price || 0,
            category: item.category || undefined,
            laboratory: item.laboratory || undefined,
            stock: item.stock || 0,
            id_producto: item.id_producto || undefined
        }));

        // Cache results for future use
        if (products.length > 0) {
            const { cacheProducts } = await import('./enhancedProductCache');
            cacheProducts(products).catch(err => console.warn('Cache error:', err));
        }

        return products;
    } catch (error) {
        console.error('Error in searchProducts:', error);
        return [];
    }
}

// Get product by EAN (optimized with cache and RPC)
export async function getProductByEAN(ean: string): Promise<Product | undefined> {
    try {
        // Check cache first
        const { enhancedProductCache } = await import('./enhancedProductCache');
        const cached = await enhancedProductCache.get(ean);

        if (cached) {
            return {
                ean: cached.ean,
                name: cached.name,
                cost: cached.cost,
                salePrice: cached.salePrice,
                category: cached.category,
                laboratory: cached.laboratory,
                stock: cached.stock,
                id_producto: cached.id_producto
            };
        }

        // Use optimized RPC function
        const { data, error } = await supabase.rpc('get_product_by_ean', {
            p_ean: ean
        });

        if (error) {
            console.error('Error fetching product by EAN:', error);
            return undefined;
        }

        // RPC returns array
        const productData = Array.isArray(data) ? data[0] : data;

        if (!productData) {
            return undefined;
        }

        const product: Product = {
            ean: productData.ean,
            name: productData.name,
            cost: productData.cost || 0,
            salePrice: productData.sale_price || 0,
            category: productData.category || undefined,
            laboratory: productData.laboratory || undefined,
            stock: 0, // Column doesn't exist in actual database
            id_producto: productData.id_producto || undefined
        };

        // Cache for future use
        enhancedProductCache.set(product).catch(err => console.warn('Cache error:', err));

        return product;
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
            category: p.category || null,
            laboratory: p.laboratory || null,
            id_producto: p.id_producto || null
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
export async function getLaboratoriesForBranch(branchName: string): Promise<{ name: string, category: string, round: number }[]> {
    try {
        let allData: any[] = [];
        let page = 0;
        const limit = 1000;
        const cleanBranch = normalizeString(branchName);
        while (true) {
            const { data, error } = await supabase
                .from('branch_laboratories')
                .select('laboratory, category, round')
                .or(`branch_name.eq.${cleanBranch},branch_name.eq.${branchName.trim()}`)
                .range(page * limit, (page + 1) * limit - 1);

            if (error) {
                console.error('Error fetching laboratories for branch:', error);
                return [];
            }
            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            if (data.length < limit) break;
            page++;
        }

        // Deduplicate and normalize in-memory to be extra safe
        const uniqueLabs = new Map<string, string>();
        allData.forEach(item => {
            const name = (item.laboratory || '').trim();
            const cat = normalizeString(item.category || 'VARIOS');
            const round = Number(item.round || 1);
            if (name) {
                const key = `${name.toUpperCase()}|${cat}|${round}`;
                if (!uniqueLabs.has(key)) {
                    uniqueLabs.set(key, JSON.stringify({ name, category: cat, round }));
                }
            }
        });

        return Array.from(uniqueLabs.values()).map(v => JSON.parse(v));
    } catch (error) {
        console.error('Error in getLaboratoriesForBranch:', error);
        return [];
    }
}

// Get total count of products for a specific laboratory AND category (Master Denominator)
export async function getProductCountByLab(labName: string, category?: string): Promise<number> {
    try {
        // Use ilike and case-insensitive matching for robustness
        let query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .ilike('laboratory', labName.trim());

        if (category) {
            query = query.ilike('category', category.trim());
        }

        const { count, error } = await query;

        if (error) {
            console.error(`Error counting products for lab ${labName} items:`, error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error(`Error in getProductCountByLab for ${labName}:`, error);
        return 0;
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
        // First clear inventories to avoid FK constraint violations
        await supabase.from('inventories').delete().neq('ean', '');

        const { error } = await supabase
            .from('products')
            .delete()
            .neq('ean', ''); // Use EAN as filter, as ID column seems missing

        if (error) {
            console.error('Error clearing products:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
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
