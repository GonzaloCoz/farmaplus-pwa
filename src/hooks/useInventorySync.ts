import { useState, useEffect, useCallback } from 'react';
import { notify } from '@/lib/notifications';
import { CyclicItem, cyclicInventoryService } from '@/services/cyclicInventoryService';

interface UseInventorySyncProps {
    branchName: string;
    labName: string;
    items: CyclicItem[];
    onItemsLoaded: (items: CyclicItem[]) => void;
}

export function useInventorySync({ branchName, labName, items, onItemsLoaded }: UseInventorySyncProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        if (labName && branchName !== 'Sucursal Desconocida') {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const data = await cyclicInventoryService.getLabInventory(branchName, labName);
                    if (data && data.length > 0) {
                        onItemsLoaded(data);
                    }
                } catch (error) {
                    console.error("Failed to load inventory:", error);
                    notify.error("Error de carga", "No se pudo cargar el inventario desde la nube");
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [labName, branchName]);

    // Auto-Save Effect
    useEffect(() => {
        // Don't auto-save if empty or offline/unknown branch
        if (items.length === 0 || !labName || branchName === 'Sucursal Desconocida') return;

        const timeoutId = setTimeout(() => {
            // Save quietly
            cyclicInventoryService.saveInventory(branchName, labName, items)
                .then(() => console.log('Auto-saved'))
                .catch(err => console.error('Auto-save error', err));
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [items, branchName, labName]);

    // Manual Save
    const saveProgress = async () => {
        setIsSaving(true);
        try {
            await cyclicInventoryService.saveInventory(branchName, labName, items);
            notify.success("Progreso guardado", "Los datos se guardaron en la nube");
        } catch (error) {
            console.error("Error saving progress:", error);
            notify.error("Error al guardar", "No se pudo guardar el progreso");
        } finally {
            setIsSaving(false);
        }
    };

    return {
        isLoading,
        setIsLoading,
        isSaving,
        setIsSaving,
        saveProgress
    };
}
