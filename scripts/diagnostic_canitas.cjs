const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
    console.log('--- DIAGNOSTIC FOR LAS CAÑITAS ---');
    
    // 1. Check branch_laboratories
    const { data: labs, error: labsError } = await supabase
        .from('branch_laboratories')
        .select('*')
        .ilike('branch_name', 'Las Cañitas');
    
    if (labsError) {
        console.error('Labs Error:', labsError);
    } else {
        console.log('Total Lab Rows:', labs.length);
        const weightedSum = labs.reduce((acc, l) => acc + (l.progress_percentage || 0), 0);
        console.log('Weighted Progress Sum:', weightedSum);
        console.log('Calculated Average %:', labs.length > 0 ? (weightedSum / labs.length).toFixed(2) : 0);
        
        const completed = labs.filter(l => l.status === 'completed' || l.progress_percentage >= 100).length;
        const inProgress = labs.filter(l => l.progress_percentage > 0 && l.progress_percentage < 100).length;
        console.log('Labs Completed:', completed);
        console.log('Labs In Progress:', inProgress);
    }

    // 2. Check branch_summaries view (raw)
    const { data: summary, error: sumError } = await supabase
        .from('branch_summaries')
        .select('*')
        .ilike('branch_name', 'Las Cañitas')
        .single();
    
    if (sumError) {
        console.error('Summary Error:', sumError);
    } else {
        console.log('--- DB VIEW DATA ---');
        console.log(JSON.stringify(summary, null, 2));
    }
}

check();
