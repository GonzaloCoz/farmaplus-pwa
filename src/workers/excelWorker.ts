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
    const { fileData, labName, branchName, currentItems } = e.data;

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

        // 3. Verificación de Laboratorio (Strict matching)
        const currentLab = normalizeStringWorker(labName);
        const currentBranch = normalizeStringWorker(branchName || "");
        const uploadLab = normalizeStringWorker(fileLabName);

        // El archivo es válido si coincide EXACTAMENTE con el laboratorio O con la sucursal
        // (A veces el Excel trae el nombre de sucursal en lugar de laboratorio para inventarios generales)
        if (uploadLab !== currentLab && uploadLab !== currentBranch) {
            self.postMessage({ 
                error: `El archivo pertenece a "${fileLabName}", pero estás intentando cargar datos para "${labName}" en "${branchName}".` 
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
            const rawEan = row[2];
            if (!rawEan) continue;
            const ean = String(rawEan).trim();
            if (!ean) continue;

            let category = normalizeStringWorker(row[9]?.toString() || 'Varios');
            const rawCost = row[10];
            const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

            if (eanMap.has(ean)) {
                const index = eanMap.get(ean);
                const existingItem = { ...finalItems[index] };

                // Si ya fue controlado o ajustado, mantenemos su estado y cantidad contada
                // Pero actualizamos los datos básicos del sistema que vienen del nuevo Excel
                finalItems[index] = {
                    ...existingItem,
                    name: row[3],
                    systemQuantity: Number(row[4]) || 0,
                    cost: costValue,
                    category: category
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
                wasReadjusted: false
            });
            addedCount++;
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
