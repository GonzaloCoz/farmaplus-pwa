import { useState, useEffect, useCallback } from 'react';
import {
    PreCountItem,
    PreCountSession,
    addPreCountItem,
    updatePreCountItem,
    deletePreCountItem,
    getPreCountItemsBySector,
    createSession,
    updateSession,
    endSession,
    getActiveSessions,
    deleteSession as deleteSessionDB,
    initDB,
} from '@/services/preCountDB';
import { toast } from 'sonner';

interface UsePreCountReturn {
    items: PreCountItem[];
    session: PreCountSession | null;
    totalProducts: number;
    totalUnits: number;
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
}

export function usePreCount(): UsePreCountReturn {
    const [items, setItems] = useState<PreCountItem[]>([]);
    const [session, setSession] = useState<PreCountSession | null>(null);
    const [availableSessions, setAvailableSessions] = useState<PreCountSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Inicializar DB y cargar sesiones activas
    useEffect(() => {
        const init = async () => {
            try {
                await initDB();
                const sessions = await getActiveSessions();
                setAvailableSessions(sessions);
            } catch (error) {
                console.error('Error initializing pre-count:', error);
                toast.error('Error al inicializar el sistema de pre-conteo');
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(init, 100); // Pequeño delay para asegurar que DB esté lista
        return () => clearTimeout(timer);
    }, []);

    // Calcular totales
    const totalProducts = items.length;
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

    // Actualizar sesión con totales
    useEffect(() => {
        if (session && !session.endTime) {
            updateSession(session.id, {
                totalProducts,
                totalUnits,
            }).catch(error => {
                console.error('Error updating session:', error);
            });
        }
    }, [session, totalProducts, totalUnits]);

    // Iniciar nueva sesión
    const startSession = async (sector: string) => {
        try {
            setIsLoading(true);

            // Verificar si ya existe una sesión con ese nombre
            const existing = availableSessions.find(s => s.sector === sector);
            if (existing) {
                toast.error('Ya existe una sesión abierta para este sector');
                return;
            }

            const newSession = await createSession(sector);
            setSession(newSession);
            setItems([]);
            setAvailableSessions(prev => [newSession, ...prev]);
            toast.success(`Sesión iniciada: ${sector}`);
        } catch (error) {
            console.error('Error starting session:', error);
            toast.error('Error al iniciar la sesión');
        } finally {
            setIsLoading(false);
        }
    };

    // Resume session
    const resumeSession = async (sessionToResume: PreCountSession) => {
        try {
            setSession(sessionToResume);
            const sessionItems = await getPreCountItemsBySector(sessionToResume.sector);
            setItems(sessionItems);
            toast.success(`Sesión retomada: ${sessionToResume.sector}`);
        } catch (error) {
            console.error('Error resuming session:', error);
            toast.error('Error al retomar la sesión');
        }
    };

    // Delete session
    const deleteSession = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta sesión? Se perderán todos los datos escaneados.')) return;
        try {
            await deleteSessionDB(id);
            setAvailableSessions(prev => prev.filter(s => s.id !== id));
            // If deleting current session
            if (session?.id === id) {
                setSession(null);
                setItems([]);
            }
            toast.success('Sesión eliminada');
        } catch (error) {
            console.error('Error deleting session:', error);
            toast.error('Error al eliminar la sesión');
        }
    };

    // Agregar item
    const addItem = useCallback(async (ean: string, productName: string, quantity: number) => {
        if (!session) {
            toast.error('No hay una sesión activa');
            return;
        }

        if (quantity <= 0) {
            toast.error('La cantidad debe ser mayor a 0');
            return;
        }

        try {
            // Verificar si el producto ya existe en esta sesión
            const existingItem = items.find(item => item.ean === ean);

            if (existingItem) {
                // Actualizar cantidad del item existente
                const newQuantity = existingItem.quantity + quantity;
                await updatePreCountItem(existingItem.id, { quantity: newQuantity });

                setItems(prev => prev.map(item =>
                    item.id === existingItem.id
                        ? { ...item, quantity: newQuantity, synced: 0 }
                        : item
                ));

                toast.success(`Cantidad actualizada: ${productName} (+${quantity})`);
            } else {
                // Agregar nuevo item
                const newItem = await addPreCountItem({
                    sector: session.sector,
                    ean,
                    productName,
                    quantity,
                });

                setItems(prev => [...prev, newItem]);
                toast.success(`Producto agregado: ${productName}`);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            toast.error('Error al agregar el producto');
        }
    }, [session, items]);

    // Actualizar item
    const updateItem = useCallback(async (id: string, quantity: number) => {
        if (quantity <= 0) {
            toast.error('La cantidad debe ser mayor a 0');
            return;
        }

        try {
            await updatePreCountItem(id, { quantity });

            setItems(prev => prev.map(item =>
                item.id === id
                    ? { ...item, quantity, synced: 0 }
                    : item
            ));

            toast.success('Cantidad actualizada');
        } catch (error) {
            console.error('Error updating item:', error);
            toast.error('Error al actualizar el producto');
        }
    }, []);

    // Eliminar item
    const removeItem = useCallback(async (id: string) => {
        try {
            await deletePreCountItem(id);
            setItems(prev => prev.filter(item => item.id !== id));
            toast.success('Producto eliminado');
        } catch (error) {
            console.error('Error removing item:', error);
            toast.error('Error al eliminar el producto');
        }
    }, []);

    // Finalizar sesión
    const finishSession = async () => {
        if (!session) return;
        if (!confirm('¿Finalizar sesión de conteo?')) return;

        try {
            await endSession(session.id);
            setSession(null);
            setItems([]);
            setAvailableSessions(prev => prev.filter(s => s.id !== session.id));
            toast.success('Sesión finalizada correctamente');
        } catch (error) {
            console.error('Error finishing session:', error);
            toast.error('Error al finalizar la sesión');
        }
    };

    // Refrescar items
    const refreshItems = useCallback(async () => {
        if (!session) return;

        try {
            const sessionItems = await getPreCountItemsBySector(session.sector);
            setItems(sessionItems);
        } catch (error) {
            console.error('Error refreshing items:', error);
            toast.error('Error al actualizar los productos');
        }
    }, [session]);

    return {
        items,
        session,
        totalProducts,
        totalUnits,
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
    };
}
