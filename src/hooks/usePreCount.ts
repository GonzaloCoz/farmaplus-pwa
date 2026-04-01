import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { supabase } from '@/integrations/supabase/client';
import { playSound } from '@/utils/soundUtils';
import {
    PreCountItem,
    PreCountSession,
    addPreCountItem,
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

export interface UIPreCountItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced?: number;
    id_producto?: string;
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
    startSession: (sector: string, masterCatalog?: any[], syncPin?: string) => Promise<void>;
    resumeSession: (session: PreCountSession) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    addItem: (ean: string, productName: string, quantity: number, id_producto?: string) => Promise<void>;
    updateItem: (id: string, quantity: number) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    finishSession: () => Promise<void>;
    refreshItems: () => Promise<void>;
    registerError: () => void;
}

export function usePreCount(): UsePreCountReturn {
    const [session, setSession] = useState<PreCountSession | null>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
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
        if (session) {
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
                            device_name: newItem.device_name
                        });
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
        };
    }, [session?.id, user?.branchId, user?.role]);

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
        deviceName: dbItem.device_name
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

    // Resume session
    const resumeSession = async (sessionToResume: PreCountSession) => {
        try {
            setSession(sessionToResume);
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
    const addItem = useCallback(async (ean: string, productName: string, quantity: number, id_producto?: string) => {
        if (!session) return;
        try {
            const { upsertPreCountItem } = await import('@/services/preCountDB');
            await upsertPreCountItem({
                session_id: session.id,
                ean,
                product_name: productName,
                quantity,
                id_producto
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
        if (!confirm('¿Finalizar sesión de conteo?')) return;
        try {
            await endSession(session.id);
            setSession(null);
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

    return {
        items,
        session,
        totalProducts,
        totalUnits,
        errorCount,
        isLoading,
        availableSessions,
        startSession,
        resumeSession,
        deleteSession,
        addItem,
        updateItem,
        removeItem,
        finishSession,
        refreshItems,
        registerError
    };
}
