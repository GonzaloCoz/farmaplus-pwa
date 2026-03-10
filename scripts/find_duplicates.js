
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://nqrwqrmigaknitmvlokp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

async function getUniqueLabs(tableName) {
    let labs = new Set();
    let from = 0;
    let finished = false;

    while (!finished) {
        const { data, error } = await supabase
            .from(tableName)
            .select('laboratory')
            .range(from, from + 999);

        if (error) {
            if (error.code !== '42P01') console.error(`Error in ${tableName}:`, error.message);
            break;
        }

        if (data.length === 0) {
            finished = true;
        } else {
            data.forEach(row => {
                if (row.laboratory) labs.add(row.laboratory);
            });
            if (data.length < 1000) {
                finished = true;
            } else {
                from += 1000;
                if (from > 200000) finished = true;
            }
        }
    }
    return Array.from(labs);
}

async function runAudit() {
    const tables = ['branch_laboratories', 'products', 'inventories'];
    const allLabs = new Set();

    for (const table of tables) {
        const tableLabs = await getUniqueLabs(table);
        tableLabs.forEach(l => allLabs.add(l));
    }

    const normalizedMap = {};
    allLabs.forEach(lab => {
        const norm = normalize(lab);
        if (!normalizedMap[norm]) normalizedMap[norm] = [];
        normalizedMap[norm].push(lab);
    });

    const duplicates = [];
    for (const norm in normalizedMap) {
        if (normalizedMap[norm].length > 1) {
            duplicates.push({
                normalized: norm,
                variations: normalizedMap[norm].sort()
            });
        }
    }

    let output = "--- Duplicate Laboratories Report ---\n\n";
    if (duplicates.length === 0) {
        output += "No laboratory duplicates found (differing only by accents).";
    } else {
        duplicates.sort((a, b) => a.normalized.localeCompare(b.normalized)).forEach(d => {
            output += `${d.normalized}: ${d.variations.join(" vs ")}\n`;
        });
    }

    fs.writeFileSync('duplicate_labs_report.txt', output);
    console.log("Report generated: duplicate_labs_report.txt");
}

runAudit();
