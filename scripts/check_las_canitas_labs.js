
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const supabaseKey = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findLasCanitas() {
    let output = '--- Búsqueda Exhaustiva de Las Cañitas ---\n';
    
    const searches = ['Las Cañitas', 'Las Canitas', 'LAS CAÑITAS', 'LAS CANITAS'];
    
    output += '\nRevisando branch_laboratories:\n';
    for (const s of searches) {
        const { data, count } = await supabase
            .from('branch_laboratories')
            .select('*', { count: 'exact', head: true })
            .ilike('branch_name', s);
        output += `- "${s}": ${count || 0} registros\n`;
    }

    output += '\nRevisando inventories:\n';
    for (const s of searches) {
        const { data, count } = await supabase
            .from('inventories')
            .select('*', { count: 'exact', head: true })
            .ilike('branch_name', s);
        output += `- "${s}": ${count || 0} registros\n`;
    }

    // Si encontramos algo en inventories, ver qué laboratorios son
    const { data: invLabs } = await supabase
        .from('inventories')
        .select('branch_name, laboratory')
        .or(searches.map(s => `branch_name.ilike.${s}`).join(','));

    if (invLabs && invLabs.length > 0) {
        output += '\nLaboratorios encontrados en Inventories para estas variantes:\n';
        const grouped = {};
        invLabs.forEach(d => {
            const key = `${d.branch_name} -> ${d.laboratory}`;
            grouped[key] = (grouped[key] || 0) + 1;
        });
        output += JSON.stringify(grouped, null, 2) + '\n';
    } else {
        output += '\nNo se encontró NADA en inventories (fuera de configuraciones) para estas variantes.\n';
    }

    fs.writeFileSync('diagnostic_results.txt', output);
    console.log('Diagnostic results written to diagnostic_results.txt');
}

findLasCanitas();
