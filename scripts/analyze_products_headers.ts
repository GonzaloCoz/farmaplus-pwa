import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'default_products.xlsx');

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read first few rows to identify headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });

    console.log("First row (Headers?):", jsonData[0]);
    console.log("Second row (Data?):", jsonData[1]);

} catch (error) {
    console.error("Error reading file:", error);
}
