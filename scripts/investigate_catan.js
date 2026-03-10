
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function investigate() {
    const branch = "Gonzalez Catan II";

    console.log(`=== Investigating "${branch}" ===\n`);

    // 1. Check branch_laboratories metadata
    console.log("1. branch_laboratories metadata:");
    const { data: labs, error: labErr } = await supabase
        .from('branch_laboratories')
        .select('*')
        .eq('branch_name', branch);

    if (labErr) console.log("  Error:", labErr.message);
    else if (labs.length === 0) console.log("  NO METADATA ENTRIES FOUND (this is the problem)");
    else {
        labs.forEach(l => {
            console.log(`  Lab: ${l.laboratory} | Total: ${l.total_items} | Controlled: ${l.controlled_items} | Status: ${l.status}`);
        });
    }

    // 2. Check inventories records
    console.log("\n2. inventories records:");
    const { count: invCount } = await supabase
        .from('inventories')
        .select('*', { count: 'exact', head: true })
        .eq('branch_name', branch);
    console.log(`  Total inventory records: ${invCount}`);

    // 3. Check unique labs in inventories for this branch
    const { data: invLabs } = await supabase
        .from('inventories')
        .select('laboratory, status')
        .eq('branch_name', branch);

    if (invLabs) {
        const labStats = {};
        invLabs.forEach(r => {
            if (!labStats[r.laboratory]) labStats[r.laboratory] = { total: 0, controlled: 0, adjusted: 0, pending: 0 };
            labStats[r.laboratory].total++;
            if (r.status === 'controlled') labStats[r.laboratory].controlled++;
            if (r.status === 'adjusted') labStats[r.laboratory].adjusted++;
            if (r.status === 'pending') labStats[r.laboratory].pending++;
        });

        console.log("\n3. Lab breakdown from inventories:");
        for (const [lab, stats] of Object.entries(labStats)) {
            console.log(`  ${lab}: Total=${stats.total} | Controlled=${stats.controlled} | Adjusted=${stats.adjusted} | Pending=${stats.pending}`);
        }
    }

    // 4. Check inventory_adjustments
    const { count: adjCount } = await supabase
        .from('inventory_adjustments')
        .select('*', { count: 'exact', head: true })
        .eq('branch_name', branch);
    console.log(`\n4. inventory_adjustments: ${adjCount} records`);
}

investigate();
