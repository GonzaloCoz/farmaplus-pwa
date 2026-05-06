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
    startSession: (sector: string, masterCatalog?: any[], syncPin?: string) => Promise<void>;
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
}

export interface ConnectedDevice {
    deviceId: string;
    deviceName: string;
    joinedAt: number;
}


export function usePreCount(): UsePreCountReturn {
    const [session, setSession] = useState<PreCountSession | null>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
    const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

        if (session) {
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

            // File Transfer Channel (Isolated)
            channelRef.current = supabase
                .channel(`precount_sync:${session.id}`)
                .on('broadcast', { event: 'device_finalized' }, (message: any) => {
                    // Supabase broadcast payloads can be nested differently depending on version
                    const payload = message.payload || message;
                    console.log(`[Sync] BROADCAST RECEIVED:`, payload);
                    
                    if (!payload || !payload.content) {
                        console.warn('[Sync] Received broadcast with no content:', payload);
                        return;
                    }

                    const devName = payload.deviceName || 'Terminal';
                    const fName = payload.filename || `conteo_${Date.now()}.txt`;

                    console.log(`[Sync] Processing file from ${devName}: ${fName}`);
                    
                    // Dispatch event for UI components to listen
                    const event = new CustomEvent('precount:device_finalized', { 
                        detail: { 
                            ...payload,
                            deviceName: devName,
                            filename: fName,
                            timestamp: payload.timestamp || Date.now()
                        } 
                    });
                    window.dispatchEvent(event);
                    
                    notify.success("Conteo Recibido", `${devName} ha finalizado su parte. El archivo ${fName} está disponible en la pestaña Archivos.`, {
                        duration: 8000
                    });
                })
                .subscribe((status) => {
                    console.log(`[Sync] Channel status for ${session.id}: ${status}`);
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
        };
    }, [activeSessionId, user?.branchId, user?.role]);


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
    const startSession = async (sector: string, masterCatalog?: any[], syncPin?: string) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const newSession = await createSession(sector, user.branchId, masterCatalog, syncPin);
            setSession(newSession);
            localStorage.setItem('last_precount_session_id', newSession.id);
            // Refresh sessions list
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
    const sendFinalCount = async (filename: string, content: string): Promise<boolean> => {
        if (!session) return false;
        const deviceName = localStorage.getItem('precount_device_name') || 'Zebra';
        const deviceId = localStorage.getItem('precount_device_id');

        return new Promise(async (resolve) => {
            const payload = { deviceId, deviceName, filename, content, timestamp: Date.now() };
            console.log(`[Sync] Sending final count: ${filename}...`);
            
            // 1. Direct Local Fallback (Instant for same browser)
            try {
                localStorage.setItem('precount:sync_file', JSON.stringify(payload));
                window.dispatchEvent(new CustomEvent('precount:device_finalized', { detail: payload }));
            } catch (e) { console.warn('[Sync] Local fallback failed:', e); }

            // 2. Broadcast with retry
            let attempts = 0;
            const trySend = async () => {
                attempts++;
                // Get the current channel or create a temporary one if needed
                const channel = channelRef.current || supabase.channel(`precount_sync:${session.id}`);
                
                // We try to send regardless of explicit state check, 
                // as some versions of the SDK handle the queueing internally
                const status = await channel.send({
                    type: 'broadcast',
                    event: 'device_finalized',
                    payload: payload
                });
                
                console.log(`[Sync] Broadcast attempt ${attempts} status: ${status}`);
                
                if (status === 'ok' || status === 'sent') {
                    resolve(true);
                } else if (attempts < 3) {
                    setTimeout(trySend, 800); // Wait a bit longer between retries
                } else {
                    console.warn('[Sync] Broadcast failed after 3 attempts, but proceeding to let user finish.');
                    resolve(true); 
                }
            };

            trySend();
        });
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
        sendFinalCount
    };
}
