import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configurar el worker de pdfjs internamente
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const normalizeStringWorker = (str: string): string => {
    if (!str) return '';
    return str
        .toUpperCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

/**
 * Parsear un valor monetario argentino.
 * Ejemplos: "15.108,82" -> 15108.82, "0,00" -> 0, "108,82" -> 108.82
 */
const parseCurrency = (s: string): number => {
    if (!s) return 0;
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

interface TextItem {
    str: string;
    x: number;
    y: number;
    width: number;
}

interface ColumnDef {
    name: string;
    x: number; // posición X del encabezado
}

/**
 * Agrupar items por coordenada Y con tolerancia de ±2px.
 */
const groupByLine = (items: TextItem[]): Map<number, TextItem[]> => {
    const linesMap = new Map<number, TextItem[]>();
    for (const item of items) {
        const y = Math.round(item.y);
        let foundY = y;
        for (const key of linesMap.keys()) {
            if (Math.abs(key - y) <= 2) {
                foundY = key;
                break;
            }
        }
        if (!linesMap.has(foundY)) linesMap.set(foundY, []);
        linesMap.get(foundY)!.push(item);
    }
    return linesMap;
};

/**
 * Buscar la línea de encabezado de la tabla que contiene los nombres de columnas.
 * Retorna las definiciones de columnas y la Y del encabezado.
 */
const findTableHeader = (
    linesMap: Map<number, TextItem[]>,
    sortedY: number[]
): { columns: ColumnDef[]; headerY: number } | null => {
    // Palabras clave que identifican la fila de encabezado de la tabla
    const HEADER_KEYWORDS = ['troquel', 'barras', 'producto', 'cajas'];

    for (const y of sortedY) {
        const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
        const lineText = lineItems.map(it => it.str.toLowerCase()).join(' ');

        // La línea de encabezado debe contener al menos 2 de las palabras clave
        const matchCount = HEADER_KEYWORDS.filter(kw => lineText.includes(kw)).length;
        if (matchCount >= 2) {
            const columns: ColumnDef[] = [];
            for (const item of lineItems) {
                const lower = item.str.toLowerCase().trim();
                if (!lower) continue;

                if (lower.includes('troquel')) columns.push({ name: 'troquel', x: item.x });
                else if (lower.includes('barras') || lower === 'cód.' || lower === 'cod.') columns.push({ name: 'ean', x: item.x });
                else if (lower.includes('producto')) columns.push({ name: 'producto', x: item.x });
                else if (lower.includes('cajas') || lower.includes('unid')) columns.push({ name: 'cantidad', x: item.x });
                else if (lower === 'mín.' || lower === 'min.' || lower === 'min') columns.push({ name: 'minimo', x: item.x });
                else if (lower === 'pvp' && !columns.find(c => c.name === 'pvp')) columns.push({ name: 'pvp', x: item.x });
                else if (lower === 'total' || lower === 'pvp total') {
                    if (!columns.find(c => c.name === 'pvpTotal')) columns.push({ name: 'pvpTotal', x: item.x });
                    else if (!columns.find(c => c.name === 'costoTotal')) columns.push({ name: 'costoTotal', x: item.x });
                }
                else if (lower.includes('costo') && !columns.find(c => c.name === 'costo')) columns.push({ name: 'costo', x: item.x });
            }

            if (columns.find(c => c.name === 'ean') || columns.find(c => c.name === 'producto')) {
                return { columns, headerY: y };
            }
        }
    }
    return null;
};

/**
 * Para un item de texto con posición X, determinar a qué columna pertenece
 * basándose en las posiciones X de los encabezados detectadas dinámicamente.
 * 
 * Asignamos al item la columna cuyo encabezado X esté más cerca sin superarlo,
 * o la columna más cercana si está a una distancia razonable.
 */
const classifyToColumn = (itemX: number, columns: ColumnDef[]): string | null => {
    // Ordenar columnas por X
    const sorted = [...columns].sort((a, b) => a.x - b.x);

    // Buscar la columna cuyo X inicio sea <= itemX y el siguiente X inicio sea > itemX
    for (let i = sorted.length - 1; i >= 0; i--) {
        // El item debe estar a la derecha del inicio de la columna (con tolerancia de 10px a la izquierda)
        if (itemX >= sorted[i].x - 10) {
            // Verificar que no esté más cerca de la siguiente columna
            if (i < sorted.length - 1) {
                const distToCurrent = itemX - sorted[i].x;
                const distToNext = sorted[i + 1].x - itemX;
                // Si está mucho más cerca de la siguiente, asignar a la siguiente
                if (distToNext < distToCurrent * 0.3 && distToNext < 15) {
                    return sorted[i + 1].name;
                }
            }
            return sorted[i].name;
        }
    }

    return null;
};

self.onmessage = async (e: MessageEvent) => {
    const { fileData, labName, branchName, currentItems } = e.data;

    try {
        const loadingTask = pdfjsLib.getDocument({ data: fileData });
        const pdf = await loadingTask.promise;

        self.postMessage({ type: 'debug', message: `PDF cargado. Páginas: ${pdf.numPages}` });

        let fileLabName = "";
        const allExtractedProducts: any[] = [];

        // --- Procesar CADA PÁGINA por separado ---
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();

            // Extraer items de texto con coordenadas
            const pageItems: TextItem[] = [];
            for (const item of content.items as any[]) {
                const str = item.str;
                if (str === undefined || str === null) continue;
                // Mantener strings con espacios para no perder separadores
                if (str.trim() === '') continue;
                pageItems.push({
                    str: str.trim(),
                    x: Math.round(item.transform[4]),
                    y: Math.round(item.transform[5]),
                    width: Math.round(item.width || 0),
                });
            }

            // Agrupar por línea dentro de esta página
            const linesMap = groupByLine(pageItems);
            const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a); // arriba a abajo

            // --- Buscar laboratorio solo en la primera página ---
            if (pageNum === 1 && !fileLabName) {
                for (const y of sortedY) {
                    const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
                    const fullLine = lineItems.map(it => it.str).join(' ');

                    if (fullLine.includes('Laboratorio:')) {
                        const match = fullLine.match(/Laboratorio:\s*(.+)/i);
                        if (match) {
                            // Limpiar: tomar solo la primera ocurrencia y quitar texto residual
                            let labValue = match[1].trim();
                            // Si el valor contiene "Laboratorio:" de nuevo, cortarlo
                            const secondIdx = labValue.indexOf('Laboratorio:');
                            if (secondIdx > 0) labValue = labValue.substring(0, secondIdx).trim();
                            // Si contiene "Sucursal:", cortarlo
                            const sucIdx = labValue.indexOf('Sucursal:');
                            if (sucIdx > 0) labValue = labValue.substring(0, sucIdx).trim();
                            fileLabName = labValue;
                            break;
                        }
                    }
                }
            }

            // --- Detectar encabezado de tabla dinámicamente ---
            const headerResult = findTableHeader(linesMap, sortedY);
            if (!headerResult) {
                self.postMessage({ type: 'debug', message: `Página ${pageNum}: No se encontró encabezado de tabla.` });
                continue;
            }

            const { columns, headerY } = headerResult;
            self.postMessage({
                type: 'debug',
                message: `Página ${pageNum}: Encabezado en Y=${headerY}. Columnas: ${columns.map(c => `${c.name}(x=${c.x})`).join(', ')}`
            });

            // --- Extraer productos: líneas DEBAJO del encabezado ---
            let pageProductCount = 0;

            for (const y of sortedY) {
                // Solo procesar líneas que estén por debajo del encabezado (Y menor en coords PDF)
                if (y >= headerY) continue;
                // Ignorar pie de página (muy abajo)
                if (y <= 30) continue;

                const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);

                // Clasificar cada item en su columna
                const colValues: Record<string, string[]> = {};
                for (const item of lineItems) {
                    const col = classifyToColumn(item.x, columns);
                    if (col) {
                        if (!colValues[col]) colValues[col] = [];
                        colValues[col].push(item.str);
                    }
                }

                // Obtener valores de cada columna
                const eanRaw = (colValues['ean'] || []).join('').replace(/\s/g, '');
                const productoRaw = (colValues['producto'] || []).join(' ').trim();

                // Una línea de producto DEBE tener un EAN numérico válido
                if (!eanRaw || !/^\d{7,14}$/.test(eanRaw)) continue;
                if (!productoRaw) continue;

                // Cantidad - puede ser "3" o vacío
                const cantidadRaw = (colValues['cantidad'] || []).join('').replace(/\s/g, '');
                const cantidad = parseInt(cantidadRaw, 10) || 0;

                // Costo unitario
                const costoRaw = (colValues['costo'] || []).join('').trim();
                const costo = parseCurrency(costoRaw);

                allExtractedProducts.push({
                    ean: eanRaw,
                    name: productoRaw,
                    systemQuantity: cantidad,
                    cost: Math.round(costo * 100) / 100,
                    category: 'Varios',
                });

                pageProductCount++;
            }

            self.postMessage({
                type: 'debug',
                message: `Página ${pageNum}: ${pageProductCount} productos extraídos.`
            });
        }

        self.postMessage({
            type: 'debug',
            message: `Total: ${allExtractedProducts.length} productos. Laboratorio: "${fileLabName}"`
        });

        // --- Validar laboratorio ---
        if (!fileLabName) {
            self.postMessage({ error: "No se pudo identificar el laboratorio en el archivo PDF." });
            return;
        }

        const currentLab = normalizeStringWorker(labName);
        const currentBranch = normalizeStringWorker(branchName || "");
        const uploadLab = normalizeStringWorker(fileLabName);

        if (uploadLab !== currentLab && uploadLab !== currentBranch) {
            self.postMessage({
                error: `El archivo pertenece a "${fileLabName}", pero estás intentando cargar datos para "${labName}".`
            });
            return;
        }

        if (allExtractedProducts.length === 0) {
            self.postMessage({ error: "No se encontraron productos en el archivo PDF. Verificá que el formato sea correcto." });
            return;
        }

        // --- Merge con items existentes (misma lógica que excelWorker) ---
        const finalItems: any[] = [...currentItems];

        const eanMap = new Map();
        finalItems.forEach((item, index) => {
            eanMap.set(String(item.ean).trim(), index);
        });

        let addedCount = 0;
        let updatedCount = 0;

        for (const ep of allExtractedProducts) {
            if (eanMap.has(ep.ean)) {
                const index = eanMap.get(ep.ean);
                const existingItem = { ...finalItems[index] };

                finalItems[index] = {
                    ...existingItem,
                    name: ep.name,
                    systemQuantity: ep.systemQuantity,
                    cost: ep.cost,
                    category: ep.category,
                };
                updatedCount++;
            } else {
                const newItem = {
                    id: self.crypto.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2),
                    ean: ep.ean,
                    name: ep.name,
                    systemQuantity: ep.systemQuantity,
                    countedQuantity: ep.systemQuantity,
                    cost: ep.cost,
                    status: 'pending',
                    category: ep.category,
                    wasReadjusted: false,
                };
                finalItems.push(newItem);
                eanMap.set(ep.ean, finalItems.length - 1);
                addedCount++;
            }
        }

        self.postMessage({
            success: true,
            finalItems,
            addedCount,
            updatedCount,
        });

    } catch (err: any) {
        self.postMessage({ error: "Error procesando el archivo PDF: " + err.message });
    }
};
