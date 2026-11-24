import * as XLSX from 'xlsx';

export class BranchStockBridge {
    private stockData: any[] = [];
    private isInitialized = false;

    async initialize() {
        if (this.isInitialized) return;
        try {
            console.log("[Bridge] Inicializando puente virtual con sucursal...");
            // Leemos el archivo desde la carpeta public
            const response = await fetch('/ALCON.xlsx');
            if (!response.ok) throw new Error('Archivo de sucursal no disponible');
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            this.stockData = XLSX.utils.sheet_to_json(worksheet);
            this.isInitialized = true;
            console.log(`[Bridge] Conexión establecida. ${this.stockData.length} registros sincronizados.`);
        } catch (error) {
            console.error("[Bridge] Error de conexión:", error);
        }
    }

    async getStockByLab(labName: string): Promise<any[]> {
        await this.initialize();
        return this.stockData.filter(item => 
            item.Laboratorio && item.Laboratorio.toUpperCase().includes(labName.toUpperCase())
        ).map(item => ({
            ean: item.CodigosBarra ? String(item.CodigosBarra).split('-').pop() : '',
            producto: item.Nombre || 'Desconocido',
            cantidad: Number(item.CantStock_Suc075 || 0),
            laboratorio: item.Laboratorio,
            rubro: item.Rubro
        }));
    }

    async getProductByEAN(ean: string): Promise<any | null> {
        await this.initialize();
        const item = this.stockData.find(i => {
            const codes = String(i.CodigosBarra || '').split('-');
            return codes.includes(ean);
        });
        if (!item) return null;
        return {
            ean: ean,
            producto: item.Nombre || 'Desconocido',
            cantidad: Number(item.CantStock_Suc075 || 0),
            laboratorio: item.Laboratorio,
            rubro: item.Rubro
        };
    }
}

export const stockBridge = new BranchStockBridge();
