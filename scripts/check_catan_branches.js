
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data } = await supabase.from('branch_laboratories').select('branch_name, laboratory, total_items').ilike('branch_name', '%CATAN%');

    const counts = {};
    const active = {};
    data.forEach(r => {
        counts[r.branch_name] = (counts[r.branch_name] || 0) + 1;
        if (r.total_items > 0) {
            active[r.branch_name] = (active[r.branch_name] || 0) + 1;
        }
    });

    console.log("Branch names in branch_laboratories:");
    console.log(counts);
    console.log("Active labs (>0 items) per branch:");
    console.log(active);
}

check();
