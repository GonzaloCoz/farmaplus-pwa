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
    const ean = '7795345123394';
    console.log(`Querying inventory_ledger_items for EAN: ${ean}...`);
    // Query items join to ledger
    const ledgerItems = await queryTable('inventory_ledger_items', `?select=*,inventory_ledger(*)&ean=eq.${ean}`);
    if (ledgerItems) {
        console.log(`Found ${ledgerItems.length} ledger item records.`);
        console.log(JSON.stringify(ledgerItems, null, 2));
    } else {
        console.log("No records found or error occurred.");
    }
}

run();
