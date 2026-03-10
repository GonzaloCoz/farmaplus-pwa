
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function recomputeFinal() {
    const toBranch = 'GONZALEZ CATAN II';

    console.log(`Fetching distinct laboratories in inventories for ${toBranch}...`);
    const { data: labs, error: e1 } = await supabase
        .from('inventories')
        .select('laboratory')
        .eq('branch_name', toBranch);

    if (e1) {
        console.error("Error fetching inventories:", e1);
        return;
    }

    const uniqueLabs = [...new Set(labs.map(l => l.laboratory))];
    console.log(`Found ${uniqueLabs.length} unique laboratories. Recomputing progress for each...`);

    for (const lab of uniqueLabs) {
        // First make sure the laboratory entry exists
        await supabase
            .from('branch_laboratories')
            .upsert({ branch_name: toBranch, laboratory: lab, total_items: 0, controlled_items: 0, status: 'pending' },
                { onConflict: 'branch_name,laboratory' });

        // Then recompute
        const { error: rpcErr } = await supabase.rpc('recompute_lab_progress', {
            p_branch_name: toBranch,
            p_laboratory: lab
        });
        if (rpcErr) {
            console.error(`Failed to recompute ${lab}: ${rpcErr.message}`);
        } else {
            process.stdout.write(".");
        }
    }

    console.log("\nDone recomputing. Checking final stats:");

    const { data: stats } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, adjusted_items, status, progress_percentage')
        .eq('branch_name', toBranch)
        .gt('total_items', 0);

    let totalItems = 0;
    stats?.forEach(s => {
        console.log(`  ${s.laboratory}: Total=${s.total_items} | Adj=${s.adjusted_items} | Progress=${s.progress_percentage}%`);
        totalItems += s.total_items;
    });
    console.log(`\nVerified Total Items: ${totalItems}`);
}

recomputeFinal();
