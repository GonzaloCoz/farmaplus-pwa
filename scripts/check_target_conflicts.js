
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'inventory_reports',
    'precount_items'
];

async function check() {
    const source = "GONZALES CATAN II";
    const target = "Gonzalez Catan II";

    console.log(`Checking counts for Source: "${source}" and Target: "${target}"`);

    for (const table of TABLES) {
        try {
            const { data: colsData } = await supabase.from(table).select('*').limit(1);
            const cols = colsData && colsData[0] ? Object.keys(colsData[0]) : [];
            let bCol = cols.find(c => c.toLowerCase().includes('branch'));

            if (!bCol) {
                console.log(`Table ${table}: No branch column.`);
                continue;
            }

            console.log(`Table ${table} (${bCol}):`);
            const { count: sCount } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(bCol, source);
            const { count: tCount } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(bCol, target);

            console.log(`  Source: ${sCount || 0} | Target: ${tCount || 0}`);

            // Also check source variations
            const { count: sVarCount } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(bCol, "Gonzales Catan II");
            if (sVarCount > 0) {
                console.log(`  Variation "Gonzales Catan II": ${sVarCount}`);
            }
        } catch (e) {
            console.log(`  Error in ${table}: ${e.message}`);
        }
    }
}

check();
