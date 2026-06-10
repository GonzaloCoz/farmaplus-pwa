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
    }
} catch (e) {}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listPolicies() {
    console.log("Querying pg_policies from Supabase...");
    
    // We can query pg_policies using a direct select since Supabase exposes some tables or we can use raw SQL if possible,
    // but we might not have direct select permissions on pg_policies via the API. Let's see if we can do an RPC or regular select.
    // Let's try to query pg_policies through supabase.rpc if a run_sql function exists, or we can just inspect pg_policies if it's exposed, 
    // or we can query information_schema.
    const { data, error } = await supabase.rpc('get_policies_diagnostics', {}); // let's see if any diagnostic function exists
    
    if (error) {
        console.log("No custom rpc get_policies_diagnostics. Trying generic query...");
        // Let's query information_schema or similar
        const { data: data2, error: error2 } = await supabase
            .from('inventory_ledger')
            .select('*')
            .limit(1);
        console.log("ledger error (if RLS error):", error2);
    } else {
        console.log("Policies:", data);
    }
}

listPolicies();
