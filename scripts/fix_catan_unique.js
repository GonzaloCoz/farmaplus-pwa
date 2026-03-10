
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixUnique() {
    const fromBranch = 'Gonzalez Catan II';
    const toBranch = 'GONZALEZ CATAN II';

    // 1. Find all active labs in fromBranch
    const { data: activeLabs, error: e1 } = await supabase
        .from('branch_laboratories')
        .select('*')
        .eq('branch_name', fromBranch)
        .gt('total_items', 0);

    if (e1) {
        console.error("Error fetching active labs:", e1);
        return;
    }

    console.log(`Found ${activeLabs.length} active labs under ${fromBranch}`);

    for (const lab of activeLabs) {
        // Check if the target branch_name already has this laboratory
        const { data: existing, error: e2 } = await supabase
            .from('branch_laboratories')
            .select('id')
            .eq('branch_name', toBranch)
            .eq('laboratory', lab.laboratory);

        if (existing && existing.length > 0) {
            console.log(`Lab ${lab.laboratory} already exists under ${toBranch}. Deleting it first...`);
            await supabase.from('branch_laboratories').delete().eq('id', existing[0].id);
        }

        // Now update the active lab to the new branch_name
        console.log(`Updating ${lab.laboratory} to ${toBranch}`);
        const { error: updateErr } = await supabase
            .from('branch_laboratories')
            .update({ branch_name: toBranch })
            .eq('id', lab.id);

        if (updateErr) {
            console.error(`Failed to update ${lab.laboratory}:`, updateErr);
        }
    }

    // Also do this for inventories to be absolutely sure
    const { error: invErr } = await supabase
        .from('inventories')
        .update({ branch_name: toBranch })
        .eq('branch_name', fromBranch);

    if (invErr) {
        console.error("Failed to update inventories:", invErr);
    } else {
        console.log("Updated inventories to", toBranch);
    }

    // Also do this for Gonzalez Catan III -> GONZALEZ CATAN III
    const fromBranch3 = 'Gonzalez Catan III';
    const toBranch3 = 'GONZALEZ CATAN III';
    await supabase.from('inventories').update({ branch_name: toBranch3 }).eq('branch_name', fromBranch3);

    console.log("Fix complete.");
}

fixUnique();
