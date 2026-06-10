import { createConnection } from 'mariadb';

async function tryCombo(u, p) {
    const config = {
        host: '172.30.40.63',
        port: 3306,
        user: u,
        password: p,
        database: 'plex',
        connectTimeout: 3000
    };
    try {
        console.log(`Probando combo: ${u} / ${p}...`);
        const conn = await createConnection(config);
        console.log(`¡EXITO! Combo válido: ${u} / ${p}`);
        await conn.end();
        return true;
    } catch (e) {
        console.log(`Falló: ${e.message}`);
        return false;
    }
}

async function run() {
    const combos = [
        ['root', 'plex2014'],
        ['plex', 'plex2014'],
        ['plex', 'plex'],
        ['plex', 'admin'],
        ['admin', 'admin'],
        ['plex', 'farmaplus']
    ];
    
    for (const [u, p] of combos) {
        if (await tryCombo(u, p)) break;
    }
}

run();
