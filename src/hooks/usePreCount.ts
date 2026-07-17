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
} from '@/services/preCountDB';
import { notify } from '@/lib/notifications';
import { useUser } from '@/contexts/UserContext';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';

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
                stock: p.systemStock || 0,
                id_producto: p.id_producto || '',
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
    resumeSession: (session: PreCountSession) => Promise<void>;
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
    const [errorCount, setErrorCount] = useState(0);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
    const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
    const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);
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

    // Initial Load
    useEffect(() => {
        const init = async () => {
            if (!user) return; // Wait for user context
            try {
                const sessions = await getActiveSessions({ 
                    branchId: user.branchId, 
                    role: user.role 
                });
                setAvailableSessions(sessions);
            } catch (error) {
                console.error('Error initializing pre-count:', error);
                notify.error("Error de conexión", "No se pudo cargar el colector");
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
        let debounceTimer: NodeJS.Timeout | null = null;
        const DEBOUNCE_MS = 300;

        const sessionsChannel = supabase
            .channel('public:precount_sessions_ui')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'precount_sessions' }, async (payload) => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    const sessions = await getActiveSessions({ branchId: user?.branchId, role: user?.role });
                    setAvailableSessions(sessions);

                    if (session && payload.eventType === 'DELETE' && payload.old.id === session.id) {
                        setSession(null);
                        notify.info("Sesión eliminada", "La sesión actual fue eliminada desde otro dispositivo");
                    }
                }, DEBOUNCE_MS);
            })
            .subscribe();

        let itemsChannel: any = null;
        let presenceChannel: any = null;
        let filesChannel: any = null;

        const fetchExistingFiles = async (sid: string) => {
            try {
                console.log(`[Sync] Fetching existing files for session ${sid}...`);
                const { data, error } = await (supabase as any)
                    .from('precount_device_files')
                    .select('*')
                    .eq('session_id', sid)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (data) {
                    const mapped = data.map((f: any) => ({
                        id: f.id,
                        filename: f.filename,
                        content: f.content,
                        deviceName: f.device_name || 'Terminal',
                        deviceId: f.device_id,
                        timestamp: new Date(f.created_at).getTime(),
                        size: f.content?.length || 0
                    }));
                    setReceivedFiles(mapped);
                    console.log(`[Sync] Loaded ${mapped.length} existing files for session ${sid}`);
                }
            } catch (err) {
                console.error('[Sync] Error fetching existing files:', err);
            }
        };

        if (session) {
            fetchExistingFiles(session.id);
            // Presence tracking
            presenceChannel = supabase
                .channel(`precount_presence:${session.id}`)
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
                .subscribe();

            // File Transfer Channel — broadcast is just a notification ping
            channelRef.current = supabase
                .channel(`precount_sync:${session.id}`)
                .on('broadcast', { event: 'device_finalized' }, (message: any) => {
                    const payload = message.payload || message;
                    console.log(`[Sync] Broadcast ping received:`, payload);
                    
                    const devName = payload.deviceName || 'Terminal';
                    const fName = payload.filename || 'conteo.txt';

                    // If the file was persisted to DB, the postgres_changes listener
                    // will handle delivering the actual content. This is just a toast.
                    if (payload.persistedToDb) {
                        notify.info("Archivo entrante", `${devName} envió ${fName}. Cargando...`, { duration: 3000 });
                    }
                })
                .subscribe((status) => {
                    console.log(`[Sync] Broadcast channel status for ${session.id}: ${status}`);
                });

            // DATABASE LISTENER for device files (RELIABLE delivery)
            filesChannel = supabase
                .channel(`public:precount_device_files:${session.id}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'precount_device_files' },
                    (payload) => {
                        const newFile = payload.new as any;
                        
                        // Client-side session filtering (safer than DB-side filter for Realtime)
                        if (newFile.session_id !== session.id) {
                            console.log(`[Sync] Ignoring file for different session: ${newFile.session_id} (Current: ${session.id})`);
                            return;
                        }

                        console.log(`[Sync] DB file received for session ${session.id}:`, { 
                            id: newFile.id, 
                            filename: newFile.filename, 
                            device: newFile.device_name,
                            contentSize: newFile.content?.length 
                        });

                        // Dispatch event for PreCount.tsx UI to pick up
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

                        // Update local state
                        const mappedFile: ReceivedFile = {
                            id: newFile.id,
                            filename: newFile.filename,
                            content: newFile.content,
                            deviceName: newFile.device_name || 'Terminal',
                            deviceId: newFile.device_id,
                            timestamp: new Date(newFile.created_at).getTime(),
                            size: newFile.content?.length || 0
                        };

                        setReceivedFiles(prev => {
                            if (prev.find(f => f.id === mappedFile.id)) return prev;
                            return [mappedFile, ...prev];
                        });
                    })
                .subscribe((status) => {
                    console.log(`[Sync] Device files channel status: ${status}`);
                    if (status === 'CHANNEL_ERROR') {
                        console.error('[Sync] Realtime channel error for precount_device_files. Check RLS or Publication.');
                    }
                });

            itemsChannel = supabase
                .channel(`public:precount_items:${session.id}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    async (payload) => {
                        const newItem = payload.new as any;
                        await db.items.put({
                            id: newItem.id,
                            session_id: newItem.session_id,
                            ean: newItem.ean,
                            product_name: newItem.product_name,
                            quantity: newItem.quantity,
                            scanned_at: newItem.scanned_at,
                            scanned_by: newItem.scanned_by,
                            synced: 1, 
                            id_producto: newItem.id_producto,
                            device_id: newItem.device_id,
                            device_name: newItem.device_name,
                            location_tag: newItem.location_tag
                        });
                        
                        // Auto-add device to presence if it scans something
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
                    { event: 'UPDATE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    async (payload) => {
                        const updatedItem = payload.new as any;
                        await db.items.update(updatedItem.id, {
                            quantity: updatedItem.quantity,
                            scanned_at: updatedItem.scanned_at,
                            synced: 1
                        });
                    })
                .on('postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    async (payload) => {
                        await db.items.delete(payload.old.id);
                    })
                .subscribe();
        } else {
            setReceivedFiles([]);
            setConnectedDevices([]);
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(sessionsChannel);
            if (itemsChannel) supabase.removeChannel(itemsChannel);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            if (presenceChannel) {
                supabase.removeChannel(presenceChannel);
            }
            if (filesChannel) {
                supabase.removeChannel(filesChannel);
            }
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
                
                const { data, error } = await (supabase as any)
                    .from('precount_device_files')
                    .select('content')
                    .eq('session_id', session.id)
                    .eq('device_id', 'system')
                    .eq('filename', 'master_catalog.json')
                    .maybeSingle();

                if (error) throw error;

                if (data && data.content) {
                    const parsedCatalog = JSON.parse(data.content);
                    console.log(`[Sync] Catálogo descargado con éxito. Productos: ${parsedCatalog.length}`);
                    
                    // Guardar en la base de datos local IndexedDB
                    await db.sessions.update(session.id, {
                        master_catalog: parsedCatalog
                    });

                    // Guardar productos en la tabla db.precount_products
                    // Se expande: una fila por EAN para que cualquier EAN secundario sea buscable
                    const dbProducts = expandCatalogToDbProducts(parsedCatalog, session.id);
                    await db.precount_products.bulkPut(dbProducts);
                    console.log(`[Sync] Guardados localmente ${dbProducts.length} filas EAN en db.precount_products (${parsedCatalog.length} productos)`);

                    // Actualizar el estado local de la sesión
                    setSession(prev => prev && prev.id === session.id ? {
                        ...prev,
                        master_catalog: parsedCatalog
                    } : prev);

                    notify.success("Catálogo cargado", `Se sincronizaron ${parsedCatalog.length} productos de stock en segundo plano para búsqueda offline.`, { duration: 4000 });
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
            if (!sessionId || !session?.master_catalog || session.master_catalog.length === 0) return;
            try {
                const count = await db.precount_products.where('session_id').equals(sessionId).count();
                if (count === 0) {
                    console.log(`[Sync] db.precount_products está vacío para la sesión activa ${sessionId}. Restaurando desde master_catalog...`);
                    // Expansión: una fila por EAN para que EANs secundarios sean buscables
                    const dbProducts = expandCatalogToDbProducts(session.master_catalog, sessionId);
                    await db.precount_products.bulkPut(dbProducts);
                    console.log(`[Sync] Restauradas ${dbProducts.length} filas EAN para la sesión ${sessionId} en db.precount_products (${session.master_catalog.length} productos)`);
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
        
        // PREVENCIÓN: Si ya tenemos una sesión activa con este mismo sector y el mismo PIN, no crear una nueva.
        if (session && session.sector === sector && session.status === 'active' && session.sync_pin === syncPin) {
            console.log('[Sync] Session already active with same PIN, skipping creation.');
            return;
        }

        setIsLoading(true);
        try {
            const newSession = await createSession(sector, user.branchId, masterCatalog, syncPin, profile);
            setSession(newSession);
            localStorage.setItem('last_precount_session_id', newSession.id);
            sessionStorage.setItem('active_precount_session_id', newSession.id);
            
            // Guardar productos del catálogo maestro localmente en db.precount_products
            // Se expande: una fila por EAN para que cualquier EAN secundario sea buscable
            if (masterCatalog && masterCatalog.length > 0) {
                const dbProducts = expandCatalogToDbProducts(masterCatalog, newSession.id);
                await db.precount_products.bulkPut(dbProducts);
                console.log(`[Sync] Guardados localmente ${dbProducts.length} filas EAN en db.precount_products al iniciar sesión (${masterCatalog.length} productos)`);
            }
            
            // Encolar la subida del catálogo a Supabase para sincronización offline-first
            if (masterCatalog && masterCatalog.length > 0) {
                console.log('[Sync] Queueing master catalog upload for session:', newSession.id);
                const { syncManager } = await import('@/services/syncManager');
                await syncManager.addToQueue({
                    type: 'create',
                    entity: 'device_file',
                    data: {
                        session_id: newSession.id,
                        device_id: 'system',
                        device_name: 'System',
                        filename: 'master_catalog.json',
                        content: JSON.stringify(masterCatalog)
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
            setIsLoading(false);
        }
    };

    // Announce device presence (for Zebras joining)
    const announcePresence = async (explicitSessionId?: string) => {
        const idToUse = explicitSessionId || session?.id;
        if (!idToUse) return;
        
        const deviceId = localStorage.getItem('precount_device_id') || `dev-${Math.random().toString(36).substring(7)}`;
        const deviceName = localStorage.getItem('precount_device_name') || 'Zebra';
        
        try {
            const channel = supabase.channel(`precount_presence:${idToUse}`);
            await channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'device_joined',
                        payload: { deviceId, deviceName, joinedAt: Date.now() }
                    });
                }
            });
        } catch (err) {
            console.error('Error announcing presence:', err);
        }
    };



    // Resume session
    const resumeSession = async (sessionToResume: PreCountSession) => {
        try {
            setSession(sessionToResume);
            localStorage.setItem('last_precount_session_id', sessionToResume.id);
            setErrorCount(sessionToResume.errorCount || 0);
            notify.success("Sesión retomada", `Sucursal: ${sessionToResume.sector}`);
        } catch (error) {
            console.error('Error resuming session:', error);
            notify.error("Error", "No se pudo conectar a la sesión");
        }
    };

    // Delete session
    const deleteSession = async (id: string) => {
        const previousSessions = [...availableSessions];
        setAvailableSessions(prev => prev.filter(s => s.id !== id));
        try {
            await deleteSessionDB(id);
            await db.precount_products.where('session_id').equals(id).delete();
            if (session?.id === id) setSession(null);
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
            playSound('success');
        } catch (error) {
            console.error('Error adding item:', error);
            notify.error("Error", "No se pudo agregar el producto");
        }
    }, [session]);

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
            await endSession(session.id);
            
            // Bridge to Dashboard Progress
            if (user?.branchName && session.sector) {
                console.log(`[PreCount] Session ended. Updating progress for ${session.sector}...`);
                await cyclicInventoryService.markLabAsControlled(user.branchName, session.sector);
            }

            await db.precount_products.where('session_id').equals(session.id).delete();
            setSession(null);
            localStorage.removeItem('last_precount_session_id');
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
    // Strategy: Persist to DB first (guaranteed), then broadcast a notification ping
    const sendFinalCount = async (filename: string, content: string): Promise<boolean> => {
        if (!session) return false;
        const deviceName = localStorage.getItem('precount_device_name') || 'Zebra';
        const deviceId = localStorage.getItem('precount_device_id') || 'unknown';

        console.log(`[Sync] Sending final count for session ${session.id}: ${filename} (${content.length} chars)...`);

        // 1. PERSIST to Supabase DB (this is the reliable delivery mechanism)
        let dbInsertOk = false;
        try {
            const { error } = await (supabase as any)
                .from('precount_device_files')
                .insert({
                    session_id: session.id,
                    device_id: deviceId,
                    device_name: deviceName,
                    filename: filename,
                    content: content
                });

            if (error) {
                console.error(`[Sync] DB insert failed for session ${session.id}:`, error);
            } else {
                dbInsertOk = true;
                console.log(`[Sync] File persisted to DB successfully for session ${session.id}`);
            }
        } catch (err) {
            console.error(`[Sync] DB insert exception for session ${session.id}:`, err);
        }

        // 2. BROADCAST a lightweight notification (just a ping, no file content)
        try {
            const channel = channelRef.current;
            if (channel) {
                await channel.send({
                    type: 'broadcast',
                    event: 'device_finalized',
                    payload: { 
                        deviceId, 
                        deviceName, 
                        filename, 
                        timestamp: Date.now(),
                        // Signal that the file is in the DB, not in this payload
                        persistedToDb: true
                    }
                });
                console.log('[Sync] Broadcast notification sent');
            } else {
                console.warn('[Sync] No active channel for broadcast notification');
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
