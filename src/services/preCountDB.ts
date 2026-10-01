import { db, LocalSession, LocalItem } from './db';
import { syncManager } from './syncManager';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { isTauriEnvironment } from '@/services/mysqlTauriBridge';

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

// --- Sesiones ---

export async function createSession(sector: string, branch_id?: string, master_catalog?: MasterCatalogItem[], sync_pin?: string, profile?: 'sucursal' | 'sap'): Promise<PreCountSession> {
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
        master_catalog: master_catalog || [],
        profile: profile || 'sucursal'
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
    await db.items.where('session_id').equals(id).delete();
    await db.locations.where('session_id').equals(id).delete();
    await db.precount_products.where('session_id').equals(id).delete();

    // 2. Cascade delete in Supabase if online
    try {
        const { supabase } = await import('@/integrations/supabase/client');
        await (supabase as any).from('precount_connected_devices').delete().eq('session_id', id);
        await (supabase as any).from('precount_location_status').delete().eq('session_id', id);
        await (supabase as any).from('precount_device_files').delete().eq('session_id', id);
        await (supabase as any).from('precount_items').delete().eq('session_id', id);
        await (supabase as any).from('precount_sessions').delete().eq('id', id);
    } catch (e) {
        console.warn('[preCountDB] Remote delete failed or offline:', e);
    }

    // 3. Queue for Sync
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
    location_tag?: string,
    laboratory?: string,
    rubro?: string
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
            laboratory: item.laboratory || existingItem.laboratory,
            rubro: item.rubro || existingItem.rubro,
            device_name: deviceName,
            location_tag: item.location_tag
        });
        resultItem = { 
            ...existingItem, 
            quantity: newQuantity, 
            scanned_at: now, 
            id_producto: item.id_producto || existingItem.id_producto,
            laboratory: item.laboratory || existingItem.laboratory,
            rubro: item.rubro || existingItem.rubro,
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
            laboratory: item.laboratory,
            rubro: item.rubro,
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
    const item = await db.items.get(id);

    // 2. Queue Sync
    await syncManager.addToQueue({
        type: 'update',
        entity: 'item',
        data: item ? { ...item, ...updates } : { id, ...updates }
    });
}

export async function deletePreCountItem(id: string): Promise<void> {
    // 1. Delete from local IndexedDB
    await db.items.delete(id);

    // 2. Remove any pending un-synced actions for this item so it won't be re-uploaded
    await db.pendingActions.where('entity').equals('item').and(action => action.data?.id === id).delete();

    // 3. Direct delete from Supabase if online
    try {
        await supabase.from('precount_items').delete().eq('id', id);
    } catch (e) {
        console.warn('Direct delete failed, queuing...', e);
    }

    // 4. Queue Sync
    await syncManager.addToQueue({
        type: 'delete',
        entity: 'item',
        data: { id }
    });
}

export async function deletePreCountItems(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    // 1. Bulk delete from local IndexedDB
    await db.items.bulkDelete(ids);

    // 2. Remove any pending un-synced actions for these items
    await db.pendingActions.where('entity').equals('item').and(action => ids.includes(action.data?.id)).delete();

    // 3. Direct delete from Supabase in batch if online
    try {
        await supabase.from('precount_items').delete().in('id', ids);
    } catch (e) {
        console.warn('Direct batch delete failed, queuing...', e);
    }

    // 4. Queue delete for each item to guarantee offline resilience
    for (const id of ids) {
        await syncManager.addToQueue({
            type: 'delete',
            entity: 'item',
            data: { id }
        });
    }
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
    if (navigator.onLine) {
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
                    // Guardar localmente como open
                    await db.locations.put({
                        session_id: sessionId,
                        location_tag: normTag,
                        status: 'open'
                    });
                    // Broadcast instantáneo por WebSocket a monitores
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
                    // Marcar localmente como cerrado
                    await db.locations.put({
                        session_id: sessionId,
                        location_tag: normTag,
                        status: 'closed',
                        closed_at: res.closed_at || new Date().toISOString()
                    });
                }
                return res;
            }

            // Si el RPC falla porque la migración aún no se corrió en Supabase, fallback a toggle_precount_location
            console.warn('[claimOrValidateLocation] Fallback a toggle_precount_location:', error);
            await (supabase as any).rpc('toggle_precount_location', {
                p_session_id: sessionId,
                p_location_tag: normTag,
                p_status: 'open'
            });
            await db.locations.put({
                session_id: sessionId,
                location_tag: normTag,
                status: 'open'
            });
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
        } catch (err: any) {
            console.error('[claimOrValidateLocation] Error:', err);
        }
    }

    // 3. Fallback Offline: Asignar en Dexie y encolar
    await db.locations.put({
        session_id: sessionId,
        location_tag: normTag,
        status: 'open'
    });
    await syncManager.addToQueue({
        type: 'update',
        entity: 'session',
        data: {
            action: 'toggle_location',
            session_id: sessionId,
            location_tag: normTag,
            status: 'open'
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

    // 1. Actualizar Dexie local
    await db.locations.put({
        session_id: sessionId,
        location_tag: normTag,
        status: 'closed',
        closed_at: now
    });

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

    // 3. Sincronizar con Supabase
    if (navigator.onLine) {
        try {
            const { data, error } = await (supabase as any).rpc('close_precount_location', {
                p_session_id: sessionId,
                p_location_tag: normTag,
                p_user_name: uName,
                p_device_id: dId,
                p_device_name: dName
            });

            if (error) {
                // Fallback a toggle_precount_location si la migración aún no se ejecutó
                await (supabase as any).rpc('toggle_precount_location', {
                    p_session_id: sessionId,
                    p_location_tag: normTag,
                    p_status: 'closed'
                });
            }
            return { success: true, closed_at: data?.closed_at || now };
        } catch (err) {
            console.error('[closeLocationWithSync] Error en RPC:', err);
        }
    } else {
        await syncManager.addToQueue({
            type: 'update',
            entity: 'session',
            data: {
                action: 'toggle_location',
                session_id: sessionId,
                location_tag: normTag,
                status: 'closed'
            }
        });
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

/**
 * Direct lookup for a session by its sync PIN.
 * Used when a device tries to join but doesn't have the session in its local list yet.
 */
export async function getSessionByPin(pin: string): Promise<PreCountSession | null> {
    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 6) return null;

    // 1. Si estamos sin conexión, buscar directamente en Dexie local
    if (!navigator.onLine) {
        return await findLocalSessionByPin(cleanPin);
    }

    try {
        // 2. Consultar Supabase para encontrar la sesión activa con este PIN
        const { data, error } = await (supabase as any)
            .from('precount_sessions')
            .select(`
                *,
                items:precount_items(quantity)
            `)
            .eq('sync_pin', cleanPin)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            console.error('Supabase error in getSessionByPin:', error);
            // Fallback a Dexie si falla la red
            return await findLocalSessionByPin(cleanPin);
        }
        
        if (!data) {
            console.warn(`No session found in server for PIN: ${cleanPin}`);
            // Fallback a Dexie
            return await findLocalSessionByPin(cleanPin);
        }

        const sessionData = data as any;
        
        // Calcular totales de productos y unidades
        const remoteTotalProducts = sessionData.items?.length || 0;
        const remoteTotalUnits = sessionData.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;

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
                        ? JSON.parse(fileData.content) 
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

        // Guardar productos en precount_products para el lector de código de barras
        if (masterCatalog && masterCatalog.length > 0) {
            try {
                const dbProducts = expandCatalogToDbProducts(masterCatalog, session.id);
                await db.precount_products.bulkPut(dbProducts);
            } catch (prodErr) {
                console.warn('[preCountDB] Error guardando productos de catálogo en Dexie:', prodErr);
            }
        }

        // Registrar presencia de este dispositivo en Supabase
        try {
            const deviceId = getDeviceId();
            const deviceName = getDeviceName();
            const isZebra = (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && !isTauriEnvironment()) ||
                deviceName.toLowerCase().includes('zebra') ||
                deviceName.toLowerCase().includes('tc2');
            await (supabase as any).from('precount_connected_devices').upsert({
                session_id: session.id,
                device_id: deviceId,
                device_name: deviceName,
                device_type: isZebra ? 'zebra' : 'pc',
                device_model: isZebra ? 'Zebra TC22' : 'PC',
                last_seen: new Date().toISOString()
            });
        } catch (devErr) {
            console.warn('[preCountDB] Error registrando dispositivo en Supabase:', devErr);
        }

        return session;
    } catch (err) {
        console.error('Error fetching session by PIN:', err);
        // Fallback local
        return await findLocalSessionByPin(cleanPin);
    }
}


