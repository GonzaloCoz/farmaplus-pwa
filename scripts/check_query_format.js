
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeString(str) {
    return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

async function check() {
    const branchFromConfig = "Gonzalez Catan II"; // from BRANCH_NAMES
    const normalized = normalizeString(branchFromConfig); // What frontend uses

    console.log("Config name:", branchFromConfig);
    console.log("Normalized (what frontend queries with):", normalized);

    // Check what format the data is actually stored in
    const { data: sample } = await supabase
        .from('inventories')
        .select('branch_name')
        .ilike('branch_name', '%catan ii%')
        .limit(5);

    console.log("\nActual branch_name values in inventories:");
    sample?.forEach(s => console.log(`  "${s.branch_name}"`));

    // Check what format the metadata is stored in
    const { data: metaSample } = await supabase
        .from('branch_laboratories')
        .select('branch_name')
        .ilike('branch_name', '%catan ii%')
        .limit(5);

    console.log("\nActual branch_name values in branch_laboratories:");
    metaSample?.forEach(s => console.log(`  "${s.branch_name}"`));

    // Try querying with the normalized version (what frontend does)
    const { count: normCount } = await supabase
        .from('inventories')
        .select('*', { count: 'exact', head: true })
        .eq('branch_name', normalized);
    console.log(`\nQuery with normalized "${normalized}": ${normCount} records`);

    // Try querying with the config name directly
    const { count: directCount } = await supabase
        .from('inventories')
        .select('*', { count: 'exact', head: true })
        .eq('branch_name', branchFromConfig);
    console.log(`Query with config "${branchFromConfig}": ${directCount} records`);
}

check();
