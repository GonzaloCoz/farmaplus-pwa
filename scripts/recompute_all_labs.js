
import { createClient } from '@supabase/supabase-js';

// Usar las credenciales del proyecto (se asumen las mismas que en otros scripts)
const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function recomputeAll() {
    console.log("🚀 Iniciando Recalculo Masivo de Progreso (Frontend Service)...");
    console.log("------------------------------------------------------------");

    // 1. Obtener todos los laboratorios únicos de branch_laboratories
    const { data: labs, error: fetchError } = await supabase
        .from('branch_laboratories')
        .select('branch_name, laboratory');

    if (fetchError) {
        console.error("❌ Error al obtener laboratorios:", fetchError.message);
        return;
    }

    // Deduplicar pares branch/lab
    const uniquePairs = new Map();
    labs.forEach(l => {
        const key = `${l.branch_name}|${l.laboratory}`;
        uniquePairs.set(key, { branch: l.branch_name, lab: l.laboratory });
    });

    const pairs = Array.from(uniquePairs.values());
    console.log(`📦 Se encontraron ${pairs.length} combinaciones sucursal/lab para procesar.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pairs.length; i++) {
        const { branch, lab } = pairs[i];
        
        process.stdout.write(`[${i + 1}/${pairs.length}] Actualizando ${lab} en ${branch}... `);

        // Llamar al RPC recompute_lab_progress
        const { error: rpcError } = await supabase.rpc('recompute_lab_progress', {
            p_branch_name: branch,
            p_laboratory: lab
        });

        if (rpcError) {
            console.log(`❌ ERROR: ${rpcError.message}`);
            errorCount++;
        } else {
            console.log(`✅ OK`);
            successCount++;
        }
    }

    console.log("------------------------------------------------------------");
    console.log(`✅ Finalizado. Exitosos: ${successCount}, Errores: ${errorCount}`);
}

recomputeAll();
