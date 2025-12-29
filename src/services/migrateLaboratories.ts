import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { BRANCH_NAMES } from '@/config/users';

/**
 * Migration script to populate branch_laboratories table from lab_sucu.xlsx
 * This preserves the original laboratory assignments per branch
 */

interface LabAssignment {
    name: string;
    category: string;
}

// Parse labs from a worksheet (same logic as preCountDB.ts)
function parseSheetLabs(worksheet: XLSX.WorkSheet): LabAssignment[] {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length < 2) return [];

    const headers = jsonData[1];
    const result: LabAssignment[] = [];

    for (let c = 0; c < headers.length; c++) {
        const category = String(headers[c]).trim();
        if (!category) continue;

        for (let r = 2; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (row && row[c]) {
                const labName = String(row[c]).trim();
                if (labName.length > 0) {
                    result.push({
                        name: labName.toUpperCase(),
                        category: category.toUpperCase()
                    });
                }
            }
        }
    }
    return result;
}

export async function migrateLaboratoryAssignments() {
    try {
        console.log('Starting laboratory assignments migration...');

        // 1. Load lab_sucu.xlsx
        const response = await fetch('/lab_sucu.xlsx');
        if (!response.ok) {
            throw new Error('Could not load lab_sucu.xlsx');
        }

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);

        // Create sheet name map (case-insensitive)
        const sheetMap = new Map<string, string>();
        workbook.SheetNames.forEach(s => sheetMap.set(s.toLowerCase().trim(), s));

        let totalInserted = 0;
        let totalUpdated = 0;

        // 2. Process each branch
        for (const branchName of BRANCH_NAMES) {
            const sheetName = sheetMap.get(branchName.toLowerCase().trim());

            if (!sheetName) {
                console.warn(`No sheet found for branch: ${branchName}`);
                continue;
            }

            // Get all labs for this branch
            const labs = parseSheetLabs(workbook.Sheets[sheetName]);
            console.log(`Found ${labs.length} labs for ${branchName}`);

            // 3. For each lab, check if there's existing inventory data
            for (const lab of labs) {
                // Check if inventory exists for this branch-lab combination
                const { data: inventoryData } = await supabase
                    .from('inventories')
                    .select('status, quantity, system_quantity, products(cost)')
                    .eq('branch_name', branchName)
                    .eq('laboratory', lab.name);

                let metadata: any = {
                    branch_name: branchName,
                    laboratory: lab.name,
                    total_items: 0,
                    controlled_items: 0,
                    adjusted_items: 0,
                    pending_items: 0,
                    progress_percentage: 0,
                    total_system_units: 0,
                    net_units: 0,
                    net_value: 0,
                    negative_value: 0,
                    positive_value: 0,
                    status: 'pending' as const
                };

                // If inventory exists, calculate stats
                if (inventoryData && inventoryData.length > 0) {
                    const total = inventoryData.length;
                    const controlled = inventoryData.filter(i => i.status === 'controlled').length;
                    const adjusted = inventoryData.filter(i => i.status === 'adjusted').length;
                    const pending = inventoryData.filter(i => i.status === 'pending').length;

                    let totalSystemUnits = 0;
                    let netUnits = 0;
                    let netValue = 0;
                    let negativeValue = 0;
                    let positiveValue = 0;

                    inventoryData.forEach((item: any) => {
                        if (item.status === 'controlled' || item.status === 'adjusted') {
                            const qty = item.quantity || 0;
                            const sysQty = item.system_quantity || 0;
                            const cost = item.products?.cost || 0;
                            const diff = qty - sysQty;
                            const value = diff * cost;

                            totalSystemUnits += sysQty;
                            netUnits += diff;
                            netValue += value;

                            if (diff < 0) negativeValue += value;
                            else if (diff > 0) positiveValue += value;
                        }
                    });

                    const progress = total > 0 ? ((controlled + adjusted) / total) * 100 : 0;
                    const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending';

                    metadata = {
                        ...metadata,
                        total_items: total,
                        controlled_items: controlled,
                        adjusted_items: adjusted,
                        pending_items: pending,
                        progress_percentage: Number(progress.toFixed(1)),
                        total_system_units: totalSystemUnits,
                        net_units: netUnits,
                        net_value: netValue,
                        negative_value: negativeValue,
                        positive_value: positiveValue,
                        status
                    };
                }

                // 4. Upsert to branch_laboratories
                const { error } = await (supabase as any)
                    .from('branch_laboratories')
                    .upsert(metadata, {
                        onConflict: 'branch_name,laboratory'
                    });

                if (error) {
                    console.error(`Error upserting ${branchName} - ${lab.name}:`, error);
                } else {
                    if (metadata.total_items > 0) {
                        totalUpdated++;
                    } else {
                        totalInserted++;
                    }
                }
            }
        }

        console.log(`Migration complete! Inserted: ${totalInserted}, Updated: ${totalUpdated}`);
        return { inserted: totalInserted, updated: totalUpdated };

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Auto-run on import (for testing)
// migrateLaboratoryAssignments();
