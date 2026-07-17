process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase.halu.com.ar';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Logging in as admin gcoz...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gcoz@farmaplus.system',
    password: 'farmaplus'
  });

  if (authError) {
    console.error("Admin login failed:", authError.message);
    return;
  }

  console.log("Logged in successfully. Querying profiles...");
  
  const { data: profiles, error: errProfiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, branch_id, active')
    .order('username');

  if (errProfiles) {
    console.error("Error fetching profiles:", errProfiles);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    
    // Fetch all branches to map names
    const { data: branches } = await supabase.from('branches').select('id, name');
    
    profiles.forEach(p => {
      const branch = branches ? branches.find(b => b.id === p.branch_id) : null;
      console.log(`  - Username: "${p.username}", Name: "${p.full_name}", Role: "${p.role}", Active: ${p.active}, Branch: ${branch ? branch.name : 'None'}`);
    });

    console.log("\n=== Checking devoto profiles specifically ===");
    const devotoProfiles = profiles.filter(p => p.username.toLowerCase().includes('devoto'));
    console.log(devotoProfiles);
  }
}

run();
