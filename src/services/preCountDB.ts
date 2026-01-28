import { db, LocalSession, LocalItem } from './db';
import { syncManager } from './syncManager';
import { v4 as uuidv4 } from 'uuid';
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

// ============ PRE-CONTEO (OFFLINE FIRST) ============

export interface PreCountSession extends LocalSession {
    totalProducts?: number;
    totalUnits?: number;
    errorCount?: number;
}

export type PreCountItem = LocalItem;

// --- Sesiones ---

export async function createSession(sector: string): Promise<PreCountSession> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const newSession: LocalSession = {
        id: sessionId,
        sector,
        start_time: now,
        status: 'active',
        user_id: userId,
        synced: 0
    };

    // 1. Save to Local DB
    await db.sessions.add(newSession);

    // 2. Queue for Sync
    await syncManager.addToQueue({
        type: 'create',
        entity: 'session',
        data: newSession
    });

    return newSession;
}


export async function getActiveSessions(): Promise<PreCountSession[]> {
    // Read from Local DB
    return await db.sessions
        .where('status')
        .equals('active')
        .reverse()
        .sortBy('start_time') as PreCountSession[];
}

export async function deleteSession(id: string): Promise<void> {
    // 1. Delete from Local DB
    await db.sessions.delete(id);
    // Also delete related items locally
    await db.items.where('session_id').equals(id).delete();

    // 2. Queue for Sync (Delete on server)
    // Note: If the session was never synced (created offline and deleted offline), 
    // we technically don't need to send a delete, but our sync manager isn't smart enough yet 
    // to cancel pending creates. Sending a delete for a non-existent ID on server might fail or be ignored.
    // For robusteness, we just queue it.
    await syncManager.addToQueue({
        type: 'delete',
        entity: 'session',
        data: { id }
    });
}

export async function getActiveSession(): Promise<PreCountSession | null> {
    const sessions = await getActiveSessions();
    return sessions.length > 0 ? sessions[0] : null;
}


export async function updateSession(id: string, updates: any): Promise<void> {
    const { totalProducts, totalUnits, errorCount, ...dbUpdates } = updates;

    // 1. Update Local
    await db.sessions.update(id, dbUpdates);

    // 2. Queue Sync
    await syncManager.addToQueue({
        type: 'update',
        entity: 'session',
        data: { id, ...dbUpdates }
    });
}

export async function endSession(id: string): Promise<void> {
    const now = new Date().toISOString();

    // 1. Update Local
    await db.sessions.update(id, { status: 'completed', end_time: now });

    // 2. Queue Sync
    await syncManager.addToQueue({
        type: 'update',
        entity: 'session',
        data: { id, status: 'completed', end_time: now }
    });
}

// --- Items ---

export async function addPreCountItem(item: { session_id: string, ean: string, product_name: string, quantity: number }): Promise<PreCountItem> {
    // Wrapper for upsert to maintain interface compatibility
    return upsertPreCountItem(item);
}

export async function upsertPreCountItem(item: { session_id: string, ean: string, product_name: string, quantity: number }): Promise<PreCountItem> {
    const { data: userData } = await supabase.auth.getUser();

    // Check if item exists locally (deduplication/update logic)
    const existingItem = await db.items
        .where('[session_id+ean]')
        .equals([item.session_id, item.ean])
        .first();

    const now = new Date().toISOString();
    let resultItem: LocalItem;

    if (existingItem) {
        // Update existing
        const newQuantity = existingItem.quantity + item.quantity;
        await db.items.update(existingItem.id, {
            quantity: newQuantity,
            scanned_at: now,
            synced: 0
        });
        resultItem = { ...existingItem, quantity: newQuantity, scanned_at: now };
    } else {
        // Create new
        const newItem: LocalItem = {
            id: uuidv4(),
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: item.quantity,
            scanned_at: now,
            scanned_by: userData.user?.id,
            synced: 0
        };
        await db.items.add(newItem);
        resultItem = newItem;
    }

    // Queue Sync
    // We send 'upsert' equivalent logic. 
    // Ideally we stick to atomic operations.
    // SyncManager handles 'create/update' for items using the RPC 'upsert_precount_item'.
    await syncManager.addToQueue({
        type: 'update', // generic update/upsert
        entity: 'item',
        data: {
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: item.quantity, // NOTE: This is DELTA quantity for the RPC usually, OR absolute?
            // The RPC 'upsert_precount_item' in our SQL usually adds quantity if exists?
            // Let's check the SQL... assumed ADDITIVE based on typical implementation.
            // Wait, if we count locally 5, then 5 again -> Total 10.
            // If we send +5 and +5 to server -> Server has 10. Correct.
            // So we send the DELTA (item.quantity), not the total (resultItem.quantity).
            // BUT resultItem has the TOTAL. 
            // We must be careful passed data.
            scanned_by: userData.user?.id
        }
    });

    return resultItem;
}

export async function getSessionSummary(sessionId: string): Promise<{
    totalProducts: number;
    totalUnits: number;
    lastUpdated: string | null;
}> {
    // High performance local query
    const items = await db.items.where('session_id').equals(sessionId).toArray();

    if (!items.length) {
        return { totalProducts: 0, totalUnits: 0, lastUpdated: null };
    }

    const totalUnits = items.reduce((acc, curr) => acc + curr.quantity, 0);
    // Sort to find last updated
    items.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));

    return {
        totalProducts: items.length,
        totalUnits,
        lastUpdated: items[0].scanned_at
    };
}

export async function updatePreCountItem(id: string, updates: Partial<PreCountItem>): Promise<void> {
    await db.items.update(id, updates);
    // This function is rarely used directly in current flow, usually upsert is used.
    // If used, we might need a specific sync handler.
    // For now, assume it's local only fix or we need to queue a sync if it changes quantity.
}

export async function deletePreCountItem(id: string): Promise<void> {
    await db.items.delete(id);

    await syncManager.addToQueue({
        type: 'delete',
        entity: 'item',
        data: { id }
    });
}

export async function getPreCountItemsBySessionId(sessionId: string): Promise<PreCountItem[]> {
    return await db.items.where('session_id').equals(sessionId).reverse().sortBy('scanned_at');
}

export async function initDB() {
    // Dexie auto-opens on first access, but we can explicit open to catch errors
    try {
        await db.open();
        console.log('Local DB initialized');
    } catch (e) {
        console.error('Failed to open Local DB', e);
    }
}

export async function getAllSessions(): Promise<PreCountSession[]> {
    return await db.sessions.orderBy('start_time').reverse().toArray();
}

export async function getSessionItems(sessionOrId: string | PreCountSession): Promise<PreCountItem[]> {
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
    return getPreCountItemsBySessionId(sessionId);
}
