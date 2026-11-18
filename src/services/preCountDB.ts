import { db, LocalSession, LocalItem } from './db';
import { syncManager } from './syncManager';
import { supabase } from '@/integrations/supabase/client';
import { isTauriEnvironment } from '@/services/mysqlTauriBridge';
import { decompressGzipBase64ToJson } from '@/lib/compression';
import {
    fetchAllSupabasePages,
    getErrorMessage,
    isNetworkOnline,
    withNetworkRetry
} from './supabaseHelpers';

// Device Identification Utility
export const getDeviceId = () => {
    let id = localStorage.getItem('precount_device_id');
    if (!id) {
        id = `dev-${crypto.randomUUID().substring(0, 8)}`;
        localStorage.setItem('precount_device_id', id);
    }
    return id;
};

export const getDeviceName = () => {
    const configuredName = typeof window !== 'undefined' ? localStorage.getItem('precount_device_name') : null;
    if (configuredName && configuredName.trim() && configuredName !== 'Generic Device') {
        return configuredName.trim();
    }
    try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('farmaplus_user') : null;
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.name || parsed.username) {
                return parsed.name || parsed.username;
            }
        }
    } catch {}
    return 'Generic Device';
};

// Re-export product functionality from the new service
export {
    type Product,
    addProducts,
    ensureConfigProduct,
    searchProducts,
    getProductByEAN,
    getProductByEanOrId,
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
    subrubro?: string;
    is_hidden?: boolean;
    is_traceable?: boolean;
    gtin?: string;
    id_producto_padre?: string;
    unidades_padre?: number;
    parent_ean?: string;
    parent_name?: string;
    is_parent?: boolean;
}

export interface PreCountSession extends LocalSession {
    totalProducts?: number;
    totalUnits?: number;
    errorCount?: number;
    sync_pin?: string;
    master_catalog?: MasterCatalogItem[];
    profile?: 'sucursal' | 'sap';
}

export type PreCountItem = LocalItem;

export const getCachedUserId = (): string | undefined => {
    try {
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('farmaplus_user') : null;
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) {
                return parsed.id;
            }
        }
    } catch {}
    return undefined;
};

// --- Sesiones ---

export async function createSession(sector: string, branch_id?: string, master_catalog?: MasterCatalogItem[], sync_pin?: string, profile?: 'sucursal' | 'sap'): Promise<PreCountSession> {
    const userId = getCachedUserId();

    const sessionId = crypto.randomUUID();
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
        master_catalog: master_catalog || [],
        profile: profile || 'sucursal'
    };

    // 1. Save to Local DB
    await db.sessions.add(newSession);

    // 2. Queue for Sync (no incluir master_catalog para evitar saturar IndexedDB en offlineQueue; se gestiona por precount_device_files)
    const { master_catalog: _mc, ...sessionToQueue } = newSession;
    await syncManager.addToQueue({
        type: 'create',
        entity: 'session',
        data: sessionToQueue
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

    // 1.1 Filter local by branch if provided for branch role
    if (options?.branchId && options.role === 'branch') {
        localSessions = localSessions.filter(s => s.branch_id === options.branchId);
    }

    // 2. If online, try to fetch/sync from Supabase to get latest counts
    if (navigator.onLine) {
        try {
            // Get pending actions for sessions to avoid resurrecting deleted ones or purging newly created offline ones
            const pendingSessionActions = await db.pendingActions
                .where('entity').equals('session')
                .toArray();
            const deletedIds = new Set(
                pendingSessionActions.filter(a => (a as any).type === 'delete').map(d => d.data.id)
            );
            const pendingCreateIds = new Set(
                pendingSessionActions.filter(a => (a as any).type === 'create').map(c => c.data.id)
            );

            let query: any = supabase
                .from('precount_sessions')
                .select('*')
                .eq('status', 'active');
            
            // Filter strictly by branch on server if branch user
            if (options?.branchId && options.role === 'branch') {
                query = query.eq('branch_id', options.branchId);
            }

            const remoteSessions = await withNetworkRetry(async () => {
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            }, { maxAttempts: 2, label: 'getActiveSessions' });

            if (remoteSessions) {
                const rawSessions = remoteSessions as any[];
                const remoteIds = new Set(rawSessions.map(rs => rs.id));
                // Filter out those we just deleted locally but haven't synced yet
                const filteredRemote = rawSessions.filter(rs => !deletedIds.has(rs.id));

                // Purgar de Dexie cualquier sesión local que ya no exista en Supabase y no tenga un create pendiente
                const allLocalActive = await db.sessions.where('status').equals('active').toArray();
                for (const ls of allLocalActive) {
                    const belongsToScope = !(options?.branchId && options.role === 'branch') || ls.branch_id === options.branchId;
                    if (belongsToScope && !remoteIds.has(ls.id) && !pendingCreateIds.has(ls.id)) {
                        await db.sessions.delete(ls.id);
                        await db.items.where('session_id').equals(ls.id).delete();
                        await db.locations.where('session_id').equals(ls.id).delete();
                        await db.precount_products.where('session_id').equals(ls.id).delete();
                    }
                }

                // Update local sessions with remote ones (preserving local master_catalog)
                for (const rs of filteredRemote) {
                    const existingLocal = (localSessions.find(ls => ls.id === rs.id) || await db.sessions.get(rs.id)) as any;

                    await db.sessions.put({
                        ...existingLocal,
                        ...rs,
                        synced: 1,
                        master_catalog: existingLocal?.master_catalog || rs.master_catalog || [],
                        profile: existingLocal?.profile || rs.profile || 'sucursal',
                        errorCount: existingLocal?.errorCount || rs.errorCount || 0
                    } as LocalSession);
                }
                
                // Refresh localSessions after purge & merge
                localSessions = await db.sessions
                    .where('status')
                    .equals('active')
                    .reverse()
                    .sortBy('start_time') as PreCountSession[];

                if (options?.branchId && options.role === 'branch') {
                    localSessions = localSessions.filter(s => s.branch_id === options.branchId);
                }
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
    await db.items.where('session_id').equals(id).delete();
    await db.locations.where('session_id').equals(id).delete();
    await db.precount_products.where('session_id').equals(id).delete();

    // 2. Queue first so orphan child actions are purged and delete survives tab close / offline
    await syncManager.addToQueue({
        type: 'delete',
        entity: 'session',
        data: { id }
    }, { skipFlush: isNetworkOnline() });

    if (!isNetworkOnline()) {
        return;
    }

    // 3. Best-effort immediate cascade delete in Supabase when online
    try {
        const childTables = [
            'precount_connected_devices',
            'precount_location_status',
            'precount_device_files',
            'precount_serials',
            'precount_items'
        ];
        for (const table of childTables) {
            const { error } = await (supabase as any).from(table).delete().eq('session_id', id);
            if (error && String(error.code || '') !== '42P01') throw error;
        }
        const { error: sessErr } = await (supabase as any).from('precount_sessions').delete().eq('id', id);
        if (sessErr) throw sessErr;

        await db.pendingActions.where('dedupeKey').equals(`session:${id}`).delete();
    } catch (e) {
        console.warn('[preCountDB] Remote cascade delete deferred to SyncManager:', e);
        void syncManager.processQueue();
    }
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

export interface ParentChildRule {
    id_producto_padre: string;
    unidades_padre: number;
    parent_ean?: string;
    parent_name?: string;
}

export async function resolveParentChildRule(
    sessionId: string,
    ean?: string,
    idProducto?: string
): Promise<ParentChildRule | null> {
    if (!sessionId) return null;
    try {
        let match: any = null;
        if (ean) {
            match = await db.precount_products
                .where('[session_id+ean]')
                .equals([sessionId, ean])
                .first();
        }
        if (!match && idProducto) {
            match = await db.precount_products
                .where('session_id')
                .equals(sessionId)
                .filter(p => String(p.id_producto).trim() === String(idProducto).trim())
                .first();
        }
        if (!match) {
            const sess = await db.sessions.get(sessionId);
            const mc = sess?.master_catalog;
            if (Array.isArray(mc)) {
                match = mc.find((p: any) =>
                    (ean && (p.ean === ean || (Array.isArray(p.eans) && p.eans.includes(ean)))) ||
                    (idProducto && String(p.id_producto).trim() === String(idProducto).trim())
                );
            }
        }
        if (match && match.id_producto_padre && Number(match.unidades_padre) > 1) {
            const parentId = String(match.id_producto_padre).trim();
            const selfId = String(match.id_producto || idProducto || '').trim();
            if (parentId && parentId !== '0' && parentId !== selfId) {
                return {
                    id_producto_padre: parentId,
                    unidades_padre: Number(match.unidades_padre),
                    parent_ean: match.parent_ean || undefined,
                    parent_name: match.parent_name || undefined,
                };
            }
        }
    } catch {}
    return null;
}

/**
 * Aplica la conversión Padre-Hijo sobre un mapa consolidado de productos
 * (usado en la tabla Admin y al compilar la exportación consolidada a Plex).
 */
export function applyParentChildConversionToMap(
    compiledMap: Map<string, { id_producto: string; ean: string; quantity: number }>,
    catalog: MasterCatalogItem[]
): void {
    if (!catalog || catalog.length === 0 || compiledMap.size === 0) return;

    const ruleByKey = new Map<string, ParentChildRule>();
    for (const item of catalog) {
        if (item.id_producto_padre && Number(item.unidades_padre) > 1) {
            const rule: ParentChildRule = {
                id_producto_padre: String(item.id_producto_padre).trim(),
                unidades_padre: Number(item.unidades_padre),
                parent_ean: item.parent_ean,
                parent_name: item.parent_name,
            };
            if (item.id_producto) ruleByKey.set(String(item.id_producto).trim(), rule);
            if (item.ean) ruleByKey.set(String(item.ean).trim(), rule);
        }
    }

    for (const [key, entry] of Array.from(compiledMap.entries())) {
        const rule = ruleByKey.get(entry.id_producto) || ruleByKey.get(entry.ean) || ruleByKey.get(key);
        if (!rule || rule.unidades_padre <= 1) continue;
        if (entry.quantity < rule.unidades_padre) continue;

        const parentsToAdd = Math.floor(entry.quantity / rule.unidades_padre);
        const remainder = entry.quantity % rule.unidades_padre;
        if (parentsToAdd <= 0) continue;

        const parentKey = rule.id_producto_padre;
        const parentEntry = compiledMap.get(parentKey);
        if (parentEntry) {
            parentEntry.quantity += parentsToAdd;
        } else {
            compiledMap.set(parentKey, {
                id_producto: rule.id_producto_padre,
                ean: rule.parent_ean || rule.id_producto_padre,
                quantity: parentsToAdd,
            });
        }

        if (remainder > 0) {
            entry.quantity = remainder;
        } else {
            compiledMap.delete(key);
        }
    }
}

// Ventana de protección en memoria (20s) para evitar carreras entre syncRemoteItems en vuelo y altas/bajas locales
const RECENT_OP_TTL_MS = 20_000;
const recentlySavedItems = new Map<string, number>();
const recentlyDeletedItems = new Map<string, number>();

export function markItemRecentlySaved(id: string) {
    if (!id) return;
    recentlyDeletedItems.delete(id);
    recentlySavedItems.set(id, Date.now() + RECENT_OP_TTL_MS);
}

export function markItemsRecentlyDeleted(ids: string[]) {
    const exp = Date.now() + RECENT_OP_TTL_MS;
    for (const id of ids) {
        if (!id) continue;
        recentlySavedItems.delete(id);
        recentlyDeletedItems.set(id, exp);
    }
}

export function isItemRecentlySaved(id: string): boolean {
    const exp = recentlySavedItems.get(id);
    if (!exp) return false;
    if (Date.now() > exp) {
        recentlySavedItems.delete(id);
        return false;
    }
    return true;
}

export function isItemRecentlyDeleted(id: string): boolean {
    const exp = recentlyDeletedItems.get(id);
    if (!exp) return false;
    if (Date.now() > exp) {
        recentlyDeletedItems.delete(id);
        return false;
    }
    return true;
}

export async function upsertPreCountItem(item: { 
    session_id: string, 
    ean: string, 
    product_name: string, 
    quantity: number, 
    id_producto?: string, 
    location_tag?: string,
    laboratory?: string,
    rubro?: string,
    device_name?: string,
    _skipParentConversion?: boolean,
    _targetDeviceId?: string
}): Promise<PreCountItem> {
    const userId = getCachedUserId();
    const deviceId = getDeviceId();
    const targetDeviceId = (item._targetDeviceId && item._targetDeviceId.trim()) ? item._targetDeviceId.trim() : deviceId;
    const effectiveDeviceName = (item.device_name && item.device_name.trim()) ? item.device_name.trim() : getDeviceName();

    // Check if item exists locally FOR THIS DEVICE AND LOCATION
    const existingItem = await db.items
        .where('[session_id+ean+device_id]')
        .equals([item.session_id, item.ean, targetDeviceId])
        .filter(i => i.location_tag === item.location_tag)
        .first();

    // Resolver id_producto desde catálogo si no fue provisto
    let resolvedIdProducto = (item.id_producto || existingItem?.id_producto || '').trim();
    if (!resolvedIdProducto && item.session_id && item.ean) {
        try {
            const catItem = await db.precount_products
                .where('[session_id+ean]')
                .equals([item.session_id, item.ean])
                .first();
            if (catItem?.id_producto) {
                resolvedIdProducto = String(catItem.id_producto).trim();
            } else {
                const byId = await db.precount_products
                    .where('session_id')
                    .equals(item.session_id)
                    .filter(p => String(p.id_producto).trim() === item.ean)
                    .first();
                if (byId?.id_producto) {
                    resolvedIdProducto = String(byId.id_producto).trim();
                }
            }
        } catch {}
    }
    if (!resolvedIdProducto && item.ean) {
        resolvedIdProducto = item.ean.trim();
    }

    const now = new Date().toISOString();
    let effectiveInputQty = existingItem ? (existingItem.quantity + item.quantity) : item.quantity;

    // Conversión automática Hijo -> Padre cuando alcanza o supera unidades_padre
    if (!item._skipParentConversion && effectiveInputQty > 0) {
        const rule = await resolveParentChildRule(item.session_id, item.ean, resolvedIdProducto);
        if (rule && rule.unidades_padre > 1 && effectiveInputQty >= rule.unidades_padre) {
            const parentsToAdd = Math.floor(effectiveInputQty / rule.unidades_padre);
            const remainderQty = effectiveInputQty % rule.unidades_padre;

            const parentItem = await upsertPreCountItem({
                session_id: item.session_id,
                ean: rule.parent_ean || rule.id_producto_padre,
                product_name: rule.parent_name || `Producto ${rule.id_producto_padre}`,
                quantity: parentsToAdd,
                id_producto: rule.id_producto_padre,
                location_tag: item.location_tag,
                laboratory: item.laboratory,
                rubro: item.rubro,
                device_name: effectiveDeviceName,
                _skipParentConversion: true,
            });

            if (remainderQty <= 0) {
                if (existingItem) {
                    await deletePreCountItem(existingItem.id);
                }
                return parentItem;
            }
            effectiveInputQty = remainderQty;
        }
    }

    let resultItem: LocalItem;

    if (existingItem) {
        // Update existing
        const newQuantity = effectiveInputQty;
        await db.items.update(existingItem.id, {
            quantity: newQuantity,
            scanned_at: now,
            synced: 0, // Unsynced until confirmed by syncManager
            id_producto: resolvedIdProducto || existingItem.id_producto,
            laboratory: item.laboratory || existingItem.laboratory,
            rubro: item.rubro || existingItem.rubro,
            device_name: effectiveDeviceName,
            location_tag: item.location_tag
        });
        resultItem = { 
            ...existingItem, 
            quantity: newQuantity, 
            scanned_at: now, 
            synced: 0,
            id_producto: resolvedIdProducto || existingItem.id_producto,
            laboratory: item.laboratory || existingItem.laboratory,
            rubro: item.rubro || existingItem.rubro,
            device_name: effectiveDeviceName,
            location_tag: item.location_tag
        };
    } else {
        // Create new
        const newItem: LocalItem = {
            id: crypto.randomUUID(),
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: effectiveInputQty,
            scanned_at: now,
            scanned_by: userId,
            synced: 0, // Unsynced until confirmed by syncManager
            id_producto: resolvedIdProducto || undefined,
            laboratory: item.laboratory,
            rubro: item.rubro,
            device_id: targetDeviceId,
            device_name: effectiveDeviceName,
            location_tag: item.location_tag
        };
        await db.items.add(newItem);
        resultItem = newItem;
    }

    markItemRecentlySaved(resultItem.id);

    // Queue Sync with full metadata to avoid deletion mismatch
    await syncManager.addToQueue({
        type: existingItem ? 'update' : 'create',
        entity: 'item',
        data: {
            id: resultItem.id, // Pass the local UUID to Supabase
            session_id: item.session_id,
            ean: item.ean,
            product_name: item.product_name,
            quantity: resultItem.quantity,
            scanned_by: userId,
            scanned_at: resultItem.scanned_at,
            id_producto: resolvedIdProducto || existingItem?.id_producto,
            device_id: targetDeviceId,
            device_name: effectiveDeviceName,
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
    const preItem = await db.items.get(id);
    if (preItem && updates.quantity !== undefined && updates.quantity > 0) {
        const rule = await resolveParentChildRule(preItem.session_id, preItem.ean, preItem.id_producto);
        if (rule && rule.unidades_padre > 1 && updates.quantity >= rule.unidades_padre) {
            const parentsToAdd = Math.floor(updates.quantity / rule.unidades_padre);
            const remainderQty = updates.quantity % rule.unidades_padre;

            await upsertPreCountItem({
                session_id: preItem.session_id,
                ean: rule.parent_ean || rule.id_producto_padre,
                product_name: rule.parent_name || `Producto ${rule.id_producto_padre}`,
                quantity: parentsToAdd,
                id_producto: rule.id_producto_padre,
                location_tag: updates.location_tag ?? preItem.location_tag,
                laboratory: preItem.laboratory,
                rubro: preItem.rubro,
                device_name: preItem.device_name,
                _skipParentConversion: true,
                _targetDeviceId: preItem.device_id,
            });

            if (remainderQty <= 0) {
                await deletePreCountItem(id);
                return;
            }
            updates = { ...updates, quantity: remainderQty };
        }
    }

    // 1. Update Local
    await db.items.update(id, { ...updates, synced: 0 });
    const item = await db.items.get(id);

    const hasPendingCreate = (await db.pendingActions
        .where('dedupeKey')
        .equals(`item:${id}`)
        .filter(a => a.type === 'create')
        .count()) > 0;

    // 2. Queue-before-send to guarantee zero lost edits if offline, pending create, or tab closes
    await syncManager.addToQueue({
        type: 'update',
        entity: 'item',
        data: item ? { ...item, ...updates } : { id, ...updates }
    }, { skipFlush: true });

    if (!isNetworkOnline() || hasPendingCreate || !item) {
        if (isNetworkOnline()) {
            void syncManager.processQueue();
        }
        return;
    }

    // 3. Direct verified update to Supabase when online and parent row already exists
    if (!hasPendingCreate) {
        try {
            const cleanUpdates: any = {};
            if (updates.quantity !== undefined) cleanUpdates.quantity = updates.quantity;
            if (updates.location_tag !== undefined) cleanUpdates.location_tag = updates.location_tag;
            if (updates.product_name !== undefined) cleanUpdates.product_name = updates.product_name;
            if (updates.id_producto !== undefined) cleanUpdates.id_producto = updates.id_producto;

            const { data: updatedRows, error } = await supabase
                .from('precount_items')
                .update(cleanUpdates)
                .eq('id', id)
                .select('id');

            if (!error && updatedRows && updatedRows.length > 0) {
                await db.items.update(id, { synced: 1 });
                await db.pendingActions
                    .where('dedupeKey')
                    .equals(`item:${id}`)
                    .filter(action => action.type === 'update' && action.status !== 'syncing')
                    .delete();
                return;
            }
        } catch (e) {
            console.warn('[preCountDB] Direct update deferred to SyncManager:', e);
        }
    }

    void syncManager.processQueue();
}

async function queueAndTryDeleteItems(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    const existingRows = await db.items.bulkGet(ids);
    const wasSyncedMap = new Map<string, boolean>();
    ids.forEach((id, idx) => {
        wasSyncedMap.set(id, existingRows[idx]?.synced === 1);
    });

    markItemsRecentlyDeleted(ids);
    await db.items.bulkDelete(ids);

    // Encolar antes de llamar a Supabase para no perder borrados ante cierre abrupto u offline
    for (const id of ids) {
        const wasSynced = wasSyncedMap.get(id) === true;
        await syncManager.addToQueue({
            type: 'delete',
            entity: 'item',
            data: {
                id,
                _skipRemoteIfNeverSynced: !wasSynced
            }
        }, { skipFlush: true });
    }

    if (!isNetworkOnline()) {
        return;
    }

    // Enviar DELETE a Supabase para todos los IDs (si aún no existía en servidor es no-op; si syncManager ya lo subió, lo borra)
    const remoteIds = ids.filter(Boolean);
    if (remoteIds.length === 0) {
        return;
    }

    try {
        const { error } = await supabase.from('precount_items').delete().in('id', remoteIds);
        if (!error) {
            const keys = remoteIds.map(id => `item:${id}`);
            await db.pendingActions
                .where('dedupeKey')
                .anyOf(keys)
                .filter(a => a.type === 'delete' && a.status !== 'syncing')
                .delete();
            return;
        }
    } catch (e) {
        console.warn('[preCountDB] Direct delete deferred to SyncManager:', e);
    }

    void syncManager.processQueue();
}

export async function deletePreCountItem(id: string): Promise<void> {
    if (!id) return;
    await queueAndTryDeleteItems([id]);
}

export async function deletePreCountItems(ids: string[]): Promise<void> {
    await queueAndTryDeleteItems(ids);
}

export async function getPreCountItemsBySessionId(sessionId: string): Promise<PreCountItem[]> {
    const items = await db.items.where('session_id').equals(sessionId).toArray();
    items.sort((a, b) => {
        const timeA = a.scanned_at ? new Date(a.scanned_at).getTime() : 0;
        const timeB = b.scanned_at ? new Date(b.scanned_at).getTime() : 0;
        return timeB - timeA;
    });
    return items;
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

async function upsertLocalLocationStatus(
    sessionId: string,
    normTag: string,
    status: 'open' | 'closed',
    closedAt?: string
): Promise<void> {
    const existing = await db.locations
        .where('[session_id+location_tag]')
        .equals([sessionId, normTag])
        .first();
    const payload = {
        session_id: sessionId,
        location_tag: normTag,
        status,
        ...(closedAt ? { closed_at: closedAt } : {})
    };
    if (existing?.id) {
        await db.locations.update(existing.id, payload);
    } else {
        await db.locations.add(payload);
    }
}

export async function getLocationStatus(sessionId: string, locationTag: string) {
    const normTag = locationTag.trim().toUpperCase();
    // 1. Local check
    const local = await db.locations
        .where('[session_id+location_tag]')
        .equals([sessionId, normTag])
        .first();
    
    if (local) return local;

    // 2. Remote check if online
    if (isNetworkOnline()) {
        const { data, error } = await (supabase as any)
            .from('precount_location_status')
            .select('*')
            .eq('session_id', sessionId)
            .eq('location_tag', normTag)
            .maybeSingle();
        
        if (data && !error) {
            const statusData = data as any;
            await upsertLocalLocationStatus(sessionId, normTag, statusData.status, statusData.closed_at);
            return statusData;
        }
    }
    return null;
}

export interface ClaimLocationResult {
    success: boolean;
    code: 'GRANTED' | 'OCCUPIED' | 'ALREADY_CLOSED' | 'NOT_CONFIGURED' | 'INVALID_ARGUMENTS' | 'ERROR';
    location_tag?: string;
    message?: string;
    opened_by_user?: string;
    opened_by_device?: string;
    opened_at?: string;
    closed_by_user?: string;
    closed_by_device?: string;
    closed_at?: string;
}

/**
 * Intenta reclamar y abrir una posición/sector de forma atómica en Supabase.
 * Valida concurrencia:
 * - Si ya está cerrada -> Rechaza (ALREADY_CLOSED)
 * - Si ya está abierta por otro operador/terminal -> Rechaza (OCCUPIED)
 * - Si no está preconfigurada por admin -> Rechaza (NOT_CONFIGURED)
 * - Si está libre -> Asigna atómicamente y emite broadcast Realtime (<50ms)
 */
export async function claimOrValidateLocation(
    sessionId: string,
    locationTag: string,
    operatorName?: string,
    deviceName?: string,
    deviceId?: string
): Promise<ClaimLocationResult> {
    const normTag = locationTag.trim().toUpperCase();
    const dId = deviceId || getDeviceId();
    const dName = deviceName || getDeviceName();
    const uName = operatorName || dName;

    // 1. Verificación local rápida en Dexie
    try {
        const local = await db.locations
            .where('[session_id+location_tag]')
            .equals([sessionId, normTag])
            .first();
        if (local && local.status === 'closed') {
            return {
                success: false,
                code: 'ALREADY_CLOSED',
                location_tag: normTag,
                message: 'El sector ya fue contabilizado y cerrado localmente.',
                closed_at: local.closed_at
            };
        }
    } catch {}

    // 2. Si hay conexión, ejecutar validación atómica por RPC en Supabase
    if (isNetworkOnline()) {
        try {
            const { data, error } = await (supabase as any).rpc('claim_or_validate_location', {
                p_session_id: sessionId,
                p_location_tag: normTag,
                p_user_name: uName,
                p_device_id: dId,
                p_device_name: dName
            });

            if (!error && data) {
                const res = data as ClaimLocationResult;
                if (res.success) {
                    await upsertLocalLocationStatus(sessionId, normTag, 'open');
                    import('./deviceTelemetry').then(({ broadcastSectorStatusChange }) => {
                        broadcastSectorStatusChange(sessionId, {
                            location_tag: normTag,
                            status: 'open',
                            user_name: uName,
                            device_name: dName,
                            device_id: dId,
                            opened_at: new Date().toISOString()
                        }).catch(() => {});
                    });
                } else if (res.code === 'ALREADY_CLOSED') {
                    await upsertLocalLocationStatus(sessionId, normTag, 'closed', res.closed_at || new Date().toISOString());
                }
                return res;
            }

            // Fallback a toggle_precount_location solo si la función nueva no existe en la DB
            const errCode = String((error as any)?.code || '');
            const errMsg = getErrorMessage(error).toLowerCase();
            if (errCode === 'PGRST202' || errCode === '42883' || errMsg.includes('could not find the function')) {
                console.warn('[claimOrValidateLocation] Fallback a toggle_precount_location:', error);
                const { error: fbErr } = await (supabase as any).rpc('toggle_precount_location', {
                    p_session_id: sessionId,
                    p_location_tag: normTag,
                    p_status: 'open'
                });
                if (fbErr) throw fbErr;

                await upsertLocalLocationStatus(sessionId, normTag, 'open');
                import('./deviceTelemetry').then(({ broadcastSectorStatusChange }) => {
                    broadcastSectorStatusChange(sessionId, {
                        location_tag: normTag,
                        status: 'open',
                        user_name: uName,
                        device_name: dName,
                        device_id: dId
                    }).catch(() => {});
                });
                return { success: true, code: 'GRANTED', location_tag: normTag };
            }

            if (error) throw error;
        } catch (err: any) {
            console.error('[claimOrValidateLocation] Error en red, resguardando en cola:', err);
        }
    }

    // 3. Fallback Offline o fallo de red: Asignar en Dexie y encolar en entity: 'location'
    await upsertLocalLocationStatus(sessionId, normTag, 'open');
    await syncManager.addToQueue({
        type: 'update',
        entity: 'location',
        data: {
            session_id: sessionId,
            location_tag: normTag,
            status: 'open',
            user_name: uName,
            device_id: dId,
            device_name: dName
        }
    });

    return {
        success: true,
        code: 'GRANTED',
        location_tag: normTag,
        message: 'Modo offline: sector abierto localmente.'
    };
}

/**
 * Cierra un sector de forma atómica en Supabase y emite notificación inmediata por Realtime.
 */
export async function closeLocationWithSync(
    sessionId: string,
    locationTag: string,
    operatorName?: string,
    deviceName?: string,
    deviceId?: string,
    unitsCount?: number
): Promise<{ success: boolean; closed_at?: string }> {
    const normTag = locationTag.trim().toUpperCase();
    const now = new Date().toISOString();
    const dId = deviceId || getDeviceId();
    const dName = deviceName || getDeviceName();
    const uName = operatorName || dName;

    // 1. Actualizar Dexie local sin duplicar filas
    await upsertLocalLocationStatus(sessionId, normTag, 'closed', now);

    // 2. Broadcast instantáneo por WebSocket a monitores (<50ms)
    import('./deviceTelemetry').then(({ broadcastSectorStatusChange }) => {
        broadcastSectorStatusChange(sessionId, {
            location_tag: normTag,
            status: 'closed',
            user_name: uName,
            device_name: dName,
            device_id: dId,
            closed_at: now,
            units: unitsCount ?? 0
        }).catch(() => {});
    });

    // 3. Encolar primero para garantizar recuperación si se pierde conexión o se cierra la pestaña
    await syncManager.addToQueue({
        type: 'update',
        entity: 'location',
        data: {
            session_id: sessionId,
            location_tag: normTag,
            status: 'closed',
            user_name: uName,
            device_id: dId,
            device_name: dName
        }
    }, { skipFlush: true });

    if (isNetworkOnline()) {
        try {
            const { data, error } = await (supabase as any).rpc('close_precount_location', {
                p_session_id: sessionId,
                p_location_tag: normTag,
                p_user_name: uName,
                p_device_id: dId,
                p_device_name: dName
            });

            if (!error) {
                await db.pendingActions.where('dedupeKey').equals(`location:${sessionId}:${normTag}`).delete();
                return { success: true, closed_at: data?.closed_at || now };
            }

            const errCode = String((error as any).code || '');
            const errMsg = getErrorMessage(error).toLowerCase();
            if (errCode === 'PGRST202' || errCode === '42883' || errMsg.includes('could not find the function')) {
                const { error: fbErr } = await (supabase as any).rpc('toggle_precount_location', {
                    p_session_id: sessionId,
                    p_location_tag: normTag,
                    p_status: 'closed'
                });
                if (!fbErr) {
                    await db.pendingActions.where('dedupeKey').equals(`location:${sessionId}:${normTag}`).delete();
                    return { success: true, closed_at: now };
                }
                throw fbErr;
            }
            throw error;
        } catch (err) {
            console.error('[closeLocationWithSync] Error en RPC, diferido a SyncManager:', err);
            void syncManager.processQueue();
        }
    }

    return { success: true, closed_at: now };
}

export async function updateLocationStatus(sessionId: string, locationTag: string, status: 'open' | 'closed') {
    if (status === 'closed') {
        return closeLocationWithSync(sessionId, locationTag);
    } else {
        return claimOrValidateLocation(sessionId, locationTag);
    }
}

/**
 * Direct lookup for a session by its sync PIN.
 * Used when a device tries to join but doesn't have the session in its local list yet.
 */
export function expandCatalogToDbProducts(catalog: MasterCatalogItem[], sessionId: string) {
    const rows: any[] = [];
    catalog.forEach(p => {
        const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
        eans.forEach((ean: string) => {
            if (!ean || ean === 'undefined') return;
            rows.push({
                ean,
                name: p.name,
                cost: p.cost || 0,
                salePrice: p.salePrice || 0,
                laboratory: p.laboratory || '',
                rubro: p.rubro || (p as any).category || '',
                subrubro: p.subrubro || '',
                stock: p.systemStock || 0,
                id_producto: p.id_producto || '',
                session_id: sessionId
            });
        });
    });
    return rows;
}

async function findLocalSessionByPin(pin: string): Promise<PreCountSession | null> {
    try {
        const all = await db.sessions.toArray();
        const found = all.find(s => s.sync_pin === pin && s.status === 'active');
        return (found as PreCountSession) || null;
    } catch (err) {
        console.warn('[preCountDB] Error en búsqueda local de PIN:', err);
        return null;
    }
}

export async function registerConnectedDevice(sessionId: string, overrideDeviceName?: string): Promise<void> {
    if (!sessionId || !isNetworkOnline()) return;
    try {
        const deviceId = getDeviceId();
        const deviceName = (overrideDeviceName && overrideDeviceName.trim()) ? overrideDeviceName.trim() : getDeviceName();
        const isZebra = (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && !isTauriEnvironment()) ||
            deviceName.toLowerCase().includes('zebra') ||
            deviceName.toLowerCase().includes('tc2');
        const { error } = await (supabase as any).from('precount_connected_devices').upsert({
            session_id: sessionId,
            device_id: deviceId,
            device_name: deviceName,
            device_type: isZebra ? 'zebra' : 'pc',
            device_model: isZebra ? 'Zebra TC22' : 'PC',
            status: 'online',
            last_seen: new Date().toISOString()
        }, { onConflict: 'device_id,session_id' });
        if (error) {
            console.warn('[preCountDB] Error registrando dispositivo en Supabase:', error);
        }
    } catch (devErr) {
        console.warn('[preCountDB] Error registrando dispositivo en Supabase:', devErr);
    }
}

/**
 * Direct lookup for a session by its sync PIN.
 * Used when a device tries to join but doesn't have the session in its local list yet.
 */
export async function getSessionByPin(
    pin: string,
    options?: { skipDeviceRegistration?: boolean }
): Promise<PreCountSession | null> {
    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 6) return null;

    // 1. Si estamos sin conexión, buscar directamente en Dexie local
    if (!isNetworkOnline()) {
        return await findLocalSessionByPin(cleanPin);
    }

    try {
        // 2. Consultar sesión sin join embebido truncado a 1000 filas
        const sessionData = await withNetworkRetry(async () => {
            const { data, error } = await (supabase as any)
                .from('precount_sessions')
                .select('*')
                .eq('sync_pin', cleanPin)
                .eq('status', 'active')
                .maybeSingle();
            if (error) throw error;
            return data as any;
        }, { maxAttempts: 2, label: 'getSessionByPin' });

        if (!sessionData) {
            console.warn(`No session found in server for PIN: ${cleanPin}`);
            return await findLocalSessionByPin(cleanPin);
        }

        // Obtener totales reales sin límite de 1000 filas mediante get_session_summary RPC
        let remoteTotalProducts = 0;
        let remoteTotalUnits = 0;
        try {
            const { data: sumRows, error: sumErr } = await (supabase as any).rpc('get_session_summary', {
                p_session_id: sessionData.id
            });
            if (!sumErr && Array.isArray(sumRows) && sumRows[0]) {
                remoteTotalProducts = Number(sumRows[0].total_products) || 0;
                remoteTotalUnits = Number(sumRows[0].total_units) || 0;
            }
        } catch {}

        let masterCatalog: MasterCatalogItem[] = sessionData.master_catalog || [];
        
        // Si el catálogo no vino embebido en la fila de sesión, descargarlo de precount_device_files
        if (!masterCatalog || masterCatalog.length === 0) {
            try {
                const { data: fileData } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', sessionData.id)
                    .eq('filename', 'master_catalog.json')
                    .maybeSingle();

                if (fileData && fileData.content) {
                    masterCatalog = typeof fileData.content === 'string' 
                        ? await decompressGzipBase64ToJson(fileData.content) 
                        : fileData.content;
                }
            } catch (fileErr) {
                console.warn('[preCountDB] No se pudo descargar master_catalog.json:', fileErr);
            }
        }

        const session: PreCountSession = {
            id: sessionData.id,
            sector: sessionData.sector,
            start_time: sessionData.start_time,
            status: sessionData.status,
            user_id: sessionData.user_id,
            branch_id: sessionData.branch_id,
            sync_pin: sessionData.sync_pin,
            master_catalog: masterCatalog,
            synced: 1,
            totalProducts: remoteTotalProducts,
            totalUnits: remoteTotalUnits
        };

        // Guardar sesión en Dexie local para acceso offline inmediato
        await db.sessions.put(session as any);

        // Guardar productos en precount_products para el lector de código de barras solo en Web/PWA
        // En Tauri de escritorio, SQLite (stock_local.db) gestiona los productos sin congelar el hilo UI
        if (!isTauriEnvironment() && masterCatalog && masterCatalog.length > 0) {
            try {
                const dbProducts = expandCatalogToDbProducts(masterCatalog, session.id);
                const CHUNK_SIZE = 5000;
                for (let i = 0; i < dbProducts.length; i += CHUNK_SIZE) {
                    await db.precount_products.bulkPut(dbProducts.slice(i, i + CHUNK_SIZE));
                }
            } catch (prodErr) {
                console.warn('[preCountDB] Error guardando productos de catálogo en Dexie:', prodErr);
            }
        }

        // Registrar presencia de este dispositivo en Supabase (salvo que se difiera hasta confirmar operador)
        if (!options?.skipDeviceRegistration) {
            await registerConnectedDevice(session.id);
        }

        return session;
    } catch (err) {
        console.error('Error fetching session by PIN:', err);
        // Fallback local
        return await findLocalSessionByPin(cleanPin);
    }
}

// ============ RECUENTO DE DIFERENCIAS (ZEBRA & MÓVIL) ============

export interface RecountPositionItem {
    posCode: string;
    deviceName: string;
    quantity: number;
}

export interface RecountProductDiff {
    ean: string;
    eans?: string[];
    name: string;
    id_producto?: string;
    laboratory?: string;
    rubro?: string;
    systemStock: number;
    countedStock: number;
    difference: number;
    positions: RecountPositionItem[];
}

export interface OnlineRecountDevice {
    device_id: string;
    device_name: string;
    platform: 'zebra' | 'web';
    status: 'online' | 'recounting' | 'completed';
    assigned_count?: number;
    last_seen?: string;
}

export interface RecountDeviceAssignment {
    device_id: string;
    device_name: string;
    platform: 'zebra' | 'web';
    assigned_at: string;
    items: RecountProductDiff[];
}

export interface RecountResultItemSubmission {
    ean: string;
    eans?: string[];
    id_producto?: string;
    name: string;
    initialQty: number;
    recountedQty: number;
    positions?: RecountPositionItem[];
}

export interface RecountResultSubmission {
    device_id: string;
    device_name: string;
    platform: 'zebra' | 'web';
    submitted_at: string;
    items: RecountResultItemSubmission[];
}

async function fetchMergedSessionItemsForRecount(sessionId: string): Promise<LocalItem[]> {
    const localItems = await db.items.where('session_id').equals(sessionId).toArray();
    if (!isNetworkOnline()) {
        return localItems;
    }

    try {
        const pendingDeletes = new Set(
            (await db.pendingActions
                .where('entity')
                .equals('item')
                .filter(a => a.type === 'delete')
                .toArray()
            ).map(a => a.data?.id).filter(Boolean)
        );

        const remoteItems = await fetchAllSupabasePages<any>(
            (from, to) => supabase
                .from('precount_items')
                .select('*')
                .eq('session_id', sessionId)
                .order('id', { ascending: true })
                .range(from, to),
            1000,
            'fetchMergedSessionItemsForRecount'
        );

        const merged = new Map<string, LocalItem>();
        for (const loc of localItems) {
            if (!pendingDeletes.has(loc.id)) {
                merged.set(loc.id, loc);
            }
        }
        for (const rem of remoteItems) {
            if (!rem?.id || pendingDeletes.has(rem.id)) continue;
            const existingLocal = merged.get(rem.id);
            if (!existingLocal || existingLocal.synced !== 0) {
                merged.set(rem.id, {
                    ...(existingLocal || {}),
                    ...rem,
                    synced: 1
                } as LocalItem);
            }
        }
        return Array.from(merged.values());
    } catch (err) {
        console.warn('[preCountDB] Usando ítems locales para diferencias tras error de red:', err);
        return localItems;
    }
}

export async function getRecountDifferences(sessionId: string, includeUncountedCatalog: boolean = false): Promise<RecountProductDiff[]> {
    if (!sessionId) return [];

    try {
        // 1. Obtener ítems completos de la sesión (combinando Dexie + Supabase paginado >1000 filas)
        const items = await fetchMergedSessionItemsForRecount(sessionId);

        // 2. Obtener catálogo y productos de la sesión
        const sessionProducts = await db.precount_products.where('session_id').equals(sessionId).toArray();
        const session = await db.sessions.get(sessionId);

        // Mapa de catálogo por EAN y mapa de todos los EANs relacionados por id_producto
        const catalogMap = new Map<string, { name: string; systemStock: number; lab?: string; rubro?: string; id_producto?: string }>();
        const eansByIdProducto = new Map<string, Set<string>>();
        const registerRelatedEan = (idProd: string | undefined, eanVal: string | undefined) => {
            if (!idProd || !eanVal) return;
            const idKey = String(idProd).trim();
            const cleanEan = String(eanVal).trim();
            if (!idKey || !cleanEan) return;
            let set = eansByIdProducto.get(idKey);
            if (!set) {
                set = new Set<string>();
                eansByIdProducto.set(idKey, set);
            }
            set.add(cleanEan);
        };

        sessionProducts.forEach(p => {
            if (p.ean) {
                registerRelatedEan(p.id_producto, p.ean);
                catalogMap.set(p.ean.trim().toLowerCase(), {
                    name: p.name,
                    systemStock: p.stock ?? (p as any).systemStock ?? 0,
                    lab: p.laboratory,
                    rubro: p.rubro,
                    id_producto: p.id_producto
                });
            }
        });

        if (session?.master_catalog && Array.isArray(session.master_catalog)) {
            session.master_catalog.forEach((p: any) => {
                const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
                eans.filter(Boolean).forEach(ean => {
                    registerRelatedEan(p.id_producto, ean);
                    if (!catalogMap.has(ean.trim().toLowerCase())) {
                        catalogMap.set(ean.trim().toLowerCase(), {
                            name: p.name,
                            systemStock: p.systemStock ?? p.stock ?? 0,
                            lab: p.laboratory,
                            rubro: p.rubro || p.category,
                            id_producto: p.id_producto
                        });
                    }
                });
            });
        }

        // Si aún no hay catálogo cargado y hay internet, intentar recuperar master_catalog.json desde Supabase
        if (catalogMap.size === 0 && navigator.onLine) {
            try {
                const { data: fileData } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', sessionId)
                    .eq('device_id', 'system')
                    .eq('filename', 'master_catalog.json')
                    .maybeSingle();

                if (fileData?.content) {
                    const downloadedCatalog = await decompressGzipBase64ToJson(fileData.content);
                    if (downloadedCatalog && Array.isArray(downloadedCatalog) && downloadedCatalog.length > 0) {
                        await db.sessions.update(sessionId, { master_catalog: downloadedCatalog });
                        downloadedCatalog.forEach((p: any) => {
                            const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
                            eans.filter(Boolean).forEach(ean => {
                                catalogMap.set(ean.trim().toLowerCase(), {
                                    name: p.name,
                                    systemStock: p.systemStock ?? p.stock ?? 0,
                                    lab: p.laboratory,
                                    rubro: p.rubro || p.category,
                                    id_producto: p.id_producto
                                });
                            });
                        });
                    }
                }
            } catch (fileErr) {
                console.warn('[preCountDB] Error recuperando catálogo desde Supabase:', fileErr);
            }
        }

        // Si estamos en Tauri de escritorio, enriquecer productos faltantes desde stock_local.db SQLite
        if (isTauriEnvironment()) {
            try {
                const { searchLocalBarcode } = await import('@/services/tauriLocalDb');
                for (const it of items) {
                    if (!it.ean) continue;
                    const key = it.ean.trim().toLowerCase();
                    if (!catalogMap.has(key)) {
                        const localProd = await searchLocalBarcode(it.ean);
                        if (localProd) {
                            catalogMap.set(key, {
                                name: localProd.name,
                                systemStock: localProd.stock,
                                lab: localProd.laboratory,
                                rubro: localProd.category,
                                id_producto: localProd.id_producto
                            });
                        }
                    }
                }
            } catch (tauriErr) {
                console.warn('[preCountDB] Error buscando catálogo en SQLite local:', tauriErr);
            }
        }

        // 3. Agrupar conteo por EAN y por posición
        const countedMap = new Map<string, {
            ean: string;
            name: string;
            lab?: string;
            rubro?: string;
            positions: Map<string, { posCode: string; deviceName: string; quantity: number }>;
            totalQty: number;
        }>();

        for (const it of items) {
            if (!it.ean) continue;
            const key = it.ean.trim().toLowerCase();
            let prod = countedMap.get(key);
            if (!prod) {
                const cat = catalogMap.get(key);
                prod = {
                    ean: it.ean.trim(),
                    name: it.product_name || cat?.name || `Producto ${it.ean}`,
                    lab: it.laboratory || cat?.lab,
                    rubro: it.rubro || cat?.rubro,
                    positions: new Map(),
                    totalQty: 0
                };
                countedMap.set(key, prod);
            }

            const posCode = it.location_tag || 'ESP-01';
            const deviceName = it.device_name || 'ZEBRA-01';
            const posKey = `${posCode}___${deviceName}`;

            const existingPos = prod.positions.get(posKey);
            if (existingPos) {
                existingPos.quantity += Number(it.quantity) || 0;
            } else {
                prod.positions.set(posKey, {
                    posCode,
                    deviceName,
                    quantity: Number(it.quantity) || 0
                });
            }
            prod.totalQty += Number(it.quantity) || 0;
        }

        // 4. Identificar diferencias
        const results: RecountProductDiff[] = [];

        // A) Productos que fueron contados y tienen diferencias respecto al stock teórico
        for (const [key, counted] of countedMap.entries()) {
            const cat = catalogMap.get(key);
            const systemStock = cat?.systemStock ?? 0;
            const diff = counted.totalQty - systemStock;

            // Si hay diferencia entre lo contado y el teórico (o si no tiene stock teórico pero fue contado)
            if (diff !== 0) {
                const related = new Set<string>([counted.ean]);
                if (cat?.id_producto && eansByIdProducto.has(String(cat.id_producto).trim())) {
                    eansByIdProducto.get(String(cat.id_producto).trim())!.forEach(e => related.add(e));
                }
                results.push({
                    ean: counted.ean,
                    eans: Array.from(related),
                    name: counted.name,
                    laboratory: counted.lab,
                    rubro: counted.rubro,
                    id_producto: cat?.id_producto,
                    systemStock,
                    countedStock: counted.totalQty,
                    difference: diff,
                    positions: Array.from(counted.positions.values())
                });
            }
        }

        // B) Solo si se solicita expresamente: productos del catálogo que NO fueron contados pero tenían stock en sistema
        if (includeUncountedCatalog) {
            for (const [key, cat] of catalogMap.entries()) {
                if (!countedMap.has(key) && cat.systemStock > 0) {
                    results.push({
                        ean: key,
                        name: cat.name,
                        laboratory: cat.lab,
                        rubro: cat.rubro,
                        id_producto: cat.id_producto,
                        systemStock: cat.systemStock,
                        countedStock: 0,
                        difference: -cat.systemStock,
                        positions: [{
                            posCode: 'Sin Asignar',
                            deviceName: 'Sistema',
                            quantity: 0
                        }]
                    });
                }
            }
        }

        return results;
    } catch (err) {
        console.error('[preCountDB] Error calculando diferencias de recuento:', err);
        return [];
    }
}

export interface RecountSessionStateDetails {
    status: 'idle' | 'waiting' | 'started';
    started_at?: string;
    updated_at?: string;
    batch_id?: string;
    total_diffs?: number;
    created_at?: string;
}

async function writeRecountSessionStateRow(
    sessionId: string,
    payload: RecountSessionStateDetails
): Promise<void> {
    await withNetworkRetry(async () => {
        const { error: delErr } = await (supabase as any)
            .from('precount_device_files')
            .delete()
            .eq('session_id', sessionId)
            .eq('filename', 'recount_session_state.json');
        if (delErr) throw delErr;

        const { error: insErr } = await (supabase as any)
            .from('precount_device_files')
            .insert({
                session_id: sessionId,
                device_id: 'system',
                device_name: 'Admin PC',
                filename: 'recount_session_state.json',
                content: JSON.stringify(payload)
            });
        if (insErr) throw insErr;
    }, { maxAttempts: 3, label: 'writeRecountSessionStateRow' });
}

export async function exportRecountDifferencesToCloud(sessionId: string): Promise<number> {
    const diffs = await getRecountDifferences(sessionId);
    if (!diffs || diffs.length === 0) return 0;

    // Cache local inmediato
    if (typeof window !== 'undefined') {
        localStorage.setItem(`recount_differences_${sessionId}`, JSON.stringify(diffs));
    }

    const fileRow = {
        session_id: sessionId,
        device_id: 'system',
        device_name: 'Admin PC',
        filename: 'recount_differences.json',
        content: JSON.stringify(diffs)
    };

    if (!isNetworkOnline()) {
        await syncManager.addToQueue({ type: 'create', entity: 'device_file', data: fileRow }, { skipFlush: true });
        return diffs.length;
    }

    try {
        await withNetworkRetry(async () => {
            const { error: delErr } = await (supabase as any)
                .from('precount_device_files')
                .delete()
                .eq('session_id', sessionId)
                .eq('filename', 'recount_differences.json');
            if (delErr) throw delErr;

            const { error: fileErr } = await (supabase as any)
                .from('precount_device_files')
                .insert(fileRow);
            if (fileErr) throw fileErr;
        }, { maxAttempts: 2, label: 'exportRecountDifferencesToCloud' });
    } catch (e) {
        console.warn('[Supabase] Error subiendo recount_differences.json, encolando en SyncManager:', e);
        await syncManager.addToQueue({ type: 'create', entity: 'device_file', data: fileRow });
    }

    return diffs.length;
}

/**
 * Reparte los productos con diferencia de forma equitativa (EANs únicos, sin repetirse)
 * entre las terminales online (Zebras y celulares Web) y sube primero las asignaciones
 * verificando persistencia antes de pasar recount_session_state.json a 'started'.
 */
export async function distributeRecountDifferencesToDevices(
    sessionId: string,
    devices: OnlineRecountDevice[]
): Promise<{ totalDiffs: number; assignments: Record<string, RecountDeviceAssignment> }> {
    const diffs = await getRecountDifferences(sessionId);
    if (!diffs || diffs.length === 0 || !devices || devices.length === 0) {
        return { totalDiffs: diffs?.length || 0, assignments: {} };
    }

    const now = new Date().toISOString();
    const batchId = crypto.randomUUID();
    const assignments: Record<string, RecountDeviceAssignment> = {};
    for (const dev of devices) {
        assignments[dev.device_id] = {
            device_id: dev.device_id,
            device_name: dev.device_name,
            platform: dev.platform,
            assigned_at: now,
            items: []
        };
    }

    // Reparto round-robin para garantizar cantidad X equitativa y EANs únicos por terminal
    diffs.forEach((diffItem, idx) => {
        const targetDevice = devices[idx % devices.length];
        assignments[targetDevice.device_id].items.push(diffItem);
    });

    // Paso 1: Poner estado en 'waiting' ANTES de reemplazar archivos para evitar lecturas prematuras
    await writeRecountSessionStateRow(sessionId, {
        status: 'waiting',
        batch_id: batchId,
        updated_at: now,
        total_diffs: diffs.length
    });

    // Paso 2: Limpiar asignaciones y resultados previos verificando errores
    await withNetworkRetry(async () => {
        const { error: delMasterErr } = await (supabase as any)
            .from('precount_device_files')
            .delete()
            .eq('session_id', sessionId)
            .in('filename', ['recount_assignments.json', 'recount_differences.json']);
        if (delMasterErr) throw delMasterErr;

        const { error: delPerDevErr } = await (supabase as any)
            .from('precount_device_files')
            .delete()
            .eq('session_id', sessionId)
            .like('filename', 'recount_differences_%');
        if (delPerDevErr) throw delPerDevErr;

        const { error: delResErr } = await (supabase as any)
            .from('precount_device_files')
            .delete()
            .eq('session_id', sessionId)
            .like('filename', 'recount_result_%');
        if (delResErr) throw delResErr;
    }, { maxAttempts: 3, label: 'distributeRecount:cleanup' });

    // Paso 3: Subir PRIMERO recount_assignments.json + recount_differences_<deviceId>.json (sin 'started')
    const assignmentRows: any[] = [
        {
            session_id: sessionId,
            device_id: 'system',
            device_name: 'Admin PC',
            filename: 'recount_assignments.json',
            content: JSON.stringify({
                version: 1,
                session_id: sessionId,
                batch_id: batchId,
                generated_at: now,
                total_diffs: diffs.length,
                assignments
            })
        }
    ];

    const expectedFilenames = ['recount_assignments.json'];
    for (const dev of devices) {
        const filename = `recount_differences_${dev.device_id}.json`;
        expectedFilenames.push(filename);
        assignmentRows.push({
            session_id: sessionId,
            device_id: dev.device_id,
            device_name: dev.device_name,
            filename,
            content: JSON.stringify(assignments[dev.device_id].items)
        });
    }

    await withNetworkRetry(async () => {
        const { error } = await (supabase as any)
            .from('precount_device_files')
            .insert(assignmentRows);
        if (error) throw error;
    }, { maxAttempts: 3, label: 'distributeRecount:insertAssignments' });

    // Paso 4: Verificar por lectura que TODOS los archivos de asignación ya estén visibles en Postgres
    let allVisible = false;
    for (let checkAttempt = 0; checkAttempt < 3; checkAttempt++) {
        const { data: verifiedRows, error: verifyErr } = await (supabase as any)
            .from('precount_device_files')
            .select('filename, content')
            .eq('session_id', sessionId)
            .in('filename', expectedFilenames);

        if (!verifyErr && Array.isArray(verifiedRows)) {
            const visibleSet = new Set(
                verifiedRows.filter((r: any) => r?.filename && r?.content).map((r: any) => r.filename)
            );
            if (expectedFilenames.every(fn => visibleSet.has(fn))) {
                allVisible = true;
                break;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 150 * (checkAttempt + 1)));
    }

    if (!allVisible) {
        throw new Error('Los archivos de asignación no confirmaron lectura tras su inserción en Supabase.');
    }

    // Paso 5: Recién ahora confirmar recount_session_state.json en 'started' y emitir Realtime (<50ms)
    const startedState: RecountSessionStateDetails = {
        status: 'started',
        started_at: now,
        updated_at: now,
        batch_id: batchId,
        total_diffs: diffs.length
    };
    await writeRecountSessionStateRow(sessionId, startedState);

    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`recount_assignments_${sessionId}`, JSON.stringify(assignments));
        } catch {}
    }

    import('./deviceTelemetry').then(({ broadcastRecountStateChange }) => {
        broadcastRecountStateChange(sessionId, startedState).catch(() => {});
    });

    return { totalDiffs: diffs.length, assignments };
}

export async function setRecountSessionState(
    sessionId: string,
    status: 'idle' | 'waiting' | 'started'
): Promise<void> {
    if (!sessionId) return;
    const now = new Date().toISOString();
    const statePayload: RecountSessionStateDetails = {
        status,
        updated_at: now,
        ...(status === 'started' ? { started_at: now } : {})
    };
    const fileRow = {
        session_id: sessionId,
        device_id: 'system',
        device_name: 'Admin PC',
        filename: 'recount_session_state.json',
        content: JSON.stringify(statePayload)
    };

    if (!isNetworkOnline()) {
        await syncManager.addToQueue({ type: 'create', entity: 'device_file', data: fileRow }, { skipFlush: true });
        return;
    }

    try {
        await writeRecountSessionStateRow(sessionId, statePayload);
        import('./deviceTelemetry').then(({ broadcastRecountStateChange }) => {
            broadcastRecountStateChange(sessionId, statePayload).catch(() => {});
        });
    } catch (e) {
        console.warn('[preCountDB] Error actualizando recount_session_state.json, encolando:', e);
        await syncManager.addToQueue({ type: 'create', entity: 'device_file', data: fileRow });
    }
}

export async function getRecountSessionStateDetails(sessionId: string): Promise<RecountSessionStateDetails> {
    if (!sessionId) return { status: 'idle' };
    try {
        const data = await withNetworkRetry(async () => {
            const { data: row, error } = await (supabase as any)
                .from('precount_device_files')
                .select('content, created_at')
                .eq('session_id', sessionId)
                .eq('filename', 'recount_session_state.json')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return row;
        }, { maxAttempts: 2, label: 'getRecountSessionStateDetails' });

        if (data?.content) {
            const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
            const status = parsed?.status === 'waiting' || parsed?.status === 'started' ? parsed.status : 'idle';
            return {
                status,
                started_at: parsed?.started_at,
                updated_at: parsed?.updated_at,
                batch_id: parsed?.batch_id,
                total_diffs: typeof parsed?.total_diffs === 'number' ? parsed.total_diffs : undefined,
                created_at: data.created_at
            };
        }
    } catch {}
    return { status: 'idle' };
}

export async function getRecountSessionState(sessionId: string): Promise<'idle' | 'waiting' | 'started'> {
    const details = await getRecountSessionStateDetails(sessionId);
    return details.status;
}

/**
 * Obtiene las diferencias asignadas a un dispositivo específico con reintentos ante
 * eventual lag de lectura y respaldo sobre recount_assignments.json / caché local.
 */
export async function fetchDeviceRecountDifferences(
    sessionId: string,
    deviceId: string
): Promise<RecountProductDiff[]> {
    if (!sessionId || !deviceId) return [];
    const cacheKey = `recount_assigned_${sessionId}_${deviceId}`;

    if (isNetworkOnline()) {
        const perDeviceFilename = `recount_differences_${deviceId}.json`;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const { data, error } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', sessionId)
                    .eq('filename', perDeviceFilename)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && data?.content) {
                    const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                    if (Array.isArray(parsed)) {
                        if (typeof window !== 'undefined') {
                            try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch {}
                        }
                        return parsed;
                    }
                }

                // Fallback al archivo maestro recount_assignments.json
                const { data: masterData, error: masterErr } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', sessionId)
                    .eq('filename', 'recount_assignments.json')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!masterErr && masterData?.content) {
                    const master = typeof masterData.content === 'string' ? JSON.parse(masterData.content) : masterData.content;
                    const devItems = master?.assignments?.[deviceId]?.items;
                    if (Array.isArray(devItems)) {
                        if (typeof window !== 'undefined') {
                            try { localStorage.setItem(cacheKey, JSON.stringify(devItems)); } catch {}
                        }
                        return devItems;
                    }
                }
            } catch (err) {
                console.warn('[preCountDB] Error leyendo diferencias asignadas, reintentando:', err);
            }

            if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
            }
        }
    }

    if (typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {}
    }

    return [];
}

/**
 * Envía el resultado del recuento de forma resiliente (offline-first):
 * resguarda localmente y encola en SyncManager antes de intentar subida inmediata.
 */
export async function submitRecountResultOfflineFirst(
    sessionId: string,
    payload: {
        device_id: string;
        device_name: string;
        platform: 'zebra' | 'web';
        items: RecountResultItemSubmission[];
        submitted_at?: string;
    }
): Promise<{ syncedImmediately: boolean; queuedOffline: boolean }> {
    const submittedAt = payload.submitted_at || new Date().toISOString();
    const fullPayload = {
        ...payload,
        submitted_at: submittedAt
    };
    const filename = `recount_result_${payload.device_id}.json`;
    const fileRow = {
        session_id: sessionId,
        device_id: payload.device_id,
        device_name: payload.device_name,
        filename,
        content: JSON.stringify(fullPayload)
    };

    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`recount_result_${sessionId}_${payload.device_id}`, fileRow.content);
        } catch {}
    }

    await syncManager.addToQueue({
        type: 'create',
        entity: 'device_file',
        data: fileRow
    }, { skipFlush: true });

    if (!isNetworkOnline()) {
        return { syncedImmediately: false, queuedOffline: true };
    }

    try {
        await withNetworkRetry(async () => {
            const { error: delErr } = await (supabase as any)
                .from('precount_device_files')
                .delete()
                .eq('session_id', sessionId)
                .eq('filename', filename);
            if (delErr) throw delErr;

            const { error: insErr } = await (supabase as any)
                .from('precount_device_files')
                .insert(fileRow);
            if (insErr) throw insErr;
        }, { maxAttempts: 2, label: 'submitRecountResultOfflineFirst' });

        await db.pendingActions
            .where('dedupeKey')
            .equals(`device_file:${sessionId}:${filename}`)
            .filter(a => a.status !== 'syncing')
            .delete();

        return { syncedImmediately: true, queuedOffline: false };
    } catch (err) {
        console.warn('[preCountDB] Subida de recuento diferida a SyncManager:', err);
        void syncManager.processQueue();
        return { syncedImmediately: false, queuedOffline: true };
    }
}

/**
 * Descarga los resultados de recuento enviados por las terminales (Zebras / Móvil Web),
 * ordenados del más reciente al más antiguo y deduplicados por terminal.
 */
export async function fetchRecountResultSubmissions(sessionId: string): Promise<RecountResultSubmission[]> {
    if (!sessionId) return [];
    const { data, error } = await (supabase as any)
        .from('precount_device_files')
        .select('content, device_id, device_name, created_at')
        .eq('session_id', sessionId)
        .like('filename', 'recount_result_%')
        .order('created_at', { ascending: false });

    if (error || !data) return [];

    const submissionsByDevice = new Map<string, RecountResultSubmission>();
    for (const row of data) {
        if (!row.content) continue;
        try {
            const parsed = JSON.parse(row.content);
            if (Array.isArray(parsed)) {
                const devId = row.device_id || 'unknown';
                if (!submissionsByDevice.has(devId)) {
                    submissionsByDevice.set(devId, {
                        device_id: devId,
                        device_name: row.device_name || devId || 'Terminal',
                        platform: 'zebra',
                        submitted_at: row.created_at || new Date().toISOString(),
                        items: parsed
                    });
                }
            } else if (parsed && Array.isArray(parsed.items)) {
                const devId = parsed.device_id || row.device_id || 'unknown';
                if (!submissionsByDevice.has(devId)) {
                    submissionsByDevice.set(devId, {
                        device_id: devId,
                        device_name: parsed.device_name || row.device_name || 'Terminal',
                        platform: parsed.platform || 'web',
                        submitted_at: parsed.submitted_at || row.created_at || new Date().toISOString(),
                        items: parsed.items
                    });
                }
            }
        } catch {
            // Ignorar JSON malformado
        }
    }
    return Array.from(submissionsByDevice.values());
}

/**
 * Aplica los conteos confirmados desde el recuento de diferencias a la sesión activa
 * antes de transmitir el inventario definitivo a Plex.
 */
export async function applyRecountResultsToSession(
    sessionId: string,
    submissions: RecountResultSubmission[]
): Promise<{ updatedProducts: number }> {
    if (!sessionId || !submissions || submissions.length === 0) {
        return { updatedProducts: 0 };
    }

    const sessionItems = await db.items.where('session_id').equals(sessionId).toArray();
    let updatedProducts = 0;

    for (const sub of submissions) {
        for (const item of sub.items) {
            const newTotal = Math.max(0, Math.floor(Number(item.recountedQty) || 0));
            const candidateEans = new Set<string>([
                String(item.ean || '').trim().toLowerCase(),
                ...(item.eans || []).map(e => String(e).trim().toLowerCase())
            ].filter(Boolean));

            const matchingRows = sessionItems.filter(row => {
                const rowEan = String(row.ean || '').trim().toLowerCase();
                const rowProdId = String(row.id_producto || '').trim();
                return candidateEans.has(rowEan) || (item.id_producto && rowProdId === String(item.id_producto).trim());
            });

            if (matchingRows.length === 0) {
                if (newTotal > 0) {
                    await upsertPreCountItem({
                        session_id: sessionId,
                        ean: item.ean,
                        product_name: item.name,
                        quantity: newTotal,
                        id_producto: item.id_producto,
                        location_tag: item.positions?.[0]?.posCode || 'REC-01',
                        device_name: sub.device_name,
                    });
                    updatedProducts++;
                }
                continue;
            }

            const currentTotal = matchingRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
            if (currentTotal === newTotal) continue;

            // Ajustar sobre la primera fila y poner en 0 (eliminar) las adicionales si el total bajó
            const primaryRow = matchingRows[0];
            if (matchingRows.length > 1) {
                for (let i = 1; i < matchingRows.length; i++) {
                    await deletePreCountItem(matchingRows[i].id);
                }
            }
            if (newTotal <= 0) {
                await deletePreCountItem(primaryRow.id);
            } else {
                await updatePreCountItem(primaryRow.id, { quantity: newTotal });
            }
            updatedProducts++;
        }
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('precount:item_added'));
    }

    return { updatedProducts };
}

export interface PreCountSerialRecord {
    session_id: string;
    location_tag: string;
    id_producto: string;
    ean?: string;
    gtin?: string;
    serial?: string;
    lot?: string;
    expiry?: string;
    no_serial: boolean;
    raw_datamatrix?: string;
    device_id?: string;
    device_name?: string;
    scanned_by?: string;
}

export async function savePreCountSerial(record: PreCountSerialRecord): Promise<boolean> {
    const dedupeKey = `serial:${record.session_id}:${record.id_producto || ''}:${record.serial || record.gtin || record.raw_datamatrix || ''}`;

    // Encolar antes de red para no perder series trazables ante cortes o cierres
    await syncManager.addToQueue({
        type: 'create',
        entity: 'serial',
        dedupeKey,
        data: record
    }, { skipFlush: true });

    if (!isNetworkOnline()) {
        return true;
    }

    try {
        const { error } = await (supabase as any)
            .from('precount_serials')
            .insert(record);
        if (!error || String((error as any).code || '') === '23505') {
            await db.pendingActions
                .where('dedupeKey')
                .equals(dedupeKey)
                .filter(a => a.status !== 'syncing')
                .delete();
            return true;
        }
        console.warn('[preCountDB] Error insertando serie trazable, diferido a SyncManager:', error);
    } catch (e) {
        console.warn('[preCountDB] Excepción guardando serie trazable, diferido a SyncManager:', e);
    }

    void syncManager.processQueue();
    return true;
}

export async function getPreCountSerials(sessionId: string): Promise<any[]> {
    try {
        return await fetchAllSupabasePages<any>(
            (from, to) => (supabase as any)
                .from('precount_serials')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(from, to),
            1000,
            'getPreCountSerials'
        );
    } catch (e) {
        console.error('[preCountDB] Error obteniendo series de sesión:', e);
        return [];
    }
}
