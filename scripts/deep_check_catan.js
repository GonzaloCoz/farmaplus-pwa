
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deepCheck() {
    const branch = "Gonzalez Catan II";

    // 1. Labs in branch_laboratories 
    const { data: metaLabs } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, status')
        .eq('branch_name', branch);

    const metaSet = new Set(metaLabs.map(l => l.laboratory));
    const metaNonZero = metaLabs.filter(l => l.total_items > 0);
    console.log(`branch_laboratories: ${metaLabs.length} entries, ${metaNonZero.length} with total_items > 0`);
    metaNonZero.forEach(l => console.log(`  ${l.laboratory}: ${l.total_items} items, ${l.status}`));

    // 2. Labs in inventories
    const { data: invData } = await supabase
        .from('inventories')
        .select('laboratory')
        .eq('branch_name', branch);

    const invCounts = {};
    invData.forEach(d => {
        invCounts[d.laboratory] = (invCounts[d.laboratory] || 0) + 1;
    });

    console.log(`\ninventories: ${invData.length} records across ${Object.keys(invCounts).length} labs`);

    // 3. Labs in inventories but NOT in branch_laboratories
    const missing = Object.keys(invCounts).filter(lab => !metaSet.has(lab));
    if (missing.length > 0) {
        console.log(`\nMISSING from branch_laboratories (in inventories but no metadata):`);
        missing.forEach(lab => console.log(`  ${lab}: ${invCounts[lab]} items`));
    }

    // 4. Sample of first 5 labs with data
    console.log(`\nTop 5 labs with inventory items:`);
    Object.entries(invCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([lab, count]) => {
        const meta = metaLabs.find(l => l.laboratory === lab);
        console.log(`  ${lab}: ${count} inv records | metadata total_items: ${meta ? meta.total_items : 'NOT FOUND'}`);
    });
}

deepCheck();
