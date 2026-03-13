
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'lab_sucu.xlsx');

async function extractLabsDetail() {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        
        // Buscamos la hoja "Las Canitas" (o variante)
        const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('canita')) || 'Las Canitas';
        console.log(`Usando hoja: ${sheetName}`);
        
        const ws = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!data || data.length < 2) {
            console.error("No hay suficientes datos en la hoja.");
            return;
        }

        // Fila 1 (index 1) tiene las categorías
        const categories = data[1];
        console.log(`Categorías encontradas: ${categories.join(', ')}`);

        const allLabs = [];

        // Iteramos cada columna para recolectar los laboratorios
        for (let c = 0; c < categories.length; c++) {
            const categoryName = String(categories[c] || 'VARIOS').toUpperCase();
            
            for (let r = 2; r < data.length; r++) {
                const labName = data[r][c];
                if (labName && String(labName).trim().length > 1) {
                    allLabs.push({
                        name: String(labName).trim(),
                        category: categoryName
                    });
                }
            }
        }

        console.log(`Extraídos ${allLabs.length} laboratorios totales.`);
        
        // Agrupar por nombre para el resumen final
        const uniqueNames = [...new Set(allLabs.map(l => l.name))];
        console.log(`Laboratorios únicos: ${uniqueNames.length}`);

        fs.writeFileSync('las_canitas_excel_labs.json', JSON.stringify(allLabs, null, 2));
        console.log('Resultados guardados en las_canitas_excel_labs.json');

    } catch (error) {
        console.error("Error:", error);
    }
}

extractLabsDetail();
