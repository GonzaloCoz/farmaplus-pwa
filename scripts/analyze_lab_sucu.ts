import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'lab_sucu.xlsx');

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log("Sheet Names:", workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        console.log(`Analyzing sheet: ${sheetName}`);
        const ws = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let found = false;
        for (let r = 0; r < data.length; r++) {
            const row: any = data[r];
            for (let c = 0; c < row.length; c++) {
                const cellVal = String(row[c]).toUpperCase();
                if (cellVal.includes("TRIBUNALES") || cellVal.includes("BARRACAS")) {
                    console.log(`Found ${cellVal} in ${sheetName} at Row ${r}, Column ${c}`);
                    found = true;
                }
            }
        }
        if (!found) console.log(`No branch names found in ${sheetName}`);
    }



} catch (error) {
    console.error("Error reading file:", error);
}
