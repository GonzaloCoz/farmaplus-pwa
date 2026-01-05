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
    clearProducts,
    loadDefaultData
} from '@/services/productService';




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

    const { data, error } = await supabase
        .from('precount_sessions')
        .insert({
            sector: sector,
            status: 'active',
            user_id: userData.user?.id
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating session:', error);
        throw error;
    }

    return data as unknown as PreCountSession;
}


export async function getActiveSessions(): Promise<PreCountSession[]> {
    const { data, error } = await supabase
        .from('precount_sessions')
        .select('*')
        .eq('status', 'active')
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching active sessions:', error);
        return [];
    }

    return data as PreCountSession[];
}

export async function deleteSession(id: string): Promise<void> {
    const { error } = await supabase
        .from('precount_sessions')
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

    const { error } = await supabase
        .from('precount_sessions')
        .update(dbUpdates)
        .eq('id', id);

    if (error) {
        console.error('Error updating session:', error);
    }
}

export async function endSession(id: string): Promise<void> {
    const { error } = await supabase
        .from('precount_sessions')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

// --- Items (Supabase) ---

export async function addPreCountItem(item: { session_id: string, ean: string, product_name: string, quantity: number }): Promise<PreCountItem> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('precount_items')
        .insert({
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: item.quantity,
            scanned_by: userData.user?.id
        })
        .select()
        .single();

    if (error) throw error;
    return data as PreCountItem;
}

export async function updatePreCountItem(id: string, updates: Partial<PreCountItem>): Promise<void> {
    const { error } = await supabase
        .from('precount_items')
        .update(updates)
        .eq('id', id);

    if (error) throw error;
}

export async function deletePreCountItem(id: string): Promise<void> {
    const { error } = await supabase
        .from('precount_items')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getPreCountItemsBySessionId(sessionId: string): Promise<PreCountItem[]> {
    const { data, error } = await supabase
        .from('precount_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('scanned_at', { ascending: false });

    if (error) {
        console.error('Error fetching items:', error);
        return [];
    }

    return data as PreCountItem[];
}

export async function initDB() {
    // No-op for Supabase mode, kept for compatibility
    return Promise.resolve();
}

// Get all sessions (active and completed)
export async function getAllSessions(): Promise<PreCountSession[]> {
    const { data, error } = await supabase
        .from('precount_sessions')
        .select('*')
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching all sessions:', error);
        return [];
    }

    return data as PreCountSession[];
}

// Alias for compatibility with Reports.tsx
export async function getSessionItems(sessionOrId: string | PreCountSession): Promise<PreCountItem[]> {
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
    return getPreCountItemsBySessionId(sessionId);
}

// clearProducts and loadDefaultData are re-exported from productService
