process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase.halu.com.ar';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("Connecting to:", supabaseUrl);

  console.log("\n=== 1. Fetching all branches ===");
  const { data: branches, error: errBranches } = await supabase
    .from('branches')
    .select('id, name, slug')
    .order('name');

  if (errBranches) {
    console.error("Error fetching branches:", errBranches);
  } else {
    console.log(`Found ${branches.length} branches:`);
    branches.forEach(b => {
      console.log(`  - [${b.id}] Name: "${b.name}", Slug: "${b.slug}"`);
    });
  }

  console.log("\n=== 2. Fetching branch profiles ===");
  const { data: profiles, error: errProfiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, branch_id, active')
    .order('username');

  if (errProfiles) {
    console.error("Error fetching profiles:", errProfiles);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => {
      const branch = branches ? branches.find(b => b.id === p.branch_id) : null;
      console.log(`  - [${p.id}] Username: "${p.username}", Name: "${p.full_name}", Role: "${p.role}", Active: ${p.active}, Branch: ${branch ? branch.name : 'None (or id: ' + p.branch_id + ')'}`);
    });
  }

  console.log("\n=== 3. Specific check for devotoiii ===");
  const devotoProfiles = profiles ? profiles.filter(p => p.username.toLowerCase().includes('devoto')) : [];
  console.log(`Profiles matching "devoto":`, devotoProfiles);

  const devotoBranches = branches ? branches.filter(b => b.name.toLowerCase().includes('devoto') || b.slug.toLowerCase().includes('devoto')) : [];
  console.log(`Branches matching "devoto":`, devotoBranches);
}

diagnose();
