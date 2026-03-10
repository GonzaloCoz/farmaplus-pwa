
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'precount_items',
    'inventory_reports',
    'branch_goals',
    'branch_notifications'
];

const VARIATIONS = [
    'Gonzales Catan II',
    'GONZALES CATAN II',
    'Gonzales Catan',
    'GONZALES CATAN',
    'gonzales catan ii'
];

async function detectData() {
    console.log("Deep searching for misspelled branch data...");

    for (const table of TABLES) {
        for (const variant of VARIATIONS) {
            try {
                const { data, error, count } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })
                    .eq('branch_name', variant);

                if (!error && count > 0) {
                    console.log(`Table ${table} -> Variant "${variant}": ${count} records.`);
                }
            } catch (e) { }
        }
    }
}

detectData();
