import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
    const buffer = fs.readFileSync('public/default_products.xlsx');
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:Z1");

    console.log("Headers (Row 1):");
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: 0 };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        const cell = worksheet[cell_ref];
        if (cell) {
            console.log(`${cell_ref}: ${cell.v}`);
        }
    }
} catch (e) {
    console.error("Error reading file:", e);
}
