
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Cargar variables de entorno manualmente si es necesario
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');

const envConfig = fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(line => line.includes('='))
    .reduce((acc, line) => {
        const [key, value] = line.split('=');
        acc[key.trim()] = value.trim();
        return acc;
    }, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorSync() {
    console.log('\n\x1b[36m%s\x1b[0m', '=== MONITOR DE SINCRONIZACIÓN SUPABASE ===');
    console.log('Conectado a:', supabaseUrl);
    
    try {
        // 1. Obtener los últimos 10 items escaneados
        const { data: latestItems, error: itemsError } = await supabase
            .from('precount_items')
            .select('ean, product_name, quantity, scanned_at, device_name, location_tag')
            .order('scanned_at', { ascending: false })
            .limit(10);

        if (itemsError) throw itemsError;

        console.log('\n\x1b[32m%s\x1b[0m', 'Últimos 10 escaneos detectados:');
        console.table(latestItems.map(item => ({
            Producto: item.product_name?.substring(0, 20) || item.ean,
            Cant: item.quantity,
            Dispositivo: item.device_name || 'N/A',
            Zona: item.location_tag || 'General',
            Hora: new Date(item.scanned_at).toLocaleTimeString()
        })));

        // 2. Resumen de actividad reciente (últimos 5 minutos)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count, error: countError } = await supabase
            .from('precount_items')
            .select('*', { count: 'exact', head: true })
            .gt('scanned_at', fiveMinutesAgo);

        if (countError) throw countError;

        console.log('\n\x1b[33m%s\x1b[0m', `Actividad en los últimos 5 minutos: ${count} items sincronizados.`);

        // 3. Verificar estado de laboratorios (opcional)
        const { data: labs, error: labsError } = await supabase
            .from('branch_laboratories')
            .select('branch_name, laboratory, status, progress_percentage')
            .eq('status', 'completed')
            .order('last_updated', { ascending: false })
            .limit(3);

        if (!labsError && labs && labs.length > 0) {
            console.log('\n\x1b[35m%s\x1b[0m', 'Últimos laboratorios finalizados:');
            labs.forEach(lab => {
                console.log(` - ${lab.branch_name} | ${lab.laboratory}: ${lab.status} (${lab.progress_percentage}%)`);
            });
        }

    } catch (err) {
        console.error('\x1b[31m%s\x1b[0m', 'Error consultando Supabase:', err.message);
    }
}

// Ejecutar una vez
monitorSync();
