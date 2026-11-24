import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrlMatch = envFile.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
const supabaseKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);

if (supabaseUrlMatch && supabaseKeyMatch) {
    const url = supabaseUrlMatch[1].trim().replace(/['"]/g, '');
    const key = supabaseKeyMatch[1].trim().replace(/['"]/g, '');

    const supabase = createClient(url, key);

    async function check() {
        console.log("Supabase URL:", url);
        const { data: ledgers, error: err1 } = await supabase
            .from('inventory_ledger')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (err1) {
            console.error("Error reading ledger:", err1);
            return;
        }

        if (!ledgers || ledgers.length === 0) {
            console.log("No ledgers found");
            return;
        }

        const latest = ledgers[0];
        console.log("Latest Ledger Header:", latest);

        const { data: items, error: err2 } = await supabase
            .from('inventory_ledger_items')
            .select('*')
            .eq('ledger_id', latest.id);

        if (err2) {
            console.error("Error reading ledger items:", err2);
            return;
        }

        console.log(`Found ${items?.length || 0} items for this ledger:`);
        items?.forEach(item => {
            console.log(`- ${item.product_name} (${item.ean}): Counted: ${item.counted_quantity}, System: ${item.system_quantity}`);
        });
    }

    check();
} else {
    console.error("Could not parse supabase credentials from .env");
}
