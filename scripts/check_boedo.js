
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const supabaseKey = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBoedo() {
    console.log("--- DIAGNÓSTICO BOEDO FINAL ---");

    // 1. Perfil
    const { data: profile } = await supabase.from('profiles').select('*').eq('username', 'boedo').maybeSingle();
    console.log("Perfil 'boedo':", profile ? "EXISTE" : "NO EXISTE", profile);

    // 2. Branch Laboratories
    const { data: labs } = await supabase.from('branch_laboratories').select('*').eq('branch_name', 'Boedo');
    console.log("Total labs en branch_laboratories:", labs?.length || 0);
    if (labs && labs.length > 0) {
        console.log("Primer lab:", labs[0]);
    }

    // 3. Inventories
    const { data: invCount } = await supabase.from('inventories').select('id', { count: 'exact', head: true }).eq('branch_name', 'Boedo');
    console.log("Total items en inventories:", invCount ? invCount.length : 0);

    // 4. Sucursales registradas
    const { data: branch } = await supabase.from('branches').select('*').eq('name', 'Boedo').maybeSingle();
    console.log("Sucursal 'Boedo' en tabla branches:", branch ? "EXISTE" : "NO EXISTE", branch);
}

checkBoedo();
