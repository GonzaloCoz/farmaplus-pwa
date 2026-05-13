/**
 * Análisis profundo de stock.tmp - Mapeo byte-a-byte de registros
 * Objetivo: Entender cómo escribir registros válidos para inyectar en Plex25
 */
const fs = require('fs');

const buf = fs.readFileSync('C:\\Plex 25\\Gestion\\Temp\\stock.tmp');
console.log(`=== stock.tmp: ${buf.length} bytes ===\n`);

// --- PASO 1: Encontrar dónde termina el schema y empiezan los datos ---
// Sabemos que el schema tiene los nombres de los campos.
// El último campo es CHANGE_LOG. Busquémoslo.
const content = buf.toString('latin1');
const changeLogPos = content.indexOf('CHANGE_LOG');
console.log(`CHANGE_LOG encontrado en offset: ${changeLogPos}`);

// Después de CHANGE_LOG hay metadata del campo y luego empiezan los datos
// Busquemos el primer EAN para saber dónde empiezan los registros
const firstEanPos = content.indexOf('7798140255222');
console.log(`Primer EAN en offset: ${firstEanPos}`);

// Veamos los bytes entre CHANGE_LOG y el primer EAN
console.log(`\n--- Bytes entre CHANGE_LOG y primer registro ---`);
const gapStart = changeLogPos;
const gapEnd = firstEanPos;
console.log(`Gap: offset ${gapStart} a ${gapEnd} (${gapEnd - gapStart} bytes)\n`);

for (let i = gapStart; i < gapEnd; i++) {
    const hex = buf[i].toString(16).padStart(2, '0');
    const ascii = (buf[i] >= 0x20 && buf[i] < 0x7F) ? String.fromCharCode(buf[i]) : '.';
    process.stdout.write(`${hex}[${ascii}] `);
    if ((i - gapStart) % 16 === 15) console.log(`  (offset ${i - 15} - ${i})`);
}
console.log();

// --- PASO 2: Mapear registros completos ---
// Buscar todos los EANs y mapear los bloques de datos
const eans = [];
const eanRegex = /\d{13}/g;
let match;
while ((match = eanRegex.exec(content)) !== null) {
    eans.push({ ean: match[0], offset: match.index });
}

console.log(`\n--- ${eans.length} registros encontrados ---`);

// Para cada registro, hacer un dump hex completo
eans.forEach((rec, idx) => {
    const start = rec.offset;
    // El fin es el inicio del siguiente registro, o el final del archivo
    const end = (idx < eans.length - 1) ? eans[idx + 1].offset : buf.length;
    const recLen = end - start;
    
    console.log(`\n======== REGISTRO ${idx + 1}: ${rec.ean} ========`);
    console.log(`Offset: ${start} - ${end} (${recLen} bytes)`);
    
    // Pero miremos también los bytes ANTES del EAN (puede haber un header de registro)
    const preStart = Math.max(0, start - 40);
    console.log(`\n  Pre-registro (${preStart} a ${start}):`);
    let line = '';
    let asciiLine = '';
    for (let i = preStart; i < start; i++) {
        const hex = buf[i].toString(16).padStart(2, '0');
        const ascii = (buf[i] >= 0x20 && buf[i] < 0x7F) ? String.fromCharCode(buf[i]) : '.';
        line += hex + ' ';
        asciiLine += ascii;
        if ((i - preStart) % 16 === 15) {
            console.log(`    ${line}  |${asciiLine}|`);
            line = '';
            asciiLine = '';
        }
    }
    if (line) console.log(`    ${line}  |${asciiLine}|`);
    
    // Dump del registro completo
    console.log(`\n  Registro completo:`);
    line = '';
    asciiLine = '';
    for (let i = start; i < Math.min(end, start + 250); i++) {
        const hex = buf[i].toString(16).padStart(2, '0');
        const ascii = (buf[i] >= 0x20 && buf[i] < 0x7F) ? String.fromCharCode(buf[i]) : '.';
        line += hex + ' ';
        asciiLine += ascii;
        if ((i - start) % 16 === 15) {
            console.log(`    ${(i-15).toString().padStart(5)}: ${line}  |${asciiLine}|`);
            line = '';
            asciiLine = '';
        }
    }
    if (line) console.log(`    ${' '.repeat(5)}: ${line}  |${asciiLine}|`);
    
    // Intentar leer los doubles (precios)
    console.log(`\n  Floats detectados:`);
    for (let i = start; i < end - 8; i++) {
        try {
            const val = buf.readDoubleLE(i);
            if (val > 0.5 && val < 100000000 && isFinite(val) && !isNaN(val)) {
                // Filtrar valores que parecen "reales" (no basura)
                const rounded = Math.round(val * 100) / 100;
                if (rounded === val || Math.abs(rounded - val) < 0.005) {
                    console.log(`    [offset ${i}, rel +${i - start}] = ${val.toFixed(4)}`);
                }
            }
        } catch (e) {}
    }
});

// --- PASO 3: Buscar el patrón "Alta de Stock" para entender el tipo de movimiento ---
console.log(`\n\n--- Patrones de "Alta de Stock" ---`);
let altaIdx = 0;
while ((altaIdx = content.indexOf('Alta de Stock', altaIdx)) !== -1) {
    console.log(`  Encontrado en offset ${altaIdx}`);
    // Mostrar bytes alrededor
    const ctx = buf.slice(Math.max(0, altaIdx - 5), altaIdx + 20);
    const hexStr = Array.from(ctx).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`    Contexto: ${hexStr}`);
    altaIdx++;
}

// --- PASO 4: Analizar si hay un "record separator" o delimitador ---
console.log(`\n\n--- Buscando separadores de registro ---`);
// Comparar los bytes justo antes de cada EAN
eans.forEach((rec, idx) => {
    const preBytes = [];
    for (let i = Math.max(0, rec.offset - 20); i < rec.offset; i++) {
        preBytes.push(buf[i].toString(16).padStart(2, '0'));
    }
    console.log(`  Pre-EAN${idx + 1}: ...${preBytes.join(' ')}`);
});
