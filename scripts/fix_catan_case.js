
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Fix all Gonzalez Catan variants to UPPERCASE normalized form
const FIXES = [
    { from: 'Gonzalez Catan II', to: 'GONZALEZ CATAN II' },
    { from: 'Gonzalez Catan III', to: 'GONZALEZ CATAN III' },
    { from: 'Gonzalez Catan', to: 'GONZALEZ CATAN' },
];

const TABLES = [
    'inventories',
    'branch_laboratories',
    'inventory_adjustments',
    'inventory_reports',
];

async function fix() {
    console.log("Normalizing branch names to UPPERCASE...\n");

    for (const pair of FIXES) {
        for (const table of TABLES) {
            try {
                const { data: sample } = await supabase.from(table).select('*').limit(1);
                const cols = sample && sample[0] ? Object.keys(sample[0]) : [];
                const branchCol = cols.find(c => c.toLowerCase().includes('branch'));
                if (!branchCol) continue;

                const { data, error } = await supabase
                    .from(table)
                    .update({ [branchCol]: pair.to })
                    .eq(branchCol, pair.from)
                    .select('id');

                if (!error && data && data.length > 0) {
                    console.log(`${table}: "${pair.from}" -> "${pair.to}": ${data.length} rows updated`);
                }
            } catch (e) { }
        }
    }

    // Now recompute progress for all labs in GONZALEZ CATAN II
    console.log("\nRecomputing lab progress for GONZALEZ CATAN II...");
    const { data: labs } = await supabase
        .from('branch_laboratories')
        .select('laboratory')
        .eq('branch_name', 'GONZALEZ CATAN II');

    if (labs) {
        const uniqueLabs = [...new Set(labs.map(l => l.laboratory))];
        for (const lab of uniqueLabs) {
            const { error } = await supabase.rpc('recompute_lab_progress', {
                p_branch_name: 'GONZALEZ CATAN II',
                p_laboratory: lab
            });
            if (error) process.stdout.write('X');
            else process.stdout.write('.');
        }
        console.log("\nDone recomputing.");
    }

    // Verify
    console.log("\nVerification - Labs with progress > 0:");
    const { data: verify } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, controlled_items, adjusted_items, status, progress_percentage')
        .eq('branch_name', 'GONZALEZ CATAN II')
        .gt('total_items', 0);

    verify?.forEach(l => {
        console.log(`  ${l.laboratory}: Total=${l.total_items} | Adj=${l.adjusted_items} | Status=${l.status} | Progress=${l.progress_percentage}%`);
    });
}

fix();
