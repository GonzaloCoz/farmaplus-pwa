/**
 * Modifica las cantidades en stock.tmp para testing
 * Cambia la Cantidad de cada registro a 9999
 */
const fs = require('fs');

const filePath = 'C:\\Plex 25\\Gestion\\Temp\\stock.tmp';
const buf = Buffer.from(fs.readFileSync(filePath));
const content = buf.toString('latin1');

console.log(`Archivo: ${buf.length} bytes`);
console.log(`Registros (byte 14): ${buf[14]}\n`);

// Encontrar cada EAN y localizar el campo Cantidad
const eanRegex = /\d{13}/g;
let match;
const records = [];

while ((match = eanRegex.exec(content)) !== null) {
    records.push({ ean: match[0], offset: match.index });
}

records.forEach((rec, idx) => {
    const eanEnd = rec.offset + 13;
    
    // Después del EAN hay 3 strings length-prefixed:
    // Producto, ProdNombre, ProdPresentacion
    let pos = eanEnd;
    
    // String 1: Producto
    const prodLen = buf[pos];
    const producto = buf.toString('latin1', pos + 1, pos + 1 + prodLen);
    pos += 1 + prodLen;
    
    // String 2: ProdNombre
    const nombreLen = buf[pos];
    const nombre = buf.toString('latin1', pos + 1, pos + 1 + nombreLen);
    pos += 1 + nombreLen;
    
    // String 3: ProdPresentacion
    const presLen = buf[pos];
    const presentacion = buf.toString('latin1', pos + 1, pos + 1 + presLen);
    pos += 1 + presLen;
    
    // Ahora: [PUnidades: 4B] [Cantidad: 4B]
    const pUnidades = buf.readUInt32LE(pos);
    const cantidad = buf.readUInt32LE(pos + 4);
    
    console.log(`Registro ${idx + 1}: ${rec.ean}`);
    console.log(`  Producto: ${nombre} ${presentacion}`);
    console.log(`  PUnidades: ${pUnidades}, Cantidad actual: ${cantidad}`);
    console.log(`  Offset Cantidad: ${pos + 4}`);
    
    // Cambiar la cantidad a 9999
    const nuevaCantidad = 9999;
    buf.writeUInt32LE(nuevaCantidad, pos + 4);
    console.log(`  ✓ Cantidad cambiada a: ${nuevaCantidad}\n`);
});

// Guardar el archivo modificado
fs.writeFileSync(filePath, buf);
console.log(`\n✅ Archivo guardado. Abrí Plex → Altas → "Retomar ajustes" y verificá las cantidades.`);
