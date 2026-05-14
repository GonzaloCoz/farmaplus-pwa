const mariadb = require('mariadb');

async function test() {
    const config = {
        host: '172.30.40.63',
        user: 'root',
        password: 'plex2014',
        database: 'plex',
        connectTimeout: 5000
    };

    let conn;
    try {
        console.log("Intentando conexión con driver MariaDB nativo...");
        conn = await mariadb.createConnection(config);
        console.log("¡CONECTADO CON ÉXITO!");
        
        console.log("Buscando estructura de productos...");
        const rows = await conn.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%productos%'");
        console.log("Tablas encontradas:", rows);
        
        if (rows.length > 0) {
            const tableName = rows[0].TABLE_NAME;
            console.log(`Leyendo 5 filas de ${tableName}...`);
            const data = await conn.query(`SELECT * FROM ${tableName} LIMIT 5`);
            console.log(data);
        }

    } catch (err) {
        console.error("Error crítico:", err.message);
    } finally {
        if (conn) conn.end();
    }
}

test();
