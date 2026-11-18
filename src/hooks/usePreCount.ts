import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { supabase } from '@/integrations/supabase/client';
import { playSound } from '@/utils/soundUtils';
import {
    PreCountItem,
    PreCountSession,
    updatePreCountItem,
    deletePreCountItem,
    getPreCountItemsBySessionId,
    createSession,
    updateSession,
    endSession,
    getActiveSessions,
    deleteSession as deleteSessionDB,
    isItemRecentlySaved,
    isItemRecentlyDeleted,
} from '@/services/preCountDB';
import { notify } from '@/lib/notifications';
import { useUser } from '@/contexts/UserContext';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { isTauriEnvironment } from '@/services/mysqlTauriBridge';
import { compressJsonToGzipBase64, decompressGzipBase64ToJson } from '@/lib/compression';
import { syncManager } from '@/services/syncManager';

/**
 * Expande el master_catalog a filas de db.precount_products: UNA fila por EAN.
 * Si un producto tiene eans=[A, B, C], se crean 3 filas con la misma
 * id_producto/name/stock, permitiendo que cualquier EAN sea encontrado.
 * NOTA: Solo aplica al Colector de Datos (PreCount). No afecta el inventario cíclico.
 */
function expandCatalogToDbProducts(catalog: any[], sessionId: string) {
    const rows: any[] = [];
    catalog.forEach(p => {
        // Usar el array completo de EANs si existe, si no usar solo el principal
        const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
        eans.forEach((ean: string) => {
            if (!ean || ean === 'undefined') return;
            rows.push({
                ean,
                name: p.name,
                cost: p.cost || 0,
                salePrice: p.salePrice || 0,
                laboratory: p.laboratory || '',
                rubro: p.rubro || p.category || '',
                stock: p.systemStock || 0,
                id_producto: p.id_producto || '',
                is_traceable: p.is_traceable || p.trazable === 1 || false,
                gtin: p.gtin || '',
                is_hidden: p.is_hidden || false,
                session_id: sessionId
            });
        });
    });
    return rows;
}

export interface UIPreCountItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced?: number;
    id_producto?: string;
    location_tag?: string;
    deviceId?: string;
    deviceName?: string;
}

interface UsePreCountReturn {
    items: UIPreCountItem[];
    session: PreCountSession | null;
    totalProducts: number;
    totalUnits: number;
    errorCount: number;
    isLoading: boolean;
    availableSessions: PreCountSession[];
    connectedDevices: ConnectedDevice[];
    receivedFiles: ReceivedFile[];
    startSession: (sector: string, masterCatalog?: any[], syncPin?: string, profile?: 'sucursal' | 'sap') => Promise<void>;
    resumeSession: (session: PreCountSession, showNotification?: boolean) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    addItem: (ean: string, productName: string, quantity: number, id_producto?: string, location_tag?: string) => Promise<void>;
    updateItem: (id: string, quantity: number) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    finishSession: () => Promise<void>;
    refreshItems: () => Promise<void>;
    registerError: () => void;
    announcePresence: (explicitSessionId?: string) => Promise<void>;
    sendFinalCount: (filename: string, content: string) => Promise<boolean>;
    isDownloadingCatalog?: boolean;
}

export interface ConnectedDevice {
    deviceId: string;
    deviceName: string;
    joinedAt: number;
}

export interface ReceivedFile {
    id: string;
    filename: string;
    content: string;
    deviceName: string;
    deviceId: string;
    timestamp: number;
    size: number;
}


export function usePreCount(): UsePreCountReturn {
    const [session, setSession] = useState<PreCountSession | null>(null);
    const sessionRef = useRef<PreCountSession | null>(session);
    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const [errorCount, setErrorCount] = useState(0);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
    const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
    const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);
    const isStartingSessionRef = useRef(false);
    const { user } = useUser();

    // LIVE QUERY for items - This is our source of truth
    const items = useLiveQuery(
        async () => {
            if (!session) return [];
            const results = await db.items
                .where('session_id')
                .equals(session.id)
                .reverse()
                .toArray();
            
            return results.map(mapInternalItemToUI);
        },
        [session?.id]
    ) || [];

    // Initial Load / Wakeup Resume
    useEffect(() => {
        const init = async () => {
            if (!user) return; // Wait for user context
            try {
                // 1. Inmediata restauración offline / local desde Dexie para que el usuario nunca vea la pantalla de PIN al desbloquear
                const lastSessionId = typeof localStorage !== 'undefined' 
                    ? (localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id')) 
                    : null;
                
                if (lastSessionId) {
                    try {
                        const localSess = await db.sessions.get(lastSessionId);
                        if (localSess && localSess.status === 'active') {
                            sessionRef.current = localSess as any;
                            setSession(localSess as any);
                        }
                    } catch (e) {
                        console.warn('[usePreCount] Error al cargar sesión local desde Dexie:', e);
                    }
                }

                // 2. Consulta y actualización remota con Supabase
                const sessions = await getActiveSessions({ 
                    branchId: user.branchId, 
                    role: user.role 
                });
                setAvailableSessions(sessions);

                if (lastSessionId) {
                    const found = sessions.find(s => s.id === lastSessionId && s.status === 'active');
                    if (found) {
                        sessionRef.current = found;
                        setSession(found);
                    } else if (navigator.onLine) {
                        sessionRef.current = null;
                        setSession(null);
                        if (typeof localStorage !== 'undefined') {
                            localStorage.removeItem('last_precount_session_id');
                            localStorage.removeItem('precount_session_id');
                            sessionStorage.removeItem('active_precount_session_id');
                        }
                    }
                } else if (navigator.onLine && sessions.length === 0) {
                    sessionRef.current = null;
                    setSession(null);
                }
            } catch (error) {
                console.error('Error initializing pre-count:', error);
                // Si ya teníamos una sesión activa restaurada de Dexie, no alarmar al usuario
                if (!sessionRef.current) {
                    notify.error("Error de conexión", "No se pudo cargar el colector");
                }
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [user]);

    // REALTIME SUBSCRIPTIONS
    // Live query for the session to track 'synced' status and metadata changes
    const activeSessionId = session?.id;
    const channelRef = useRef<any>(null);

    const liveSession = useLiveQuery(
        async () => {
            if (!activeSessionId) return null;
            return await db.sessions.get(activeSessionId) as PreCountSession;
        },
        [activeSessionId]
    );

    // Sync state: Use liveSession if available, otherwise fallback to initial state
    const currentSession = liveSession || session;

    useEffect(() => {
        let disposed = false;
        let debounceTimer: NodeJS.Timeout | null = null;
        const DEBOUNCE_MS = 300;
        const sid = activeSessionId;

        const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
        const reconnectAttempts = new Map<string, number>();

        let sessionsChannel: any = null;
        let syncChannel: any = null;
        let filesChannel: any = null;
        let itemsChannel: any = null;

        const clearReconnectTimer = (key: string) => {
            const t = reconnectTimers.get(key);
            if (t) {
                clearTimeout(t);
                reconnectTimers.delete(key);
            }
        };

        const removeChannelSafely = (ch: any, topic?: string) => {
            if (topic) {
                const stale = supabase.getChannels().filter(
                    (c: any) => c.topic === `realtime:${topic}` || c.subTopic === topic
                );
                stale.forEach((c: any) => {
                    try { void supabase.removeChannel(c); } catch {}
                });
            }
            if (ch) {
                try { void supabase.removeChannel(ch); } catch {}
            }
        };

        const scheduleChannelReconnect = (key: string, subscribeFn: () => void) => {
            if (disposed || reconnectTimers.has(key)) return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            const attempt = reconnectAttempts.get(key) || 0;
            const delay = Math.min(15000, 1000 * Math.pow(2, attempt));
            reconnectAttempts.set(key, attempt + 1);
            const timer = setTimeout(() => {
                reconnectTimers.delete(key);
                if (!disposed) subscribeFn();
            }, delay);
            reconnectTimers.set(key, timer);
        };

        const mapFileRow = (f: any): ReceivedFile => ({
            id: f.id,
            filename: f.filename,
            content: f.content,
            deviceName: f.device_name || 'Terminal',
            deviceId: f.device_id,
            timestamp: new Date(f.created_at).getTime(),
            size: f.content?.length || 0
        });

        const isItemProtectedLocally = async (itemId: string): Promise<{ protected: boolean; scannedAt?: string }> => {
            if (!itemId) return { protected: false };
            const localItem = await db.items.get(itemId);
            if (localItem && localItem.synced === 0) {
                return { protected: true, scannedAt: localItem.scanned_at };
            }
            const pendingActions = await db.pendingActions.where('entity').equals('item').toArray();
            const isQueued = pendingActions.some(
                (a) =>
                    (a.status === 'pending' || a.status === 'syncing' || a.status === 'failed') &&
                    !Boolean((a as { permanentError?: boolean }).permanentError) &&
                    (a.data?.id === itemId || (Array.isArray(a.data?.ids) && a.data.ids.includes(itemId)))
            );
            return { protected: isQueued, scannedAt: localItem?.scanned_at };
        };

        const fetchExistingFiles = async (targetSid: string) => {
            if (disposed || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
            try {
                console.log(`[Sync] Fetching existing files for session ${targetSid}...`);
                const allFiles: any[] = [];
                let from = 0;
                const PAGE_SIZE = 1000;
                while (true) {
                    const { data, error } = await (supabase as any)
                        .from('precount_device_files')
                        .select('*')
                        .eq('session_id', targetSid)
                        .order('created_at', { ascending: false })
                        .range(from, from + PAGE_SIZE - 1);

                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    allFiles.push(...data);
                    if (data.length < PAGE_SIZE) break;
                    from += PAGE_SIZE;
                }
                if (!disposed) {
                    const mapped = allFiles.map(mapFileRow);
                    setReceivedFiles(mapped);
                    console.log(`[Sync] Loaded ${mapped.length} existing files for session ${targetSid}`);
                }
            } catch (err) {
                console.error('[Sync] Error fetching existing files:', err);
            }
        };

        const syncSessionItems = async (targetSid: string) => {
            if (disposed || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
            try {
                const allRemote: any[] = [];
                let from = 0;
                const PAGE_SIZE = 1000;
                while (true) {
                    const { data, error } = await supabase
                        .from('precount_items')
                        .select('*')
                        .eq('session_id', targetSid)
                        .order('scanned_at', { ascending: false })
                        .range(from, from + PAGE_SIZE - 1);

                    if (error) {
                        console.warn('[Sync] Error syncing precount_items:', error);
                        return;
                    }
                    if (!data || data.length === 0) break;
                    allRemote.push(...data);
                    if (data.length < PAGE_SIZE) break;
                    from += PAGE_SIZE;
                }
                if (disposed) return;

                const pendingActions = await db.pendingActions.where('entity').equals('item').toArray();
                const activePending = pendingActions.filter(
                    (a) =>
                        (a.status === 'pending' || a.status === 'syncing' || a.status === 'failed') &&
                        !Boolean((a as { permanentError?: boolean }).permanentError)
                );
                const pendingIds = new Set(
                    activePending.flatMap((a) => [a.data?.id, ...(Array.isArray(a.data?.ids) ? a.data.ids : [])]).filter(Boolean)
                );
                const localItems = await db.items.where('session_id').equals(targetSid).toArray();
                const unsyncedIds = new Set(localItems.filter((i) => i.synced === 0).map((i) => i.id));
                const localMap = new Map(localItems.map((i) => [i.id, i]));
                const remoteIds = new Set(allRemote.map((i: any) => i.id));

                const orphaned = localItems.filter(
                    (l) =>
                        l.synced === 1 &&
                        !remoteIds.has(l.id) &&
                        !pendingIds.has(l.id) &&
                        !unsyncedIds.has(l.id) &&
                        !isItemRecentlySaved(l.id)
                );
                if (orphaned.length > 0) {
                    await db.items.bulkDelete(orphaned.map((i) => i.id));
                }

                const safeRows = allRemote
                    .filter(
                        (item: any) =>
                            item?.id &&
                            !pendingIds.has(item.id) &&
                            !unsyncedIds.has(item.id) &&
                            !isItemRecentlyDeleted(item.id)
                    )
                    .map((item: any) => ({
                        id: item.id,
                        session_id: item.session_id,
                        ean: item.ean,
                        product_name: item.product_name || `Producto ${item.ean}`,
                        quantity: item.quantity || 0,
                        scanned_at: localMap.get(item.id)?.scanned_at || item.scanned_at || item.created_at || new Date().toISOString(),
                        scanned_by: item.scanned_by || undefined,
                        synced: 1,
                        id_producto: item.id_producto || undefined,
                        device_id: item.device_id || undefined,
                        device_name: item.device_name || undefined,
                        location_tag: item.location_tag || undefined,
                        laboratory: item.laboratory || undefined,
                        rubro: item.rubro || undefined,
                    }));

                if (safeRows.length > 0) {
                    await db.items.bulkPut(safeRows);
                }
            } catch (err) {
                console.warn('[Sync] Exception syncing session items:', err);
            }
        };

        const refreshSessionsList = async () => {
            if (disposed || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
            try {
                const sessions = await getActiveSessions({ branchId: user?.branchId, role: user?.role });
                if (!disposed) setAvailableSessions(sessions);
            } catch {}
        };

        const subscribeSessionsChannel = () => {
            if (disposed) return;
            clearReconnectTimer('sessions');
            const topic = `public:precount_sessions_ui_${sid || 'global'}`;
            removeChannelSafely(sessionsChannel, topic);

            sessionsChannel = supabase
                .channel(topic)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'precount_sessions' }, async (payload: any) => {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(async () => {
                        const sessions = await getActiveSessions({ branchId: user?.branchId, role: user?.role });
                        if (disposed) return;
                        setAvailableSessions(sessions);

                        const currentActiveId = sessionRef.current?.id;
                        if (currentActiveId) {
                            if (payload.eventType === 'DELETE' && payload.old?.id === currentActiveId) {
                                sessionRef.current = null;
                                setSession(null);
                                if (typeof localStorage !== 'undefined') {
                                    localStorage.removeItem('last_precount_session_id');
                                    localStorage.removeItem('precount_session_id');
                                    sessionStorage.removeItem('active_precount_session_id');
                                }
                                notify.info("Sesión eliminada", "La sesión actual fue eliminada desde otro dispositivo");
                            } else if (payload.eventType === 'UPDATE' && payload.new?.id === currentActiveId && payload.new?.status === 'completed') {
                                sessionRef.current = null;
                                setSession(null);
                                if (typeof localStorage !== 'undefined') {
                                    localStorage.removeItem('last_precount_session_id');
                                    localStorage.removeItem('precount_session_id');
                                    sessionStorage.removeItem('active_precount_session_id');
                                }
                                notify.info("Sesión finalizada", "El inventario ha sido finalizado por el Administrador");
                            }
                        }
                    }, DEBOUNCE_MS);
                })
                .subscribe((status) => {
                    if (disposed) return;
                    if (status === 'SUBSCRIBED') {
                        reconnectAttempts.set('sessions', 0);
                        void refreshSessionsList();
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleChannelReconnect('sessions', subscribeSessionsChannel);
                    }
                });
        };

        const subscribeSyncChannel = (targetSid: string) => {
            if (disposed) return;
            clearReconnectTimer('sync');
            const topic = `precount_sync:${targetSid}`;
            removeChannelSafely(syncChannel, topic);
            if (channelRef.current === syncChannel) channelRef.current = null;

            syncChannel = supabase
                .channel(topic)
                .on('broadcast', { event: 'device_joined' }, ({ payload }: any) => {
                    console.log(`[Sync] Device joined:`, payload);
                    setConnectedDevices(prev => {
                        const exists = prev.find(d => d.deviceId === payload.deviceId);
                        if (exists) {
                            return prev.map(d => d.deviceId === payload.deviceId ? payload : d);
                        }
                        return [...prev, payload];
                    });
                })
                .on('broadcast', { event: 'device_finalized' }, (message: any) => {
                    const payload = message.payload || message;
                    console.log(`[Sync] Broadcast ping received:`, payload);

                    const devName = payload.deviceName || 'Terminal';
                    const fName = payload.filename || 'conteo.txt';

                    if (payload.persistedToDb) {
                        notify.info("Archivo entrante", `${devName} envió ${fName}. Cargando...`, { duration: 3000 });
                    }
                })
                .subscribe((status) => {
                    if (disposed) return;
                    console.log(`[Sync] Broadcast channel status for ${targetSid}: ${status}`);
                    if (status === 'SUBSCRIBED') {
                        reconnectAttempts.set('sync', 0);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleChannelReconnect('sync', () => subscribeSyncChannel(targetSid));
                    }
                });
            channelRef.current = syncChannel;
        };

        const subscribeFilesChannel = (targetSid: string) => {
            if (disposed) return;
            clearReconnectTimer('files');
            const topic = `public:precount_device_files:${targetSid}`;
            removeChannelSafely(filesChannel, topic);

            filesChannel = supabase
                .channel(topic)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'precount_device_files' },
                    (payload) => {
                        const newFile = payload.new as any;
                        if (newFile.session_id !== targetSid) {
                            return;
                        }

                        console.log(`[Sync] DB file received for session ${targetSid}:`, {
                            id: newFile.id,
                            filename: newFile.filename,
                            device: newFile.device_name,
                            contentSize: newFile.content?.length
                        });

                        const event = new CustomEvent('precount:device_finalized', {
                            detail: {
                                dbFileId: newFile.id,
                                deviceId: newFile.device_id,
                                deviceName: newFile.device_name || 'Terminal',
                                filename: newFile.filename,
                                content: newFile.content,
                                timestamp: new Date(newFile.created_at).getTime(),
                                isReceived: true
                            }
                        });
                        window.dispatchEvent(event);

                        notify.success(
                            "Conteo recibido",
                            `${newFile.device_name || 'Terminal'} envió ${newFile.filename}. Disponible en la pestaña Archivos.`,
                            { duration: 8000 }
                        );

                        const mappedFile = mapFileRow(newFile);
                        setReceivedFiles(prev => {
                            if (prev.find(f => f.id === mappedFile.id)) return prev;
                            return [mappedFile, ...prev];
                        });
                    })
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'precount_device_files' },
                    (payload) => {
                        const updatedFile = payload.new as any;
                        if (updatedFile?.session_id !== targetSid) return;
                        const mappedFile = mapFileRow(updatedFile);
                        setReceivedFiles(prev => {
                            const exists = prev.some(f => f.id === mappedFile.id);
                            return exists
                                ? prev.map(f => f.id === mappedFile.id ? mappedFile : f)
                                : [mappedFile, ...prev];
                        });
                    })
                .on('postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'precount_device_files' },
                    (payload) => {
                        const oldId = payload.old?.id;
                        if (oldId) {
                            setReceivedFiles(prev => prev.filter(f => f.id !== oldId));
                        }
                    })
                .subscribe((status) => {
                    if (disposed) return;
                    console.log(`[Sync] Device files channel status: ${status}`);
                    if (status === 'SUBSCRIBED') {
                        reconnectAttempts.set('files', 0);
                        void fetchExistingFiles(targetSid);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        console.error('[Sync] Realtime channel error for precount_device_files. Reconnecting...');
                        scheduleChannelReconnect('files', () => subscribeFilesChannel(targetSid));
                    }
                });
        };

        const subscribeItemsChannel = (targetSid: string) => {
            if (disposed) return;
            clearReconnectTimer('items');
            const topic = `public:precount_items:${targetSid}`;
            removeChannelSafely(itemsChannel, topic);

            itemsChannel = supabase
                .channel(topic)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'precount_items', filter: `session_id=eq.${targetSid}` },
                    async (payload) => {
                        const newItem = payload.new as any;
                        const guard = await isItemProtectedLocally(newItem.id);
                        if (guard.protected) return;

                        await db.items.put({
                            id: newItem.id,
                            session_id: newItem.session_id,
                            ean: newItem.ean,
                            product_name: newItem.product_name,
                            quantity: newItem.quantity,
                            scanned_at: newItem.scanned_at || guard.scannedAt || new Date().toISOString(),
                            scanned_by: newItem.scanned_by,
                            synced: 1,
                            id_producto: newItem.id_producto,
                            device_id: newItem.device_id,
                            device_name: newItem.device_name,
                            location_tag: newItem.location_tag
                        });

                        if (newItem.device_id) {
                            setConnectedDevices(prev => {
                                if (prev.find(d => d.deviceId === newItem.device_id)) return prev;
                                return [...prev, {
                                    deviceId: newItem.device_id,
                                    deviceName: newItem.device_name || 'Zebra',
                                    joinedAt: Date.now()
                                }];
                            });
                        }
                    })
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${targetSid}` },
                    async (payload) => {
                        const updatedItem = payload.new as any;
                        const guard = await isItemProtectedLocally(updatedItem.id);
                        if (guard.protected) return;

                        await db.items.put({
                            id: updatedItem.id,
                            session_id: updatedItem.session_id,
                            ean: updatedItem.ean,
                            product_name: updatedItem.product_name,
                            quantity: updatedItem.quantity,
                            scanned_at: updatedItem.scanned_at || guard.scannedAt || new Date().toISOString(),
                            scanned_by: updatedItem.scanned_by,
                            synced: 1,
                            id_producto: updatedItem.id_producto,
                            device_id: updatedItem.device_id,
                            device_name: updatedItem.device_name,
                            location_tag: updatedItem.location_tag
                        });
                    })
                .on('postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${targetSid}` },
                    async (payload) => {
                        const oldId = payload.old?.id;
                        if (!oldId) return;
                        const guard = await isItemProtectedLocally(oldId);
                        if (guard.protected) return;
                        await db.items.delete(oldId);
                    })
                .subscribe((status) => {
                    if (disposed) return;
                    if (status === 'SUBSCRIBED') {
                        reconnectAttempts.set('items', 0);
                        void syncSessionItems(targetSid);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleChannelReconnect('items', () => subscribeItemsChannel(targetSid));
                    }
                });
        };

        subscribeSessionsChannel();

        const handleLocalDeviceJoined = (e: any) => {
            const payload = e.detail;
            if (!payload?.deviceId) return;
            setConnectedDevices(prev => {
                const exists = prev.find(d => d.deviceId === payload.deviceId);
                if (exists) {
                    return prev.map(d => d.deviceId === payload.deviceId ? payload : d);
                }
                return [...prev, payload];
            });
        };
        window.addEventListener('precount:device_joined' as any, handleLocalDeviceJoined);

        if (sid) {
            void fetchExistingFiles(sid);
            void syncSessionItems(sid);
            subscribeSyncChannel(sid);
            subscribeFilesChannel(sid);
            subscribeItemsChannel(sid);
        } else {
            setReceivedFiles([]);
            setConnectedDevices([]);
        }

        const handleWakeUp = () => {
            if (disposed) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;

            const mgr = syncManager as unknown as { onConnectivityRestored?: () => Promise<void> };
            const flushPromise =
                typeof mgr.onConnectivityRestored === 'function'
                    ? mgr.onConnectivityRestored()
                    : syncManager.flushNow();
            void flushPromise.then(() => {
                if (disposed) return;
                void refreshSessionsList();
                if (sid) {
                    void fetchExistingFiles(sid);
                    void syncSessionItems(sid);
                }
            });

            if (!sessionsChannel || sessionsChannel.state !== 'joined') {
                reconnectAttempts.set('sessions', 0);
                subscribeSessionsChannel();
            }
            if (sid) {
                if (!syncChannel || syncChannel.state !== 'joined') {
                    reconnectAttempts.set('sync', 0);
                    subscribeSyncChannel(sid);
                }
                if (!filesChannel || filesChannel.state !== 'joined') {
                    reconnectAttempts.set('files', 0);
                    subscribeFilesChannel(sid);
                }
                if (!itemsChannel || itemsChannel.state !== 'joined') {
                    reconnectAttempts.set('items', 0);
                    subscribeItemsChannel(sid);
                }
            }
        };

        window.addEventListener('online', handleWakeUp);
        window.addEventListener('focus', handleWakeUp);
        document.addEventListener('visibilitychange', handleWakeUp);

        return () => {
            disposed = true;
            window.removeEventListener('precount:device_joined' as any, handleLocalDeviceJoined);
            window.removeEventListener('online', handleWakeUp);
            window.removeEventListener('focus', handleWakeUp);
            document.removeEventListener('visibilitychange', handleWakeUp);
            if (debounceTimer) clearTimeout(debounceTimer);
            reconnectTimers.forEach((t) => clearTimeout(t));
            reconnectTimers.clear();
            removeChannelSafely(sessionsChannel);
            removeChannelSafely(itemsChannel);
            removeChannelSafely(syncChannel);
            removeChannelSafely(filesChannel);
            channelRef.current = null;
        };
    }, [activeSessionId, user?.branchId, user?.role]);

    // Descarga en segundo plano del catálogo para dispositivos que se unen
    useEffect(() => {
        const downloadCatalog = async () => {
            if (!session?.id) return;
            
            try {
                // Verificar si ya tenemos el catálogo localmente en la base de datos local
                const localSession = await db.sessions.get(session.id) as PreCountSession;
                if (localSession?.master_catalog && localSession.master_catalog.length > 0) {
                    // Ya tenemos el catálogo localmente, no hacer nada
                    return;
                }

                if (!navigator.onLine) {
                    console.log('[Sync] Dispositivo sin conexión. La descarga del catálogo de stock se reintentará al conectarse.');
                    return;
                }

                setIsDownloadingCatalog(true);
                console.log('[Sync] Iniciando descarga en segundo plano del catálogo de stock para la sesión:', session.id);
                
                const { data: catalogRows, error } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', session.id)
                    .eq('device_id', 'system')
                    .eq('filename', 'master_catalog.json')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error) throw error;
                const data = Array.isArray(catalogRows) && catalogRows.length > 0 ? catalogRows[0] : null;

                if (data && data.content) {
                    const parsedCatalog = await decompressGzipBase64ToJson(data.content);
                    console.log(`[Sync] Catálogo descargado con éxito. Productos: ${parsedCatalog.length}`);
                    
                    // Guardar en la base de datos local IndexedDB
                    await db.sessions.update(session.id, {
                        master_catalog: parsedCatalog
                    });

                    // Guardar productos en la tabla db.precount_products solo en Web/PWA
                    if (!isTauriEnvironment()) {
                        const dbProducts = expandCatalogToDbProducts(parsedCatalog, session.id);
                        const CHUNK_SIZE = 5000;
                        for (let i = 0; i < dbProducts.length; i += CHUNK_SIZE) {
                            await db.precount_products.bulkPut(dbProducts.slice(i, i + CHUNK_SIZE));
                        }
                        console.log(`[Sync] Guardados localmente ${dbProducts.length} filas EAN en db.precount_products (${parsedCatalog.length} productos)`);
                    } else {
                        // En Tauri, asegurar que SQLite stock_local.db tenga estos productos indexados
                        try {
                            const { importCatalogToLocalDb } = await import('@/services/tauriLocalDb');
                            const localInputs = parsedCatalog.map((item: any) => ({
                                id_producto: item.id_producto || item.id || '',
                                troquel: item.troquel,
                                name: item.name,
                                stock: item.systemStock ?? item.stock ?? 0,
                                sale_price: item.salePrice || item.sale_price || 0,
                                cost: item.cost || 0,
                                category: item.rubro || item.category,
                                subrubro: item.subrubro,
                                laboratory: item.laboratory,
                                is_hidden: item.is_hidden ?? false,
                                is_traceable: item.is_traceable ?? item.trazable ?? false,
                                gtin: item.gtin,
                                eans: (item.eans && item.eans.length > 0) ? item.eans : [item.ean],
                            }));
                            await importCatalogToLocalDb(localInputs);
                        } catch (sqliteErr) {
                            console.warn('[usePreCount] Error sincronizando a SQLite local:', sqliteErr);
                        }
                    }

                    // Actualizar el estado local de la sesión
                    setSession(prev => prev && prev.id === session.id ? {
                        ...prev,
                        master_catalog: parsedCatalog
                    } : prev);
                    window.dispatchEvent(new CustomEvent('precount:catalog_loaded', { detail: { sessionId: session.id } }));

                    const primaryCount = Array.isArray(parsedCatalog)
                        ? parsedCatalog.filter((p: any) => p.isPrimaryEan ?? true).length
                        : (parsedCatalog as any[]).length;

                    notify.success(
                        "Catálogo cargado",
                        `Se sincronizaron ${primaryCount.toLocaleString('es-AR')} productos (${parsedCatalog.length.toLocaleString('es-AR')} códigos EAN) para búsqueda offline.`,
                        { duration: 4500 }
                    );
                } else {
                    console.warn('[Sync] No se encontró un catálogo cargado para esta sesión en Supabase.');
                }
            } catch (err) {
                console.error('[Sync] Error al descargar el catálogo en segundo plano:', err);
            } finally {
                setIsDownloadingCatalog(false);
            }
        };

        downloadCatalog();

        // Escuchar cambios de estado de red para reintentar la descarga
        const handleOnline = () => {
            downloadCatalog();
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [session?.id]);

    // Asegurar que los productos locales estén cargados en db.precount_products si existen en session.master_catalog
    const sessionId = session?.id;
    useEffect(() => {
        const restoreProducts = async () => {
            if (isTauriEnvironment()) return; // En Tauri, SQLite gestiona la base local sin bloquear el renderizado
            if (!sessionId || !session?.master_catalog || session.master_catalog.length === 0) return;
            try {
                const count = await db.precount_products.where('session_id').equals(sessionId).count();
                if (count === 0) {
                    console.log(`[Sync] db.precount_products está vacío para la sesión activa ${sessionId}. Restaurando desde master_catalog...`);
                    // Expansión: una fila por EAN para que EANs secundarios sean buscables
                    const dbProducts = expandCatalogToDbProducts(session.master_catalog, sessionId);
                    const CHUNK_SIZE = 5000;
                    for (let i = 0; i < dbProducts.length; i += CHUNK_SIZE) {
                        await db.precount_products.bulkPut(dbProducts.slice(i, i + CHUNK_SIZE));
                    }
                    console.log(`[Sync] Restauradas ${dbProducts.length} filas EAN para la sesión ${sessionId} en db.precount_products (${session.master_catalog.length} productos)`);
                    window.dispatchEvent(new CustomEvent('precount:catalog_loaded', { detail: { sessionId } }));
                }
            } catch (err) {
                console.error('[Sync] Error al restaurar productos locales:', err);
            }
        };
        restoreProducts();
    }, [sessionId, session?.master_catalog]);


    // Helper to map DB item to UI item
    const mapInternalItemToUI = (dbItem: any): UIPreCountItem => ({
        id: dbItem.id,
        sessionId: dbItem.session_id,
        ean: dbItem.ean,
        productName: dbItem.product_name || 'Producto Desconocido',
        quantity: dbItem.quantity,
        timestamp: new Date(dbItem.scanned_at || Date.now()).getTime(),
        synced: dbItem.synced ?? 1,
        id_producto: dbItem.id_producto,
        deviceId: dbItem.device_id,
        deviceName: dbItem.device_name,
        location_tag: dbItem.location_tag
    });

    // Calcular totales
    const totalProducts = useMemo(() => items.length, [items.length]);
    const totalUnits = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

    // Iniciar nueva sesión
    const startSession = async (sector: string, masterCatalog?: any[], syncPin?: string, profile?: 'sucursal' | 'sap') => {
        if (!user) return;
        if (isStartingSessionRef.current) return;
        
        // PREVENCIÓN: Si ya tenemos una sesión activa con este mismo sector y el mismo PIN, no crear una nueva.
        const currentSess = sessionRef.current || session;
        if (currentSess && currentSess.sector === sector && currentSess.status === 'active' && currentSess.sync_pin === syncPin) {
            console.log('[Sync] Session already active with same PIN, skipping creation.');
            return;
        }

        isStartingSessionRef.current = true;
        setIsLoading(true);
        try {
            const newSession = await createSession(sector, user.branchId, masterCatalog, syncPin, profile);
            sessionRef.current = newSession;
            setSession(newSession);
            localStorage.setItem('last_precount_session_id', newSession.id);
            localStorage.setItem('precount_session_id', newSession.id);
            sessionStorage.setItem('active_precount_session_id', newSession.id);
            
            // Guardar productos del catálogo maestro localmente en db.precount_products solo en Web/PWA
            if (!isTauriEnvironment() && masterCatalog && masterCatalog.length > 0) {
                const dbProducts = expandCatalogToDbProducts(masterCatalog, newSession.id);
                const CHUNK_SIZE = 5000;
                for (let i = 0; i < dbProducts.length; i += CHUNK_SIZE) {
                    await db.precount_products.bulkPut(dbProducts.slice(i, i + CHUNK_SIZE));
                }
                console.log(`[Sync] Guardados localmente ${dbProducts.length} filas EAN en db.precount_products al iniciar sesión (${masterCatalog.length} productos)`);
            }
            
            // Encolar la subida del catálogo comprimido (gzip) a Supabase para sincronización offline-first
            if (masterCatalog && masterCatalog.length > 0) {
                console.log('[Sync] Queueing compressed master catalog upload for session:', newSession.id);
                const compressed = await compressJsonToGzipBase64(masterCatalog);
                const { syncManager } = await import('@/services/syncManager');
                await syncManager.addToQueue({
                    type: 'create',
                    entity: 'device_file',
                    data: {
                        session_id: newSession.id,
                        device_id: 'system',
                        device_name: 'System',
                        filename: 'master_catalog.json',
                        content: compressed
                    }
                });
            }

            const sessions = await getActiveSessions({ branchId: user.branchId, role: user.role });
            setAvailableSessions(sessions);
            notify.success("Sesión iniciada", "La sesión ha sido creada correctamente");
        } catch (error) {
            console.error('Error starting session:', error);
            notify.error("Error", "No se pudo crear la sesión");
        } finally {
            isStartingSessionRef.current = false;
            setIsLoading(false);
        }
    };

    // Announce device presence (for Zebras joining)
    const announcePresence = async (explicitSessionId?: string) => {
        const idToUse = explicitSessionId || session?.id;
        if (!idToUse) return;
        
        try {
            const { emitDeviceTelemetry } = await import('@/services/deviceTelemetry');
            await emitDeviceTelemetry({
                sessionId: idToUse,
                currentLocation: null,
                totalScanned: totalUnits || 0,
                totalSkus: totalProducts || 0,
            });
        } catch (err) {
            console.error('Error announcing presence:', err);
        }
    };



    // Resume session
    const resumeSession = async (sessionToResume: PreCountSession, showNotification = true) => {
        try {
            sessionRef.current = sessionToResume;
            setSession(sessionToResume);
            localStorage.setItem('last_precount_session_id', sessionToResume.id);
            localStorage.setItem('precount_session_id', sessionToResume.id);
            sessionStorage.setItem('active_precount_session_id', sessionToResume.id);
            setErrorCount(sessionToResume.errorCount || 0);

            const isInsideCollector = typeof window !== 'undefined' && 
                (window.location.hash.includes('stock/colector') || window.location.pathname.includes('stock/colector'));

            if (showNotification && isInsideCollector) {
                notify.success("Sesión retomada", `Sucursal: ${sessionToResume.sector}`);
            }
        } catch (error) {
            console.error('Error resuming session:', error);
            const isInsideCollector = typeof window !== 'undefined' && 
                (window.location.hash.includes('stock/colector') || window.location.pathname.includes('stock/colector'));
            if (isInsideCollector) {
                notify.error("Error", "No se pudo conectar a la sesión");
            }
        }
    };

    // Delete session
    const deleteSession = async (id: string) => {
        const previousSessions = [...availableSessions];
        setAvailableSessions(prev => prev.filter(s => s.id !== id));
        try {
            await deleteSessionDB(id);
            await db.precount_products.where('session_id').equals(id).delete();
            if (sessionRef.current?.id === id) {
                sessionRef.current = null;
                setSession(null);
            }

            // Limpieza exhaustiva de claves de sesión y caché de terminales en localStorage
            if (typeof window !== 'undefined') {
                try {
                    localStorage.removeItem('last_precount_session_id');
                    localStorage.removeItem('precount_session_id');
                    sessionStorage.removeItem('active_precount_session_id');

                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.startsWith('precount_monitor_cache_') || k.startsWith('precount_active_terminal_') || k.includes(id))) {
                            keysToRemove.push(k);
                        }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                } catch {}

                window.dispatchEvent(new CustomEvent('precount:session_deleted', { detail: { sessionId: id } }));
            }

            notify.success("Sesión eliminada", "La sesión ha sido eliminada correctamente");
        } catch (error) {
            console.error('Error deleting session:', error);
            setAvailableSessions(previousSessions);
            notify.error("Error", "No se pudo eliminar la sesión");
        }
    };

    // Agregar item
    const addItem = useCallback(async (ean: string, productName: string, quantity: number, id_producto?: string, location_tag?: string) => {
        if (!session) return;
        try {
            const { upsertPreCountItem } = await import('@/services/preCountDB');
            await upsertPreCountItem({
                session_id: session.id,
                ean,
                product_name: productName,
                quantity,
                id_producto,
                location_tag
            });

            // Guardar copia offline ultrarrápida en SQLite local de Tauri (%APPDATA%/com.farmaplus.desktop/data/stock_local.db)
            try {
                const { recordLocalScan } = await import('@/services/tauriLocalDb');
                await recordLocalScan(session.id, ean, quantity, location_tag);
            } catch (err) {
                console.debug('[LocalDB] recordLocalScan skipped:', err);
            }

            // Emitir telemetría liviana a la PC Admin (sin saturar con productos individuales)
            try {
                const { emitDeviceTelemetry } = await import('@/services/deviceTelemetry');
                await emitDeviceTelemetry({
                    sessionId: session.id,
                    currentLocation: location_tag || null,
                    totalScanned: totalUnits + quantity,
                    totalSkus: totalProducts + 1,
                });
            } catch (err) {
                console.debug('[Telemetry] emitDeviceTelemetry error:', err);
            }

            playSound('success');
        } catch (error) {
            console.error('Error adding item:', error);
            notify.error("Error", "No se pudo agregar el producto");
        }
    }, [session, totalUnits, totalProducts]);

    // Actualizar item
    const updateItem = useCallback(async (id: string, quantity: number) => {
        if (quantity <= 0) return;
        try {
            await updatePreCountItem(id, { quantity });
        } catch (error) {
            console.error('Error updating item:', error);
            notify.error("Error", "No se pudo actualizar el producto");
        }
    }, []);

    // Eliminar item
    const removeItem = useCallback(async (id: string) => {
        try {
            await deletePreCountItem(id);
            playSound('delete');
        } catch (error) {
            console.error('Error removing item:', error);
            notify.error("Error", "No se pudo eliminar el producto");
        }
    }, []);

    // Finalizar sesión
    const finishSession = async () => {
        if (!session) return;
        try {
            // Vaciar y sincronizar inmediatamente cualquier producto pendiente en cola
            try {
                const { syncManager } = await import('@/services/syncManager');
                await syncManager.flushNow();
            } catch (syncErr) {
                console.warn('[PreCount] Error en flushNow antes de finalizar:', syncErr);
            }

            await endSession(session.id);
            
            // Bridge to Dashboard Progress
            if (user?.branchName && session.sector) {
                console.log(`[PreCount] Session ended. Updating progress for ${session.sector}...`);
                await cyclicInventoryService.markLabAsControlled(user.branchName, session.sector);
            }

            await db.precount_products.where('session_id').equals(session.id).delete();
            sessionRef.current = null;
            setSession(null);
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('last_precount_session_id');
                localStorage.removeItem('precount_session_id');
                sessionStorage.removeItem('active_precount_session_id');
            }
            notify.success("Sesión finalizada", "La sesión se cerró y finalizó");
        } catch (error) {
            console.error('Error finishing session:', error);
            notify.error("Error", "No se pudo finalizar la sesión");
        }
    };

    // Refrescar items
    const refreshItems = useCallback(async () => {
        const sessions = await getActiveSessions({ branchId: user?.branchId, role: user?.role });
        setAvailableSessions(sessions);
    }, [user]);

    const registerError = useCallback(() => {
        setErrorCount(prev => prev + 1);
    }, []);

    // Send final count to Admin (awaitable)
    // Strategy: Persist to DB first (with offline queue fallback), then broadcast a notification ping
    const sendFinalCount = async (filename: string, content: string): Promise<boolean> => {
        if (!session) return false;
        const deviceName = localStorage.getItem('precount_device_name') || 'Zebra';
        const deviceId = localStorage.getItem('precount_device_id') || 'unknown';

        console.log(`[Sync] Sending final count for session ${session.id}: ${filename} (${content.length} chars)...`);

        const fileRecord = {
            session_id: session.id,
            device_id: deviceId,
            device_name: deviceName,
            filename,
            content
        };

        // 1. PERSIST to Supabase DB (or enqueue offline in Dexie pendingActions)
        let dbInsertOk = false;
        if (typeof navigator === 'undefined' || navigator.onLine) {
            try {
                const { error } = await (supabase as any)
                    .from('precount_device_files')
                    .insert(fileRecord);

                if (error) {
                    console.error(`[Sync] DB insert failed for session ${session.id}:`, error);
                } else {
                    dbInsertOk = true;
                    console.log(`[Sync] File persisted to DB successfully for session ${session.id}`);
                }
            } catch (err) {
                console.error(`[Sync] DB insert exception for session ${session.id}:`, err);
            }
        }

        if (!dbInsertOk) {
            try {
                await syncManager.addToQueue({
                    type: 'create',
                    entity: 'device_file',
                    data: fileRecord
                });
                console.log(`[Sync] Queued final count file in offline sync queue: ${filename}`);
            } catch (queueErr) {
                console.error(`[Sync] Error queueing offline device_file:`, queueErr);
            }
        }

        // 2. BROADCAST a lightweight notification (just a ping, no file content)
        try {
            const channel = channelRef.current;
            if (channel && channel.state === 'joined') {
                await channel.send({
                    type: 'broadcast',
                    event: 'device_finalized',
                    payload: { 
                        deviceId, 
                        deviceName, 
                        filename, 
                        timestamp: Date.now(),
                        // Signal that the file is in the DB, not in this payload
                        persistedToDb: dbInsertOk
                    }
                });
                console.log('[Sync] Broadcast notification sent');
            } else {
                console.warn('[Sync] No active joined channel for broadcast notification');
            }
        } catch (e) { 
            console.warn('[Sync] Broadcast notification failed (non-critical):', e); 
        }

        // 3. Local fallback for same-device testing
        try {
            const localPayload = { deviceId, deviceName, filename, content, timestamp: Date.now() };
            localStorage.setItem('precount:sync_file', JSON.stringify(localPayload));
        } catch (e) { /* localStorage might be full for large files */ }

        return dbInsertOk;
    };

    return {
        items,
        session: currentSession,
        totalProducts,
        totalUnits,
        errorCount,
        isLoading,
        availableSessions,
        connectedDevices,
        receivedFiles,
        startSession,
        resumeSession,
        deleteSession,
        addItem,
        updateItem,
        removeItem,
        finishSession,
        refreshItems,
        registerError,
        announcePresence,
        sendFinalCount,
        isDownloadingCatalog
    };
}
