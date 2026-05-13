const fs = require('fs');

const filePath = 'C:\\Plex 25\\Gestion\\Temp\\stock.tmp';
const buf = Buffer.from(fs.readFileSync(filePath));
let content = buf.toString('latin1');

// 1. Asegurar que diga "Alta de Stock" para que Plex lo reconozca al arrancar
let pos = content.indexOf('Baja de Stock');
if (pos !== -1) {
    buf.write('Alta de Stock', pos, 'ascii');
    console.log(`✓ Restaurado tipo a "Alta de Stock" para forzar recuperación.`);
}

// 2. Cambiar cantidad a NEGATIVO (-10)
const eanRegex = /\d{13}/g;
let match;
content = buf.toString('latin1');
if ((match = eanRegex.exec(content)) !== null) {
    const eanEnd = match.index + 13;
    let p = eanEnd;
    for (let s = 0; s < 3; s++) { p += 1 + buf[p]; }
    
    const nuevaCantidad = -10; 
    buf.writeInt32LE(nuevaCantidad, p + 4); // Usar WriteInt32 para el signo
    console.log(`✓ Cantidad seteada en: ${nuevaCantidad}`);
}

fs.writeFileSync(filePath, buf);
console.log(`\n✅ Archivo actualizado. Ahora abre la pantalla de ALTA DE STOCK en Plex.`);
