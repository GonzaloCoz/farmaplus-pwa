
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapping: misspelled -> correct
const BRANCH_MAPPING = [
    { from: 'GONZALES CATAN II', to: 'Gonzalez Catan II' },
    { from: 'GONZALES CATAN III', to: 'Gonzalez Catan III' },
    { from: 'Gonzales Catan II', to: 'Gonzalez Catan II' },
    { from: 'Gonzales Catan III', to: 'Gonzalez Catan III' },
    { from: 'gonzales catan ii', to: 'Gonzalez Catan II' },
];

const TABLES = [
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'inventory_reports',
];

async function migrate() {
    console.log("Starting Gonzalez Catan branch name migration...\n");

    for (const pair of BRANCH_MAPPING) {
        const { from, to } = pair;

        for (const table of TABLES) {
            try {
                // First detect the column name
                const { data: sample } = await supabase.from(table).select('*').limit(1);
                const cols = sample && sample[0] ? Object.keys(sample[0]) : [];
                const branchCol = cols.find(c => c.toLowerCase().includes('branch'));

                if (!branchCol) continue;

                const { data, error } = await supabase
                    .from(table)
                    .update({ [branchCol]: to })
                    .eq(branchCol, from)
                    .select('id');

                if (error) {
                    if (error.code !== '42P01') {
                        console.log(`Table ${table} [${from} -> ${to}]: ERROR - ${error.message}`);
                    }
                } else {
                    const affected = data ? data.length : 0;
                    if (affected > 0) {
                        console.log(`Table ${table} [${from} -> ${to}]: ${affected} rows updated.`);
                    }
                }
            } catch (e) {
                // silently skip
            }
        }
    }

    console.log("\nMigration complete.");
}

migrate();
