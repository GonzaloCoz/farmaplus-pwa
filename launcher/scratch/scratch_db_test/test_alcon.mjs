import { createConnection } from 'mariadb';

async function test() {
    const config = {
        host: 'plexadm.farmaplus.com.ar',
        port: 3144,
        user: 'root',
        password: 'plex2014', // Probando con la clave conocida
        database: 'plex',
        connectTimeout: 5000
    };

    let conn;
    try {
        console.log(`Conectando a ${config.host}:${config.port}...`);
        conn = await createConnection(config);
        console.log("¡CONECTADO AL SERVIDOR CENTRAL!");
        
        // 1. Buscar el ID de la sucursal Devoto III
        console.log("Buscando sucursal Devoto III...");
        const branches = await conn.query("SELECT * FROM sucursales WHERE nombre LIKE '%Devoto%'");
        console.log("Sucursales encontradas:", branches);
        
        // 2. Buscar el laboratorio Alcon
        console.log("Buscando laboratorio Alcon...");
        const labs = await conn.query("SELECT * FROM laboratorios WHERE nombre LIKE '%Alcon%'");
        console.log("Laboratorios encontrados:", labs);
        
        if (labs.length > 0) {
            const labId = labs[0].id;
            console.log(`Extrayendo stock para Lab ID: ${labId}...`);
            // Esta consulta es una asunción de estructura, la ajustaremos según los resultados
            const stock = await conn.query(`
                SELECT p.ean, p.nombre, s.cantidad 
                FROM productos p 
                JOIN stock s ON p.id = s.producto_id 
                WHERE p.laboratorio_id = ? LIMIT 20
            `, [labId]);
            
            console.log("Muestra de Stock Alcon:");
            console.table(stock);
        }

    } catch (err) {
        console.error("Error en la prueba:", err.message);
    } finally {
        if (conn) conn.end();
    }
}

test();
