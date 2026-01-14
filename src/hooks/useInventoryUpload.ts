import { useState } from 'react';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notifications';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

                // Merge Logic
                const finalItems: CyclicItem[] = [...currentItems];
                const eanMap = new Map();
                finalItems.forEach((item, index) => {
                    eanMap.set(String(item.ean).trim(), index);
                });

                let addedCount = 0;
                let updatedCount = 0;
                let ignoredCount = 0;

                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || !row[3]) continue;

                    const rawEan = row[2]; // Column C
                    if (!rawEan) continue;

                    const ean = String(rawEan).trim();
                    if (!ean) continue;

                    let category = row[9]?.toString().trim(); // Column J
                    if (category) {
                        if (category === "Medicamento") category = "Medicamentos";
                        if (category === "Perfumeria") category = "Perfumería";
                    }
                    if (!category || !CATEGORIES.includes(category)) category = "Varios";

                    const rawCost = row[12]; // Column M
                    const costValue = Number(rawCost) || 0;

                    // Debug logging
                    console.log(`📊 EAN: ${ean}, Name: ${row[3]}, Raw Cost (Col M): ${rawCost}, Parsed Cost: ${costValue}`);

                    if (eanMap.has(ean)) {
                        const index = eanMap.get(ean);
                        const existingItem = finalItems[index];

                        // Skip adjusted items completely (they are finalized)
                        if (existingItem.status === 'adjusted') {
                            ignoredCount++;
                            continue;
                        }

                        // For controlled items: update cost and system quantity, but keep counted quantity and status
                        if (existingItem.status === 'controlled') {
                            finalItems[index] = {
                                ...existingItem,
                                name: row[3], // Column D
                                systemQuantity: Number(row[4]) || 0, // Column E
                                cost: costValue, // Column M - UPDATE COST
                                category: category
                                // Keep: countedQuantity, status: 'controlled'
                            };
                            console.log(`✅ Updated CONTROLLED item: ${ean}, Old Cost: ${existingItem.cost}, New Cost: ${costValue}`);
                            updatedCount++;
                            continue;
                        }

                        // For pending items: reset everything
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

                // Save immediately
                cyclicInventoryService.saveInventory(branchName, labName, finalItems)
                    .then(() => console.log("Auto-save after upload success"))
                    .catch(err => console.error("Auto-save failed", err));

                if (addedCount > 0 || updatedCount > 0) {
                    notify.success("Carga exitosa", `${addedCount} nuevos, ${updatedCount} actualizados`);
                } else {
                    notify.info("Sin cambios", `${ignoredCount} productos ya estaban procesados`);
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
