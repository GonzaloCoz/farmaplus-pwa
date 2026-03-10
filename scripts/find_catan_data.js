
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findCatan() {
    console.log("Searching for ANY branch starting with 'GONZ' or 'Gonz'...");

    const tables = ['inventories', 'branch_laboratories', 'inventory_adjustments', 'inventory_reports', 'precount_items'];

    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.log(`Table ${table} schema error or missing: ${error.message}`);
                continue;
            }

            const cols = data && data[0] ? Object.keys(data[0]) : [];
            let branchCol = cols.find(c => c.toLowerCase().includes('branch'));

            if (!branchCol) {
                console.log(`Table ${table} has NO branch column. Found columns: ${cols.join(", ")}`);
                continue;
            }

            const { data: records, error: fetchError } = await supabase
                .from(table)
                .select(branchCol);

            if (fetchError) {
                console.log(`Table ${table} fetch error: ${fetchError.message}`);
                continue;
            }

            const matching = [...new Set(records.map(r => r[branchCol]))]
                .filter(b => b && b.toUpperCase().startsWith("GONZ"));

            if (matching.length > 0) {
                console.log(`Table ${table} (${branchCol}) matching branches: ${matching.join(", ")}`);

                // Count for each
                for (const m of matching) {
                    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(branchCol, m);
                    console.log(`  - ${m}: ${count} records`);
                }
            }
        } catch (e) {
            console.log(`Unexpected error in ${table}: ${e.message}`);
        }
    }
}

findCatan();
