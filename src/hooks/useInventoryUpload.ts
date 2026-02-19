import { useState } from 'react';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { normalizeString } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';

// Define categories to avoid circular dependency or redefine
const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

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

        // Check lock status before allowing upload (branch users only)
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
                // Continue with upload if lock check fails (fail open)
            }
        }

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // VERIFICACION DE LABORATORIO
                let fileLabName = "";
                // Escaneamos las primeras 20 filas buscando datos confiables
                for (let r = 1; r < Math.min(data.length, 20); r++) {
                    const row: any = data[r];
                    if (row && row[14]) { // Columna O
                        fileLabName = String(row[14]).trim();
                        break;
                    }
                }

                if (!fileLabName) {
                    notify.error("Archivo inválido", "No se pudo identificar el laboratorio en el archivo (Columna O)");
                    setIsUploading(false);
                    return;
                }

                // Normalizamos nombres
                const currentLab = labName.toUpperCase().trim();
                const uploadLab = fileLabName.toUpperCase().trim();

                if (currentLab !== uploadLab) {
                    if (!uploadLab.includes(currentLab) && !currentLab.includes(uploadLab)) {
                        notify.error("Laboratorio incorrecto", `El archivo pertenece a "${fileLabName}", pero estás en "${labName}"`);
                        setIsUploading(false);
                        return;
                    }
                }

                // --- NEW: Identify categories and EANs in the uploaded file to clear residue ---
                const categoriesInFile = new Set<string>();
                const eansInFile = new Set<string>();

                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || !row[3]) continue;

                    const ean = String(row[2] || '').trim();
                    if (ean) eansInFile.add(ean);

                    let category = normalizeString(row[9]?.toString() || 'Varios');
                    categoriesInFile.add(category);
                }

                // Lab-Wide Master Sync Logic: Treat Excel as source of truth for the ENTIRE LABORATORY
                const finalItems: CyclicItem[] = currentItems.filter(item => {
                    // 1. Pending items are always removed (the Excel has the new pendants for the lab)
                    if (item.status === 'pending') return false;

                    // 2. Controlled/Adjusted items are kept ONLY if their EAN is in the new Excel
                    // This prevents residues from products that no longer belong to this laboratory in any rubric
                    if (eansInFile.has(String(item.ean).trim())) {
                        return true;
                    }

                    console.log(`Removing laboratory residue item: ${item.name} (${item.ean}) - No presente en el nuevo archivo`);
                    return false;
                });

                const eanMap = new Map();
                finalItems.forEach((item, index) => {
                    eanMap.set(String(item.ean).trim(), index);
                });

                let addedCount = 0;
                let updatedCount = 0;

                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || !row[3]) continue;

                    const rawEan = row[2]; // Column C
                    if (!rawEan) continue;

                    const ean = String(rawEan).trim();
                    if (!ean) continue;

                    let category = normalizeString(row[9]?.toString() || 'Varios');

                    const rawCost = row[10]; // Column K
                    const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

                    if (eanMap.has(ean)) {
                        const index = eanMap.get(ean);
                        const existingItem = finalItems[index];

                        // For adjusted or controlled items: update cost and system quantity, but keep counted quantity and status
                        if (existingItem.status === 'controlled' || existingItem.status === 'adjusted') {
                            finalItems[index] = {
                                ...existingItem,
                                name: row[3], // Column D
                                systemQuantity: Number(row[4]) || 0, // Column E
                                cost: costValue, // Column M - UPDATE COST
                                category: category
                                // Keep: countedQuantity, status
                            };
                            updatedCount++;
                            continue;
                        }

                        // For pending items: reset everything (shouldn't happen often now because we filtered them above)
                        finalItems[index] = {
                            ...existingItem,
                            name: row[3], // Column D
                            systemQuantity: Number(row[4]) || 0, // Column E
                            countedQuantity: Number(row[4]) || 0, // Reset to match system
                            cost: costValue, // Column M
                            category: category,
                            status: 'pending'
                        };
                        updatedCount++;
                        continue;
                    }

                    finalItems.push({
                        id: crypto.randomUUID(),
                        ean: ean,
                        name: row[3], // Column D
                        systemQuantity: Number(row[4]) || 0, // Column E
                        countedQuantity: Number(row[4]) || 0,
                        cost: costValue, // Column M
                        status: 'pending',
                        category: category,
                        wasReadjusted: false
                    });
                    addedCount++;
                }

                onItemsUpdated(finalItems);

                // Save immediately with residue cleanup
                const categoriesList = Array.from(categoriesInFile);

                const saveWithCleanup = async () => {
                    try {
                        // 1. Algoritmo de Sincronización de Hierro (Ironclad Sync)
                        // Borra TODO el laboratorio de la DB antes de guardar el nuevo estado del Excel
                        await cyclicInventoryService.purgeAndSaveLabInventory(branchName, labName, finalItems);
                        console.log("Ironclad Sync completado con éxito.");
                    } catch (err) {
                        console.error("Failed to save after upload:", err);
                        notify.error("Error al guardar", "Se cargó el archivo pero hubo un problema al sincronizar con la nube.");
                    }
                };

                saveWithCleanup();

                if (addedCount > 0 || updatedCount > 0) {
                    notify.success("Carga exitosa", `${addedCount} nuevos, ${updatedCount} actualizados`);
                } else {
                    notify.info("Sin cambios", `Todos los productos ya estaban procesados`);
                }

            } catch (error) {
                console.error("Error reading file:", error);
                notify.error("Error de archivo", "No se pudo procesar el archivo Excel");
            } finally {
                setIsUploading(false);
                e.target.value = ''; // Reset input
            }
        };

        reader.readAsBinaryString(file);
    };

    return {
        isUploading,
        handleFileUpload
    };
}
