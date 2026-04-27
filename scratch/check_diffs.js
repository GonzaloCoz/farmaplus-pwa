
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventories() {
  const { data, error } = await supabase
    .from('inventories')
    .select('branch_name, quantity, system_quantity')
    .eq('branch_name', 'Caballito')
    .neq('laboratory', '_CONFIG_');

  if (error) {
    console.error("Error", error);
    return;
  }

  let pos = 0;
  let neg = 0;
  let net = 0;

  data.forEach(item => {
    const diff = item.quantity - item.system_quantity;
    if (diff > 0) pos += diff;
    if (diff < 0) neg += diff;
    net += diff;
  });

  console.log(`Caballito - Real Pos: ${pos}, Real Neg: ${neg}, Real Net: ${net}`);
}

checkInventories();
