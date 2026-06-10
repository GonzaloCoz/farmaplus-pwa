import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env manually
try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const parts = trimmed.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                    process.env[key] = value;
                }
            }
        });
        console.log("Loaded environment variables from .env");
    } else {
        console.warn(".env file not found at " + envPath);
    }
} catch (e) {
    console.error("Error reading .env file:", e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("ERROR: Missing Supabase URL or Key in env.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Using Supabase URL:", supabaseUrl);

    // 1. Query recent ledger entries
    const { data: ledger, error: ledgerError } = await supabase
        .from('inventory_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (ledgerError) {
        console.error("Ledger error:", ledgerError);
    } else {
        console.log("\n--- RECENT LEDGER ENTRIES (inventory_ledger) ---");
        ledger.forEach(row => {
            console.log(`[Ledger] ID: ${row.id} | Lab: ${row.laboratory} | Branch: ${row.branch_name} | Shortage: ${row.adjustment_id_shortage} | Surplus: ${row.adjustment_id_surplus} | CreatedAt: ${row.created_at}`);
        });
    }

    // 2. Query recent adjustments entries
    const { data: adjustments, error: adjError } = await supabase
        .from('inventory_adjustments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (adjError) {
        console.error("Adjustments error:", adjError);
    } else {
        console.log("\n--- RECENT ADJUSTMENTS ENTRIES (inventory_adjustments) ---");
        adjustments.forEach(row => {
            console.log(`[Adjustments] ID: ${row.id} | Lab: ${row.laboratory} | Branch: ${row.branch_name} | Shortage: ${row.adjustment_id_shortage} | Surplus: ${row.adjustment_id_surplus} | CreatedAt: ${row.created_at}`);
        });
    }
}

main();
