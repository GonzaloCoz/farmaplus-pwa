import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Supabase URL:", supabaseUrl);

    // 1. Query recent ledger entries
    const { data: ledger, error: ledgerError } = await supabase
        .from('inventory_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (ledgerError) {
        console.error("Ledger error:", ledgerError);
    } else {
        console.log("Ledger recent entries count:", ledger?.length);
        ledger.forEach(row => {
            console.log(`[Ledger] ID: ${row.id} | Lab: ${row.laboratory} | Branch: ${row.branch_name} | Shortage: ${row.adjustment_id_shortage} | Surplus: ${row.adjustment_id_surplus} | CreatedAt: ${row.created_at}`);
        });
    }

    // 2. Query recent adjustments entries
    const { data: adjustments, error: adjError } = await supabase
        .from('inventory_adjustments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (adjError) {
        console.error("Adjustments error:", adjError);
    } else {
        console.log("Adjustments recent entries count:", adjustments?.length);
        adjustments.forEach(row => {
            console.log(`[Adjustments] ID: ${row.id} | Lab: ${row.laboratory} | Branch: ${row.branch_name} | Shortage: ${row.adjustment_id_shortage} | Surplus: ${row.adjustment_id_surplus} | CreatedAt: ${row.created_at}`);
        });
    }
}

main();
