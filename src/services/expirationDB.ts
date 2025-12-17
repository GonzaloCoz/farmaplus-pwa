import { supabase } from '@/integrations/supabase/client';

export interface ExpirationSession {
    id: string;
    sector: string;
    branchName: string;
    startTime: number;
    endTime?: number;
    status: 'active' | 'completed';
    totalProducts: number;
    totalUnits: number;
}

export interface BatchInfo {
    batchNumber: string;
    expirationDate: string;
    quantity: number;
    reminderMonths?: number;
    status?: 'active' | 'sold' | 'transfer' | 'return' | 'destroyed';
    actionDate?: number;
    destinationBranch?: string;
    plexShipmentNumber?: string;
}

export interface ExpirationItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    batches: BatchInfo[];
    totalQuantity: number;
    timestamp: number;
    synced: number;
    branchName: string;
}

// --- Sesiones ---

export async function createExpirationSession(sector: string, branchName: string): Promise<ExpirationSession> {
    const newSession = {
        sector,
        branch_name: branchName,
        start_time: Date.now(),
        status: 'active',
        total_products: 0,
        total_units: 0
    };

    const { data, error } = await supabase
        .from('expiration_sessions')
        .insert(newSession)
        .select()
        .single();

    if (error) throw error;

    return mapSessionFromDB(data);
}

export async function getActiveExpirationSessions(branchName: string): Promise<ExpirationSession[]> {
    let query = supabase
        .from('expiration_sessions')
        .select('*')
        .eq('status', 'active');

    if (branchName) {
        query = query.eq('branch_name', branchName);
    }

    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) throw error;

    return data.map(mapSessionFromDB);
}

export async function deleteExpirationSession(id: string): Promise<void> {
    // Cascade delete in DB handles items, but let's be safe and rely on cascade or delete explicitly if needed.
    // My SQL defined ON DELETE CASCADE for items, so just deleting session is enough.
    const { error } = await supabase
        .from('expiration_sessions')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getActiveExpirationSession(branchName: string): Promise<ExpirationSession | null> {
    const sessions = await getActiveExpirationSessions(branchName);
    return sessions.length > 0 ? sessions[0] : null;
}

export async function updateExpirationSession(id: string, updates: Partial<ExpirationSession>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.sector) dbUpdates.sector = updates.sector;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.endTime) dbUpdates.end_time = updates.endTime;
    if (updates.totalProducts !== undefined) dbUpdates.total_products = updates.totalProducts;
    if (updates.totalUnits !== undefined) dbUpdates.total_units = updates.totalUnits;

    const { error } = await supabase
        .from('expiration_sessions')
        .update(dbUpdates)
        .eq('id', id);

    if (error) throw error;
}

export async function endExpirationSession(id: string): Promise<void> {
    await updateExpirationSession(id, { status: 'completed', endTime: Date.now() });
}

// --- Items ---

export async function addExpirationItem(
    itemData: Omit<ExpirationItem, 'id' | 'sessionId' | 'timestamp' | 'synced' | 'branchName'>,
    branchName: string
): Promise<ExpirationItem> {
    const activeSession = await getActiveExpirationSession(branchName);
    if (!activeSession) throw new Error("No active expiration session");

    // Check if exists
    const { data: existing } = await supabase
        .from('expiration_items')
        .select('id')
        .eq('session_id', activeSession.id)
        .eq('ean', itemData.ean)
        .single();

    if (existing) {
        throw new Error("Item already exists in session. Use update.");
    }

    const newItem = {
        session_id: activeSession.id,
        ean: itemData.ean,
        product_name: itemData.productName,
        batches: itemData.batches as any, // Supabase client handles JSON stringify
        total_quantity: itemData.batches.reduce((acc, b) => acc + b.quantity, 0),
        timestamp: Date.now(),
        branch_name: branchName,
        synced: 1
    };

    const { data, error } = await supabase
        .from('expiration_items')
        .insert(newItem)
        .select()
        .single();

    if (error) throw error;

    await updateSessionTotals(activeSession.id);

    return mapItemFromDB(data);
}

export async function updateExpirationItem(id: string, updates: Partial<ExpirationItem>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.batches) {
        dbUpdates.batches = updates.batches as any;
        dbUpdates.total_quantity = updates.batches.reduce((acc, b) => acc + b.quantity, 0);
    }
    if (updates.timestamp) dbUpdates.timestamp = updates.timestamp;

    const { data, error } = await supabase
        .from('expiration_items')
        .update(dbUpdates)
        .eq('id', id)
        .select('session_id') // Get session_id to update totals
        .single();

    if (error) throw error;

    if (data) {
        await updateSessionTotals(data.session_id);
    }
}

export async function deleteExpirationItem(id: string): Promise<void> {
    // Get session_id first to update totals
    const { data: item } = await supabase
        .from('expiration_items')
        .select('session_id')
        .eq('id', id)
        .single();

    const { error } = await supabase
        .from('expiration_items')
        .delete()
        .eq('id', id);

    if (error) throw error;

    if (item) {
        await updateSessionTotals(item.session_id);
    }
}

export async function getExpirationItemsBySession(sessionId: string): Promise<ExpirationItem[]> {
    const { data, error } = await supabase
        .from('expiration_items')
        .select('*')
        .eq('session_id', sessionId);

    if (error) throw error;

    return data.map(mapItemFromDB);
}

// Updated to optionally filter by branch (for SmartAnalystWidget)
export async function getAllExpirationItems(branchName?: string): Promise<ExpirationItem[]> {
    let query = supabase.from('expiration_items').select('*');

    if (branchName) {
        query = query.eq('branch_name', branchName);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(mapItemFromDB);
}

// Helper to update totals
async function updateSessionTotals(sessionId: string) {
    const items = await getExpirationItemsBySession(sessionId);
    const totalProducts = items.length;
    const totalUnits = items.reduce((acc, item) => acc + item.totalQuantity, 0);

    await updateExpirationSession(sessionId, {
        totalProducts,
        totalUnits
    });
}

// Mappers
function mapSessionFromDB(dbSession: any): ExpirationSession {
    return {
        id: dbSession.id,
        sector: dbSession.sector,
        branchName: dbSession.branch_name,
        startTime: Number(dbSession.start_time),
        endTime: dbSession.end_time ? Number(dbSession.end_time) : undefined,
        status: dbSession.status,
        totalProducts: dbSession.total_products,
        totalUnits: dbSession.total_units
    };
}

function mapItemFromDB(dbItem: any): ExpirationItem {
    return {
        id: dbItem.id,
        sessionId: dbItem.session_id,
        ean: dbItem.ean,
        productName: dbItem.product_name,
        batches: dbItem.batches,
        totalQuantity: dbItem.total_quantity,
        timestamp: Number(dbItem.timestamp),
        synced: dbItem.synced,
        branchName: dbItem.branch_name
    };
}

