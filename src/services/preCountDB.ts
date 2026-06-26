import { db, LocalSession, LocalItem } from './db';
import { syncManager } from './syncManager';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

// Device Identification Utility
export const getDeviceId = () => {
    let id = localStorage.getItem('precount_device_id');
    if (!id) {
        id = `dev-${uuidv4().substring(0, 8)}`;
        localStorage.setItem('precount_device_id', id);
    }
    return id;
};

export const getDeviceName = () => {
    return localStorage.getItem('precount_device_name') || 'Generic Device';
};

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

// ============ COLECTOR DE DATOS (OFFLINE FIRST) ============

export interface MasterCatalogItem {
    ean: string;
    eans?: string[];
    isPrimaryEan?: boolean; // true solo en el primer EAN; false en los secundarios
    id_producto: string;
    name: string;
    systemStock: number;
    cost: number;
    salePrice: number;
    laboratory?: string;
    rubro?: string;
}

export interface PreCountSession extends LocalSession {
    totalProducts?: number;
    totalUnits?: number;
    errorCount?: number;
    sync_pin?: string;
    master_catalog?: MasterCatalogItem[];
}

export type PreCountItem = LocalItem;

// --- Sesiones ---

export async function createSession(sector: string, branch_id?: string, master_catalog?: MasterCatalogItem[], sync_pin?: string): Promise<PreCountSession> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const newSession: PreCountSession = {
        id: sessionId,
        sector,
        start_time: now,
        status: 'active',
        user_id: userId,
        branch_id: branch_id,
        synced: 0,
        sync_pin,
        master_catalog: master_catalog || []
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


export async function getActiveSessions(options?: { branchId?: string, role?: string }): Promise<PreCountSession[]> {
    // 1. Read sessions from Local DB first (immediate results)
    let localSessions = await db.sessions
        .where('status')
        .equals('active')
        .reverse()
        .sortBy('start_time') as PreCountSession[];

    // 1.1 Filter local by branch if provided, but allow global sessions (branch_id null)
    if (options?.branchId && options.role === 'branch') {
        localSessions = localSessions.filter(s => s.branch_id === options.branchId || !s.branch_id);
    }

    // 2. If online, try to fetch/sync from Supabase to get latest counts
    if (navigator.onLine) {
        try {
            // Get pending deletes to avoid resurrecting them
            const pendingDeletes = await db.pendingActions
                .where('entity').equals('session')
                .and(a => (a as any).type === 'delete')
                .toArray();
            const deletedIds = new Set(pendingDeletes.map(d => d.data.id));

            let query: any = supabase
                .from('precount_sessions')
                .select(`
                    *,
                    items:precount_items(quantity)
                `)
                .eq('status', 'active');
            
            // Filter by branch on server if branch user, but allow global sessions (branch_id null)
            if (options?.branchId && options.role === 'branch') {
                query = query.or(`branch_id.eq.${options.branchId},branch_id.is.null`);
            }

            const { data: remoteSessions, error: sError } = await query;

            if (!sError && remoteSessions) {
                const rawSessions = remoteSessions as any[];
                const remoteIds = new Set(rawSessions.map(rs => rs.id));
                // Filter out those we just deleted locally but haven't synced yet
                const filteredRemote = rawSessions.filter(rs => !deletedIds.has(rs.id));

                // Update local sessions with remote ones (simple merge and sync counts)
                for (const rs of filteredRemote) {
                    const { items: _items, ...sessionData } = rs;
                    const remoteTotalProducts = rs.items?.length || 0;
                    const remoteTotalUnits = rs.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;

                    await db.sessions.put({
                        ...sessionData,
                        synced: 1
                    } as LocalSession);
                }
                
                // Refresh localSessions after merge
                localSessions = await db.sessions
                    .where('status')
                    .equals('active')
                    .reverse()
                    .sortBy('start_time') as PreCountSession[];
            }
        } catch (error) {
            console.error('Error fetching remote sessions:', error);
        }
    }

    // 3. Fallback: Enrich local sessions with counts from Local Items
    for (const session of localSessions) {
        const items = await db.items.where('session_id').equals(session.id).toArray();
        session.totalProducts = items.length;
        session.totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    }

    return localSessions;
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

export async function upsertPreCountItem(item: { 
    session_id: string, 
    ean: string, 
    product_name: string, 
    quantity: number, 
    id_producto?: string, 
    location_tag?: string 
}): Promise<PreCountItem> {
    const { data: userData } = await supabase.auth.getUser();
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    // Check if item exists locally FOR THIS DEVICE AND LOCATION
    const existingItem = await db.items
        .where('[session_id+ean+device_id]')
        .equals([item.session_id, item.ean, deviceId])
        .filter(i => i.location_tag === item.location_tag)
        .first();

    const now = new Date().toISOString();
    let resultItem: LocalItem;

    if (existingItem) {
        // Update existing
        const newQuantity = existingItem.quantity + item.quantity;
        await db.items.update(existingItem.id, {
            quantity: newQuantity,
            scanned_at: now,
            synced: 1, // Optimistic: assume success
            id_producto: item.id_producto || existingItem.id_producto,
            device_name: deviceName,
            location_tag: item.location_tag
        });
        resultItem = { 
            ...existingItem, 
            quantity: newQuantity, 
            scanned_at: now, 
            id_producto: item.id_producto || existingItem.id_producto,
            device_name: deviceName,
            location_tag: item.location_tag
        };
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
            synced: 1, // Optimistic: assume success
            id_producto: item.id_producto,
            device_id: deviceId,
            device_name: deviceName,
            location_tag: item.location_tag
        };
        await db.items.add(newItem);
        resultItem = newItem;
    }

    // Queue Sync with full metadata to avoid deletion mismatch
    await syncManager.addToQueue({
        type: 'update',
        entity: 'item',
        data: {
            id: resultItem.id, // Pass the local UUID to Supabase
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: item.quantity,
            scanned_by: userData.user?.id,
            id_producto: item.id_producto || existingItem?.id_producto,
            device_id: deviceId,
            device_name: deviceName,
            location_tag: item.location_tag
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
    // 1. Update Local
    await db.items.update(id, updates);

    // 2. Queue Sync
    await syncManager.addToQueue({
        type: 'update',
        entity: 'item',
        data: { id, ...updates }
    });
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
        console.warn('Failed to open Local DB, attempting recovery...', e);
        try {
            await db.delete();
            await db.open();
            console.log('Local DB recovered after schema reset');
        } catch (e2) {
            console.error('Local DB recovery failed', e2);
        }
    }
}

export async function getAllSessions(): Promise<PreCountSession[]> {
    return await db.sessions.orderBy('start_time').reverse().toArray();
}

export async function getSessionItems(sessionOrId: string | PreCountSession): Promise<PreCountItem[]> {
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
    return getPreCountItemsBySessionId(sessionId);
}

// --- Zonas / Ubicaciones ---

export async function getLocationStatus(sessionId: string, locationTag: string) {
    // 1. Local check
    const local = await db.locations
        .where('[session_id+location_tag]')
        .equals([sessionId, locationTag])
        .first();
    
    if (local) return local;

    // 2. Remote check if online
    if (navigator.onLine) {
        const { data, error } = await (supabase as any)
            .from('precount_location_status')
            .select('*')
            .eq('session_id', sessionId)
            .eq('location_tag', locationTag)
            .maybeSingle();
        
        if (data && !error) {
            const statusData = data as any;
            await db.locations.put({
                session_id: sessionId,
                location_tag: locationTag,
                status: statusData.status,
                closed_at: statusData.closed_at
            });
            return statusData;
        }
    }
    return null;
}

export async function updateLocationStatus(sessionId: string, locationTag: string, status: 'open' | 'closed') {
    const now = new Date().toISOString();
    
    // 1. Local
    await db.locations.put({
        session_id: sessionId,
        location_tag: locationTag,
        status,
        closed_at: status === 'closed' ? now : undefined
    });

    // 2. Sync
    if (navigator.onLine) {
        await (supabase as any).rpc('toggle_precount_location', {
            p_session_id: sessionId,
            p_location_tag: locationTag,
            p_status: status
        });
    } else {
        await syncManager.addToQueue({
            type: 'update',
            entity: 'session', // Reusing session sync for location tags or we could make a new one
            data: { 
                action: 'toggle_location',
                session_id: sessionId, 
                location_tag: locationTag, 
                status 
            }
        });
    }
}

/**
 * Direct lookup for a session by its sync PIN.
 * Used when a device tries to join but doesn't have the session in its local list yet.
 */
export async function getSessionByPin(pin: string): Promise<PreCountSession | null> {
    if (!navigator.onLine) return null;

    try {
        const { data, error } = await (supabase as any)
            .from('precount_sessions')
            .select(`
                *,
                items:precount_items(quantity)
            `)
            .eq('sync_pin', pin)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            console.error('Supabase error in getSessionByPin:', error);
            return null;
        }
        
        if (!data) {
            console.warn(`No session found for PIN: ${pin}`);
            return null;
        }

        const sessionData = data as any;
        
        // Calculate totals from items
        const remoteTotalProducts = sessionData.items?.length || 0;
        const remoteTotalUnits = sessionData.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;

        const session: PreCountSession = {
            id: sessionData.id,
            sector: sessionData.sector,
            start_time: sessionData.start_time,
            status: sessionData.status,
            user_id: sessionData.user_id,
            branch_id: sessionData.branch_id,
            sync_pin: sessionData.sync_pin,
            master_catalog: sessionData.master_catalog || [],
            synced: 1,
            totalProducts: remoteTotalProducts,
            totalUnits: remoteTotalUnits
        };

        // Save to local DB so it's available for the app
        await db.sessions.put(session as any);

        return session;
    } catch (err) {
        console.error('Error fetching session by PIN:', err);
        return null;
    }
}

