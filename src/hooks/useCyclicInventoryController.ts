import { useState, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/components/CyclicInventoryList';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useInventoryUpload } from '@/hooks/useInventoryUpload';
import { useInventoryStats } from '@/hooks/useInventoryStats';
import { useUser } from '@/contexts/UserContext';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

interface UseCyclicInventoryControllerProps {
    labName: string;
}

export function useCyclicInventoryController({ labName }: UseCyclicInventoryControllerProps) {
    const navigate = useNavigate();
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
        controlledItems,
        currentCategory
    } = stats;

    // Advanced Logic State
    const [sortBy, setSortBy] = useState<'default' | 'financial'>('default');

    // Derived State: Sorted Items
    // We filter items based on the active tab in the UI, but here we provide a helper to sort any list
    const getSortedItems = useCallback((itemsToSort: CyclicItem[]) => {
        if (sortBy === 'default') return itemsToSort;

        return [...itemsToSort].sort((a, b) => {
            const diffA = Math.abs(a.systemQuantity - a.countedQuantity) * a.cost;
            const diffB = Math.abs(b.systemQuantity - b.countedQuantity) * b.cost;
            // Descending order (highest impact first)
            return diffB - diffA;
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

    // Confetti Effect
    const [confettiFired, setConfettiFired] = useState(false);
    const progressPercentage = items.length > 0
        ? Math.round((items.filter(i => i.status === 'controlled' || i.status === 'adjusted').length / items.length) * 100)
        : 0;

    useEffect(() => {
        if (progressPercentage < 100 && confettiFired) {
            setConfettiFired(false);
        }
        if (progressPercentage === 100 && !confettiFired && items.length > 0) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
            setConfettiFired(true);
            notify.success("¡Excelente!", "Has completado el 100% del laboratorio.");
        }
    }, [progressPercentage, confettiFired, items.length]);

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
        await saveProgress();
        setShowSaveDialog(true);
    };

    const globalControlledItems = items.filter(i => i.status === 'controlled');

    const shortageValue = globalControlledItems
        .filter(i => i.countedQuantity < i.systemQuantity)
        .reduce((acc, i) => acc + ((i.systemQuantity - i.countedQuantity) * i.cost), 0);

    const surplusValue = globalControlledItems
        .filter(i => i.countedQuantity > i.systemQuantity)
        .reduce((acc, i) => acc + ((i.countedQuantity - i.systemQuantity) * i.cost), 0);

    const handleSaveInventory = async () => {
        const globalControlledItems = items.filter(i => i.status === 'controlled');
        const shortages = globalControlledItems.filter(i => i.countedQuantity < i.systemQuantity);
        const surpluses = globalControlledItems.filter(i => i.countedQuantity > i.systemQuantity);

        if (shortages.length > 0 && !shortageId.trim()) {
            notify.error("Error", "Por favor ingresa el ID de ajuste para Faltantes");
            return;
        }

        if (surpluses.length > 0 && !surplusId.trim()) {
            notify.error("Error", "Por favor ingresa el ID de ajuste para Sobrantes");
            return;
        }

        setIsSaving(true);
        try {
            const categoryToFinalize = currentCategory;

            const itemsToKeep = items.filter(item => {
                const isInCategory = (item.category === categoryToFinalize) || (!item.category && categoryToFinalize === "Varios");
                if (isInCategory && item.status === 'pending') {
                    return false;
                }
                return true;
            });

            const updatedItems = itemsToKeep.map(item => {
                if (item.status === 'controlled') {
                    return { ...item, status: 'adjusted' as const };
                }
                return item;
            });

            setItems(updatedItems);

            await cyclicInventoryService.clearPendingResidue(branchName, labName, [categoryToFinalize]);
            await cyclicInventoryService.saveInventory(branchName, labName, updatedItems);
            await cyclicInventoryService.saveAdjustmentHistory(branchName, labName, {
                adjustment_id_shortage: shortageId,
                adjustment_id_surplus: surplusId,
                shortage_value: shortageValue,
                surplus_value: surplusValue,
                total_units_adjusted: globalControlledItems.length,
                user_name: user?.name,
                user_id: user?.id,
                items_snapshot: updatedItems,
                category: categoryToFinalize
            });

            notify.success("Operación exitosa", `${categoryToFinalize} finalizado. Pendientes eliminados.`);
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
            await new Promise(resolve => setTimeout(resolve, 1500));
            await cyclicInventoryService.deleteInventory(branchName, labName);
            await cyclicInventoryService.deleteAdjustmentHistory(branchName, labName);
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
        progressPercentage,
        branchName,

        // Stats
        stats,
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
