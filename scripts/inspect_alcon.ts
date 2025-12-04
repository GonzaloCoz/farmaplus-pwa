import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'public', 'default_products.xlsx');

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });

    console.log("Searching for ALCON products...");

    // Iterate and find ALCON
    let found = 0;
    for (let i = 1; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const lab = row["O"] ? String(row["O"]).trim().toUpperCase() : "";

        if (lab.includes("ALCON")) {
            console.log(`Row ${i + 1}:`);
            console.log(`  Name: ${row["D"]}`);
            console.log(`  Lab: ${row["O"]}`);
            console.log(`  Category (Col J): ${row["J"]}`);
            console.log(`  EAN: ${row["Q"]}`);
            found++;
            if (found >= 5) break; // Show first 5
        }
    }

    if (found === 0) {
        console.log("No ALCON products found.");
    }

} catch (error) {
    console.error("Error reading file:", error);
}
