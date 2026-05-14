const mysql = require('mysql2/promise');

async function explore() {
    const config = { host: '172.30.40.63', user: 'root', password: 'plex2014', database: 'plex' };
    
    try {
        console.log("Conectando a Plex DB...");
        const connection = await mysql.createConnection(config);
        
        console.log("Buscando tablas de productos...");
        const [tables] = await connection.execute("SHOW TABLES LIKE '%prod%'");
        const [tables2] = await connection.execute("SHOW TABLES LIKE '%art%'");
        const [tables3] = await connection.execute("SHOW TABLES LIKE '%stock%'");
        
        console.log("Tablas encontradas:", [...tables, ...tables2, ...tables3].map(t => Object.values(t)[0]));
        
        // Intentar ver la estructura de la tabla más probable
        const targetTable = 'productos'; // Asunción común
        console.log(`\nEstructura de la tabla '${targetTable}':`);
        try {
            const [columns] = await connection.execute(`DESCRIBE ${targetTable}`);
            console.table(columns);
            
            console.log("\nPrimeros 5 productos de prueba:");
            const [rows] = await connection.execute(`SELECT * FROM ${targetTable} LIMIT 5`);
            console.log(JSON.stringify(rows, null, 2));
        } catch (e) {
            console.log(`La tabla '${targetTable}' no existe o no se puede leer.`);
        }
        
        await connection.end();
    } catch (err) {
        console.error("Error de exploración:", err.message);
    }
}

explore();
