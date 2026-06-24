import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { normalizeString, getStringSimilarity } from '@/lib/utils';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { useUser } from '@/contexts/UserContext';
import ExcelWorker from '../workers/excelWorker?worker';

// Definir categorías para evitar dependencias circulares o redefiniciones
const CATEGORIES = ["Medicamentos", "Perfumería", "ACCESORIOS", "VARIOS"];

interface UseInventoryUploadProps {
    labName: string;
    branchName: string;
    currentItems: CyclicItem[];
    onItemsUpdated: (items: CyclicItem[]) => void;
}

interface MismatchData {
    fileLabName: string;
    isSimilar: boolean;
    similarLabs: string[];
    fileContent?: any;
    electronData?: any;
}

export function useInventoryUpload({ labName, branchName, currentItems, onItemsUpdated }: UseInventoryUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [showMismatchDialog, setShowMismatchDialog] = useState(false);
    const [mismatchData, setMismatchData] = useState<MismatchData | null>(null);
    
    const navigate = useNavigate();
    const { user } = useUser();

    const handleResolveMismatch = async (action: 'current' | 'redirect' | 'cancel', chosenLab?: string) => {
        if (action === 'cancel' || !mismatchData) {
            setShowMismatchDialog(false);
            setMismatchData(null);
            setIsUploading(false);
            return;
        }

        setIsUploading(true);
        setShowMismatchDialog(false);

        const targetLab = action === 'current' ? labName : (chosenLab || mismatchData.fileLabName);

        try {
            // Caso A: Carga de Archivo Manual (posee fileContent)
            if (mismatchData.fileContent) {
                const dbItems = await cyclicInventoryService.getLabInventory(branchName, targetLab);
                const worker = new ExcelWorker();

                worker.onmessage = async (eMsg) => {
                    const { success, error, finalItems, addedCount, updatedCount } = eMsg.data;

                    if (error) {
                        notify.error("Error de archivo", error);
                        setIsUploading(false);
                        worker.terminate();
                        return;
                    }

                    if (success) {
                        // Actualizamos el estado en pantalla si nos quedamos en el mismo laboratorio (o si elegimos el mismo de la lista)
                        if (action === 'current' || targetLab.toUpperCase() === labName.toUpperCase()) {
                            onItemsUpdated(finalItems);
                        }
                        
                        try {
                            await cyclicInventoryService.purgeAndSaveLabInventory(branchName, targetLab, finalItems);
                            
                            if (addedCount > 0 || updatedCount > 0) {
                                notify.success("Carga exitosa", `Se importaron ${addedCount} productos nuevos y ${updatedCount} existentes en ${targetLab}.`);
                            } else {
                                notify.info("Sin cambios", `Todos los productos ya estaban procesados en ${targetLab}.`);
                            }

                            if (action === 'redirect' && targetLab.toUpperCase() !== labName.toUpperCase()) {
                                navigate(`/cyclic-inventory/${encodeURIComponent(targetLab)}`);
                            }
                        } catch (err) {
                            console.error("Failed to save after upload:", err);
                            notify.error("Error al guardar", "Se procesó el archivo pero hubo un problema al guardar.");
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
                    fileData: mismatchData.fileContent,
                    labName: targetLab,
                    branchName,
                    currentItems: dbItems,
                    bypassLabCheck: true
                });
            } 
            // Caso B: Datos de importación de Launcher (Electron)
            else if (mismatchData.electronData) {
                const dbItems = await cyclicInventoryService.getLabInventory(branchName, targetLab);
                const rows = mismatchData.electronData.rows;
                const finalItems = [...dbItems];
                const eanMap = new Map();
                finalItems.forEach((item, index) => eanMap.set(String(item.ean).trim(), index));

                let addedCount = 0;
                let updatedCount = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || !row[3]) continue;
                    const id_producto = row[0] ? String(row[0]).trim() : '';
                    const rawEan = row[16];
                    if (!rawEan) continue;
                    const eanList = String(rawEan).split('-').map(e => e.trim()).filter(e => e.length > 0);
                    if (eanList.length === 0) continue;

                    let category = normalizeString(row[9]?.toString() || 'Varios').toUpperCase();
                    const rawCost = row[10];
                    const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

                    for (const ean of eanList) {
                        if (eanMap.has(ean)) {
                            const index = eanMap.get(ean);
                            const existingItem = { ...finalItems[index] };
                            const newSystemQty = Number(row[4]) || 0;
                            finalItems[index] = {
                                ...existingItem,
                                name: row[3],
                                systemQuantity: newSystemQty,
                                countedQuantity: existingItem.status === 'pending' ? newSystemQty : existingItem.countedQuantity,
                                cost: costValue,
                                category: category,
                                id_producto: id_producto
                            };
                            updatedCount++;
                        } else {
                            finalItems.push({
                                id: crypto.randomUUID(),
                                ean: ean,
                                name: row[3],
                                systemQuantity: Number(row[4]) || 0,
                                countedQuantity: Number(row[4]) || 0,
                                cost: costValue,
                                status: 'pending',
                                category: category,
                                wasReadjusted: false,
                                id_producto: id_producto
                            });
                            addedCount++;
                        }
                    }
                }

                if (action === 'current' || targetLab.toUpperCase() === labName.toUpperCase()) {
                    onItemsUpdated(finalItems);
                }
                
                await cyclicInventoryService.purgeAndSaveLabInventory(branchName, targetLab, finalItems);
                notify.success("Importación Exitosa", `Se sincronizaron ${addedCount + updatedCount} productos en ${targetLab}.`);
                
                if (action === 'redirect' && targetLab.toUpperCase() !== labName.toUpperCase()) {
                    navigate(`/cyclic-inventory/${encodeURIComponent(targetLab)}`);
                }
                setIsUploading(false);
            }
        } catch (error) {
            console.error("Error resolving mismatch:", error);
            notify.error("Error", "No se pudieron procesar los datos.");
            setIsUploading(false);
        } finally {
            setMismatchData(null);
        }
    };

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
            const worker = new ExcelWorker();

            worker.onmessage = async (eMsg) => {
                const { success, error, finalItems, addedCount, updatedCount, type, message, fileLabName } = eMsg.data;

                if (type === 'debug') {
                    console.log('[Worker Debug]', message);
                    return;
                }

                if (type === 'mismatch') {
                    try {
                        const allowedLabs = await getLaboratoriesForBranch(branchName);
                        const uniqueLabNames = Array.from(new Set(allowedLabs.map(lab => lab.name)));
                        const similarLabs = uniqueLabNames
                            .map(name => ({
                                name,
                                similarity: getStringSimilarity(fileLabName, name)
                            }))
                            .filter(lab => lab.similarity >= 0.5) // Filtro de coincidencia
                            .sort((a, b) => b.similarity - a.similarity)
                            .slice(0, 5)
                            .map(lab => lab.name);

                        setMismatchData({
                            fileLabName,
                            isSimilar: similarLabs.length > 0,
                            similarLabs,
                            fileContent
                        });
                        setShowMismatchDialog(true);
                    } catch (err) {
                        console.error("Error seeking similar labs:", err);
                        notify.error("Error de verificación", `El archivo pertenece a "${fileLabName}", pero estás intentando cargar datos para "${labName}".`);
                        setIsUploading(false);
                    } finally {
                        worker.terminate();
                    }
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
                currentItems: mergedCurrentItems,
                bypassLabCheck: false
            });
        };

        reader.readAsBinaryString(file);
    };

    const handleElectronImport = async (data: { rows: any[][], filename: string }) => {
        if (!data.rows || data.rows.length < 2) return;

        setIsUploading(true);

        try {
            const rows = data.rows;
            const fileLabName = rows[1] ? String(rows[1][14] || '').trim() : '';

            // Si hay discrepancia de laboratorio en la carga de Electron
            if (fileLabName && fileLabName.toUpperCase() !== labName.toUpperCase() && fileLabName.toUpperCase() !== branchName.toUpperCase()) {
                const allowedLabs = await getLaboratoriesForBranch(branchName);
                const uniqueLabNames = Array.from(new Set(allowedLabs.map(lab => lab.name)));
                const similarLabs = uniqueLabNames
                    .map(name => ({
                        name,
                        similarity: getStringSimilarity(fileLabName, name)
                    }))
                    .filter(lab => lab.similarity >= 0.5)
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 5)
                    .map(lab => lab.name);

                setMismatchData({
                    fileLabName,
                    isSimilar: similarLabs.length > 0,
                    similarLabs,
                    electronData: data
                });
                setShowMismatchDialog(true);
                return;
            }

            // Pre-merge logic (similar to handleFileUpload)
            let mergedCurrentItems: CyclicItem[] = [...currentItems];
            const dbItems = await cyclicInventoryService.getLabInventory(branchName, labName);
            if (dbItems.length > 0) {
                const reactItemMap = new Map(currentItems.map(i => [String(i.ean).trim(), i]));
                const merged: CyclicItem[] = dbItems.map(dbItem => {
                    const reactVersion = reactItemMap.get(String(dbItem.ean).trim());
                    return reactVersion || dbItem;
                });
                currentItems.forEach(rItem => {
                    const ean = String(rItem.ean).trim();
                    if (!merged.find(m => String(m.ean).trim() === ean)) merged.push(rItem);
                });
                mergedCurrentItems = merged;
            }

            const finalItems: any[] = [...mergedCurrentItems];
            const eanMap = new Map();
            finalItems.forEach((item, index) => eanMap.set(String(item.ean).trim(), index));

            let addedCount = 0;
            let updatedCount = 0;

            for (let i = 1; i < rows.length; i++) {
                const row: any = rows[i];
                if (!row || !row[3]) continue;
                const id_producto = row[0] ? String(row[0]).trim() : '';
                const rawEan = row[16];
                if (!rawEan) continue;
                const eanList = String(rawEan).split('-').map(e => e.trim()).filter(e => e.length > 0);
                if (eanList.length === 0) continue;

                let category = normalizeString(row[9]?.toString() || 'Varios').toUpperCase();
                const rawCost = row[10];
                const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

                for (const ean of eanList) {
                    if (eanMap.has(ean)) {
                        const index = eanMap.get(ean);
                        const existingItem = { ...finalItems[index] };
                        const newSystemQty = Number(row[4]) || 0;
                        finalItems[index] = {
                            ...existingItem,
                            name: row[3],
                            systemQuantity: newSystemQty,
                            countedQuantity: existingItem.status === 'pending' ? newSystemQty : existingItem.countedQuantity,
                            cost: costValue,
                            category: category,
                            id_producto: id_producto
                        };
                        updatedCount++;
                    } else {
                        finalItems.push({
                            id: crypto.randomUUID(),
                            ean: ean,
                            name: row[3],
                            systemQuantity: Number(row[4]) || 0,
                            countedQuantity: Number(row[4]) || 0,
                            cost: costValue,
                            status: 'pending',
                            category: category,
                            wasReadjusted: false,
                            id_producto: id_producto
                        });
                        addedCount++;
                    }
                }
            }

            onItemsUpdated(finalItems);
            await cyclicInventoryService.purgeAndSaveLabInventory(branchName, labName, finalItems);
            
            if (addedCount > 0 || updatedCount > 0) {
                notify.success("Importación Plex25", `Se sincronizaron ${addedCount + updatedCount} productos desde el Launcher.`);
            }
        } catch (error) {
            console.error("Error in handleElectronImport:", error);
            notify.error("Error", "No se pudo procesar la importación del Launcher.");
        } finally {
            setIsUploading(false);
        }
    };

    return {
        isUploading,
        handleFileUpload,
        handleElectronImport,
        showMismatchDialog,
        setShowMismatchDialog,
        mismatchData,
        handleResolveMismatch
    };
}
