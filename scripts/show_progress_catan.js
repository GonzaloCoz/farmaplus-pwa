
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function showProgress() {
    const branch = "Gonzalez Catan II";

    const { data: labs } = await supabase
        .from('branch_laboratories')
        .select('laboratory, total_items, controlled_items, adjusted_items, pending_items, status, progress_percentage')
        .eq('branch_name', branch)
        .gt('total_items', 0)
        .order('laboratory');

    console.log(`Labs with progress data for "${branch}":\n`);

    let totalItems = 0, totalControlled = 0, totalAdjusted = 0, totalPending = 0;

    labs.forEach(l => {
        console.log(`${l.laboratory}: Total=${l.total_items} | Ctrl=${l.controlled_items} | Adj=${l.adjusted_items} | Pend=${l.pending_items} | Status=${l.status} | Progress=${l.progress_percentage}%`);
        totalItems += l.total_items;
        totalControlled += l.controlled_items;
        totalAdjusted += l.adjusted_items;
        totalPending += l.pending_items;
    });

    console.log(`\nSUMMARY: ${labs.length} active labs | Total=${totalItems} | Ctrl=${totalControlled} | Adj=${totalAdjusted} | Pend=${totalPending}`);
    console.log(`Overall progress: ${Math.round(((totalControlled + totalAdjusted) / totalItems) * 100)}%`);
}

showProgress();
