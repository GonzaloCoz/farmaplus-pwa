import * as XLSX from 'xlsx';

// Constantes típicamente usadas en la aplicación
const CATEGORIES = ["Medicamentos", "Perfumería", "ACCESORIOS", "VARIOS"];

/**
 * Normalización básica de strings para comparación dentro del worker
 */
const normalizeStringWorker = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

self.onmessage = async (e: MessageEvent) => {
    const { fileData, labName, branchName, currentItems, bypassLabCheck } = e.data;

    try {
        // 1. Procesar Excel
        const wb = XLSX.read(fileData, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 2. Identificar Laboratorio
        let fileLabName = "";
        for (let r = 1; r < Math.min(data.length, 20); r++) {
            const row: any = data[r];
            if (row && row[14]) { // Columna O
                fileLabName = String(row[14]).trim();
                break;
            }
        }

        if (!fileLabName) {
            self.postMessage({ error: "No se pudo identificar el laboratorio en el archivo (Columna O)" });
            return;
        }

        // 3. Verificación de Laboratorio
        const currentLab = normalizeStringWorker(labName);
        const currentBranch = normalizeStringWorker(branchName || "");
        const uploadLab = normalizeStringWorker(fileLabName);

        // El archivo es válido si coincide EXACTAMENTE con el laboratorio O con la sucursal, o si se saltea la verificación
        if (!bypassLabCheck && uploadLab !== currentLab && uploadLab !== currentBranch) {
            self.postMessage({ 
                type: 'mismatch',
                fileLabName
            });
            return;
        }

        // 4. Lógica de Procesamiento (Sincronización Maestra - MODO MERGE)
        // Ya no filtramos currentItems destructivamente. Los mantenemos todos.
        // Esto permite que el nuevo Excel rellene los huecos sin pisar lo ya hecho.
        const finalItems: any[] = [...currentItems];
        
        const eanMap = new Map();
        finalItems.forEach((item, index) => {
            eanMap.set(String(item.ean).trim(), index);
        });

        let addedCount = 0;
        let updatedCount = 0;

        for (let i = 1; i < data.length; i++) {
            const row: any = data[i];
            if (!row || !row[3]) continue;
            
            // Columna A (index 0) - IDProducto
            const id_producto = row[0] ? String(row[0]).trim() : '';

            // Columna Q (index 16) - CodigosBarra
            const rawEan = row[16];
            if (!rawEan) continue;
            const eanList = String(rawEan).split('-').map(e => e.trim()).filter(e => e.length > 0);
            if (eanList.length === 0) continue;

            let category = normalizeStringWorker(row[9]?.toString() || 'Varios');
            const rawCost = row[10];
            const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

            for (const ean of eanList) {
                if (eanMap.has(ean)) {
                    const index = eanMap.get(ean);
                    const existingItem = { ...finalItems[index] };
                    const newSystemQty = Number(row[4]) || 0;

                    // Si ya fue controlado o ajustado, mantenemos su estado y cantidad contada
                    // Pero actualizamos los datos básicos del sistema que vienen del nuevo Excel
                    // Si el producto aún está pendiente, actualizamos también la cantidad física contada.
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
                    continue;
                }

                // Si es un EAN nuevo, lo agregamos como pendiente
                finalItems.push({
                    id: self.crypto.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2),
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

        self.postMessage({
            success: true,
            finalItems,
            addedCount,
            updatedCount
        });

    } catch (err: any) {
        self.postMessage({ error: "Error procesando el archivo: " + err.message });
    }
};
