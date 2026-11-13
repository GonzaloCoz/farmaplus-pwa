import { useState, useEffect, useRef } from 'react';
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

    const itemsRef = useRef(items);
    itemsRef.current = items;

    // Actualizar estado local cuando cambian los datos de la consulta, preservando PVP y metadata en memoria
    useEffect(() => {
        if (queryData && queryData.length > 0) {
            const existingMap = new Map<string, CyclicItem>();
            (itemsRef.current || []).forEach(it => {
                if (it.ean) existingMap.set(it.ean, it);
                if (it.id_producto) existingMap.set(it.id_producto, it);
            });

            const merged = queryData.map(qItem => {
                const existing = existingMap.get(qItem.ean) || (qItem.id_producto ? existingMap.get(qItem.id_producto) : undefined);
                const price = (qItem.price && qItem.price > 0) ? qItem.price : (existing?.price || 0);
                const is_hidden = qItem.is_hidden ?? existing?.is_hidden ?? false;
                return {
                    ...qItem,
                    price,
                    is_hidden
                };
            });
            onItemsLoaded(merged);
        } else if (queryData && queryData.length === 0) {
            onItemsLoaded(queryData);
        }
    }, [queryData]);

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
