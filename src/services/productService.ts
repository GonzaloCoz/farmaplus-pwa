
import { supabase } from '@/integrations/supabase/client';
import { BRANCH_NAMES } from '@/config/users';
// Removed XLSX import to avoid build issues for now
// import * as XLSX from 'xlsx'; 

export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
    laboratory?: string;
    stock: number;
}

// ============ PRODUCTOS (Supabase) ============

// Agregar productos a Supabase (Batch Insert)
export async function addProducts(products: Product[]): Promise<void> {
    const { error } = await supabase
        .from('products')
        .upsert(products.map(p => ({
            ean: p.ean,
            name: p.name,
            laboratory: p.laboratory,
            category: p.category,
            cost: p.cost,
            sale_price: p.salePrice
        })), { onConflict: 'ean' });

    if (error) {
        console.error('Error adding products to Supabase:', error);
        throw error;
    }
}

export async function ensureConfigProduct(): Promise<void> {
    const configEans = ['CONFIG_DAYS', 'CONFIG_START_DATE'];

    for (const ean of configEans) {
        const { data } = await supabase.from('products').select("id").eq('ean', ean).maybeSingle();
        if (!data) {
            await addProducts([{
                ean: ean,
                name: ean === 'CONFIG_DAYS' ? 'Configuración de Días' : 'Configuración de Fecha Inicio',
                laboratory: '_CONFIG_',
                category: 'SYSTEM',
                cost: 0, salePrice: 0, stock: 0
            }]);
        }
    }
}

// Buscar productos por nombre o EAN (Supabase ILIKE)
export async function searchProducts(query: string, limit: number = 10): Promise<Product[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${normalizedQuery}%,ean.eq.${normalizedQuery}`)
        .limit(limit);

    if (error) {
        console.error('Error searching products:', error);
        return [];
    }

    return data.map(p => ({
        ean: p.ean,
        name: p.name,
        cost: p.cost || 0,
        salePrice: p.sale_price || 0,
        category: p.category || undefined,
        laboratory: p.laboratory || undefined,
        stock: 0
    }));
}

// Obtener producto por EAN
export async function getProductByEAN(ean: string): Promise<Product | undefined> {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('ean', ean)
        .single();

    if (error || !data) return undefined;

    return {
        ean: data.ean,
        name: data.name,
        cost: data.cost || 0,
        salePrice: data.sale_price || 0,
        category: data.category || undefined,
        laboratory: data.laboratory || undefined,
        stock: 0
    };
}

// Obtener todos los productos
export async function getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select('*');

    if (error) {
        console.error('Error getting all products:', error);
        return [];
    }

    return data.map(p => ({
        ean: p.ean,
        name: p.name,
        cost: p.cost || 0,
        salePrice: p.sale_price || 0,
        category: p.category || undefined,
        laboratory: p.laboratory || undefined,
        stock: 0
    }));
}

export async function getProductCount(): Promise<number> {
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error getting product count:', error);
        return 0;
    }

    return count || 0;
}

// Obtener laboratorios permitidos para una sucursal desde Supabase (branch_laboratories)
export async function getLaboratoriesForBranch(branchName: string): Promise<{ name: string, category: string }[]> {
    try {
        const { data, error } = await supabase
            .from('branch_laboratories')
            .select('laboratory, category')
            .eq('branch_name', branchName);

        if (error) {
            console.error("Error loading laboratories from Supabase:", error);
            return [];
        }

        if (!data) return [];

        return (data as any[]).map(row => ({
            name: row.laboratory.toUpperCase(),
            category: (row.category || 'MEDICAMENTOS').toUpperCase()
        })).sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error("Critical error loading laboratories:", error);
        return [];
    }
}

// Obtener conteo de laboratorios para TODAS las sucursales (Batch)
// Stubbed implementation to verify build fix
export async function getAllBranchLabCounts(): Promise<Record<string, number>> {
    return {};
}

export async function clearProducts(): Promise<void> {
    console.warn("clearProducts called in Cloud Mode - use Supabase dashboard to manage products");
}
