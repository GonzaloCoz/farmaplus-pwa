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
        const wb = XLSX.read(fileData, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 1.b Evaluación de fecha de emisión del reporte
        let fileCreationDate: Date | null = null;
        const props = wb.Props as any;
        if (props && (props.Created || props.Modified || props.CreatedDate || props.ModifiedDate)) {
            fileCreationDate = new Date(props.Created || props.Modified || props.CreatedDate || props.ModifiedDate);
        } else if (e.data.lastModified) {
            fileCreationDate = new Date(e.data.lastModified);
        }

        let isOutdated = false;
        let fileDateStr = "";
        let relativeDateStr = "";

        if (fileCreationDate && !isNaN(fileCreationDate.getTime())) {
            fileDateStr = fileCreationDate.toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const fileDay = new Date(fileCreationDate.getFullYear(), fileCreationDate.getMonth(), fileCreationDate.getDate());
            const diffDays = Math.round((today.getTime() - fileDay.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                relativeDateStr = "en la madrugada de hoy";
            } else if (diffDays === 1) {
                relativeDateStr = "el día de ayer";
            } else if (diffDays === 2) {
                relativeDateStr = "antes de ayer";
            } else if (diffDays >= 3 && diffDays <= 6) {
                relativeDateStr = `hace ${diffDays} días`;
            } else if (diffDays >= 7 && diffDays <= 13) {
                relativeDateStr = "hace 1 semana";
            } else if (diffDays >= 14 && diffDays <= 29) {
                const weeks = Math.floor(diffDays / 7);
                relativeDateStr = `hace ${weeks} semanas`;
            } else if (diffDays >= 30 && diffDays <= 59) {
                relativeDateStr = "hace 1 mes";
            } else if (diffDays >= 60) {
                const months = Math.floor(diffDays / 30);
                relativeDateStr = `hace ${months} meses`;
            } else {
                relativeDateStr = "en una fecha anterior";
            }

            const opStart = new Date(now);
            if (now.getHours() < 7) {
                opStart.setDate(opStart.getDate() - 1);
            }
            opStart.setHours(7, 0, 0, 0);

            const opEnd = new Date(opStart);
            opEnd.setDate(opEnd.getDate() + 1);
            opEnd.setHours(1, 0, 0, 0);

            if (fileCreationDate < opStart || fileCreationDate > opEnd) {
                isOutdated = true;
            }
        }

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
        
        const eanMap = new Map<string, number>();
        const idProdMap = new Map<string, number>();

        finalItems.forEach((item, index) => {
            const itemEan = String(item.ean || '').trim();
            if (itemEan) eanMap.set(itemEan, index);
            const itemIdProd = String(item.id_producto || '').trim();
            if (itemIdProd) idProdMap.set(itemIdProd, index);
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

            // Si el EAN es 0, vacío o s/n, usamos el IDProducto como identificador único para que no choquen entre sí
            const rawEan = String(row[eanIndex] || '').trim();
            let effectiveEan = rawEan;
            if (!effectiveEan || effectiveEan === '0' || effectiveEan === '00' || effectiveEan.toLowerCase() === 's/n' || effectiveEan.toLowerCase() === 'sin barra') {
                if (id_producto) {
                    effectiveEan = id_producto;
                }
            }
            if (!effectiveEan) continue;

            const category = normalizeStringWorker(row[categoryIndex]?.toString() || 'Varios');
            if (category) excelCategoriesSet.add(category.toUpperCase());

            const rawCost = row[costIndex];
            const costValue = Math.round((Number(rawCost) || 0) * 100) / 100;

            // Determinar si ya existe el ítem:
            // 1. Por IDProducto (si existe en ambos)
            // 2. Por effectiveEan
            let existingIndex = -1;
            if (id_producto && idProdMap.has(id_producto)) {
                existingIndex = idProdMap.get(id_producto)!;
            } else if (eanMap.has(effectiveEan)) {
                existingIndex = eanMap.get(effectiveEan)!;
            }

            if (existingIndex !== -1) {
                const existingItem = { ...finalItems[existingIndex] };
                const newSystemQty = Number(row[qtyIndex]) || 0;

                finalItems[existingIndex] = {
                    ...existingItem,
                    name: name,
                    ean: effectiveEan,
                    systemQuantity: newSystemQty,
                    countedQuantity: existingItem.status === 'pending' ? newSystemQty : existingItem.countedQuantity,
                    cost: costValue,
                    category: category,
                    id_producto: id_producto || existingItem.id_producto
                };
                
                updatedCount++;
            } else {
                // Producto nuevo: agregar como pendiente
                const newItem = {
                    id: self.crypto.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2),
                    ean: effectiveEan,
                    name: name,
                    systemQuantity: Number(row[qtyIndex]) || 0,
                    countedQuantity: Number(row[qtyIndex]) || 0,
                    cost: costValue,
                    status: 'pending',
                    category: category,
                    wasReadjusted: false,
                    id_producto: id_producto
                };
                finalItems.push(newItem);
                const newIdx = finalItems.length - 1;
                eanMap.set(effectiveEan, newIdx);
                if (id_producto) {
                    idProdMap.set(id_producto, newIdx);
                }
                addedCount++;
            }
        }

        self.postMessage({
            success: true,
            finalItems,
            addedCount,
            updatedCount,
            excelCategories: Array.from(excelCategoriesSet),
            isOutdated,
            fileDateStr,
            relativeDateStr
        });

    } catch (err: any) {
        self.postMessage({ error: "Error procesando el archivo: " + err.message });
    }
};
