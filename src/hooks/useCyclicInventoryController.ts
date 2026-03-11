import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/components/CyclicInventoryList';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useInventoryUpload } from '@/hooks/useInventoryUpload';
import { useInventoryStats } from '@/hooks/useInventoryStats';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { INVENTORY_KEYS } from './useInventoryQueries';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

interface UseCyclicInventoryControllerProps {
    labName: string;
}

export function useCyclicInventoryController({ labName }: UseCyclicInventoryControllerProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useUser();
    const branchName = user?.branchName || 'Sucursal Desconocida';

    // Core State
    const [items, setItems] = useState<CyclicItem[]>([]);

    // 1. Sync Logic (Load/Save/AutoSave/Reset)
    const { isLoading, setIsLoading, isSaving, setIsSaving, saveProgress } = useInventorySync({
        branchName,
        labName,
        items,
        onItemsLoaded: setItems
    });

    // 2. Upload Logic
    const { isUploading, handleFileUpload } = useInventoryUpload({
        branchName,
        labName,
        currentItems: items,
        onItemsUpdated: setItems
    });

    // 3. Stats & Filter Logic
    const stats = useInventoryStats(items, CATEGORIES[0]);
    const {
        controlledItems: localControlled,
        currentCategory
    } = stats;

    // 4. Persistent Stats (DB)
    const [persistentStats, setPersistentStats] = useState<{
        pendingItems: number;
        progress: number;
        controlledItems: number;
        adjustedItems: number;
        totalItems: number;
    } | null>(null);

    // Fetch Persistent Stats on Mount / Category Change / Save
    const fetchPersistentStats = useCallback(async () => {
        if (branchName && labName && currentCategory) {
            const dbStats = await cyclicInventoryService.getLabStats(branchName, labName, currentCategory);
            if (dbStats) {
                setPersistentStats(dbStats);
            }
        }
    }, [branchName, labName, currentCategory]);

    useEffect(() => {
        fetchPersistentStats();
    }, [fetchPersistentStats]);

    // Advanced Logic State
    const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'value-asc' | 'value-desc'>('name-asc');

    // Derived State: Sorted Items
    // We filter items based on the active tab in the UI, but here we provide a helper to sort any list
    const getSortedItems = useCallback((itemsToSort: CyclicItem[]) => {
        return [...itemsToSort].sort((a, b) => {
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
            if (sortBy === 'name-desc') return b.name.localeCompare(a.name);

            const diffA = Math.abs(a.systemQuantity - a.countedQuantity) * a.cost;
            const diffB = Math.abs(b.systemQuantity - b.countedQuantity) * b.cost;
            
            if (sortBy === 'value-asc') return diffA - diffB;
            if (sortBy === 'value-desc') return diffB - diffA;

            return 0;
        });
    }, [sortBy]);

    // UI Dialog States
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [shortageId, setShortageId] = useState("");
    const [surplusId, setSurplusId] = useState("");

    // Delete Confirmation State
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [verificationText, setVerificationText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // History State
    const [history, setHistory] = useState<any[]>([]);

    // Load History
    useEffect(() => {
        if (branchName && labName) {
            cyclicInventoryService.getAdjustmentHistory(branchName, labName).then(setHistory);
        }
    }, [branchName, labName]);

    // --- GLOBAL LABORATORY STATS (Standard Header) ---
    // These metrics are calculated from the full items array to ensure 100% consistency
    // and correctly represent the entire lab regardless of the filtered category tab.

    const globalTotal = items.length;
    const globalControlled = items.filter(i => i.status === 'controlled').length;
    const globalAdjusted = items.filter(i => i.status === 'adjusted').length;
    const globalPending = items.filter(i => i.status === 'pending').length;

    // Progress capped at 100% (Integer rounding)
    const globalProgress = globalTotal > 0
        ? Math.min(100, Math.round((globalControlled + globalAdjusted) / globalTotal * 100))
        : 0;


    // -- Actions --

    const handleUpdateQuantity = useCallback((id: string, quantity: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const diff = quantity - item.systemQuantity;

                // Anomaly Detection Algorithm
                // Trigger if:
                // 1. Difference > 50 units AND > 50% deviation
                // 2. OR Value Difference > $50,000 (Local Currency)
                const absDiff = Math.abs(diff);
                const isSignificantQty = absDiff > 50 && (absDiff / (item.systemQuantity || 1)) > 0.5;
                const isHighValueDiff = (absDiff * item.cost) > 50000;

                if ((isSignificantQty || isHighValueDiff) && navigator.vibrate) {
                    // Stronger vibration for anomalies
                    navigator.vibrate([100, 50, 100, 50, 100]);
                    // Here we could also trigger a UI toast/warning, but since we are in the loop,
                    // we'll rely on the visual "Diferencia" badge turning red/orange in the UI 
                    // or handle the specific alert in the UI component if needed.
                    // For now, let's just log it or maybe set a flag on the item?
                } else if (diff !== 0 && navigator.vibrate) {
                    navigator.vibrate([50, 50, 50]);
                } else if (navigator.vibrate) {
                    navigator.vibrate(50);
                }

                const isReadjustment = item.status === 'adjusted';

                return {
                    ...item,
                    countedQuantity: quantity,
                    status: item.status === 'adjusted' ? 'adjusted' : 'controlled',
                    wasReadjusted: isReadjustment ? true : item.wasReadjusted
                };
            }
            return item;
        }));
    }, []);

    const handleCheck = useCallback((id: string) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setItems(prev => prev.map(item =>
            item.id === id
                ? { ...item, status: 'controlled', countedQuantity: item.systemQuantity }
                : item
        ));
        notify.success("Operación exitosa", 'Producto controlado');
    }, []);

    const handleRevertItem = useCallback((id: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, status: 'pending' } : item
        ));
        notify.info("Información", 'Producto devuelto a pendientes');
    }, []);

    // Save & Finalize Logic
    const handleFinalizeClick = async () => {
        // No guardamos en la nube antes de abrir el diálogo, según pedido del usuario.
        // El usuario ingresará los IDs y recién ahí gatillaremos el guardado final.
        setShowSaveDialog(true);
    };

    const globalControlledItems = items.filter(i => i.status === 'controlled');

    const shortageValue = Math.round(globalControlledItems
        .filter(i => i.countedQuantity < i.systemQuantity)
        .reduce((acc, i) => acc + ((i.systemQuantity - i.countedQuantity) * i.cost), 0) * 100) / 100;

    const surplusValue = Math.round(globalControlledItems
        .filter(i => i.countedQuantity > i.systemQuantity)
        .reduce((acc, i) => acc + ((i.countedQuantity - i.systemQuantity) * i.cost), 0) * 100) / 100;

    const handleSaveInventory = async () => {
        const controlledItems = items.filter(i => i.status === 'controlled');
        const shortages = controlledItems.filter(i => i.countedQuantity < i.systemQuantity);
        const surpluses = controlledItems.filter(i => i.countedQuantity > i.systemQuantity);

        if (shortages.length > 0) {
            if (!shortageId.trim()) {
                notify.error("Error", "Por favor ingresa el ID de ajuste para Faltantes");
                return;
            }
            if (!/^\d+$/.test(shortageId.trim())) {
                notify.error("Error", "El ID de Faltantes debe contener solo números, sin espacios ni símbolos.");
                return;
            }
        }

        if (surpluses.length > 0) {
            if (!surplusId.trim()) {
                notify.error("Error", "Por favor ingresa el ID de ajuste para Sobrantes");
                return;
            }
            if (!/^\d+$/.test(surplusId.trim())) {
                notify.error("Error", "El ID de Sobrantes debe contener solo números, sin espacios ni símbolos.");
                return;
            }
        }

        setIsSaving(true);
        try {
            const categoryToFinalize = currentCategory;

            // Optimización del Flujo: Ya no purgar la base de datos de los pendientes, pero 
            // sigue guardando (Upsert) el nuevo listado sobreescribiendo el control local 
            // con estado 'adjusted' para reflejar UI de inmediato.
            const updatedItems = items.map(item => {
                if (item.status === 'controlled') {
                    const diff = item.countedQuantity - item.systemQuantity;
                    return {
                        ...item,
                        status: 'adjusted' as const,
                        shortageId: diff < 0 ? shortageId : undefined,
                        surplusId: diff > 0 ? surplusId : undefined
                    };
                }
                return item;
            });

            setItems(updatedItems);

            // 0. Sincronización obligatoria previa al SNAP
            // Antes de finalizar el laboratorio, debemos asegurarnos de que el estado actual (controlled)
            // esté en la nube. De lo contrario, finalize_cyclic_inventory no encontrará nada.
            await cyclicInventoryService.saveInventory(branchName, labName, items);

            // 1. Guardar invocando al Motor Ferrari 
            await cyclicInventoryService.saveInventoryForFinalize(
                branchName,
                labName,
                updatedItems,
                user?.id || '',
                shortageId,
                surplusId
            );

            // Fetch the updated stats to reflect the real database state after finalization
            await fetchPersistentStats();

            // Source of truth: recompute progress from inventories (prevent false 100%)
            // Already called inside finalize_cyclic_inventory RPC but doing it here again 
            // ensures the local UI is fully synced if necessary.
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);

            // Extrack history details
            const controlledCategories = Array.from(new Set(controlledItems.map(i => i.category || 'Varios')));
            const historyCategoryStr = controlledCategories.length > 0
                ? controlledCategories.join(', ')
                : categoryToFinalize;

            await cyclicInventoryService.saveAdjustmentHistory(branchName, labName, {
                adjustment_id_shortage: shortageId,
                adjustment_id_surplus: surplusId,
                shortage_value: shortageValue,
                surplus_value: surplusValue,
                total_units_adjusted: controlledItems.length,
                user_name: user?.name,
                user_id: user?.id,
                items_snapshot: updatedItems,
                category: historyCategoryStr
            });

            notify.success("Operación exitosa", `${categoryToFinalize} finalizado y archivado. Listo para nueva carga.`);
            setShowSaveDialog(false);
            setShortageId("");
            setSurplusId("");

            // Redirigir a la lista principal
            navigate('/cyclic-inventory');

            const newHistory = await cyclicInventoryService.getAdjustmentHistory(branchName, labName);
            setHistory(newHistory);

        } catch (error) {
            console.error("Error saving inventory:", error);
            notify.error("Error", "Error al guardar en la nube.");
        } finally {
            setIsSaving(false);
        }
    };

    // Reset Logic
    const handleResetData = () => {
        let challenge = "CONFIRMAR";
        if (items.length > 0) {
            const validItems = items.filter(i => i.name && i.name.length > 4);
            if (validItems.length > 0) {
                const randomItem = validItems[Math.floor(Math.random() * validItems.length)];
                challenge = randomItem.name.toUpperCase();
            }
        }
        setVerificationText(challenge);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        try {
            setItems([]);
            // Removed 1.5s artificial delay for better fluidity
            await cyclicInventoryService.deleteInventory(branchName, labName);
            await cyclicInventoryService.deleteAdjustmentHistory(branchName, labName);

            // Invalidar Caché de React Query para forzar recarga limpia
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });

            setShowDeleteDialog(false);
            notify.success("Operación exitosa", "Datos reiniciados correctamente.");
            navigate('/cyclic-inventory');
        } catch (error) {
            console.error("Error resetting data:", error);
            notify.error("Error", "Error al reiniciar datos. Intente de nuevo.");
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        // State
        items,
        isLoading,
        isSaving,
        isUploading,
        branchName,

        // Stats (Overriden by Global Logic)
        stats: {
            ...stats,
            // Keep original arrays for UI lists
            pendingItems: stats.pendingItems,
            controlledItems: stats.controlledItems,
            adjustedItems: stats.adjustedItems,
            // Global Metrics for Header (Standardized)
            globalPending,
            globalControlled,
            globalAdjusted,
            globalProgress,
            pendingCount: globalPending,
            progress: globalProgress,
        },
        progressPercentage: globalProgress, // Export global progress
        history,

        // Dialogs State
        showSaveDialog, setShowSaveDialog,
        shortageId, setShortageId,
        surplusId, setSurplusId,
        shortageValue, surplusValue,

        showDeleteDialog, setShowDeleteDialog,
        verificationText, setVerificationText,
        isDeleting, setIsDeleting,

        // Advanced Logic
        sortBy, setSortBy,
        getSortedItems,

        // Actions
        handleFileUpload,
        handleUpdateQuantity,
        handleCheck,
        handleRevertItem,
        handleFinalizeClick,
        handleSaveInventory,
        handleResetData,
        handleConfirmDelete
    };
}
