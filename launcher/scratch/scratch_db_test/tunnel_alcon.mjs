import { createConnection } from 'mariadb';

async function test() {
    const config = {
        host: '172.30.40.63',
        port: 3306, // El puerto real detectado
        user: 'root',
        password: 'plex2014',
        database: 'plex',
        connectTimeout: 5000
    };

    let conn;
    try {
        console.log(`Abriendo túnel a ${config.host}:${config.port}...`);
        conn = await createConnection(config);
        console.log("¡TÚNEL ABIERTO CON ÉXITO!");
        
        console.log("Extrayendo Stock de Alcon para Devoto III...");
        // Esta es la consulta definitiva
        const results = await conn.query(`
            SELECT 
                p.ean as EAN, 
                p.nombre as Producto, 
                s.cantidad as Stock,
                l.nombre as Laboratorio
            FROM productos p
            INNER JOIN laboratorios l ON p.laboratorio_id = l.id
            INNER JOIN stock s ON p.id = s.producto_id
            WHERE l.nombre LIKE '%ALCON%'
            LIMIT 50
        `);
        
        console.log("RESULTADOS DE LA EXTRACCIÓN:");
        console.table(results);

    } catch (err) {
        console.error("Error en el túnel:", err.message);
    } finally {
        if (conn) conn.end();
    }
}

test();
