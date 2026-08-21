import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { normalizeString, getStringSimilarity } from '@/lib/utils';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import ExcelWorker from '../workers/excelCyclicWorker?worker';

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

export interface CategoryWarningData {
    targetLab: string;
    expectedCategories: string[];
    foundCategories: string[];
    missingCategories: string[];
    pendingUpload: {
        finalItems: any[];
        addedCount: number;
        updatedCount: number;
        action?: 'current' | 'redirect';
        targetLab: string;
    };
}

export interface OutdatedWarningData {
    targetLab: string;
    fileDateStr: string;
    relativeDateStr?: string;
    excelCategories?: string[];
    pendingUpload: {
        finalItems: any[];
        addedCount: number;
        updatedCount: number;
        action?: 'current' | 'redirect';
        targetLab: string;
    };
}

export function useInventoryUpload({ labName, branchName, currentItems, onItemsUpdated }: UseInventoryUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [showMismatchDialog, setShowMismatchDialog] = useState(false);
    const [mismatchData, setMismatchData] = useState<MismatchData | null>(null);

    // Advertencia de Rubros Faltantes
    const [showCategoryWarningDialog, setShowCategoryWarningDialog] = useState(false);
    const [categoryWarningData, setCategoryWarningData] = useState<CategoryWarningData | null>(null);

    // Advertencia de Archivo Desactualizado
    const [showOutdatedWarningDialog, setShowOutdatedWarningDialog] = useState(false);
    const [outdatedWarningData, setOutdatedWarningData] = useState<OutdatedWarningData | null>(null);

    const navigate = useNavigate();
    const { user } = useUser();

    const checkMissingCategories = async (targetLab: string, branchName: string, excelCategories: string[]) => {
        try {
            const allowedLabs = await getLaboratoriesForBranch(branchName);
            const normTarget = normalizeString(targetLab);
            const labEntries = allowedLabs.filter(l => normalizeString(l.name) === normTarget);

            // Categorías asignadas en esta sucursal para este laboratorio en la lista maestra (branch_laboratories)
            const expectedCategories = Array.from(new Set(
                labEntries.map(l => (l.category || 'VARIOS').trim().toUpperCase())
            ));

            // Si el laboratorio solo tiene 1 o 0 rubros asignados en la sucursal, no hay riesgo de omisión
            if (expectedCategories.length <= 1) {
                return { hasMissingCategories: false, expectedCategories: [], foundCategories: [], missingCategories: [] };
            }

            // Categorías presentes EXCLUSIVAMENTE en las filas del archivo Excel subido
            const foundCategories = Array.from(new Set(
                (excelCategories || [])
                    .map(cat => (cat || 'VARIOS').trim().toUpperCase())
                    .filter(Boolean)
            ));

            // Categorías omitidas en el reporte subido
            const missingCategories = expectedCategories.filter(cat => !foundCategories.includes(cat));

            return {
                hasMissingCategories: missingCategories.length > 0,
                expectedCategories,
                foundCategories,
                missingCategories
            };
        } catch (err) {
            console.error("Error checking missing categories:", err);
            return { hasMissingCategories: false, expectedCategories: [], foundCategories: [], missingCategories: [] };
        }
    };

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
                    const { success, error, finalItems, addedCount, updatedCount, excelCategories } = eMsg.data;

                    if (error) {
                        notify.error("Error de archivo", error);
                        setIsUploading(false);
                        worker.terminate();
                        return;
                    }

                    if (success) {
                        const { isOutdated, fileDateStr, relativeDateStr } = eMsg.data;
                        const categoryCheck = await checkMissingCategories(targetLab, branchName, excelCategories || []);

                        if (isOutdated) {
                            setOutdatedWarningData({
                                targetLab,
                                fileDateStr: fileDateStr || 'Sin fecha',
                                relativeDateStr: relativeDateStr || 'en una fecha anterior',
                                excelCategories: excelCategories || [],
                                pendingUpload: {
                                    finalItems,
                                    addedCount,
                                    updatedCount,
                                    action,
                                    targetLab
                                }
                            });
                            setShowOutdatedWarningDialog(true);
                            setIsUploading(false);
                            worker.terminate();
                            return;
                        }

                        if (categoryCheck.hasMissingCategories) {
                            setCategoryWarningData({
                                targetLab,
                                expectedCategories: categoryCheck.expectedCategories,
                                foundCategories: categoryCheck.foundCategories,
                                missingCategories: categoryCheck.missingCategories,
                                pendingUpload: {
                                    finalItems,
                                    addedCount,
                                    updatedCount,
                                    action,
                                    targetLab
                                }
                            });
                            setShowCategoryWarningDialog(true);
                            setIsUploading(false);
                            worker.terminate();
                            return;
                        }

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
                                navigate(`/inventario-ciclico/${encodeURIComponent(targetLab)}`);
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

                // ponytail: mapear dinámicamente cabeceras de Excel
                const headers = Array.isArray(rows[0]) ? rows[0].map(h => String(h || '').trim().toLowerCase()) : [];
                const getIndex = (names: string[], fallback: number) => {
                    const idx = headers.findIndex(h => names.includes(h));
                    return idx !== -1 ? idx : fallback;
                };

                const idProductoIndex = getIndex(['idproducto', 'id_producto', 'id_prod', 'idprod', 'id'], 0);
                const nameIndex = getIndex(['producto', 'detalle', 'name', 'nombre', 'descripcion', 'descrip'], 3);
                const qtyIndex = getIndex(['cantidad', 'cant', 'stock', 'sistema', 'systemquantity', 'system_quantity', 'cantidad_sistema'], 4);
                const categoryIndex = getIndex(['rubro', 'categoria', 'category'], 9);
                
                // Inventario Cíclico: Priorizar Columna K (índice 10: Precio / Precio Venta) que es uniforme para todas las sucursales
                const costIndex = getIndex(['precio', 'price', 'precio_venta', 'precio_publico', 'pvp', 'precio_lista', 'costo', 'cost'], 10);
                
                const codigosBarraIndex = -1; // Inventario Cíclico: ignorar columna Q (CodigosBarra)
                const eanIndex = getIndex(['codebar', 'codigobarra', 'barras', 'código de barras', 'ean'], 2);

                let addedCount = 0;
                let updatedCount = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row) continue;
                    
                    const name = row[nameIndex] ? String(row[nameIndex]).trim() : '';
                    if (!name) continue;
                    
                    const id_producto = row[idProductoIndex] ? String(row[idProductoIndex]).trim() : '';
                    // Inventario Cíclico: usar SOLO la columna C (Codebar, índice 2) como EAN único.
                    // NO usar columna Q (CodigosBarra) ni hacer split('-').
                    const ean = String(row[eanIndex] || '').trim();
                    if (!ean) continue;

                    let category = normalizeString(row[categoryIndex]?.toString() || 'Varios').toUpperCase();
                    const rawCost = row[costIndex];
                    const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

                    if (eanMap.has(ean)) {
                        const index = eanMap.get(ean);
                        const existingItem = { ...finalItems[index] };
                        const newSystemQty = Number(row[qtyIndex]) || 0;
                        finalItems[index] = {
                            ...existingItem,
                            name: name,
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
                            name: name,
                            systemQuantity: Number(row[qtyIndex]) || 0,
                            countedQuantity: Number(row[qtyIndex]) || 0,
                            cost: costValue,
                            status: 'pending',
                            category: category,
                            wasReadjusted: false,
                            id_producto: id_producto
                        });
                        addedCount++;
                    }
                }

                const excelCategoriesFromRows: string[] = Array.from(new Set<string>(
                    (rows || []).slice(1)
                        .map((r: any) => normalizeString(r[categoryIndex]?.toString() || 'VARIOS').toUpperCase())
                        .filter(Boolean)
                ));

                const categoryCheck = await checkMissingCategories(targetLab, branchName, excelCategoriesFromRows);
                if (categoryCheck.hasMissingCategories) {
                    setCategoryWarningData({
                        targetLab,
                        expectedCategories: categoryCheck.expectedCategories,
                        foundCategories: categoryCheck.foundCategories,
                        missingCategories: categoryCheck.missingCategories,
                        pendingUpload: {
                            finalItems,
                            addedCount,
                            updatedCount,
                            action,
                            targetLab
                        }
                    });
                    setShowCategoryWarningDialog(true);
                    setIsUploading(false);
                    return;
                }

                if (action === 'current' || targetLab.toUpperCase() === labName.toUpperCase()) {
                    onItemsUpdated(finalItems);
                }
                
                await cyclicInventoryService.purgeAndSaveLabInventory(branchName, targetLab, finalItems);
                notify.success("Importación Exitosa", `Se sincronizaron ${addedCount + updatedCount} productos en ${targetLab}.`);
                
                if (action === 'redirect' && targetLab.toUpperCase() !== labName.toUpperCase()) {
                    navigate(`/inventario-ciclico/${encodeURIComponent(targetLab)}`);
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

    const executeUpload = async (file: File, mode: 'merge' | 'overwrite') => {
        setIsUploading(true);
        let mergedCurrentItems: CyclicItem[] = [];

        if (mode === 'merge') {
            mergedCurrentItems = [...currentItems];
            try {
                const dbItems = await cyclicInventoryService.getLabInventory(branchName, labName);
                if (dbItems.length > 0) {
                    const allAdjusted = dbItems.every(i => i.status === 'adjusted');
                    if (allAdjusted) {
                        const confirmReajuste = window.confirm("Este laboratorio ya fue finalizado al 100%.\n\n¿Deseas realizar un re-ajuste de algunos artículos?\nSi confirmas, podrás buscarlos en la pestaña 'Ajustados' y modificar su cantidad indicando el motivo.");
                        if (!confirmReajuste) {
                            setIsUploading(false);
                            return;
                        }
                    }

                    const reactItemMap = new Map(currentItems.map(i => [String(i.ean).trim(), i]));
                    const merged: CyclicItem[] = dbItems.map(dbItem => {
                        const reactVersion = reactItemMap.get(String(dbItem.ean).trim());
                        return reactVersion || dbItem;
                    });
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
        } else {
            mergedCurrentItems = [];
        }

        const reader = new FileReader();

        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            notify.error("Formato no soportado", "La carga de archivos PDF está temporalmente deshabilitada. Por favor, utilizá un archivo Excel (.xlsx o .xls).");
            setIsUploading(false);
            return;
        }

        reader.onload = (evt) => {
            const fileContent = evt.target?.result;
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
                            .filter(lab => lab.similarity >= 0.5)
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
                    const { excelCategories, isOutdated, fileDateStr, relativeDateStr } = eMsg.data;

                    if (isOutdated) {
                        setOutdatedWarningData({
                            targetLab: labName,
                            fileDateStr: fileDateStr || 'Sin fecha',
                            relativeDateStr: relativeDateStr || 'en una fecha anterior',
                            excelCategories: excelCategories || [],
                            pendingUpload: {
                                finalItems,
                                addedCount,
                                updatedCount,
                                action: 'current',
                                targetLab: labName
                            }
                        });
                        setShowOutdatedWarningDialog(true);
                        setIsUploading(false);
                        worker.terminate();
                        return;
                    }

                    const categoryCheck = await checkMissingCategories(labName, branchName, excelCategories || []);
                    if (categoryCheck.hasMissingCategories) {
                        setCategoryWarningData({
                            targetLab: labName,
                            expectedCategories: categoryCheck.expectedCategories,
                            foundCategories: categoryCheck.foundCategories,
                            missingCategories: categoryCheck.missingCategories,
                            pendingUpload: {
                                finalItems,
                                addedCount,
                                updatedCount,
                                action: 'current',
                                targetLab: labName
                            }
                        });
                        setShowCategoryWarningDialog(true);
                        setIsUploading(false);
                        worker.terminate();
                        return;
                    }

                    onItemsUpdated(finalItems);

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
            }
        }

        await executeUpload(file, 'merge');
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

            // ponytail: mapear dinámicamente cabeceras de Excel
            const headers = Array.isArray(rows[0]) ? rows[0].map(h => String(h || '').trim().toLowerCase()) : [];
            const getIndex = (names: string[], fallback: number) => {
                const idx = headers.findIndex(h => names.includes(h));
                return idx !== -1 ? idx : fallback;
            };

            const idProductoIndex = getIndex(['idproducto', 'id_producto', 'id_prod', 'idprod', 'id'], 0);
            const nameIndex = getIndex(['producto', 'detalle', 'name', 'nombre', 'descripcion', 'descrip'], 3);
            const qtyIndex = getIndex(['cantidad', 'cant', 'stock', 'sistema', 'systemquantity', 'system_quantity', 'cantidad_sistema'], 4);
            const categoryIndex = getIndex(['rubro', 'categoria', 'category'], 9);
            
            // Inventario Cíclico: Priorizar Columna K (índice 10: Precio / Precio Venta) que es uniforme para todas las sucursales
            const costIndex = getIndex(['precio', 'price', 'precio_venta', 'precio_publico', 'pvp', 'precio_lista', 'costo', 'cost'], 10);
            
            const codigosBarraIndex = -1; // Inventario Cíclico: ignorar columna Q (CodigosBarra)
            const eanIndex = getIndex(['codebar', 'codigobarra', 'barras', 'código de barras', 'ean'], 2);

            let addedCount = 0;
            let updatedCount = 0;

            const excelCategoriesSet = new Set<string>();

            for (let i = 1; i < rows.length; i++) {
                const row: any = rows[i];
                if (!row) continue;
                
                const name = row[nameIndex] ? String(row[nameIndex]).trim() : '';
                if (!name) continue;
                
                const id_producto = row[idProductoIndex] ? String(row[idProductoIndex]).trim() : '';
                const ean = String(row[eanIndex] || '').trim();
                if (!ean) continue;

                let category = normalizeString(row[categoryIndex]?.toString() || 'Varios').toUpperCase();
                if (category) excelCategoriesSet.add(category);

                const rawCost = row[costIndex];
                const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

                if (eanMap.has(ean)) {
                    const index = eanMap.get(ean);
                    const existingItem = { ...finalItems[index] };
                    const newSystemQty = Number(row[qtyIndex]) || 0;
                    finalItems[index] = {
                        ...existingItem,
                        name: name,
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
                        name: name,
                        systemQuantity: Number(row[qtyIndex]) || 0,
                        countedQuantity: Number(row[qtyIndex]) || 0,
                        cost: costValue,
                        status: 'pending',
                        category: category,
                        wasReadjusted: false,
                        id_producto: id_producto
                    });
                    addedCount++;
                }
            }

            // Validar si faltan rubros autorizados (evaluando únicamente las categorías del Excel)
            const categoryCheck = await checkMissingCategories(labName, branchName, Array.from(excelCategoriesSet));
            if (categoryCheck.hasMissingCategories) {
                setCategoryWarningData({
                    targetLab: labName,
                    expectedCategories: categoryCheck.expectedCategories,
                    foundCategories: categoryCheck.foundCategories,
                    missingCategories: categoryCheck.missingCategories,
                    pendingUpload: {
                        finalItems,
                        addedCount,
                        updatedCount,
                        action: 'current',
                        targetLab: labName
                    }
                });
                setShowCategoryWarningDialog(true);
                setIsUploading(false);
                return;
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

    const handleResolveCategoryWarning = async (action: 'proceed' | 'cancel') => {
        if (action === 'cancel' || !categoryWarningData) {
            setShowCategoryWarningDialog(false);
            setCategoryWarningData(null);
            setIsUploading(false);
            return;
        }

        const { pendingUpload } = categoryWarningData;
        const { finalItems, addedCount, updatedCount, action: uploadAction, targetLab } = pendingUpload;

        setIsUploading(true);
        setShowCategoryWarningDialog(false);

        try {
            if (uploadAction === 'current' || targetLab.toUpperCase() === labName.toUpperCase()) {
                onItemsUpdated(finalItems);
            }

            await cyclicInventoryService.purgeAndSaveLabInventory(branchName, targetLab, finalItems);

            if (addedCount > 0 || updatedCount > 0) {
                notify.success("Carga exitosa", `Se importaron ${addedCount} productos nuevos y ${updatedCount} existentes en ${targetLab}.`);
            } else {
                notify.info("Sin cambios", `Todos los productos en el archivo ya estaban procesados.`);
            }

            if (uploadAction === 'redirect' && targetLab.toUpperCase() !== labName.toUpperCase()) {
                navigate(`/inventario-ciclico/${encodeURIComponent(targetLab)}`);
            }
        } catch (err) {
            console.error("Failed to save after upload (warning bypass):", err);
            notify.error("Error al guardar", "Se procesó el archivo pero hubo un problema al guardar.");
        } finally {
            setIsUploading(false);
            setCategoryWarningData(null);
        }
    };

    const handleResolveOutdatedWarning = async (action: 'proceed' | 'cancel') => {
        if (action === 'cancel' || !outdatedWarningData) {
            setShowOutdatedWarningDialog(false);
            setOutdatedWarningData(null);
            setIsUploading(false);
            return;
        }

        const { pendingUpload, excelCategories } = outdatedWarningData;
        const { finalItems, addedCount, updatedCount, action: uploadAction, targetLab } = pendingUpload;

        setIsUploading(true);
        setShowOutdatedWarningDialog(false);

        try {
            // Chained validation: Check missing categories after outdated warning is resolved
            const categoryCheck = await checkMissingCategories(targetLab, branchName, excelCategories || []);
            if (categoryCheck.hasMissingCategories) {
                setCategoryWarningData({
                    targetLab,
                    expectedCategories: categoryCheck.expectedCategories,
                    foundCategories: categoryCheck.foundCategories,
                    missingCategories: categoryCheck.missingCategories,
                    pendingUpload: {
                        finalItems,
                        addedCount,
                        updatedCount,
                        action: uploadAction,
                        targetLab
                    }
                });
                setShowCategoryWarningDialog(true);
                setIsUploading(false);
                setOutdatedWarningData(null);
                return;
            }

            if (uploadAction === 'current' || targetLab.toUpperCase() === labName.toUpperCase()) {
                onItemsUpdated(finalItems);
            }

            await cyclicInventoryService.purgeAndSaveLabInventory(branchName, targetLab, finalItems);

            if (addedCount > 0 || updatedCount > 0) {
                notify.success("Carga exitosa", `Se importaron ${addedCount} productos nuevos y ${updatedCount} existentes en ${targetLab}.`);
            } else {
                notify.info("Sin cambios", `Todos los productos en el archivo ya estaban procesados.`);
            }

            if (uploadAction === 'redirect' && targetLab.toUpperCase() !== labName.toUpperCase()) {
                navigate(`/inventario-ciclico/${encodeURIComponent(targetLab)}`);
            }
        } catch (err) {
            console.error("Failed to save after upload (outdated warning bypass):", err);
            notify.error("Error al guardar", "Se procesó el archivo pero hubo un problema al guardar.");
        } finally {
            setIsUploading(false);
            setOutdatedWarningData(null);
        }
    };

    return {
        isUploading,
        handleFileUpload,
        handleElectronImport,
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
        handleResolveOutdatedWarning
    };
}
