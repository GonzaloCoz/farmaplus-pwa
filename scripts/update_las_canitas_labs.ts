
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const supabaseKey = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('--- Iniciando Migración para Las Cañitas ---');

    try {
        // 1. Unificación de nombres en Tablas de Datos
        console.log('1. Unificando nombres de sucursal...');
        const branchesToFix = ['Las Canitas', 'LAS CANITAS', 'LAS CAÑITAS'];
        
        for (const oldName of branchesToFix) {
            // Inventaries
            const { error: err1 } = await supabase
                .from('inventories')
                .update({ branch_name: 'Las Cañitas' })
                .eq('branch_name', oldName);
            if (err1) console.error(`Error unificando inventories (${oldName}):`, err1.message);

            // branch_laboratories (metadatos)
            const { error: err2 } = await supabase
                .from('branch_laboratories')
                .update({ branch_name: 'Las Cañitas' })
                .eq('branch_name', oldName);
            if (err2) console.error(`Error unificando branch_laboratories (${oldName}):`, err2.message);
            
            // activity_logs
            const { error: err3 } = await supabase
                .from('activity_logs')
                .update({ branch_name: 'Las Cañitas' })
                .eq('branch_name', oldName);
            if (err3) console.error(`Error unificando activity_logs (${oldName}):`, err3.message);
        }

        // 2. Limpieza de configuraciones antiguas para evitar duplicados/ruido
        console.log('2. Limpiando laboratorios asignados antiguos...');
        const { error: delError } = await supabase
            .from('branch_laboratories')
            .delete()
            .eq('branch_name', 'Las Cañitas');
        
        if (delError) throw delError;

        // 3. Carga de los nuevos laboratorios desde el JSON (extraído del Excel)
        console.log('3. Cargando nuevos laboratorios...');
        const labsFile = path.join(process.cwd(), 'las_canitas_excel_labs.json');
        const labsData = JSON.parse(fs.readFileSync(labsFile, 'utf8'));

        // Preparar registros para insert masivo (chunks de 100 para evitar límites)
        const entries = labsData.map(l => ({
            branch_name: 'Las Cañitas',
            laboratory: l.name,
            category: l.category || 'VARIOS',
            status: 'pending',
            progress_percentage: 0
        }));

        const chunkSize = 100;
        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);
            const { error: insError } = await supabase
                .from('branch_laboratories')
                .insert(chunk);
            
            if (insError) {
                console.error(`Error insertando chunk ${i/chunkSize}:`, insError.message);
            } else {
                console.log(`Chunk ${i/chunkSize} insertado (${chunk.length} labs).`);
            }
        }

        console.log('\n--- Migración Completada con Éxito ---');
        console.log(`Se procesaron ${entries.length} laboratorios para "Las Cañitas".`);

    } catch (error) {
        console.error('Error fatal durante la migración:', error);
    }
}

runMigration();
