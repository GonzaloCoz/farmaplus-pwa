const fs = require('fs');
const path = require('path');

const TEMP_DIR = 'C:\\Plex 25\\Gestion\\Temp';
const EAN_TEST = "7798140255222"; // Tafirol 1G
const CANTIDAD = 1;

function createBajaBuffer(headerText) {
    // El header suele tener un tamaño fijo o nulo al final
    const header = Buffer.alloc(30, 0);
    header.write(headerText, 0, 'ascii');

    // Estructura simplificada del registro binario
    const record = Buffer.alloc(100, 0);
    record.write(EAN_TEST, 0, 'ascii'); // EAN
    record.writeInt32LE(CANTIDAD, 40);   // Cantidad en la posición que vimos antes
    
    return Buffer.concat([header, record]);
}

const variations = [
    { name: 'baja.tmp', head: 'Baja de Stock' },
    { name: 'stock_b.tmp', head: 'Baja de Stock' },
    { name: 'stock.tmp', head: 'Baja de Stock' },
    { name: 'stock.baja', head: 'Baja de Stock' }
];

console.log("Sembrando archivos de prueba en " + TEMP_DIR);

variations.forEach(v => {
    const fullPath = path.join(TEMP_DIR, v.name);
    try {
        const buffer = createBajaBuffer(v.head);
        fs.writeFileSync(fullPath, buffer);
        console.log(`[OK] Generado: ${v.name}`);
    } catch (e) {
        console.log(`[ERROR] No se pudo crear ${v.name}: ${e.message}`);
    }
});

console.log("\nINSTRUCCIONES:");
console.log("1. Abre Plex25.");
console.log("2. Entra en Stock -> Baja de Stock.");
console.log("3. Mira si aparece el cartel de 'Desea recuperar el proceso pendiente'.");
console.log("4. Si entra directo, mira si la lista de productos ya tiene el Tafirol.");
