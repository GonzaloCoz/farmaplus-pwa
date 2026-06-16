const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}\\s*=\\s*(.+)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

async function fetchAll(tableName, queryParams = '', select = '*') {
    let allData = [];
    let page = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * limit;
        const to = from + limit - 1;
        const url = `${supabaseUrl}/rest/v1/${tableName}?select=${select}&limit=${limit}&offset=${from}${queryParams}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'count=exact'
                }
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }
            
            const contentRange = response.headers.get('content-range');
            const data = await response.json();
            allData = allData.concat(data);
            
            console.log(`Fetched ${data.length} rows for ${tableName} (offset ${from}). Range: ${contentRange}`);
            
            if (data.length < limit) {
                hasMore = false;
            } else {
                page++;
            }
        } catch (error) {
            console.error(`Error querying ${tableName}:`, error.message);
            break;
        }
    }
    return allData;
}

async function run() {
    console.log('--- FETCHING BRANCH LABORATORIES ---');
    const branchLabs = await fetchAll('branch_laboratories', '', 'branch_name,laboratory,category,status,progress_percentage,updated_at');
    console.log(`Total branch_laboratories fetched: ${branchLabs.length}`);

    console.log('\n--- FETCHING AUDIT LOGS FOR ADJUSTMENTS ---');
    // We filter by action=eq.INVENTORY_ADJUSTMENT in PostgREST format
    const auditLogs = await fetchAll('audit_logs', '&action=eq.INVENTORY_ADJUSTMENT', 'created_at,branch_id,action,details');
    console.log(`Total audit_logs fetched: ${auditLogs.length}`);

    // Let's write the raw counts or dump it to inspect
    fs.writeFileSync(path.join(__dirname, 'branch_labs.json'), JSON.stringify(branchLabs, null, 2));
    fs.writeFileSync(path.join(__dirname, 'audit_logs.json'), JSON.stringify(auditLogs, null, 2));
}

run();
