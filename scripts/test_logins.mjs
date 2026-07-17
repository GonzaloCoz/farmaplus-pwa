process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase.halu.com.ar';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin(username) {
  const email = `${username}@farmaplus.system`;
  const password = 'farmaplus';
  
  console.log(`Testing login for: ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error(`  - Failed: ${error.message}`);
    return null;
  } else {
    console.log(`  - Success! User ID: ${data.user.id}`);
    
    // Now let's try to query profiles since we are authenticated
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();
      
    if (profileErr) {
      console.error(`  - Profile fetch error: ${profileErr.message}`);
    } else {
      console.log(`  - Profile data:`, profile);
    }
    return data.user.id;
  }
}

async function run() {
  await testLogin('devoto');
  await testLogin('devotoiii');
  await testLogin('gcoz');
}

run();
