const fs = require('fs');

const filePath = 'C:\\Plex 25\\Gestion\\Temp\\stock.tmp';
const backupPath = 'C:\\Plex 25\\Gestion\\Temp\\stock_original.tmp';

if (!fs.existsSync(filePath)) {
    console.error("No se encontró stock.tmp en la carpeta de Plex.");
    process.exit(1);
}

// Hacer backup por seguridad
fs.copyFileSync(filePath, backupPath);
const buf = Buffer.from(fs.readFileSync(filePath));
let content = buf.toString('latin1');

console.log(`Analizando archivo: ${buf.length} bytes`);

// 1. Cambiar "Alta de Stock" por "Baja de Stock"
// Ambos tienen 13 caracteres, así que el reemplazo es seguro byte-a-byte
let replacements = 0;
let pos = 0;
while ((pos = content.indexOf('Alta de Stock', pos)) !== -1) {
    buf.write('Baja de Stock', pos, 'ascii');
    console.log(`  ✓ Movimiento cambiado a "Baja de Stock" en offset ${pos}`);
    replacements++;
    pos += 13;
}

// 2. Modificar cantidades
const eanRegex = /\d{13}/g;
let match;
const records = [];
content = buf.toString('latin1'); // Actualizar contenido para buscar EANs

while ((match = eanRegex.exec(content)) !== null) {
    records.push({ ean: match[0], offset: match.index });
}

records.forEach((rec, idx) => {
    const eanEnd = rec.offset + 13;
    let p = eanEnd;
    
    // Saltamos los 3 strings (Producto, Nombre, Presentacion)
    for (let s = 0; s < 3; s++) {
        const len = buf[p];
        p += 1 + len;
    }
    
    // P = Inicio de [PUnidades: 4B] [Cantidad: 4B]
    const pUnidades = buf.readUInt32LE(p);
    const cantOffset = p + 4;
    
    // PROBEMOS: Cantidad 5 para ver si Plex lo toma como baja por el tipo de movimiento
    const nuevaCantidad = 5; 
    buf.writeInt32LE(nuevaCantidad, cantOffset);
    
    console.log(`Registro ${idx + 1} (${rec.ean}):`);
    console.log(`  ✓ Cantidad seteada en: ${nuevaCantidad} (en offset ${cantOffset})`);
});

// Guardar el archivo "trucado"
fs.writeFileSync(filePath, buf);
console.log(`\n✅ Simulación de Baja generada con éxito.`);
console.log(`👉 Ahora ve a Plex25 -> Altas -> "Retomar ajustes" y observa qué dice.`);
