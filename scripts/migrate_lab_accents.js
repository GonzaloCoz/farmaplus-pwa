
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAPPING = [
    { from: 'ANDROMACO', to: 'ANDRÓMACO' },
    { from: 'BAGO', to: 'BAGÓ' },
    { from: 'BAGO-ARCOR', to: 'BAGÓ-ARCOR' },
    { from: 'CASSARA', to: 'CASSARÁ' },
    { from: 'DOMINGUEZ', to: 'DOMÍNGUEZ' },
    { from: 'EPUYEN', to: 'EPUYÉN' },
    { from: 'FILAXIS FARMACE', to: 'FILAXIS FARMACÉ' },
    { from: 'GEMINIS', to: 'GÉMINIS' },
    { from: 'GEMINIS FARMACE', to: 'GÉMINIS FARMACÉ' },
    { from: 'LA FARMACO ARG.', to: 'LA FÁRMACO ARG.' },
    { from: 'NESTLE HEALTH S', to: 'NESTLÉ HEALTH S' },
    { from: 'NUTRICIA-BAGO', to: 'NUTRICIA-BAGÓ' },
    { from: 'PEREZ', to: 'PÉREZ' },
    { from: 'PIERRE FABRE ME', to: 'PIERRE FABRE MÉ' },
    { from: 'QUIMICA ESTRELLA', to: 'QUÍMICA ESTRELLA' },
    { from: 'QUIMICA LUAR', to: 'QUÍMICA LUAR' },
    { from: 'SCOTT-CASSARA', to: 'SCOTT-CASSARÁ' },
    { from: 'TEMIS-LOSTALO', to: 'TEMIS-LOSTALÓ' }
];

const TABLES = [
    'products',
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'precount_items',
    'inventory_reports'
];

async function runMigration() {
    console.log("Starting Laboratory Accent Migration...");

    for (const pair of MAPPING) {
        const { from, to } = pair;
        console.log(`\nMigrating: "${from}" -> "${to}"`);

        for (const table of TABLES) {
            process.stdout.write(`  Table ${table}... `);

            const { data, error, count } = await supabase
                .from(table)
                .update({ laboratory: to })
                .eq('laboratory', from)
                .select('id'); // We select something to get the count of affected rows if possible, or just check the result

            if (error) {
                if (error.code === '42P01') {
                    console.log("SKIP (Table not found)");
                } else {
                    console.log(`ERROR: ${error.message}`);
                }
            } else {
                const affected = data ? data.length : "unknown";
                console.log(`OK (${affected} rows updated)`);
            }
        }
    }

    console.log("\nMigration completed for all mapped laboratories.");
    console.log("Calling global normalization triggers...");

    // Try to call any existing recompute logic if available
    const { error: rpcError } = await supabase.rpc('recompute_all_lab_progress');
    if (rpcError) {
        console.log("Note: Global recompute RPC not found or failed, but individual row updates were successful.");
    } else {
        console.log("Global progress recomputed successfully.");
    }
}

runMigration();
