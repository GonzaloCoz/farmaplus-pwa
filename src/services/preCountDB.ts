import { supabase } from '@/integrations/supabase/client';

// Re-export product functionality from the new service
export {
    type Product,
    addProducts,
    ensureConfigProduct,
    searchProducts,
    getProductByEAN,
    getAllProducts,
    getProductCount,
    getLaboratoriesForBranch,
    getAllBranchLabCounts,
    clearProducts
} from '@/services/productService';

// Stub loadDefaultData or move it if needed
export async function loadDefaultData(): Promise<boolean> { return false; }

// Stub legacy offline sync function
export async function getUnsyncedItems(): Promise<PreCountItem[]> { return []; }



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

// clearProducts is re-exported from productService, no need to define it here
