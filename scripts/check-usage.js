import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function checkCounts() {
  console.log('Checking Supabase Table Counts...');
  
  const tables = ['precount_items', 'precount_sessions', 'profiles', 'branches', 'inventories', 'products'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error counting ${table}:`, error.message);
    } else {
      console.log(`${table}: ${count} records`);
    }
  }
}

checkCounts();
