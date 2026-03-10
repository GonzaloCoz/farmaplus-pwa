
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findAlLCatan() {
    console.log("Filtering inventories for 'CATAN' (case-insensitive)...");

    const { data, error } = await supabase
        .from('inventories')
        .select('branch_name')
        .ilike('branch_name', '%CATAN%');

    if (error) {
        console.log("Error:", error.message);
        return;
    }

    const variations = {};
    data.forEach(d => {
        variations[d.branch_name] = (variations[d.branch_name] || 0) + 1;
    });

    console.log("Variations found in INVENTORIES:");
    for (const [v, count] of Object.entries(variations)) {
        console.log(` - "${v}": ${count} records`);
    }
}

findAlLCatan();
