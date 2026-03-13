
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'lab_sucu.xlsx');

async function auditExcelStructure() {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        
        const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('canita')) || 'Las Canitas';
        const ws = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        console.log(`Auditoría de Hoja: ${sheetName}`);
        
        // El usuario dice: Medicamentos 209, Perfumería 246, Varios 83, Accesorios 108.
        // Mi script anterior extrajo 638 en total. 
        // 209+246+83+108 = 646. (Casi coincide con 638, faltan 8).

        const categoriesRow = data[1] || [];
        const counts = {};
        
        for (let c = 0; c < categoriesRow.length; c++) {
            const catName = String(categoriesRow[c] || `COL_${c}`).toUpperCase();
            let count = 0;
            const labsInCat = [];
            for (let r = 2; r < data.length; r++) {
                const val = data[r][c];
                if (val && String(val).trim().length > 1) {
                    count++;
                    labsInCat.push(String(val).trim());
                }
            }
            counts[catName] = { count, labs: labsInCat };
        }

        console.log("Conteos por columna en Excel:");
        Object.entries(counts).forEach(([name, data]: [string, any]) => {
            console.log(`- ${name}: ${data.count} labs`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

auditExcelStructure();
