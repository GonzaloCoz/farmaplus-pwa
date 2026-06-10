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
        console.log("Loaded env variables.");
    }
} catch (e) {
    console.error("Error loading env:", e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Supabase URL:", supabaseUrl);
    
    console.log("Attempting to insert test ledger entry...");
    const { data, error, status } = await supabase
        .from('inventory_ledger')
        .insert({
            branch_name: 'TEST BRANCH',
            laboratory: 'TEST LAB',
            category: 'TEST CATEGORY',
            user_name: 'TEST USER',
            adjustment_id_shortage: '111111',
            adjustment_id_surplus: '222222',
            total_shortage_value: 100.50,
            total_surplus_value: 200.75,
            total_net_value: 100.25,
            total_items_adjusted: 5
        })
        .select();

    if (error) {
        console.error("Insert error on inventory_ledger:", error);
    } else {
        console.log("Insert status:", status);
        console.log("Inserted ledger data:", data);
        
        if (data && data.length > 0) {
            const ledgerId = data[0].id;
            console.log("Ledger entry created with ID:", ledgerId);
            
            // Try to clean it up
            console.log("Cleaning up test ledger entry...");
            const { error: deleteErr } = await supabase
                .from('inventory_ledger')
                .delete()
                .eq('id', ledgerId);
            if (deleteErr) {
                console.error("Error deleting test entry:", deleteErr);
            } else {
                console.log("Cleaned up successfully.");
            }
        }
    }
}

testInsert();
