import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'lab_sucu.xlsx');

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    console.log("Sheet Names:", workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        console.log(`\nAnalyzing sheet: ${sheetName}`);
        const ws = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
            console.log("Sheet is empty or too short.");
            continue;
        }

        // Row 1 (index 1) seems to contain headers: ACCESORIOS, MEDICAMENTOS, PERFUMERIA, VARIOS
        const headers = data[1];
        console.log("Potential Headers (Row 1):", headers);

        let totalLabs = 0;
        const columnCounts: Record<string, number> = {};

        // Iterate columns based on headers found in row 1
        for (let c = 0; c < headers.length; c++) {
            const category = String(headers[c]).trim();
            if (!category) continue;

            let count = 0;
            // Start from row 2 (index 2)
            for (let r = 2; r < data.length; r++) {
                const cell = data[r][c];
                if (cell && String(cell).trim().length > 0) {
                    count++;
                }
            }
            columnCounts[category] = count;
            totalLabs += count;
        }

        console.log(`Counts for ${sheetName}:`, columnCounts);
        console.log(`Total Labs for ${sheetName}: ${totalLabs}`);
    }

} catch (error) {
    console.error("Error reading file:", error);
}
