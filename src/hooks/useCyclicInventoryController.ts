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
import { INVENTORY_KEYS, useAdjustmentHistoryQuery } from './useInventoryQueries';
import { normalizeString } from '@/lib/utils';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

interface UseCyclicInventoryControllerProps {
    labName: string;
    round?: number;
}

export function useCyclicInventoryController({ labName, round }: UseCyclicInventoryControllerProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useUser();
    const branchName = user?.branchName || 'Sucursal Desconocida';

    // Core State
    const [items, setItems] = useState<CyclicItem[]>([]);
    const [isExcelUploaded, setIsExcelUploaded] = useState(false);

    useEffect(() => {
        if (branchName && labName) {
            const key = `excel_uploaded_${normalizeString(branchName)}_${normalizeString(labName)}`;
            setIsExcelUploaded(localStorage.getItem(key) === 'true');
        }
    }, [branchName, labName]);

    const [isAdminEditActive, setIsAdminEditActive] = useState(false);
    const [isLabHidden, setIsLabHidden] = useState(false);

    useEffect(() => {
        const checkHiddenStatus = async () => {
            if (branchName && labName) {
                const cleanBranch = normalizeString(branchName);
                const cleanLabName = labName.trim().toUpperCase();
                const eanKey = `HIDDEN_LAB_${cleanLabName}`;
                
                try {
                    const { data } = await supabase
                        .from('inventories')
                        .select('quantity')
                        .eq('branch_name', cleanBranch)
                        .eq('laboratory', '_CONFIG_')
                        .eq('ean', eanKey)
                        .maybeSingle();
                    
                    setIsLabHidden(data?.quantity === 1);
                } catch (err) {
                    console.error("Error checking lab hidden status:", err);
                }
            }
        };
        checkHiddenStatus();
    }, [branchName, labName]);

    // 1. Sync Logic (Load/Save/AutoSave/Reset)
    const { isLoading, setIsLoading, isSaving, setIsSaving, saveProgress } = useInventorySync({
        branchName,
        labName,
        items,
        onItemsLoaded: setItems,
        round
    });

    // 2. Upload Logic
    const { 
        isUploading, 
        handleFileUpload, 
        handleElectronImport,
        showMismatchDialog,
        setShowMismatchDialog,
        mismatchData,
        handleResolveMismatch,

        showCategoryWarningDialog,
        setShowCategoryWarningDialog,
        categoryWarningData,
        handleResolveCategoryWarning,

        showOutdatedWarningDialog,
        setShowOutdatedWarningDialog,
        outdatedWarningData,
        handleResolveOutdatedWarning
    } = useInventoryUpload({
        branchName,
        labName,
        currentItems: items,
        onItemsUpdated: (newItems) => {
            setItems(newItems);
            setIsExcelUploaded(true); // Se acaba de cargar un Excel, permitimos re-ajustes
            if (branchName && labName) {
                const key = `excel_uploaded_${normalizeString(branchName)}_${normalizeString(labName)}`;
                localStorage.setItem(key, 'true');
            }
        }
    });

    // RULE: "Smart Hide" - If lab has adjusted items and NO Excel upload, hide pendings. (salvo en edición admin)
    const hasAdjustedItems = items.some(i => i.status === 'adjusted');
    const shouldHidePendings = hasAdjustedItems && !isExcelUploaded && !isAdminEditActive;

    // We only count "visible" or "active" items for the Global Header
    const visibleItems = shouldHidePendings 
        ? items.filter(i => i.status !== 'pending')
        : items;

    // 3. Stats & Filter Logic
    const stats = useInventoryStats(visibleItems, CATEGORIES[0]);
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

            const diffA = (a.countedQuantity - a.systemQuantity) * a.cost;
            const diffB = (b.countedQuantity - b.systemQuantity) * b.cost;
            
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

    // History Query (React Query)
    const { data: history = [] } = useAdjustmentHistoryQuery(branchName, labName);

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

    const handleUpdateQuantity = useCallback((id: string, quantity: number, reason?: string) => {
        const itemToUpdate = items.find(i => i.id === id);
        
        // REGLA DE NEGOCIO: Re-ajuste requiere carga previa de Excel
        if (itemToUpdate?.status === 'adjusted' && !isExcelUploaded && !isAdminEditActive) {
            notify.error(
                "Acción bloqueada", 
                "Para realizar un re-ajuste de productos ya finalizados, primero debes cargar el Excel de sistema actualizado."
            );
            return;
        }

        // Obtener IDs de ajuste existentes de cualquier otro ítem que ya esté ajustado en la lista actual
        const existingShortageId = items.find(i => i.status === 'adjusted' && i.shortageId)?.shortageId || "";
        const existingSurplusId = items.find(i => i.status === 'adjusted' && i.surplusId)?.surplusId || "";

        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const diff = quantity - item.systemQuantity;

                // Anomaly Detection Algorithm
                const absDiff = Math.abs(diff);
                const isSignificantQty = absDiff > 50 && (absDiff / (item.systemQuantity || 1)) > 0.5;
                const isHighValueDiff = (absDiff * item.cost) > 50000;

                if ((isSignificantQty || isHighValueDiff) && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 100]);
                } else if (diff !== 0 && navigator.vibrate) {
                    navigator.vibrate([50, 50, 50]);
                } else if (navigator.vibrate) {
                    navigator.vibrate(50);
                }

                const isReadjustment = item.status === 'adjusted';
                
                let newShortageId = item.shortageId;
                let newSurplusId = item.surplusId;
                
                if (isAdminEditActive) {
                    if (diff < 0) {
                        newShortageId = item.shortageId || existingShortageId || null;
                    } else if (diff > 0) {
                        newSurplusId = item.surplusId || existingSurplusId || null;
                    } else {
                        newShortageId = null;
                        newSurplusId = null;
                    }
                }

                return {
                    ...item,
                    countedQuantity: quantity,
                    readjustmentReason: reason,
                    status: isAdminEditActive ? 'adjusted' as const : 'controlled' as const,
                    wasReadjusted: isReadjustment ? true : item.wasReadjusted,
                    shortageId: isAdminEditActive ? newShortageId : item.shortageId,
                    surplusId: isAdminEditActive ? newSurplusId : item.surplusId
                };
            }
            return item;
        }));

        // [NEW] 24h Tracking
        const updatedItem = items.find(i => i.id === id);
        if (updatedItem) {
            cyclicInventoryService.logScanEvent(branchName, labName, updatedItem.ean, user?.id, user?.name);
        }
    }, [items, branchName, labName, user, isExcelUploaded, isAdminEditActive]);

    const handleCheck = useCallback((id: string) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setItems(prev => prev.map(item =>
            item.id === id
                ? { 
                    ...item, 
                    status: isAdminEditActive ? 'adjusted' as const : 'controlled' as const, 
                    countedQuantity: item.systemQuantity,
                    shortageId: isAdminEditActive ? null : item.shortageId,
                    surplusId: isAdminEditActive ? null : item.surplusId
                  }
                : item
        ));
        
        // [NEW] 24h Tracking
        const checkedItem = items.find(i => i.id === id);
        if (checkedItem) {
            cyclicInventoryService.logScanEvent(branchName, labName, checkedItem.ean, user?.id, user?.name);
        }

        notify.success("Operación exitosa", 'Producto controlado');
    }, [items, branchName, labName, user, isAdminEditActive]);

    const handleBulkCheck = useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        setItems(prev => prev.map(item =>
            ids.includes(item.id)
                ? { 
                    ...item, 
                    status: isAdminEditActive ? 'adjusted' as const : 'controlled' as const, 
                    countedQuantity: item.systemQuantity,
                    shortageId: isAdminEditActive ? null : item.shortageId,
                    surplusId: isAdminEditActive ? null : item.surplusId
                  }
                : item
        ));

        // [NEW] 24h Tracking (Bulk)
        ids.forEach(id => {
            const item = items.find(i => i.id === id);
            if (item) {
                cyclicInventoryService.logScanEvent(branchName, labName, item.ean, user?.id, user?.name);
            }
        });

        notify.success("Operación exitosa", `${ids.length} producto${ids.length > 1 ? 's' : ''} controlado${ids.length > 1 ? 's' : ''} sin diferencia`);
    }, [items, branchName, labName, user, isAdminEditActive]);

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
        if (isSaving) return;
        const controlledItems = items.filter(i => i.status === 'controlled');
        const shortages = controlledItems.filter(i => i.countedQuantity < i.systemQuantity);
        const surpluses = controlledItems.filter(i => i.countedQuantity > i.systemQuantity);

        if (shortages.length > 0) {
            const cleanId = shortageId.trim();
            if (!cleanId) {
                notify.error("Error", "Por favor ingresa el ID de ajuste para Faltantes");
                return;
            }
            if (!/^\d+$/.test(cleanId) || cleanId.length < 4 || cleanId.length > 12) {
                notify.error("Error", "El ID de Faltantes debe ser numérico y tener entre 4 y 12 dígitos.");
                return;
            }
        }

        if (surpluses.length > 0) {
            const cleanId = surplusId.trim();
            if (!cleanId) {
                notify.error("Error", "Por favor ingresa el ID de ajuste para Sobrantes");
                return;
            }
            if (!/^\d+$/.test(cleanId) || cleanId.length < 4 || cleanId.length > 12) {
                notify.error("Error", "El ID de Sobrantes debe ser numérico y tener entre 4 y 12 dígitos.");
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
                    
                    // Logic to preserve existing IDs and append new ones if they changed
                    let newShortageId = item.shortageId;
                    if (diff < 0) {
                        newShortageId = item.shortageId 
                            ? (item.shortageId.includes(shortageId) ? item.shortageId : `${item.shortageId}, ${shortageId}`)
                            : shortageId;
                    }

                    let newSurplusId = item.surplusId;
                    if (diff > 0) {
                        newSurplusId = item.surplusId 
                            ? (item.surplusId.includes(surplusId) ? item.surplusId : `${item.surplusId}, ${surplusId}`)
                            : surplusId;
                    }

                    return {
                        ...item,
                        status: 'adjusted' as const,
                        shortageId: newShortageId,
                        surplusId: newSurplusId
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
                surplusId,
                user?.branchId
            );

            // 2. Limpieza local de pendientes: tras la finalización, la app solo debe mostrar lo ajustado
            // El RPC ya borró los pendientes en la DB, sincronizamos el estado local.
            const finalProcessedItems = updatedItems.filter(item => item.status === 'adjusted');
            setItems(finalProcessedItems);

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

            // Resolve active round for the ledger history
            let activeRound = 1;
            try {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                const activeItems = items.filter(i => i.status === 'controlled' || i.status === 'adjusted');
                const cat = activeItems[0]?.category || currentCategory || 'GENERAL';
                const normCat = cat.toUpperCase();
                activeRound = config.rounds?.[normCat] || config.rounds?.GENERAL || 1;
            } catch (err) {
                console.warn("No se pudo obtener la ronda del config, usando default 1:", err);
            }

            await cyclicInventoryService.saveAdjustmentHistory(branchName, labName, {
                adjustment_id_shortage: shortageId,
                adjustment_id_surplus: surplusId,
                shortage_value: shortageValue,
                surplus_value: surplusValue,
                total_units_adjusted: controlledItems.length,
                user_name: user?.name,
                user_id: user?.id,
                items_snapshot: updatedItems,
                category: historyCategoryStr,
                round: activeRound
            });

            notify.success("Operación exitosa", `${categoryToFinalize} finalizado y archivado. Listo para nueva carga.`);
            setShowSaveDialog(false);
            setShortageId("");
            setSurplusId("");

            // Limpiar localStorage tras finalizar para que el próximo control/re-ajuste requiera carga nueva de Excel
            if (branchName && labName) {
                const key = `excel_uploaded_${normalizeString(branchName)}_${normalizeString(labName)}`;
                localStorage.removeItem(key);
            }
            setIsExcelUploaded(false);

            // Redirigir a la lista principal
            navigate('/cyclic-inventory');

            const newHistory = await cyclicInventoryService.getAdjustmentHistory(branchName, labName);
            // Non-destructive: React Query will refetch via invalidation

            // Invalidar Caché de React Query
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.history(branchName, labName)
            });

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

            // Clean localStorage
            if (branchName && labName) {
                const key = `excel_uploaded_${normalizeString(branchName)}_${normalizeString(labName)}`;
                localStorage.removeItem(key);
            }
            setIsExcelUploaded(false);

            // Invalidar Caché de React Query para forzar recarga limpia
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.history(branchName, labName)
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

    const handleForceRefreshProgress = async () => {
        try {
            notify.info("Actualizando", "Sincronizando el avance del laboratorio...");
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);
            await fetchPersistentStats();
            
            // Invalidar Caché de React Query para forzar recarga en el dashboard también
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            
            notify.success("Sincronizado", "El avance se ha recalculado correctamente.");
        } catch (error) {
            console.error("Error refreshing progress:", error);
            notify.error("Error", "No se pudo sincronizar el avance.");
        }
    };

    const handleSaveAdminEdit = async () => {
        setIsSaving(true);
        try {
            await cyclicInventoryService.saveInventory(branchName, labName, items);
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);
            await fetchPersistentStats();

            // Guardar en el historial de ajustes el registro de esta edición administrativa
            const adjustedItems = items.filter(i => i.status === 'adjusted');
            const shortages = adjustedItems.filter(i => i.countedQuantity < i.systemQuantity);
            const surpluses = adjustedItems.filter(i => i.countedQuantity > i.systemQuantity);
            
            const shortageVal = Math.round(shortages.reduce((acc, i) => acc + ((i.systemQuantity - i.countedQuantity) * i.cost), 0) * 100) / 100;
            const surplusVal = Math.round(surpluses.reduce((acc, i) => acc + ((i.countedQuantity - i.systemQuantity) * i.cost), 0) * 100) / 100;

            const existingShortageId = adjustedItems.find(i => i.shortageId)?.shortageId || "ADMIN_EDIT";
            const existingSurplusId = adjustedItems.find(i => i.surplusId)?.surplusId || "ADMIN_EDIT";

            const controlledCategories = Array.from(new Set(adjustedItems.map(i => i.category || 'Varios')));
            const historyCategoryStr = controlledCategories.length > 0
                ? controlledCategories.join(', ')
                : currentCategory;

            // Resolve active round for the ledger history
            let activeRoundAdmin = 1;
            try {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                const cat = adjustedItems[0]?.category || 'GENERAL';
                const normCat = cat.toUpperCase();
                activeRoundAdmin = config.rounds?.[normCat] || config.rounds?.GENERAL || 1;
            } catch (err) {
                console.warn("No se pudo obtener la ronda del config, usando default 1:", err);
            }

            await cyclicInventoryService.saveAdjustmentHistory(branchName, labName, {
                adjustment_id_shortage: existingShortageId,
                adjustment_id_surplus: existingSurplusId,
                shortage_value: shortageVal,
                surplus_value: surplusVal,
                total_units_adjusted: adjustedItems.length,
                user_name: `${user?.name || 'Admin'} (Edición Admin)`,
                user_id: user?.id,
                items_snapshot: items,
                category: historyCategoryStr,
                round: activeRoundAdmin
            });

            notify.success("Operación exitosa", "Ajustes editados y guardados correctamente.");
            setIsAdminEditActive(false);

            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.history(branchName, labName)
            });
        } catch (error) {
            console.error("Error saving admin edit:", error);
            notify.error("Error", "Error al guardar los cambios del ajuste.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelAdminEdit = async () => {
        setIsSaving(true);
        try {
            await queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            setIsAdminEditActive(false);
            notify.info("Edición cancelada", "Se descartaron los cambios no guardados.");
        } catch (error) {
            console.error("Error canceling admin edit:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleHideLab = async (checked: boolean) => {
        setIsLabHidden(checked);
        try {
            await cyclicInventoryService.hideLaboratory(branchName, labName, checked);
            notify.success(
                "Operación exitosa",
                checked ? "Laboratorio ocultado correctamente." : "Laboratorio visible nuevamente."
            );
            
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
        } catch (error) {
            console.error("Error toggling hidden state:", error);
            notify.error("Error", "No se pudo cambiar el estado de visibilidad.");
            setIsLabHidden(!checked); // Revertir estado
        }
    };

    const handleUpdateAdjustmentIds = async (newShortageId: string, newSurplusId: string) => {
        try {
            await cyclicInventoryService.updateAdjustmentIds(
                branchName,
                labName,
                newShortageId.trim(),
                newSurplusId.trim()
            );

            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.history(branchName, labName)
            });

            return true;
        } catch (error) {
            console.error("Error updating adjustment IDs in controller:", error);
            throw error;
        }
    };

    const handleUpdateSessionAdjustmentIds = async (
        sessionId: string,
        newShortageId: string,
        newSurplusId: string,
        sessionCreatedAt: string
    ) => {
        try {
            await cyclicInventoryService.updateSessionAdjustmentIds(
                branchName,
                labName,
                sessionId,
                newShortageId.trim(),
                newSurplusId.trim(),
                sessionCreatedAt
            );

            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.lab(branchName, labName)
            });
            queryClient.invalidateQueries({
                queryKey: INVENTORY_KEYS.history(branchName, labName)
            });

            return true;
        } catch (error) {
            console.error("Error updating session adjustment IDs in controller:", error);
            throw error;
        }
    };

    return {
        // State
        items,
        isLoading,
        isSaving,
        isUploading,
        isExcelUploaded,
        branchName,
        isLabHidden,

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
        handleElectronImport,
        handleUpdateQuantity,
        handleCheck,
        handleBulkCheck,
        handleRevertItem,
        handleFinalizeClick,
        handleSaveInventory,
        handleResetData,
        handleConfirmDelete,
        handleForceRefreshProgress,
        handleToggleHideLab,
        handleUpdateAdjustmentIds,
        handleUpdateSessionAdjustmentIds,
        
        // Mismatch Overrides
        showMismatchDialog,
        setShowMismatchDialog,
        mismatchData,
        handleResolveMismatch,

        // Advertencia de Rubros Faltantes
        showCategoryWarningDialog,
        setShowCategoryWarningDialog,
        categoryWarningData,
        handleResolveCategoryWarning,

        // Advertencia de Archivo Desactualizado
        showOutdatedWarningDialog,
        setShowOutdatedWarningDialog,
        outdatedWarningData,
        handleResolveOutdatedWarning,

        // Special State
        shouldHidePendings,
        isAdminEditActive,
        setIsAdminEditActive,
        handleSaveAdminEdit,
        handleCancelAdminEdit
    };
}
