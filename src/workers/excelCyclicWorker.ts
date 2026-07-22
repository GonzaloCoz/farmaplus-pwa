import * as XLSX from 'xlsx';

// Constantes típicamente usadas en la aplicación
const CATEGORIES = ["Medicamentos", "Perfumería", "ACCESORIOS", "VARIOS"];

/**
 * Normalización básica de strings para comparación dentro del worker
 */
const normalizeStringWorker = (str: string): string => {
    if (!str) return '';
    return str
        .toUpperCase()
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
        const finalItems: any[] = [...currentItems];
        
        const eanMap = new Map();
        finalItems.forEach((item, index) => {
            eanMap.set(String(item.ean).trim(), index);
        });

        // ponytail: mapear dinámicamente cabeceras de Excel para soportar variaciones de columnas (Plex, preconteo, etc)
        const headers = Array.isArray(data[0]) ? data[0].map(h => String(h || '').trim().toLowerCase()) : [];
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
        
        // Inventario Cíclico: ignorar columna Q (CodigosBarra) - se reserva para inventarios nocturnos.
        // Usar SOLO la columna C (codebar, índice 2) como EAN único por producto.
        const eanIndex = getIndex(['codebar', 'codigobarra', 'barras', 'código de barras', 'ean'], 2);

        let addedCount = 0;
        let updatedCount = 0;

        const excelCategoriesSet = new Set<string>();

        for (let i = 1; i < data.length; i++) {
            const row: any = data[i];
            if (!row) continue;
            
            const name = row[nameIndex] ? String(row[nameIndex]).trim() : '';
            if (!name) continue;
            
            const id_producto = row[idProductoIndex] ? String(row[idProductoIndex]).trim() : '';

            // Inventario Cíclico: EAN único desde columna C, sin split ni expansión.
            const ean = String(row[eanIndex] || '').trim();
            if (!ean) continue;

            const category = normalizeStringWorker(row[categoryIndex]?.toString() || 'Varios');
            if (category) excelCategoriesSet.add(category.toUpperCase());

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
                // EAN nuevo: agregar como pendiente
                finalItems.push({
                    id: self.crypto.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2),
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

        self.postMessage({
            success: true,
            finalItems,
            addedCount,
            updatedCount,
            excelCategories: Array.from(excelCategoriesSet)
        });

    } catch (err: any) {
        self.postMessage({ error: "Error procesando el archivo: " + err.message });
    }
};
