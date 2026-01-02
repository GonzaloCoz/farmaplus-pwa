
import { supabase } from '@/integrations/supabase/client';
// import * as XLSX from 'xlsx';
// import { openDB, DBSchema, IDBPDatabase } from 'idb'; // Removed
import { BRANCH_NAMES } from '@/config/users';

// Interfaces para los datos
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

// Cargar datos por defecto si la base de datos está vacía
export async function loadDefaultData(): Promise<boolean> {
    // try {
    //     // Check if products exist in Supabase
    //     const { count, error } = await supabase
    //         .from('products')
    //         .select('*', { count: 'exact', head: true });

    //     if (error) throw error;

    //     if (count !== null && count > 0) {
    //         return false; // Ya hay datos
    //     }
    //     // Stubbed to avoid XLSX dependency build error
    //     console.warn("loadDefaultData disabled during build debug");
    //     return false;

    // } catch (error) {
    //     console.error("Error cargando datos por defecto:", error);
    // }
    return false;
    return false;
}

// Helper to parse labs from a worksheet
/*
function parseSheetLabs(worksheet: XLSX.WorkSheet): { name: string, category: string }[] {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length < 2) return [];

    const headers = jsonData[1];
    const result: { name: string, category: string }[] = [];

    for (let c = 0; c < headers.length; c++) {
        const category = String(headers[c]).trim();
        if (!category) continue;

        for (let r = 2; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (row && row[c]) {
                const labName = String(row[c]).trim();
                if (labName.length > 0) {
                    result.push({
                        name: labName.toUpperCase(),
                        category: category.toUpperCase()
                    });
                }
            }
        }
    }
    return result;
}
*/

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
export async function getAllBranchLabCounts(): Promise<Record<string, number>> {
    // try {
    //     const response = await fetch('lab_sucu.xlsx');
    //     if (!response.ok) return {};

    //     const data = await response.arrayBuffer();
    //     const workbook = XLSX.read(data);
    //     const counts: Record<string, number> = {};

    //     // Normalization map for sheet names
    //     const sheetMap = new Map<string, string>();
    //     workbook.SheetNames.forEach(s => sheetMap.set(s.toLowerCase().trim(), s));

    //     for (const branch of BRANCH_NAMES) {
    //         const sheetName = sheetMap.get(branch.toLowerCase().trim());

    //         if (sheetName) {
    //             const labs = parseSheetLabs(workbook.Sheets[sheetName]);
    //             counts[branch] = labs.length;
    //         } else {
    //             counts[branch] = 0;
    //         }
    //     }
    //     return counts;
    // } catch (error) {
    //     console.error("Error getting all branch counts:", error);
    //     return {};
    // }
    return {};
}

// ============ PRE-CONTEO (Supabase - Cloud Sync) ============

export interface PreCountSession {
    id: string;
    sector: string;
    start_time: string; // Supabase returns ISO string
    end_time?: string;
    status: 'active' | 'completed';
    totalProducts?: number; // Calculated on client for now or DB view
    totalUnits?: number;
    errorCount?: number;
    user_id?: string;
}

export interface PreCountItem {
    id: string;
    session_id: string;
    ean: string;
    product_name: string;
    quantity: number;
    scanned_at: string;
    scanned_by?: string;
    synced?: number; // Kept for compatibility but always 1 in cloud
}

// --- Sesiones (Supabase) ---

export async function createSession(sector: string): Promise<PreCountSession> {
    const { data: userData } = await supabase.auth.getUser();

    // @ts-ignore
    const { data, error } = await supabase
        .from('precount_sessions' as any)
        .insert({
            sector: sector,
            status: 'active',
            user_id: userData.user?.id
        } as any)
        .select()
        .single();

    if (error) {
        console.error('Error creating session:', error);
        throw error;
    }

    return data as unknown as PreCountSession;
}


export async function getActiveSessions(): Promise<PreCountSession[]> {
    // @ts-ignore
    const { data, error } = await supabase
        .from('precount_sessions' as any)
        .select('*')
        .eq('status', 'active')
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching active sessions:', error);
        return [];
    }

    return data as unknown as PreCountSession[];
}

export async function deleteSession(id: string): Promise<void> {
    // @ts-ignore
    const { error } = await supabase
        .from('precount_sessions' as any)
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}

export async function getActiveSession(): Promise<PreCountSession | null> {
    // This logic might need to change to "get MY active session" or "selected session"
    // For now returning the most recent active one
    const sessions = await getActiveSessions();
    return sessions.length > 0 ? sessions[0] : null;
}


export async function updateSession(id: string, updates: any): Promise<void> {
    // Filter out client-only fields if they shouldn't be in DB
    const { totalProducts, totalUnits, errorCount, ...dbUpdates } = updates;

    // @ts-ignore
    const { error } = await supabase
        .from('precount_sessions' as any)
        .update(dbUpdates)
        .eq('id', id);

    if (error) {
        console.error('Error updating session:', error);
    }
}

export async function endSession(id: string): Promise<void> {
    // @ts-ignore
    const { error } = await supabase
        .from('precount_sessions' as any)
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

// --- Items (Supabase) ---

export async function addPreCountItem(item: { session_id: string, ean: string, product_name: string, quantity: number }): Promise<PreCountItem> {
    const { data: userData } = await supabase.auth.getUser();

    // @ts-ignore
    const { data, error } = await supabase
        .from('precount_items' as any)
        .insert({
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: item.quantity,
            scanned_by: userData.user?.id
        } as any)
        .select()
        .single();

    if (error) throw error;
    return data as unknown as PreCountItem;
}

export async function updatePreCountItem(id: string, updates: Partial<PreCountItem>): Promise<void> {
    // @ts-ignore
    const { error } = await supabase
        .from('precount_items' as any)
        .update(updates)
        .eq('id', id);

    if (error) throw error;
}

export async function deletePreCountItem(id: string): Promise<void> {
    // @ts-ignore
    const { error } = await supabase
        .from('precount_items' as any)
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getPreCountItemsBySessionId(sessionId: string): Promise<PreCountItem[]> {
    // @ts-ignore
    const { data, error } = await supabase
        .from('precount_items' as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('scanned_at', { ascending: false });

    if (error) {
        console.error('Error fetching items:', error);
        return [];
    }

    return data as unknown as PreCountItem[];
}

export async function initDB() {
    // No-op for Supabase mode, kept for compatibility
    return Promise.resolve();
}

// Legacy / Unused in Cloud Mode but kept to prevent breakages if called
export async function clearAllData(): Promise<void> {
    console.warn("clearAllData called in Cloud Mode - ignoring local DB clear");
}

