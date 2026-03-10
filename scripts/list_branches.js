
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'precount_items'
];

async function listBranches() {
    console.log("Listing unique branch names across tables...");

    for (const table of TABLES) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('branch_name');

            if (error) {
                console.log(`Table ${table}: ERROR - ${error.message}`);
                continue;
            }

            const unique = [...new Set(data.map(d => d.branch_name))].sort();
            console.log(`Table ${table} unique branches:`);
            unique.forEach(b => {
                if (b && b.toUpperCase().includes("CATAN")) {
                    console.log(`  - ${b}`);
                }
            });
        } catch (e) { }
    }
}

listBranches();
