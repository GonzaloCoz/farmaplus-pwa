import { useState } from 'react';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { normalizeString } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';

// Definir categorías para evitar dependencias circulares o redefiniciones
const CATEGORIES = ["Medicamentos", "Perfumería", "ACCESORIOS", "VARIOS"];

interface UseInventoryUploadProps {
    labName: string;
    branchName: string;
    currentItems: CyclicItem[];
    onItemsUpdated: (items: CyclicItem[]) => void;
}

export function useInventoryUpload({ labName, branchName, currentItems, onItemsUpdated }: UseInventoryUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const { user } = useUser();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Verificar estado de bloqueo antes de permitir la carga (solo usuarios de sucursal)
        if (user?.role === 'branch') {
            try {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                const lockStatus = await cyclicInventoryService.isInventoryLocked(
                    branchName,
                    config.days,
                    config.startDate
                );

                if (lockStatus.isLocked) {
                    const reason = lockStatus.reason === 'manual'
                        ? 'El inventario ha sido bloqueado manualmente'
                        : 'El plazo de inventario ha vencido';
                    notify.error('Inventario Bloqueado', `${reason}. No puedes cargar archivos en este momento.`);
                    return;
                }
            } catch (error) {
                console.error('Error checking lock status:', error);
                // Continuar con la carga si la verificación de bloqueo falla
            }
        }

        setIsUploading(true);

        // IRONCLAD PRE-MERGE: Leer el estado actual de Supabase ANTES de abrir el reader.
        // Debe ejecutarse aquí (en la función async handleFileUpload) y no dentro de reader.onload
        // que es síncrono. Esto garantiza que los items ajustados/controlados de sesiones anteriores
        // se preserven aunque el estado de React esté vacío (e.g., tras recargar la app).
        let mergedCurrentItems: CyclicItem[] = [...currentItems];
        try {
            const dbItems = await cyclicInventoryService.getLabInventory(branchName, labName);
            if (dbItems.length > 0) {
                // Feature logic: If 100% adjusted and user uploads Excel, ask for re-adjustment
                const allAdjusted = dbItems.every(i => i.status === 'adjusted');
                if (allAdjusted) {
                    const confirmReajuste = window.confirm("Este laboratorio ya fue finalizado al 100%.\n\n¿Deseas realizar un re-ajuste de algunos artículos?\nSi confirmas, podrás buscarlos en la pestaña 'Ajustados' y modificar su cantidad indicando el motivo.");
                    if (!confirmReajuste) {
                        setIsUploading(false);
                        return;
                    }
                }

                // React state toma prioridad (puede tener cambios no guardados recientes),
                // pero la DB es el fallback para items que no están en el estado.
                const reactItemMap = new Map(currentItems.map(i => [String(i.ean).trim(), i]));
                const merged: CyclicItem[] = dbItems.map(dbItem => {
                    const reactVersion = reactItemMap.get(String(dbItem.ean).trim());
                    return reactVersion || dbItem;
                });
                // Agregar cualquier item del estado React que no esté en DB (cambios pendientes de sync)
                currentItems.forEach(rItem => {
                    const ean = String(rItem.ean).trim();
                    if (!merged.find(m => String(m.ean).trim() === ean)) {
                        merged.push(rItem);
                    }
                });
                mergedCurrentItems = merged;
            }
        } catch (fetchError) {
            console.warn('No se pudo leer el estado de DB antes de subir Excel. Usando estado de React.', fetchError);
        }

        const reader = new FileReader();

        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        // PDF uploads are temporarily disabled due to worker compatibility issues
        if (isPdf) {
            notify.error("Formato no soportado", "La carga de archivos PDF está temporalmente deshabilitada. Por favor, utilizá un archivo Excel (.xlsx o .xls).");
            setIsUploading(false);
            return;
        }

        reader.onload = (evt) => {
            const fileContent = evt.target?.result;

            // Optimización Empresarial: Uso de Web Workers para rendimiento de UI a 60FPS
            const workerUrl = new URL('../workers/excelWorker.ts', import.meta.url);

            const worker = new Worker(workerUrl, { type: 'module' });

            worker.onmessage = async (e) => {
                const { success, error, finalItems, addedCount, updatedCount, type, message } = e.data;

                if (type === 'debug') {
                    console.log('[Worker Debug]', message);
                    return;
                }

                if (error) {
                    notify.error("Error de archivo", error);
                    setIsUploading(false);
                    worker.terminate();
                    return;
                }

                if (success) {
                    onItemsUpdated(finalItems);

                    // Guardar inmediatamente con limpieza de residuos
                    try {
                        await cyclicInventoryService.purgeAndSaveLabInventory(branchName, labName, finalItems);
                        console.log("Ironclad Sync completado con éxito (Worker).");

                        if (addedCount > 0 || updatedCount > 0) {
                            notify.success("Carga exitosa", `Se agregaron ${addedCount} productos nuevos y se actualizaron ${updatedCount} existentes.`);
                        } else {
                            notify.info("Sin cambios", `Todos los productos en el archivo ya estaban procesados en este laboratorio.`);
                        }
                    } catch (err) {
                        console.error("Failed to save after upload:", err);
                        notify.error("Error al guardar", "Se cargó el archivo pero hubo un problema al sincronizar con la nube.");
                    } finally {
                        setIsUploading(false);
                        worker.terminate();
                    }
                }
            };

            worker.onerror = (err) => {
                console.error("Worker Error:", err);
                notify.error("Error de procesamiento", "Hubo un fallo crítico en el worker.");
                setIsUploading(false);
                worker.terminate();
            };

            // Pasar la lista pre-mergeada (capturada por closure) al worker
            worker.postMessage({
                fileData: fileContent,
                labName,
                branchName,
                currentItems: mergedCurrentItems
            });
        };

        reader.readAsBinaryString(file);
    };

    return {
        isUploading,
        handleFileUpload
    };
}
