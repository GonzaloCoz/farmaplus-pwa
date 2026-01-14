
import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";
import { getAllBranchLabCounts } from './preCountDB';
import { BRANCH_NAMES } from "@/config/users";

export interface CyclicInventoryStats {
    labName: string;
    category: string;
    status: LaboratoryStatus;
    totalItems: number;
    controlledItems: number;
    progress: number;

    // Financials
    negativeValue: number;
    positiveValue: number;
    netValue: number;
    differenceValue: number;

    // Units
    totalSystemUnits: number;
    negativeUnits: number;
    positiveUnits: number;
    netUnits: number;
}

export interface CyclicItem {
    id: string;
    ean: string;
    name: string;
    systemQuantity: number;
    countedQuantity: number;
    cost: number;
    status: 'pending' | 'controlled' | 'adjusted';
    category?: string;
    wasReadjusted?: boolean;
}

export const cyclicInventoryService = {
    // Get inventory for a specific lab (Supabase)
    getLabInventory: async (branchName: string, labName: string): Promise<CyclicItem[]> => {
        try {
            const { data, error } = await supabase
                .from('inventories')
                .select(`
                    id,
                    ean,
                    quantity,
                    system_quantity,
                    status,
                    was_readjusted,
                    products (
                        name,
                        cost,
                        category
                    )
                `)
                .eq('branch_name', branchName)
                .eq('laboratory', labName);

            if (error) {
                console.error(`Error loading inventory for ${labName}:`, error);
                return [];
            }

            // Map Supabase result to CyclicItem
            return data.map((item: any) => ({
                id: item.id,
                ean: item.ean,
                name: item.products?.name || 'Desconocido',
                systemQuantity: item.system_quantity || 0,
                countedQuantity: item.quantity,
                cost: item.products?.cost || 0,
                status: item.status as 'pending' | 'controlled' | 'adjusted',
                category: item.products?.category,
                wasReadjusted: item.was_readjusted
            }));
        } catch (e) {
            console.error(`Error loading inventory for ${labName}`, e);
            return [];
        }
    },

    // Save inventory (Upsert)
    saveInventory: async (branchName: string, labName: string, items: CyclicItem[]) => {
        try {
            // Prepare items payload for the RPC function
            const rpcItems = items.map(item => ({
                ean: item.ean,
                name: item.name,
                category: item.category,
                cost: item.cost || 0,
                countedQuantity: item.countedQuantity,
                systemQuantity: item.systemQuantity,
                status: item.status,
                wasReadjusted: item.wasReadjusted || false
            }));

            // Call the database function (RPC)
            // This handles BOTH product creation (if missing) and inventory upsert atomically
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await supabase.rpc('save_cyclic_inventory', {
                p_branch_name: branchName,
                p_laboratory: labName,
                p_items: rpcItems as any // Keeping 'as any' for complex Json mapping for now to avoid specific Json type errors
            });

            if (error) {
                console.error('Error calling save_cyclic_inventory RPC:', error);
                throw error;
            }

            // Update metadata table for real-time monitoring
            await cyclicInventoryService.updateLabMetadata(branchName, labName, items);

        } catch (e) {
            console.error("Error saving inventory:", e);
            throw e;
        }
    },

    // Delete inventory
    deleteInventory: async (branchName: string, labName: string) => {
        const { error } = await supabase.from('inventories')
            .delete()
            .eq('branch_name', branchName)
            .eq('laboratory', labName);

        if (error) {
            console.error("Error deleting inventory:", error);
            throw error;
        }
    },

    // Delete adjustment history for a laboratory
    deleteAdjustmentHistory: async (branchName: string, labName: string) => {
        const { error } = await supabase.from('inventory_adjustments')
            .delete()
            .eq('branch_name', branchName)
            .eq('laboratory', labName);

        if (error) {
            console.error("Error deleting adjustment history:", error);
            throw error;
        }
    },

    // Update laboratory metadata for real-time monitoring
    updateLabMetadata: async (branchName: string, labName: string, items: CyclicItem[]): Promise<void> => {
        try {
            // Group items by category to split metadata records
            const grouped: Record<string, CyclicItem[]> = {};
            items.forEach(item => {
                const cat = item.category || 'Varios';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            // Iterate each category and upsert its own stats
            const upsertPromises = Object.entries(grouped).map(async ([category, catItems]) => {
                const stats = cyclicInventoryService.calculateStats(catItems);

                // Count items by status
                const controlledItems = catItems.filter(i => i.status === 'controlled').length;
                const adjustedItems = catItems.filter(i => i.status === 'adjusted').length;
                const pendingItems = catItems.filter(i => i.status === 'pending').length;

                // Determine overall status
                let status: 'pending' | 'in_progress' | 'completed' = 'pending';
                if (stats.progress === 100) status = 'completed';
                else if (stats.progress > 0) status = 'in_progress';

                // Upsert to metadata table with composite key (Branch + Lab + Category)
                return supabase
                    .from('branch_laboratories')
                    .upsert({
                        branch_name: branchName,
                        laboratory: labName,
                        category: category, // NEW: Include Category in unique identifier
                        total_items: catItems.length,
                        controlled_items: controlledItems,
                        adjusted_items: adjustedItems,
                        pending_items: pendingItems,
                        progress_percentage: stats.progress,
                        total_system_units: stats.totalSystemUnits,
                        net_units: stats.netUnits,
                        net_value: stats.net,
                        negative_value: stats.negative,
                        positive_value: stats.positive,
                        status: status
                    }, {
                        // Crucial: This requires the DB constraint to be updated to (branch_name, laboratory, category)
                        onConflict: 'branch_name,laboratory,category'
                    });
            });

            const results = await Promise.all(upsertPromises);

            // Log any errors
            results.forEach(({ error }) => {
                if (error) console.error('Error updating lab metadata chunk:', error);
            });

        } catch (e) {
            console.error('Error in updateLabMetadata:', e);
        }
    },

    calculateStats: (items: CyclicItem[]): {
        negative: number, positive: number, net: number, progress: number, status: LaboratoryStatus,
        negativeUnits: number, positiveUnits: number, netUnits: number, totalSystemUnits: number
    } => {
        let negative = 0;
        let positive = 0;
        let controlledCount = 0;

        // Unit stats
        let negativeUnits = 0;
        let positiveUnits = 0;
        let totalSystemUnits = 0;

        items.forEach(item => {
            if (item.status === 'controlled' || item.status === 'adjusted') {
                controlledCount++;
                const diff = item.countedQuantity - item.systemQuantity;
                const value = diff * item.cost;

                totalSystemUnits += item.systemQuantity;

                if (diff < 0) {
                    negative += value;
                    negativeUnits += diff;
                } else if (diff > 0) {
                    positive += value;
                    positiveUnits += diff;
                }
            }
        });

        const totalItems = items.length;


        let status: LaboratoryStatus = 'pendiente';
        if (controlledCount === totalItems && totalItems > 0) status = 'controlado';
        else if (controlledCount > 0) status = 'por_controlar';

        const rawProgress = totalItems > 0 ? (controlledCount / totalItems) * 100 : 0;
        // Float with 1 decimal if small, or integer if large?
        // Let's use 1 decimal for better precision
        const progress = totalItems > 0 ? Number(rawProgress.toFixed(1)) : 0;

        return {
            negative,
            positive,
            net: negative + positive,
            progress,
            status,
            negativeUnits,
            positiveUnits,
            netUnits: negativeUnits + positiveUnits,
            totalSystemUnits
        };
    },

    // Get all inventories (aggregated or filtered by branch)
    getAllCyclicInventories: async (branchName?: string): Promise<CyclicInventoryStats[]> => {
        // Fetch inventories
        let query = supabase
            .from('inventories')
            .select(`
                branch_name,
                laboratory,
                quantity,
                system_quantity,
                status,
                products (
                    cost,
                    category
                )
            `)
            .in('status', ['pending', 'controlled', 'adjusted']); // Explicitly include all statuses

        if (branchName) {
            query = query.eq('branch_name', branchName);
        }

        const { data, error } = await query;

        if (error || !data) return [];

        // Group by LABORATORY (since we are already filtered by branch or just want all labs for this branch)
        // Note: The previous logic grouped by branch_name because branch_name WAS the lab name.
        // Now branch_name is the Store. So we group by 'laboratory'.

        const grouped: Record<string, CyclicItem[]> = {};

        data.forEach((row: any) => {
            const lab = row.laboratory || 'Desconocido';
            const cat = row.products?.category || 'Varios';
            // GROUP KEY: Lab Name + Category
            // This ensures logic splits "Abbott (Medicamentos)" from "Abbott (Perfumeria)"
            const groupKey = `${lab}|${cat}`;

            if (!grouped[groupKey]) grouped[groupKey] = [];

            grouped[groupKey].push({
                id: '',
                ean: '',
                name: row.products?.name || '',
                systemQuantity: row.system_quantity || 0,
                countedQuantity: row.quantity,
                cost: row.products?.cost || 0,
                status: row.status,
                category: cat
            });
        });

        const stats: CyclicInventoryStats[] = [];

        Object.entries(grouped).forEach(([key, items]) => {
            // Extract Name and Category from composite key
            // Format: "Name|Category"
            const [labName, category] = key.split('|');

            const calc = cyclicInventoryService.calculateStats(items);

            stats.push({
                labName,
                category,
                status: calc.status,
                totalItems: items.length,
                controlledItems: Math.round((calc.progress / 100) * items.length),
                progress: calc.progress,
                negativeValue: calc.negative,
                positiveValue: calc.positive,
                netValue: items.reduce((acc, i) => acc + (i.countedQuantity * i.cost), 0),
                differenceValue: calc.net,
                totalSystemUnits: calc.totalSystemUnits,
                negativeUnits: calc.negativeUnits,
                positiveUnits: calc.positiveUnits,
                netUnits: calc.netUnits
            });
        });

        return stats;
    },



    // Get summary for ALL branches (Admin View)
    getBranchesSummary: async (): Promise<any[]> => {
        const { data, error } = await supabase
            .from('inventories')
            .select(`
                branch_name,
                laboratory,
                quantity,
                system_quantity,
                status,
                products (
                     cost
                )
            `);

        if (error || !data) {
            console.error("Error fetching branches summary:", error);
            return [];
        }

        // --- NEW LOGIC: Fetch Goals from Supabase instead of Excel ---
        let labCounts: Record<string, number> = {};

        // Try fetching from Supabase first
        const { data: goalsData, error: goalsError } = await supabase
            .from('branch_goals')
            .select('branch_name, total_labs_goal');

        if (!goalsError && goalsData && goalsData.length > 0) {
            goalsData.forEach(g => {
                labCounts[g.branch_name] = g.total_labs_goal;
            });
        } else {
            console.warn("No goals found in Supabase, falling back to Excel or 0.");
            // Fallback to Excel if DB is empty (Migration phase)
            labCounts = await getAllBranchLabCounts();
        }

        // Initialize with ALL valid branches to ensure they appear
        const groupedByBranch: Record<string, {
            totalSystemUnits: number;
            netUnits: number;
            netValue: number;
            controlledLabs: Set<string>;
            totalLabsInDB: Set<string>;
        }> = {};

        BRANCH_NAMES.forEach(name => {
            groupedByBranch[name] = {
                totalSystemUnits: 0,
                netUnits: 0,
                netValue: 0,
                controlledLabs: new Set(),
                totalLabsInDB: new Set()
            };
        });

        data.forEach((row: any) => {
            const rawBranch = (row.branch_name || '').trim();
            if (!rawBranch) return;

            // Find valid branch name case-insensitive
            const validName = BRANCH_NAMES.find(b => b.toLowerCase() === rawBranch.toLowerCase());

            // Only aggregate if it matches a valid branch
            if (validName) {
                const group = groupedByBranch[validName];
                const labName = row.laboratory || 'Unknown';

                // **FIX: Only count adjusted or controlled items**
                const isAdjustedOrControlled = row.status === 'adjusted' || row.status === 'controlled';

                // Units and Values logic (Sum of items)
                const quantity = row.quantity || 0;
                const sysQuantity = row.system_quantity || 0;
                const cost = row.products?.cost || 0;

                // Only add to totals if item has been adjusted/controlled
                if (isAdjustedOrControlled) {
                    group.totalSystemUnits += sysQuantity;
                    group.netUnits += (quantity - sysQuantity);
                    group.netValue += (quantity - sysQuantity) * cost;
                }

                // Lab Stats - count all labs that have ANY items
                group.totalLabsInDB.add(labName);

                // Only count lab as controlled if ALL its items are controlled/adjusted
                // We'll handle this differently - track controlled status per lab
                if (row.status === 'controlled' || row.status === 'adjusted') {
                    group.controlledLabs.add(labName);
                }
            }
        });

        const summaries = BRANCH_NAMES.map(branchName => {
            const group = groupedByBranch[branchName];
            // If goal is missing in DB (0), try Excel map, else 0.
            const totalLabsGoal = labCounts[branchName] || 0;
            const controlledCount = group.controlledLabs.size;

            const rawProgress = totalLabsGoal > 0 ? (controlledCount / totalLabsGoal) * 100 : 0;
            const progress = totalLabsGoal > 0 ? Number(rawProgress.toFixed(1)) : 0;

            // Status logic based on Labs
            let status = 'pendiente';
            if (controlledCount >= totalLabsGoal && totalLabsGoal > 0) status = 'controlado';
            else if (controlledCount > 0) status = 'por_controlar';

            return {
                branchName,
                deploymentDate: '01/12/2025',
                cyclicRound: 1,
                monthlyGoal: totalLabsGoal, // Goal is Total Labs from Excel/DB
                elapsedDays: 12,
                progress: progress,
                inventoryUnits: group.totalSystemUnits,
                differenceUnits: group.netUnits,
                adjustmentsValue: group.netValue,
                status: status
            };
        });

        return summaries.sort((a, b) => b.progress - a.progress);
    },



    // Configuration System
    getBranchConfig: async (branchName: string): Promise<{ days: number, startDate: string | null }> => {
        const { data } = await supabase
            .from('inventories')
            .select('ean, quantity')
            .eq('branch_name', branchName)
            .eq('laboratory', '_CONFIG_');

        if (!data || (data as any).length === 0) return { days: 0, startDate: null };

        const configData = data as any[];
        const daysRecord = configData.find(r => r.ean === 'CONFIG_DAYS');
        const startDateRecord = configData.find(r => r.ean === 'CONFIG_START_DATE');

        // If it's the old format (only one record with ean 'CONFIG_DAYS' or generic)
        const days = daysRecord ? daysRecord.quantity : (configData[0]?.ean === 'CONFIG_DAYS' ? configData[0].quantity : 0);

        let startDate = null;
        if (startDateRecord && startDateRecord.quantity) {
            // Convert back to ms (stored as seconds to fit in 32-bit integer)
            startDate = new Date(startDateRecord.quantity * 1000).toISOString();
        }

        return { days, startDate };
    },

    saveBranchConfig: async (branchName: string, days: number, startDate?: string): Promise<void> => {
        const cleanBranch = branchName.trim();
        try {
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            // 1. Delete previous config records for this branch
            const { error: deleteError } = await supabase.from('inventories')
                .delete()
                .eq('branch_name', cleanBranch)
                .eq('laboratory', '_CONFIG_');

            if (deleteError) {
                console.error("Error deleting old config:", deleteError);
            }

            // 2. Prepare new records
            const insertData = [
                {
                    laboratory: '_CONFIG_',
                    branch_name: cleanBranch,
                    ean: 'CONFIG_DAYS',
                    quantity: days,
                    system_quantity: 0,
                    status: 'pending' as const
                }
            ];

            if (startDate) {
                // Store as seconds to fit in Postgres integer column (32-bit)
                const seconds = Math.floor(new Date(startDate).getTime() / 1000);
                insertData.push({
                    laboratory: '_CONFIG_',
                    branch_name: cleanBranch,
                    ean: 'CONFIG_START_DATE',
                    quantity: seconds,
                    system_quantity: 0,
                    status: 'pending' as const
                });
            }

            // 3. Insert and check for error
            const { error } = await supabase.from('inventories').insert(insertData);
            if (error) throw error;
        } catch (e) {
            console.error("Error saving branch config:", e);
            throw e;
        }
    },

    // History System
    saveAdjustmentHistory: async (
        branchName: string,
        labName: string,
        data: {
            adjustment_id_shortage: string;
            adjustment_id_surplus: string;
            shortage_value: number;
            surplus_value: number;
            total_units_adjusted: number;
            user_name?: string;
            user_id?: string; // New param
            // Optional: Pass full items snapshot if available
            items_snapshot?: CyclicItem[];
            category?: string;
        }
    ): Promise<void> => {
        try {
            // 1. Save to legacy adjustment table (for backward compat or simple history)
            const { error: error1 } = await supabase.from('inventory_adjustments').insert({
                branch_name: branchName,
                laboratory: labName,
                category: data.category || null, // NEW: Save Category
                adjustment_id_shortage: data.adjustment_id_shortage,
                adjustment_id_surplus: data.adjustment_id_surplus,
                shortage_value: data.shortage_value,
                surplus_value: data.surplus_value,
                total_units_adjusted: data.total_units_adjusted,
                user_name: data.user_name || 'Desconocido'
            } as any); // cast as any in case Typescript Definitions aren't updated in IDE yet

            if (error1) throw error1;

            // 2. Save to NEW Full Report Table (Immutable Snapshot)
            if (data.items_snapshot) {
                const financialSummary = {
                    net_value: data.adjustment_id_surplus ? data.surplus_value : -data.shortage_value, // Simplification
                    shortage_value: data.shortage_value,
                    surplus_value: data.surplus_value,
                    adjustment_ids: {
                        shortage: data.adjustment_id_shortage,
                        surplus: data.adjustment_id_surplus
                    }
                };

                const { error: error2 } = await supabase.from('inventory_reports').insert({
                    branch_name: branchName,
                    laboratory: labName,
                    category: data.category || null, // NEW: Save Category here too if column exists, otherwise it might be in snapshot_data
                    snapshot_data: data.items_snapshot, // Guarda todo el JSON
                    financial_summary: financialSummary,
                    user_name: data.user_name || 'Desconocido'
                } as any);

                if (error2) console.error("Error saving advanced report snapshot:", error2);
            }

            // 3. Audit Log
            try {
                await import('./auditService').then(({ auditService }) => {
                    auditService.logAction({
                        action: 'INVENTORY_ADJUSTMENT',
                        entityType: 'INVENTORY',
                        branchId: branchName,
                        userId: data.user_id, // Pass explicit ID
                        details: {
                            lab: labName,
                            netValue: data.surplus_value - data.shortage_value,
                            unitsAdjusted: data.total_units_adjusted
                        }
                    });
                });
            } catch (ignore) { }

        } catch (e) {
            console.error("Error saving history:", e);
            throw e;
        }
    },

    getAdjustmentHistory: async (branchName: string, labName: string): Promise<any[]> => {
        const { data, error } = await supabase
            .from('inventory_adjustments')
            .select('*')
            .eq('branch_name', branchName)
            .eq('laboratory', labName)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching history:", error);
            return [];
        }
        return data;
    },

    // Closure System (Snapshots for UI Visualization)
    saveCycleClosure: async (branchName: string, period: number, categories: { name: string, percentage: number }[]): Promise<void> => {
        try {
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            const insertData = categories.map(cat => ({
                laboratory: '_CONFIG_',
                branch_name: branchName,
                ean: `CLOSURE_${period}_${cat.name.toUpperCase()}`,
                quantity: Math.round(cat.percentage),
                system_quantity: 0,
                status: 'pending' as const
            }));

            // Delete previous closures for this period and branch to avoid duplicates
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', branchName)
                .eq('laboratory', '_CONFIG_')
                .ilike('ean', `CLOSURE_${period}_%`);

            const { error } = await supabase.from('inventories').insert(insertData);
            if (error) throw error;

            // Audit
            try {
                await import('./auditService').then(({ auditService }) => {
                    auditService.logAction({
                        action: 'CYCLE_CLOSURE',
                        entityType: 'SYSTEM',
                        branchId: branchName,
                        details: { period, categories }
                    });
                });
            } catch (ignore) { }

        } catch (e) {
            console.error(`Error saving closure for period ${period}:`, e);
            throw e;
        }
    },

    getCycleClosures: async (branchName: string, period: number = 1): Promise<Record<string, number>> => {
        const { data, error } = await supabase
            .from('inventories')
            .select('ean, quantity')
            .eq('branch_name', branchName)
            .eq('laboratory', '_CONFIG_')
            .ilike('ean', `CLOSURE_${period}_%`);

        if (error || !data) return {};

        const result: Record<string, number> = {};
        data.forEach((row: any) => {
            const catName = row.ean.replace(`CLOSURE_${period}_`, '');
            result[catName] = row.quantity;
        });
        return result;
    },

    // Migration Tool
    migrateGoalsFromExcel: async (): Promise<void> => {
        try {
            console.log("Starting migration...");
            const counts = await getAllBranchLabCounts();
            const updates = Object.entries(counts).map(([branch, count]) => ({
                branch_name: branch,
                total_labs_goal: count,
                updated_at: new Date().toISOString()
            }));

            if (updates.length > 0) {
                // @ts-ignore
                const { error } = await supabase.from('branch_goals').upsert(updates, { onConflict: 'branch_name' });
                if (error) throw error;
                console.log(`Migrated ${updates.length} branch goals to Supabase.`);
            }
        } catch (error) {
            console.error("Migration failed:", error);
            throw error;
        }
    }
};
