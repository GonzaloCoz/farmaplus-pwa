import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const supabaseKey = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cloneDevotoLabs() {
    try {
        console.log("Starting clone of 'Devoto' labs to 'Devoto X'...");

        // 1. Get all labs for Devoto
        const { data: devotoLabs, error: fetchError } = await supabase
            .from('branch_laboratories')
            .select('*')
            .eq('branch_name', 'Devoto');

        if (fetchError) {
            console.error("Error fetching 'Devoto' branch_laboratories:", fetchError);
            return;
        }

        if (!devotoLabs || devotoLabs.length === 0) {
            console.log("No laboratories found for 'Devoto'.");
            return;
        }

        console.log(`Found ${devotoLabs.length} labs for 'Devoto'. Copying to 'Devoto X'...`);

        // Clean up previously inserted partial data for "Devoto X"
        console.log("Cleaning up existing 'Devoto X' data...");
        const { error: deleteError } = await supabase
            .from('branch_laboratories')
            .delete()
            .eq('branch_name', 'Devoto X');

        if (deleteError) {
            console.error("Failed to delete existing Devoto X data:", deleteError);
            return;
        }

        // 2. Map exactly to "Devoto X", strip `id` and `created_at` and deduplicate.
        const seen = new Set();
        const newLabs = [];

        for (const lab of devotoLabs) {
            const cat = lab.category || 'Varios';
            const key = `${lab.laboratory}|${cat}`;
            if (!seen.has(key)) {
                seen.add(key);
                const { id, created_at, updated_at, ...rest } = lab;
                newLabs.push({
                    ...rest,
                    branch_name: 'Devoto X'
                });
            }
        }

        let inserted = 0;
        let failed = 0;

        // Insert manually in bulk
        const { error: insertError } = await supabase
            .from('branch_laboratories')
            .insert(newLabs);

        if (insertError) {
            console.error(`Error in bulk insert:`, insertError);
            failed = newLabs.length;
        } else {
            inserted = newLabs.length;
        }

        console.log(`Copying done. Inserted: ${inserted}, Failed: ${failed}.`);
    } catch (e) {
        console.error("Global error:", e);
    }
}

cloneDevotoLabs();
