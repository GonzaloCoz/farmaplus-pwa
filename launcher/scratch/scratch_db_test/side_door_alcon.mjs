import { createConnection } from 'mariadb';

async function test() {
    const config = {
        host: '172.30.40.63',
        port: 3306,
        user: 'plex', // Probando usuario de aplicación en lugar de root
        password: 'plex', // Clave común en Plex
        database: 'plex',
        connectTimeout: 5000
    };

    let conn;
    try {
        console.log(`Intentando acceso con usuario '${config.user}'...`);
        conn = await createConnection(config);
        console.log("¡CONECTADO POR LA PUERTA LATERAL!");
        
        // Consultar stock de Alcon (ID 5) en Devoto III (Sucursal 75)
        const results = await conn.query(`
            SELECT p.ean, p.nombre, s.stock
            FROM productos p
            JOIN stock s ON p.id = s.producto_id
            WHERE p.laboratorio_id = 5 AND s.sucursal_id = 75
            LIMIT 10
        `);
        console.table(results);

    } catch (err) {
        console.error("Error en puerta lateral:", err.message);
    } finally {
        if (conn) conn.end();
    }
}

test();
