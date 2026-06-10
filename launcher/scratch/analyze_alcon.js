const XLSX = require('xlsx');

async function analyze() {
    try {
        console.log("Leyendo ALCON.xlsx...");
        const workbook = XLSX.readFile('c:/Proyectos/farmaplus-pwa-main/public/ALCON.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON para ver las columnas
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = data[0];
        
        console.log("¡Estructura Detectada!");
        console.log("Columnas:", headers);
        
        console.log("\nMuestra de datos (primeras 3 filas):");
        console.log(JSON.stringify(data.slice(1, 4), null, 2));
        
        // Buscar indicios de ID de laboratorio o rubro en los datos
        // (A veces Plex los pone en celdas ocultas o comentarios)
    } catch (err) {
        console.error("Error al analizar el archivo:", err.message);
    }
}

analyze();
