import { useState, useEffect, useCallback } from 'react';
import { notify } from '@/lib/notifications';
import { useUser } from '@/contexts/UserContext'; // Import useUser
import {
    ExpirationItem,
    ExpirationSession,
    createExpirationSession,
    getActiveExpirationSessions,
    deleteExpirationSession,
    endExpirationSession,
    addExpirationItem,
    updateExpirationItem,
    deleteExpirationItem,
    getExpirationItemsBySession,
    BatchInfo
} from '@/services/expirationDB';

export function useExpirationControl() {
    const { user } = useUser(); // Get user for branch info
    const [session, setSession] = useState<ExpirationSession | null>(null);
    const [availableSessions, setAvailableSessions] = useState<ExpirationSession[]>([]);
    const [items, setItems] = useState<ExpirationItem[]>([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [totalUnits, setTotalUnits] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Initial load - depend on user.branchName
    useEffect(() => {
        if (user?.branchName) {
            loadSession(user.branchName);
        } else {
            // If no user/branch, reset
            setSession(null);
            setItems([]);
        }
    }, [user?.branchName]);

    const loadSession = async (branchName: string) => {
        try {
            setIsLoading(true);
            const sessions = await getActiveExpirationSessions(branchName);
            setAvailableSessions(sessions);
            // Don't auto-set session
        } catch (error) {
            console.error("Error loading expiration session:", error);
            notify.error("Error", "No se pudo cargar la sesión");
        } finally {
            setIsLoading(false);
        }
    };

    const loadItems = async (sessionId: string) => {
        const sessionItems = await getExpirationItemsBySession(sessionId);
        // Sort by timestamp desc (newest first)
        sessionItems.sort((a, b) => b.timestamp - a.timestamp);
        setItems(sessionItems);

        // Recalculate totals from items directly for immediate UI feedback
        setTotalProducts(sessionItems.length);
        setTotalUnits(sessionItems.reduce((acc, curr) => acc + curr.totalQuantity, 0));
    };

    const startSession = async (sector: string) => {
        try {
            if (!user?.branchName) {
                notify.error("Error", "No hay sucursal seleccionada");
                return;
            }
            // Allow starting new session even if one exists in list, just not same name
            const existing = availableSessions.find(s => s.sector === sector);
            if (existing) {
                notify.error("Sesión duplicada", "Ya existe una sesión para este sector");
                return;
            }

            const newSession = await createExpirationSession(sector, user.branchName);
            setSession(newSession);
            setAvailableSessions(prev => [newSession, ...prev]);
            setItems([]);
            // toast.success(`Sesión iniciada: ${sector}`);
        } catch (error) {
            console.error("Error starting session:", error);
            notify.error("Error", "No se pudo iniciar la sesión");
        }
    };

    const resumeSession = async (sessionToResume: ExpirationSession) => {
        try {
            setSession(sessionToResume);
            await loadItems(sessionToResume.id);
            notify.success("Sesión retomada", `Continuando control de ${sessionToResume.sector}`);
        } catch (error) {
            console.error("Error resuming:", error);
            notify.error("Error", "No se pudo retomar la sesión");
        }
    };

    const deleteSession = async (id: string) => {
        if (!confirm("¿Eliminar sesión?")) return;
        try {
            await deleteExpirationSession(id);
            setAvailableSessions(prev => prev.filter(s => s.id !== id));
            if (session?.id === id) {
                setSession(null);
                setItems([]);
            }
            notify.success("Sesión eliminada", "La sesión se eliminó correctamente");
        } catch (error) {
            console.error("Error deleting:", error);
            notify.error("Error", "No se pudo eliminar la sesión");
        }
    };

    const addItem = async (ean: string, productName: string, batches: BatchInfo[]) => {
        try {
            // Check if item already exists in state to decide between add or update
            const existingItem = items.find(i => i.ean === ean);

            if (existingItem) {
                // Update existing
                await updateExpirationItem(existingItem.id, {
                    batches: batches, // We replace batches with new state from UI
                    timestamp: Date.now()
                });
                notify.success("Producto actualizado", "Los datos del producto se actualizaron correctamente");
            } else {
                if (!user?.branchName) throw new Error("No branch selected");
                // Add new
                await addExpirationItem({
                    ean,
                    productName,
                    batches,
                    totalQuantity: batches.reduce((acc, b) => acc + b.quantity, 0)
                }, user.branchName);
                notify.success("Producto agregado", `${productName} agregado al control`);
            }

            if (session) await loadItems(session.id);

        } catch (error) {
            console.error("Error adding/updating item:", error);
            notify.error("Error", "No se pudo guardar el producto");
        }
    };

    const deleteItem = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este producto?")) return;
        try {
            await deleteExpirationItem(id);
            notify.success("Producto eliminado", "El producto se eliminó del control");
            if (session) await loadItems(session.id);
        } catch (error) {
            console.error("Error deleting item:", error);
            notify.error("Error", "No se pudo eliminar el producto");
        }
    };

    const finishSession = async () => {
        if (!session) return;
        if (!confirm("¿Finalizar control de vencimientos?")) return;

        try {
            await endExpirationSession(session.id);
            setAvailableSessions(prev => prev.filter(s => s.id !== session.id));
            setSession(null);
            setItems([]);
            notify.success("Control finalizado", "El control de vencimientos se finalizó correctamente");
        } catch (error) {
            console.error("Error finishing session:", error);
            notify.error("Error", "No se pudo finalizar el control");
        }
    };

    return {
        session,
        items,
        totalProducts,
        totalUnits,
        isLoading,
        availableSessions,
        startSession,
        resumeSession,
        deleteSession,
        addItem,
        deleteItem,
        finishSession
    };
}
