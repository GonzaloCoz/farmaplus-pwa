import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext'; // Import useUser
import {
    ExpirationItem,
    ExpirationSession,
    createExpirationSession,
    getActiveExpirationSession,
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
            const activeSession = await getActiveExpirationSession(branchName);
            setSession(activeSession);
            if (activeSession) {
                await loadItems(activeSession.id);
            } else {
                setItems([]);
                setTotalProducts(0);
                setTotalUnits(0);
            }
        } catch (error) {
            console.error("Error loading expiration session:", error);
            toast.error("Error al cargar la sesión");
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
                toast.error("No hay sucursal seleccionada");
                return;
            }
            if (session) {
                toast.error("Ya existe una sesión activa");
                return;
            }
            const newSession = await createExpirationSession(sector, user.branchName);
            setSession(newSession);
            setItems([]);
            // toast.success(`Sesión iniciada: ${sector}`);
        } catch (error) {
            console.error("Error starting session:", error);
            toast.error("Error al iniciar sesión");
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
                toast.success("Producto actualizado");
            } else {
                if (!user?.branchName) throw new Error("No branch selected");
                // Add new
                await addExpirationItem({
                    ean,
                    productName,
                    batches,
                    totalQuantity: batches.reduce((acc, b) => acc + b.quantity, 0)
                }, user.branchName);
                toast.success("Producto agregado");
            }

            if (session) await loadItems(session.id);

        } catch (error) {
            console.error("Error adding/updating item:", error);
            toast.error("Error al guardar producto");
        }
    };

    const deleteItem = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este producto?")) return;
        try {
            await deleteExpirationItem(id);
            toast.success("Producto eliminado");
            if (session) await loadItems(session.id);
        } catch (error) {
            console.error("Error deleting item:", error);
            toast.error("Error al eliminar");
        }
    };

    const finishSession = async () => {
        if (!session) return;
        if (!confirm("¿Finalizar control de vencimientos?")) return;

        try {
            await endExpirationSession(session.id);
            setSession(null);
            setItems([]);
            toast.success("Control finalizado correctamente");
        } catch (error) {
            console.error("Error finishing session:", error);
            toast.error("Error al finalizar");
        }
    };

    return {
        session,
        items,
        totalProducts,
        totalUnits,
        isLoading,
        startSession,
        addItem,
        deleteItem,
        finishSession
    };
}
