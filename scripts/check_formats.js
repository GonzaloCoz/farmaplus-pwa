
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFormats() {
    console.log("Sampling branch_name formats from branch_laboratories...");
    const { data } = await supabase.from('branch_laboratories').select('branch_name').limit(50);
    const unique = [...new Set(data.map(d => d.branch_name))].sort();
    unique.forEach(b => console.log(`  "${b}"`));

    console.log("\nSampling branch_name formats from inventories...");
    const { data: inv } = await supabase.from('inventories').select('branch_name').limit(50);
    const uniqueInv = [...new Set(inv.map(d => d.branch_name))].sort();
    uniqueInv.forEach(b => console.log(`  "${b}"`));
}

checkFormats();
