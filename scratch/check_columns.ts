
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('branch_summaries')
    .select('negative_units, positive_units')
    .limit(1);

  if (error) {
    console.log("Columns negative_units/positive_units do NOT exist in branch_summaries.");
  } else {
    console.log("Columns negative_units/positive_units EXIST in branch_summaries.");
  }
}

checkColumns();
