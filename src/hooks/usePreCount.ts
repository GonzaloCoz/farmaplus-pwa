import { useState, useEffect, useCallback, useMemo } from 'react';
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

    // REALTIME SUBSCRIPTIONS with incremental updates and debouncing
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout | null = null;
        const DEBOUNCE_MS = 300; // 300ms debounce for rapid changes

        // Subscribe to Sessions changes
        const sessionsChannel = supabase
            .channel('public:precount_sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'precount_sessions' }, async (payload) => {
                // Debounce session updates
                if (debounceTimer) clearTimeout(debounceTimer);

                debounceTimer = setTimeout(async () => {
                    const sessions = await getActiveSessions();
                    setAvailableSessions(sessions);

                    // If current session was updated/deleted
                    if (session && payload.eventType === 'DELETE' && payload.old.id === session.id) {
                        setSession(null);
                        setItems([]);
                        notify.info("Sesión eliminada", "La sesión actual fue eliminada desde otro dispositivo");
                    }
                }, DEBOUNCE_MS);
            })
            .subscribe();

        // Subscribe to Items changes (only if in a session) - INCREMENTAL UPDATES
        let itemsChannel: any = null;
        if (session) {
            itemsChannel = supabase
                .channel(`public:precount_items:session_id=${session.id}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    (payload) => {
                        // Incremental INSERT: add new item to list
                        const newItem = payload.new as PreCountItem;
                        const uiItem = mapItemToUI(newItem);

                        setItems(prev => {
                            // Check if item already exists (from optimistic update)
                            const exists = prev.some(item => item.id === uiItem.id);
                            if (exists) {
                                // Update existing item (mark as synced)
                                return prev.map(item =>
                                    item.id === uiItem.id ? { ...uiItem, synced: 1 } : item
                                );
                            }
                            // Check if same EAN exists (replace optimistic temp)
                            const tempIndex = prev.findIndex(item => item.ean === uiItem.ean && item.id.startsWith('temp-'));
                            if (tempIndex !== -1) {
                                const newItems = [...prev];
                                newItems[tempIndex] = { ...uiItem, synced: 1 };
                                return newItems;
                            }
                            // Add new item
                            return [uiItem, ...prev];
                        });
                    })
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    (payload) => {
                        // Incremental UPDATE: update specific item
                        const updatedItem = payload.new as PreCountItem;
                        const uiItem = mapItemToUI(updatedItem);

                        setItems(prev => prev.map(item =>
                            item.id === uiItem.id ? { ...uiItem, synced: 1 } : item
                        ));
                    })
                .on('postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'precount_items', filter: `session_id=eq.${session.id}` },
                    (payload) => {
                        // Incremental DELETE: remove specific item
                        const deletedId = payload.old.id as string;
                        setItems(prev => prev.filter(item => item.id !== deletedId));
                    })
                .subscribe();
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
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

    // Calcular totales con memoization
    const totalProducts = useMemo(() => items.length, [items.length]);
    const totalUnits = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

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

    // Agregar item con optimistic update
    const addItem = useCallback(async (ean: string, productName: string, quantity: number) => {
        if (!session) {
            notify.error("Sesión requerida", "No hay una sesión activa");
            return;
        }

        // Verificar si el producto ya existe
        const existingItem = items.find(item => item.ean === ean);
        const previousQuantity = existingItem?.quantity || 0;

        // Optimistic update: actualizar UI inmediatamente
        const tempId = `temp-${Date.now()}`;
        const optimisticItem: UIPreCountItem = {
            id: tempId,
            sessionId: session.id,
            ean,
            productName,
            quantity,
            timestamp: Date.now(),
            synced: 0 // Marca como no sincronizado
        };

        try {
            if (existingItem) {
                // Update optimistically
                setItems(prev => prev.map(item =>
                    item.ean === ean
                        ? { ...item, quantity: item.quantity + quantity, synced: 0 }
                        : item
                ));

                notify.success("Cantidad actualizada", `${productName} (+${quantity})`);
            } else {
                // Add optimistically
                setItems(prev => [optimisticItem, ...prev]);
                notify.success("Producto agregado", `${productName} - ${quantity} unidades`);
                playSound('success');
            }

            // Realizar operación en servidor (usa upsert RPC optimizado)
            const { upsertPreCountItem } = await import('@/services/preCountDB');
            await upsertPreCountItem({
                session_id: session.id,
                ean,
                product_name: productName,
                quantity,
            });

            // La actualización real vendrá por realtime subscription
            // que marcará el item como sincronizado
        } catch (error) {
            console.error('Error adding item:', error);

            // Rollback optimistic update
            if (existingItem) {
                setItems(prev => prev.map(item =>
                    item.ean === ean
                        ? { ...item, quantity: previousQuantity, synced: 1 }
                        : item
                ));
            } else {
                setItems(prev => prev.filter(item => item.id !== tempId));
            }

            notify.error("Error", "No se pudo agregar el producto");
        }
    }, [session, items]);

    // Actualizar item con optimismo
    const updateItem = useCallback(async (id: string, quantity: number) => {
        if (quantity <= 0) return;

        // 1. Guardar estado anterior para rollback
        const itemToUpdate = items.find(i => i.id === id);
        const previousQuantity = itemToUpdate?.quantity || 0;

        // 2. Actualización Optimista: UI inmediata
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity, synced: 0 } : item // synced:0 para indicar pendiente
        ));

        // Feedback inmediato (opcional, puede ser mucho ruido)
        // notify.success("Cantidad actualizada", "Sincronizando...");

        try {
            // 3. Llamada al servidor
            await updatePreCountItem(id, { quantity });
            // El realtime se encargará de confirmar (poner synced: 1)
        } catch (error) {
            console.error('Error updating item:', error);

            // 4. Rollback en caso de error
            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, quantity: previousQuantity, synced: 1 } : item
            ));

            notify.error("Error", "No se pudo actualizar el producto");
        }
    }, [items]);

    // Eliminar item con optimismo y Deshacer
    const removeItem = useCallback(async (id: string) => {
        // 1. Guardar el item para rollback
        const itemToDelete = items.find(i => i.id === id);
        if (!itemToDelete) return;

        // 2. Eliminación Optimista: UI inmediata
        setItems(prev => prev.filter(item => item.id !== id));
        playSound('delete');

        // 3. Notificación con acción de Deshacer
        notify.success("Producto eliminado", "Deshacer para restaurar", {
            duration: 4000,
            action: {
                label: "Deshacer",
                onClick: async () => {
                    // RESTORE (UNDO)
                    console.log('Undoing deletion for:', itemToDelete);

                    // Create a temporary item for optimistic restoration to avoid duplication
                    const restoredItem = {
                        ...itemToDelete,
                        id: `temp-undo-${Date.now()}`,
                        synced: 0
                    };

                    setItems(prev => [restoredItem, ...prev]);
                    playSound('success');

                    // Re-insert into DB
                    try {
                        const { upsertPreCountItem } = await import('@/services/preCountDB');
                        await upsertPreCountItem({
                            session_id: itemToDelete.sessionId,
                            ean: itemToDelete.ean,
                            product_name: itemToDelete.productName,
                            quantity: itemToDelete.quantity,
                        });
                    } catch (e) {
                        console.error('Error restoring item:', e);
                        notify.error("Error", "No se pudo restaurar el producto");
                        setItems(prev => prev.filter(i => i.id !== restoredItem.id));
                    }
                }
            }
        });

        try {
            // 4. Llamada al servidor (Delete real)
            await deletePreCountItem(id);
        } catch (error) {
            console.error('Error removing item:', error);

            // Rollback automático si falla el borrado real (no el undo)
            setItems(prev => [...prev, itemToDelete]);

            notify.error("Error", "No se pudo eliminar el producto");
            playSound('error');
        }
    }, [items]);

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
