import * as XLSX from 'xlsx';

interface MasterCatalogItem {
    ean: string;
    eans: string[];
    isPrimaryEan: boolean;
    id_producto: string;
    name: string;
    systemStock: number;
    cost: number;
    salePrice: number;
    laboratory: string;
    rubro?: string;
}

self.onmessage = async (e: MessageEvent) => {
    const { fileData, rows: inputRows } = e.data;

    try {
        let rows: any[][] = [];

        if (fileData) {
            const wb = XLSX.read(fileData, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            rows = data.slice(1); // skip headers
        } else if (inputRows) {
            rows = inputRows.slice(1); // skip headers
        }

        const catalog: MasterCatalogItem[] = [];

        rows.forEach((row) => {
            if (!row || !row[0]) return; // Requiere Columna A (ID)

            const idProducto = String(row[0]).trim();
            const rawEans = String(row[15] || '').trim(); // Columna P
            
            let eanList = rawEans.split('-').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
            
            // Fallback a Columna C (Codebar) si Columna P está vacía
            if (eanList.length === 0) {
                const fallbackEan = String(row[2] || '').trim();
                if (fallbackEan) {
                    eanList = [fallbackEan];
                }
            }

            if (eanList.length === 0) return;

            const name = String(row[3] || 'Sin Nombre').trim(); // Columna D
            const systemStock = Number(row[4]) || 0; // Columna E
            const rubro = String(row[9] || 'Varios').trim(); // Columna J
            const cost = Number(row[10]) || 0; // Columna K
            const laboratory = String(row[14] || '').trim(); // Columna O

            eanList.forEach((ean: string, idx: number) => {
                catalog.push({
                    ean,
                    eans: eanList,
                    isPrimaryEan: idx === 0,
                    id_producto: idProducto,
                    name,
                    systemStock,
                    cost,
                    salePrice: cost,
                    laboratory,
                    rubro
                });
            });
        });

        self.postMessage({
            success: true,
            catalog
        });

    } catch (err: any) {
        self.postMessage({ error: "Error procesando el archivo: " + err.message });
    }
};
