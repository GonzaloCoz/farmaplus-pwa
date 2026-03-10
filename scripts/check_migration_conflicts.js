
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

async function checkConflicts() {
    console.log("Analyzing potential migration conflicts (Overlapping EANs in the same branch)...");

    for (const pair of MAPPING) {
        const { from, to } = pair;

        // Manual check without RPC
        process.stdout.write(`Analyzing ${from} vs ${to}... `);
        const { data: fromItems } = await supabase.from('inventories').select('branch_name, ean, status').eq('laboratory', from);
        const { data: toItems } = await supabase.from('inventories').select('branch_name, ean, status').eq('laboratory', to);

        if (fromItems && toItems && fromItems.length > 0 && toItems.length > 0) {
            const registry = {};
            toItems.forEach(item => {
                const key = `${item.branch_name}|${item.ean}`;
                registry[key] = item.status;
            });

            let conflictsCount = 0;
            fromItems.forEach(item => {
                const key = `${item.branch_name}|${item.ean}`;
                if (registry[key]) {
                    conflictsCount++;
                }
            });

            if (conflictsCount > 0) {
                console.log(`\n  !! CONFLICT: ${conflictsCount} overlapping EANs found between "${from}" and "${to}" across branches.`);
            } else {
                console.log("OK (No EAN overlap)");
            }
        } else {
            console.log("OK (No overlap in active records)");
        }
    }
}

checkConflicts();
