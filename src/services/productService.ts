// TEMPORARY STUB FOR BUILD - MINIMAL EXPORTS TO SATISFY IMPORTS

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

// Stub functions
export async function addProducts(products: Product[]): Promise<void> { }
export async function ensureConfigProduct(): Promise<void> { }
export async function searchProducts(query: string, limit?: number): Promise<Product[]> { return []; }
export async function getProductByEAN(ean: string): Promise<Product | undefined> { return undefined; }
export async function getAllProducts(): Promise<Product[]> { return []; }
export async function getProductCount(): Promise<number> { return 0; }

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

export async function getAllBranchLabCounts(): Promise<Record<string, number>> { return {}; }
export async function clearProducts(): Promise<void> { }
export async function loadDefaultData(): Promise<boolean> { return false; }
