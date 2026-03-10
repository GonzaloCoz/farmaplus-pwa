
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

async function checkMetadata() {
    console.log("Analyzing laboratory metadata (progress and counts) for potential overlaps...");

    for (const pair of MAPPING) {
        const { from, to } = pair;

        const { data: fromMeta } = await supabase.from('branch_laboratories').select('branch_name, total_items, controlled_items').eq('laboratory', from);
        const { data: toMeta } = await supabase.from('branch_laboratories').select('branch_name, total_items, controlled_items').eq('laboratory', to);

        if (fromMeta && toMeta && fromMeta.length > 0 && toMeta.length > 0) {
            const branchesFrom = new Set(fromMeta.map(m => m.branch_name));
            const branchesTo = new Set(toMeta.map(m => m.branch_name));

            const intersection = [...branchesFrom].filter(b => branchesTo.has(b));

            if (intersection.length > 0) {
                console.log(`\nCONFLICT in metadata for ${from} -> ${to}:`);
                intersection.forEach(branch => {
                    const f = fromMeta.find(m => m.branch_name === branch);
                    const t = toMeta.find(m => m.branch_name === branch);
                    console.log(`  [${branch}] Progress in "${from}": ${f.controlled_items}/${f.total_items} | Progress in "${to}": ${t.controlled_items}/${t.total_items}`);
                });
            }
        }
    }
}

checkMetadata();
