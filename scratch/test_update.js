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

async function testUpdate() {
    console.log("Supabase URL:", supabaseUrl);
    
    // 1. Fetch a recent adjustment entry to try updating it
    const { data: adj, error: fetchErr } = await supabase
        .from('inventory_adjustments')
        .select('*')
        .limit(1)
        .single();
    
    if (fetchErr || !adj) {
        console.error("Error fetching recent adjustment entry:", fetchErr);
        return;
    }

    console.log(`Found adjustment: ID=${adj.id}, shortages=${adj.adjustment_id_shortage}, surpluses=${adj.adjustment_id_surplus}`);

    // Try to update it
    console.log("Attempting to update shortage_id to 'TEST_SHORTAGE'...");
    const { data: updateData, error: updateErr, status } = await supabase
        .from('inventory_adjustments')
        .update({
            adjustment_id_shortage: 'TEST_SHORTAGE'
        })
        .eq('id', adj.id)
        .select();

    if (updateErr) {
        console.error("Update error on inventory_adjustments:", updateErr);
    } else {
        console.log("Update status:", status);
        console.log("Updated data (if empty, RLS blocked it):", updateData);
    }
}

testUpdate();
