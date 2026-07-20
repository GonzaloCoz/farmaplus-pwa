import { useState, useEffect, useCallback } from 'react';
import { notify } from '@/lib/notifications';
import { CyclicItem, cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useLabInventoryQuery } from './useInventoryQueries';

interface UseInventorySyncProps {
    branchName: string;
    labName: string;
    items: CyclicItem[];
    onItemsLoaded: (items: CyclicItem[]) => void;
    round?: number;
}

export function useInventorySync({ branchName, labName, items, onItemsLoaded, round }: UseInventorySyncProps) {
    const { data: queryData, isLoading: queryLoading } = useLabInventoryQuery(branchName, labName, round);
    const [isSaving, setIsSaving] = useState(false);
    const setIsLoading = (loading: boolean) => { }; // Compatibilidad con el controlador

    // Actualizar estado local cuando cambian los datos de la consulta
    useEffect(() => {
        if (queryData) {
            onItemsLoaded(queryData);
        }
    }, [queryData, onItemsLoaded]);

    const isLoading = queryLoading;

    // Efecto de Auto-Guardado
    useEffect(() => {
        // No auto-guardar si está vacío o en sucursal desconocida/offline
        if (items.length === 0 || !labName || branchName === 'Sucursal Desconocida') return;

        const timeoutId = setTimeout(() => {
            // Guardar silenciosamente
            cyclicInventoryService.saveInventory(branchName, labName, items)
                .then(() => console.log('Auto-guardado exitoso'))
                .catch(err => console.error('Error de auto-guardado', err));
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [items, branchName, labName]);

    // Guardado Manual
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
