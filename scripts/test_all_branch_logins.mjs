process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase.halu.com.ar';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Logging in as admin to get branch usernames...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gcoz@farmaplus.system',
    password: 'farmaplus'
  });

  if (authError) {
    console.error("Admin login failed:", authError.message);
    return;
  }

  // Get all branch profiles
  const { data: profiles, error: errProfiles } = await supabase
    .from('profiles')
    .select('username, active, branch_id')
    .eq('role', 'branch');

  if (errProfiles) {
    console.error("Error fetching profiles:", errProfiles);
    return;
  }

  // Get branches to map names
  const { data: branches } = await supabase.from('branches').select('id, name');
  const branchMap = {};
  branches.forEach(b => {
    branchMap[b.id] = b.name;
  });

  console.log(`Found ${profiles.length} branch profiles. Testing login for each with default password 'farmaplus'...`);
  
  // Sign out admin
  await supabase.auth.signOut();

  const successList = [];
  const failList = [];

  for (const profile of profiles) {
    const email = `${profile.username}@farmaplus.system`;
    const branchName = branchMap[profile.branch_id] || 'Unknown Branch';
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'farmaplus'
    });

    if (error) {
      failList.push({ username: profile.username, branchName, error: error.message });
      console.log(`❌ ${profile.username} (${branchName}): FAILED (${error.message})`);
    } else {
      successList.push({ username: profile.username, branchName });
      console.log(`✅ ${profile.username} (${branchName}): SUCCESS`);
      // Sign out to clean up session
      await supabase.auth.signOut();
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Total Success: ${successList.length}`);
  console.log(`Total Failed: ${failList.length}`);
  
  if (failList.length > 0) {
    console.log("\nFailed logins detail:");
    failList.forEach(f => {
      console.log(`  - Username: "${f.username}", Branch: "${f.branchName}", Reason: ${f.error}`);
    });
  }
}

run();
