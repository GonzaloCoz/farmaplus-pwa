import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

// Mapped interface for internal component use (camelCase)
export interface UIPreCountItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced?: number;
}

interface UsePreCountReturn {
    items: UIPreCountItem[];
    session: PreCountSession | null;
    totalProducts: number;
    totalUnits: number;
    errorCount: number;
    isLoading: boolean;
    availableSessions: PreCountSession[];
    startSession: (sector: string) => Promise<void>;
    resumeSession: (session: PreCountSession) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    addItem: (ean: string, productName: string, quantity: number) => Promise<void>;
    updateItem: (id: string, quantity: number) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    finishSession: () => Promise<void>;
    refreshItems: () => Promise<void>;
    registerError: () => void;
}

export function usePreCount(): UsePreCountReturn {
    const [items, setItems] = useState<UIPreCountItem[]>([]);
    const [session, setSession] = useState<PreCountSession | null>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            try {
                const sessions = await getActiveSessions();
                setAvailableSessions(sessions);
            } catch (error) {
                console.error('Error initializing pre-count:', error);
                notify.error("Error de conexión", "No se pudo cargar el pre-conteo");
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    // REALTIME SUBSCRIPTIONS
    useEffect(() => {
        // Subscribe to Sessions changes
        const sessionsChannel = supabase
            .channel('public:precount_sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'precount_sessions' }, async (payload) => {
                // Refresh sessions list
                const sessions = await getActiveSessions();
                setAvailableSessions(sessions);

                // If current session was updated/deleted
                if (session && payload.eventType === 'DELETE' && payload.old.id === session.id) {
                    setSession(null);
                    setItems([]);
                    notify.info("Sesión eliminada", "La sesión actual fue eliminada desde otro dispositivo");
                }
            })
            .subscribe();

        // Subscribe to Items changes (only if in a session)
        let itemsChannel: any = null;
        if (session) {
            itemsChannel = supabase
                .channel(`public:precount_items:session_id=${session.id}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    async (payload) => {
                        // Simple approach: Reload all items for this session to ensure consistency
                        // Optimization: handle individual events
                        const dbItems = await getPreCountItemsBySessionId(session.id);
                        setItems(dbItems.map(mapItemToUI));
                    })
                .subscribe();
        }

        return () => {
            supabase.removeChannel(sessionsChannel);
            if (itemsChannel) supabase.removeChannel(itemsChannel);
        };
    }, [session?.id]); // Re-subscribe when session changes

    // Helper to map DB item to UI item
    const mapItemToUI = (dbItem: PreCountItem): UIPreCountItem => ({
        id: dbItem.id,
        sessionId: dbItem.session_id,
        ean: dbItem.ean,
        productName: dbItem.product_name,
        quantity: dbItem.quantity,
        timestamp: new Date(dbItem.scanned_at).getTime(),
        synced: dbItem.synced ?? 1
    });

    // Calcular totales
    const totalProducts = items.length;
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

    // Iniciar nueva sesión
    const startSession = async (sector: string) => {
        try {
            setIsLoading(true);
            const newSession = await createSession(sector);
            setSession(newSession);
            setItems([]);
            setErrorCount(0);
            notify.success("Sesión iniciada", `Pre-conteo de ${sector} comenzado (En la Nube)`);
        } catch (error) {
            console.error('Error starting session:', error);
            notify.error("Error", "No se pudo iniciar la sesión");
        } finally {
            setIsLoading(false);
        }
    };

    // Resume session
    const resumeSession = async (sessionToResume: PreCountSession) => {
        try {
            setSession(sessionToResume);
            const sessionItems = await getPreCountItemsBySessionId(sessionToResume.id);
            setItems(sessionItems.map(mapItemToUI));
            setErrorCount(sessionToResume.errorCount || 0);
            notify.success("Sesión retomada", `Conectado a ${sessionToResume.sector}`);
        } catch (error) {
            console.error('Error resuming session:', error);
            notify.error("Error", "No se pudo conectar a la sesión");
        }
    };

    // Delete session
    const deleteSession = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta sesión? Se borrará para TODOS los usuarios.')) return;
        try {
            await deleteSessionDB(id);
            if (session?.id === id) {
                setSession(null);
                setItems([]);
            }
            notify.success("Sesión eliminada", "La sesión se eliminó correctamente");
        } catch (error) {
            console.error('Error deleting session:', error);
            notify.error("Error", "No se pudo eliminar la sesión");
        }
    };

    // Agregar item
    const addItem = useCallback(async (ean: string, productName: string, quantity: number) => {
        if (!session) {
            notify.error("Sesión requerida", "No hay una sesión activa");
            return;
        }

        try {
            // Verificar si el producto ya existe en los items cargados
            const existingItem = items.find(item => item.ean === ean);

            if (existingItem) {
                // Actualizar cantidad
                const newQuantity = existingItem.quantity + quantity;
                await updatePreCountItem(existingItem.id, { quantity: newQuantity });
                // UI update via Realtime subscription
                notify.success("Cantidad actualizada", `${productName} (+${quantity})`);
            } else {
                // Agregar nuevo item
                await addPreCountItem({
                    session_id: session.id,
                    ean,
                    product_name: productName,
                    quantity,
                });
                // UI update via Realtime subscription
                notify.success("Producto agregado", `${productName} - ${quantity} unidades`);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            notify.error("Error", "No se pudo agregar el producto");
        }
    }, [session, items]);

    // Actualizar item
    const updateItem = useCallback(async (id: string, quantity: number) => {
        if (quantity <= 0) return;
        try {
            await updatePreCountItem(id, { quantity });
            notify.success("Cantidad actualizada", "La cantidad se sincronizó");
        } catch (error) {
            console.error('Error updating item:', error);
            notify.error("Error", "No se pudo actualizar el producto");
        }
    }, []);

    // Eliminar item
    const removeItem = useCallback(async (id: string) => {
        try {
            await deletePreCountItem(id);
            // UI update via Realtime subscription
            notify.success("Producto eliminado", "El producto se eliminó del conteo");
        } catch (error) {
            console.error('Error removing item:', error);
            notify.error("Error", "No se pudo eliminar el producto");
        }
    }, []);

    // Finalizar sesión
    const finishSession = async () => {
        if (!session) return;
        if (!confirm('¿Finalizar sesión de conteo? Esto la cerrará para todos.')) return;

        try {
            await endSession(session.id);
            setSession(null);
            setItems([]);
            notify.success("Sesión finalizada", "El pre-conteo se guardó y finalizó");
        } catch (error) {
            console.error('Error finishing session:', error);
            notify.error("Error", "No se pudo finalizar la sesión");
        }
    };

    // Refrescar items (manual override)
    const refreshItems = useCallback(async () => {
        if (!session) return;
        try {
            const sessionItems = await getPreCountItemsBySessionId(session.id);
            setItems(sessionItems.map(mapItemToUI));
        } catch (error) {
            console.error('Error refreshing items:', error);
        }
    }, [session]);

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
