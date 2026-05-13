/**
 * Parser para archivos .tmp de Plex25
 * Analiza la estructura binaria de stock.tmp e inventario.tmp
 */
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || 'C:\\Plex 25\\Gestion\\Temp\\stock.tmp';

console.log(`\n=== Parseando: ${path.basename(filePath)} ===`);
console.log(`Tamaño: ${fs.statSync(filePath).size} bytes\n`);

const buf = fs.readFileSync(filePath);
let pos = 0;

// --- HEADER ---
// Primeros bytes: magic/version
const magic = buf.readUInt32LE(0);
console.log(`Magic/Version: 0x${magic.toString(16)}`);
pos = 4;

const unknown1 = buf.readUInt32LE(pos); pos += 4;
const unknown2 = buf.readUInt32LE(pos); pos += 4;
const fieldCount = buf.readUInt16LE(pos); pos += 2; // Probablemente el número de campos
console.log(`Posible nro de campos (offset 12): ${fieldCount}`);

// Parece haber más bytes de header. Vamos a buscar los nombres de campos.
// Los campos son strings ASCII precedidos por su longitud como un byte

// Resetear y buscar campo por campo
pos = 4; // Después del magic
console.log(`\nBytes 4-20 (header info):`);
for (let i = 4; i < 24; i++) {
    process.stdout.write(`  [${i}] = 0x${buf[i].toString(16).padStart(2,'0')} (${buf[i]})`);
    if ((i - 4) % 4 === 3) console.log();
}
console.log();

// El schema parece empezar después de un header fijo.
// Busquemos "IDProducto" que es el primer campo
const idProdStr = 'IDProducto';
let schemaStart = buf.indexOf(Buffer.from(idProdStr, 'ascii'));
console.log(`\nSchema empieza en offset: ${schemaStart}`);

// Ahora parseemos los campos del schema
pos = schemaStart;
const fields = [];

function readField() {
    if (pos >= buf.length) return null;
    
    // El nombre del campo parece estar precedido por su longitud (1 byte)
    // Retrocedemos 1 byte desde la posición actual del string para ver la longitud
    const nameLen = buf[pos - 1] || 0;
    
    // Intentemos leer como: [nameLen byte] [name string] [type byte] [size info...]
    // Primero, busquemos el patrón leyendo el nombre hasta encontrar un byte de tipo
    let name = '';
    let i = pos;
    while (i < buf.length && buf[i] >= 0x20 && buf[i] < 0x7F) {
        name += String.fromCharCode(buf[i]);
        i++;
    }
    if (name.length === 0) return null;
    
    // Después del nombre hay bytes de metadatos del campo
    const afterName = i;
    const typeByte = buf[afterName]; // Tipo del campo
    
    // Leer los bytes que siguen al tipo
    const meta = [];
    for (let j = afterName; j < Math.min(afterName + 12, buf.length); j++) {
        meta.push(buf[j]);
    }
    
    return { name, typeByte, afterNameOffset: afterName, meta };
}

// Busquemos todos los campos escaneando por strings ASCII válidos
console.log('\n=== CAMPOS DEL SCHEMA ===');
let scanPos = schemaStart;
const fieldNames = [];

while (scanPos < buf.length) {
    // Buscar inicio de un string ASCII (letra mayúscula o minúscula)
    if ((buf[scanPos] >= 0x41 && buf[scanPos] <= 0x5A) || (buf[scanPos] >= 0x61 && buf[scanPos] <= 0x7A)) {
        let name = '';
        let j = scanPos;
        while (j < buf.length && buf[j] >= 0x20 && buf[j] < 0x7F && name.length < 50) {
            name += String.fromCharCode(buf[j]);
            j++;
        }
        
        // Solo considerar strings que parezcan nombres de campo (sin espacios, longitud razonable)
        if (name.length >= 3 && name.length <= 30 && !name.includes(' ')) {
            const typeByte = buf[j];
            // Verificar si parece un campo (seguido de bytes de tipo conocidos: 01, 02, 04, 08)
            if (typeByte === 0x01 || typeByte === 0x02 || typeByte === 0x04 || typeByte === 0x08) {
                const typeNames = { 0x01: 'STRING', 0x02: 'SMALLINT/BOOL', 0x04: 'INTEGER', 0x08: 'FLOAT/DATE' };
                console.log(`  [${scanPos}] ${name.padEnd(20)} tipo=${typeNames[typeByte] || '0x'+typeByte.toString(16)}`);
                fieldNames.push({ name, type: typeByte, offset: scanPos });
                scanPos = j + 1;
                continue;
            }
        }
    }
    scanPos++;
}

console.log(`\nTotal campos encontrados: ${fieldNames.length}`);

// --- BUSCAR DATOS ---
// Los datos reales contienen EANs (13 dígitos). Busquemos todos los EANs
console.log('\n=== REGISTROS DE DATOS ===');
const eanRegex = /\d{13}/g;
const content = buf.toString('latin1');
let match;
const records = [];

while ((match = eanRegex.exec(content)) !== null) {
    const eanPos = match.index;
    const ean = match[0];
    
    // Buscar el nombre del producto después del EAN
    let prodName = '';
    let k = eanPos + 13;
    while (k < content.length && k < eanPos + 200) {
        const ch = content.charCodeAt(k);
        if (ch >= 0x20 && ch < 0x7F) {
            prodName += content[k];
        } else if (prodName.length > 3) {
            break;
        }
        k++;
    }
    
    // Buscar "Alta de Stock" u otro tipo de movimiento cerca
    const context = content.substring(Math.max(0, eanPos - 20), Math.min(content.length, eanPos + 300));
    const movType = context.match(/(Alta de Stock|Baja de Stock|Ajuste|Carga de Inventario|Modificado)/);
    
    records.push({
        ean,
        position: eanPos,
        productText: prodName.trim(),
        movementType: movType ? movType[0] : 'Desconocido'
    });
}

records.forEach((r, i) => {
    console.log(`\n  Registro ${i + 1}:`);
    console.log(`    EAN:        ${r.ean}`);
    console.log(`    Producto:   ${r.productText}`);
    console.log(`    Movimiento: ${r.movementType}`);
    console.log(`    Offset:     ${r.position}`);
});

// --- BUSCAR FLOATS IEEE 754 ---
// Los precios y cantidades están como doubles (8 bytes little-endian)
console.log('\n=== VALORES NUMÉRICOS (Floats cercanos a registros) ===');
records.forEach((r, i) => {
    console.log(`\n  Registro ${i + 1} (${r.ean}):`);
    // Buscar floats en los 100 bytes antes del siguiente registro o final
    const endSearch = (i < records.length - 1) ? records[i + 1].position : Math.min(r.position + 400, buf.length);
    const startSearch = r.position + 13 + r.productText.length;
    
    const floats = [];
    for (let fpos = startSearch; fpos < endSearch - 8; fpos++) {
        try {
            const val = buf.readDoubleLE(fpos);
            // Solo valores que parezcan razonables (precios, cantidades)
            if (val > 0.01 && val < 10000000 && !isNaN(val) && isFinite(val)) {
                // Verificar que no sea un valor "basura" - los floats válidos suelen estar alineados
                floats.push({ offset: fpos, value: val });
            }
        } catch (e) {}
    }
    
    // Mostrar los floats más relevantes (eliminar duplicados cercanos)
    const uniqueFloats = [];
    floats.forEach(f => {
        if (!uniqueFloats.some(u => Math.abs(u.offset - f.offset) < 8)) {
            uniqueFloats.push(f);
        }
    });
    
    uniqueFloats.slice(0, 10).forEach(f => {
        console.log(`    [${f.offset}] = ${f.value.toFixed(4)}`);
    });
});

// También parsear inventario.tmp para comparar
const invPath = 'C:\\Plex 25\\Gestion\\Temp\\inventario.tmp';
if (fs.existsSync(invPath)) {
    console.log('\n\n========================================');
    console.log('=== COMPARACIÓN CON inventario.tmp ===');
    console.log('========================================');
    const invBuf = fs.readFileSync(invPath);
    console.log(`Tamaño: ${invBuf.length} bytes`);
    
    const invContent = invBuf.toString('latin1');
    const invEans = invContent.match(/\d{13}/g);
    if (invEans) {
        console.log(`EANs encontrados: ${invEans.join(', ')}`);
    }
    
    // Buscar campos del schema
    const invFieldNames = ['IDProducto', 'Codebar', 'Producto', 'Cantidad', 'CantidadStock'];
    invFieldNames.forEach(fn => {
        const idx = invContent.indexOf(fn);
        console.log(`  ${fn}: ${idx >= 0 ? 'offset ' + idx : 'NO ENCONTRADO'}`);
    });
}
