
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    // This is exactly what the frontend does: normalizeString("Gonzalez Catan II") = "GONZALEZ CATAN II"
    const normalized = "GONZALEZ CATAN II";

    console.log(`Querying branch_laboratories with "${normalized}" (what the frontend uses):\n`);

    const { data, error } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, controlled_items, adjusted_items, pending_items, status, progress_percentage')
        .eq('branch_name', normalized)
        .gt('total_items', 0);

    if (error) {
        console.log("Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("NO DATA FOUND — the frontend query returns empty.");

        // Check what branch_names exist
        const { data: all } = await supabase.from('branch_laboratories').select('branch_name').ilike('branch_name', '%CATAN%');
        const unique = [...new Set(all?.map(d => d.branch_name))];
        console.log("\nBranch names containing 'CATAN' in branch_laboratories:", unique);
    } else {
        console.log(`Found ${data.length} labs with data:`);
        let total = 0, adj = 0;
        data.forEach(l => {
            console.log(`  ${l.laboratory}: Total=${l.total_items} | Adj=${l.adjusted_items} | Status=${l.status} | Progress=${l.progress_percentage}%`);
            total += l.total_items;
            adj += l.adjusted_items;
        });
        console.log(`\nOverall: ${total} items, ${adj} adjusted`);
    }

    // Also check inventories
    console.log("\n---");
    const { count: invNorm } = await supabase.from('inventories').select('*', { count: 'exact', head: true }).eq('branch_name', normalized);
    const { count: invMixed } = await supabase.from('inventories').select('*', { count: 'exact', head: true }).eq('branch_name', 'Gonzalez Catan II');
    console.log(`inventories with "${normalized}": ${invNorm}`);
    console.log(`inventories with "Gonzalez Catan II": ${invMixed}`);
}

verify();
