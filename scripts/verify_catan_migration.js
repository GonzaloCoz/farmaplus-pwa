
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    const tables = ['inventories', 'branch_laboratories', 'inventory_adjustments', 'inventory_reports'];

    console.log("Post-migration verification: checking for remaining 'GONZALES' records...\n");

    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).ilike('branch_name', '%GONZALES%');
        console.log(`Table ${table}: ${count || 0} records with 'GONZALES'`);
    }

    console.log("\nChecking correct 'Gonzalez Catan' counts...\n");

    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).ilike('branch_name', '%Gonzalez Catan%');
        console.log(`Table ${table}: ${count || 0} records with 'Gonzalez Catan'`);
    }
}

verify();
