const mysql = require('mysql2/promise');

async function test() {
    const configs = [
        { host: '172.30.40.63', user: 'root', password: '', database: 'plex' },
        { host: '172.30.40.63', user: 'root', password: 'plex', database: 'plex' },
        { host: '172.30.40.63', user: 'root', password: 'plex2014', database: 'plex' }
    ];

    for (let config of configs) {
        console.log(`Probando conexión: ${config.user}@${config.host} (Pass: ${config.password || 'vacía'})...`);
        try {
            const connection = await mysql.createConnection(config);
            console.log("¡CONECTADO CON ÉXITO!");
            const [rows] = await connection.execute('SELECT DATABASE() as db');
            console.log("Base de datos activa:", rows[0].db);
            await connection.end();
            process.exit(0);
        } catch (err) {
            console.log("Error:", err.message);
        }
    }
}

test();
