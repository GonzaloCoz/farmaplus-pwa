import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: userData } = await supabase.auth.getUser();
    console.log("User:", userData); // Probably won't work auth-wise, but lets just query public or try

    // Since we are external, we might not have RLS access. Let's try anyway.
    const { data, error } = await supabase
        .from('branch_laboratories')
        .select('*')
        // .eq('branch_name', 'ALCORTA') // Might need to know the branch name
        .limit(20);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Sample Data:", data);
    }
}

main();
