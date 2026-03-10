
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function recomputeAll() {
    const branch = "Gonzalez Catan II";

    console.log(`Fetching laboratories for "${branch}"...`);

    // Get unique labs from branch_laboratories
    const { data: labs, error } = await supabase
        .from('branch_laboratories')
        .select('laboratory')
        .eq('branch_name', branch);

    if (error) {
        console.log("Error:", error.message);
        return;
    }

    if (labs.length === 0) {
        console.log("No lab entries found in branch_laboratories. Checking inventories instead...");

        // Get unique labs from inventories
        const { data: invData } = await supabase
            .from('inventories')
            .select('laboratory')
            .eq('branch_name', branch);

        if (invData) {
            const uniqueLabs = [...new Set(invData.map(d => d.laboratory))];
            console.log(`Found ${uniqueLabs.length} labs in inventories: ${uniqueLabs.join(', ')}`);

            // Need to create the branch_laboratories entries first, then recompute
            for (const lab of uniqueLabs) {
                console.log(`  Creating metadata for "${lab}"...`);
                const { error: insertErr } = await supabase
                    .from('branch_laboratories')
                    .upsert({ branch_name: branch, laboratory: lab, total_items: 0, controlled_items: 0, status: 'pending' },
                        { onConflict: 'branch_name,laboratory' });
                if (insertErr) console.log(`    Insert error: ${insertErr.message}`);
            }

            // Now recompute
            for (const lab of uniqueLabs) {
                console.log(`  Recomputing progress for "${lab}"...`);
                const { error: rpcErr } = await supabase.rpc('recompute_lab_progress', {
                    p_branch_name: branch,
                    p_laboratory: lab
                });
                if (rpcErr) console.log(`    RPC error: ${rpcErr.message}`);
                else console.log(`    OK`);
            }
        }
    } else {
        const uniqueLabs = [...new Set(labs.map(l => l.laboratory))];
        console.log(`Found ${uniqueLabs.length} labs. Recomputing progress for each...`);

        for (const lab of uniqueLabs) {
            process.stdout.write(`  Recomputing "${lab}"... `);
            const { error: rpcErr } = await supabase.rpc('recompute_lab_progress', {
                p_branch_name: branch,
                p_laboratory: lab
            });
            if (rpcErr) console.log(`ERROR: ${rpcErr.message}`);
            else console.log("OK");
        }
    }

    // Verify results
    console.log("\n--- Verification ---\n");
    const { data: verifyLabs } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, controlled_items, adjusted_items, pending_items, status, progress_percentage')
        .eq('branch_name', branch);

    if (verifyLabs) {
        verifyLabs.forEach(l => {
            console.log(`${l.laboratory}: Total=${l.total_items} | Ctrl=${l.controlled_items} | Adj=${l.adjusted_items} | Pend=${l.pending_items} | Status=${l.status} | Progress=${l.progress_percentage}%`);
        });
    }
}

recomputeAll();
