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

console.log(`URL: ${supabaseUrl}`);

async function queryTable(tableName, queryParams = '') {
    const url = `${supabaseUrl}/rest/v1/${tableName}${queryParams}`;
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error querying ${tableName}:`, error.message);
        return null;
    }
}

async function run() {
    console.log('Querying branch_laboratories...');
    // branch_laboratories records the progress of each laboratory in each branch
    const branchLabs = await queryTable('branch_laboratories', '?select=*&limit=100');
    if (branchLabs) {
        console.log(`Found ${branchLabs.length} records in branch_laboratories.`);
        // Let's see if there are completed ones
        const completed = branchLabs.filter(l => l.status === 'completed' || l.progress_percentage >= 100);
        console.log(`Completed/100% labs count: ${completed.length}`);
        if (completed.length > 0) {
            console.log('Sample completed labs:');
            console.log(completed.slice(0, 10));
        }
    }

    console.log('\nQuerying audit_logs...');
    // Let's see if we can read audit_logs (might fail due to RLS if not logged in as admin)
    const logs = await queryTable('audit_logs', '?select=*&order=created_at.asc&limit=100');
    if (logs) {
        console.log(`Found ${logs.length} records in audit_logs.`);
        console.log(logs.slice(0, 20));
    }
}

run();
