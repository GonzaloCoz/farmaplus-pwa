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
        const reader = new FileReader();

        reader.onload = (evt) => {
            const bstr = evt.target?.result;

            // Optimización Empresarial: Uso de Web Workers para rendimiento de UI a 60FPS
            const worker = new Worker(new URL('../workers/excelWorker.ts', import.meta.url), { type: 'module' });

            worker.onmessage = async (e) => {
                const { success, error, finalItems, addedCount, updatedCount } = e.data;

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
                            notify.success("Carga exitosa", `${addedCount} nuevos, ${updatedCount} actualizados`);
                        } else {
                            notify.info("Sin cambios", `Todos los productos ya estaban procesados`);
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

            worker.postMessage({
                fileData: bstr,
                labName,
                currentItems
            });
        };

        reader.readAsBinaryString(file);
    };

    return {
        isUploading,
        handleFileUpload
    };
}
